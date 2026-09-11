package com.buildsight.platform.forecast.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ForecastTrend;
import com.buildsight.platform.forecast.domain.ProjectEvmSnapshot;
import com.buildsight.platform.forecast.repository.ProjectEvmSnapshotRepository;
import com.buildsight.platform.forecast.service.EarnedValueCalculator.EarnedValueResult;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleIntelligenceResponse;
import com.buildsight.platform.schedule.service.ScheduleControlService;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ForecastIntelligenceService {

    private static final String ACTUAL_COST_SQL =
            """
            SELECT COALESCE(
                SUM(
                    COALESCE(
                        "amount",
                        0
                    )
                ),
                0
            )
            FROM "project_actual_costs"
            WHERE project_id = :projectId
            """;

    private final ProjectRepository
            projectRepository;

    private final ProjectEvmSnapshotRepository
            snapshotRepository;

    private final ScheduleControlService
            scheduleControlService;

    private final EarnedValueCalculator
            earnedValueCalculator;

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    private final Clock
            clock;

    public ForecastIntelligenceService(
            ProjectRepository projectRepository,
            ProjectEvmSnapshotRepository snapshotRepository,
            ScheduleControlService scheduleControlService,
            EarnedValueCalculator earnedValueCalculator,
            NamedParameterJdbcTemplate jdbcTemplate,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.snapshotRepository =
                snapshotRepository;

        this.scheduleControlService =
                scheduleControlService;

        this.earnedValueCalculator =
                earnedValueCalculator;

        this.jdbcTemplate =
                jdbcTemplate;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ForecastIntelligenceResponse calculate(
            UUID projectId) {

        Project project =
                projectRepository
                        .findById(
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Project '%s' was not found."
                                                        .formatted(
                                                                projectId)));

        LocalDate today =
                LocalDate.now(
                        clock);

        double plannedProgress =
                plannedProgressPercentage(
                        project,
                        today);

        double earnedProgress =
                project.getPhysicalProgressPercentage()
                        .doubleValue();

        BigDecimal actualCost =
                readActualCost(
                        projectId);

        EarnedValueResult evm =
                earnedValueCalculator.calculate(
                        project.getApprovedBudget(),
                        plannedProgress,
                        earnedProgress,
                        actualCost);

        ScheduleIntelligenceResponse schedule =
                scheduleControlService
                        .intelligence(
                                projectId);

        LocalDate expectedFinish =
                schedule.cpmForecastFinishDate();

        if (expectedFinish == null) {

            expectedFinish =
                    project.getForecastEndDate();
        }

        long scheduleVarianceDays =
                schedule.projectFinishVarianceDays();

        ForecastEnvelope envelope =
                envelope(
                        project,
                        today,
                        evm,
                        expectedFinish,
                        scheduleVarianceDays);

        Optional<ProjectEvmSnapshot> latest =
                snapshotRepository
                        .findFirstByProjectIdOrderByDataDateDesc(
                                projectId);

        ForecastTrend trend =
                trend(
                        evm,
                        latest);

        double score =
                predictiveScore(
                        evm,
                        scheduleVarianceDays,
                        trend);

        ForecastRiskLevel risk =
                score >= 80
                        ? ForecastRiskLevel.ON_TRACK
                        : score >= 60
                                ? ForecastRiskLevel.WATCH
                                : ForecastRiskLevel.AT_RISK;

        long snapshotCount =
                snapshotRepository
                        .countByProjectId(
                                projectId);

        return new ForecastIntelligenceResponse(
                today,

                evm.bac(),
                evm.plannedValue(),
                evm.earnedValue(),
                evm.actualCost(),

                evm.costVariance(),
                evm.scheduleVariance(),

                evm.cpi(),
                evm.spi(),

                evm.estimateAtCompletion(),
                evm.estimateToComplete(),
                evm.varianceAtCompletion(),
                evm.tcpi(),

                roundTwo(
                        plannedProgress),
                roundTwo(
                        earnedProgress),

                envelope.lowerCost(),
                envelope.expectedCost(),
                envelope.upperCost(),

                envelope.earliestFinish(),
                envelope.expectedFinish(),
                envelope.latestFinish(),

                scheduleVarianceDays,

                roundOne(
                        score),
                risk,
                trend,

                snapshotCount,

                latest.map(
                                ProjectEvmSnapshot::getDataDate)
                        .orElse(null),

                "Predictive Project Controls combine earned-value performance, the existing actual-cost ledger, physical progress, CPM forecast completion, historical EVM snapshots and scenario assumptions. Forecast ranges are deterministic uncertainty envelopes, not statistical confidence intervals.");
    }

    private BigDecimal readActualCost(
            UUID projectId) {

        BigDecimal value =
                jdbcTemplate.queryForObject(
                        ACTUAL_COST_SQL,

                        new MapSqlParameterSource()
                                .addValue(
                                        "projectId",
                                        projectId),

                        BigDecimal.class);

        if (value == null) {
            return BigDecimal.ZERO.setScale(2);
        }

        return value.max(
                        BigDecimal.ZERO)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);
    }

    private double plannedProgressPercentage(
            Project project,
            LocalDate today) {

        LocalDate start =
                project.getPlannedStartDate();

        LocalDate finish =
                project.getPlannedEndDate();

        if (!today.isAfter(start)) {
            return 0;
        }

        if (!today.isBefore(finish)) {
            return 100;
        }

        long total =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                start,
                                finish));

        long elapsed =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                start,
                                today));

        return Math.max(
                0,
                Math.min(
                        100,
                        (
                                elapsed
                                * 100.0
                                / total)));
    }

    private ForecastEnvelope envelope(
            Project project,
            LocalDate today,
            EarnedValueResult evm,
            LocalDate expectedFinish,
            long scheduleVarianceDays) {

        BigDecimal expectedCost =
                evm.estimateAtCompletion();

        double costVarianceRatio =
                evm.bac().signum() == 0
                        ? 0
                        : evm.varianceAtCompletion()
                                .abs()
                                .divide(
                                        evm.bac(),
                                        8,
                                        RoundingMode.HALF_UP)
                                .doubleValue();

        long totalPlanDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                project.getPlannedStartDate(),
                                project.getPlannedEndDate()));

        double delayRatio =
                Math.max(
                        0,
                        scheduleVarianceDays)
                        / (double) totalPlanDays;

        double uncertainty =
                clamp(
                        0.05
                                + Math.min(
                                        0.15,
                                        costVarianceRatio
                                                * 0.50)
                                + Math.min(
                                        0.10,
                                        delayRatio
                                                * 0.50),
                        0.05,
                        0.25);

        BigDecimal lower =
                money(
                        expectedCost.multiply(
                                BigDecimal.valueOf(
                                        1
                                                - uncertainty
                                                * 0.60)));

        lower =
                lower.max(
                        evm.actualCost());

        BigDecimal upper =
                money(
                        expectedCost.multiply(
                                BigDecimal.valueOf(
                                        1
                                                + uncertainty)));

        long remainingDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                today,
                                expectedFinish));

        long spread =
                Math.max(
                        3,
                        Math.min(
                                45,
                                Math.round(
                                        remainingDays
                                                * uncertainty
                                                * 0.50)
                                        + Math.max(
                                                0,
                                                scheduleVarianceDays
                                                        / 4)));

        LocalDate earliest =
                expectedFinish.minusDays(
                        Math.max(
                                1,
                                spread / 2));

        if (earliest.isBefore(today)) {

            earliest =
                    today;
        }

        LocalDate latest =
                expectedFinish.plusDays(
                        spread);

        return new ForecastEnvelope(
                lower,
                expectedCost,
                upper,
                earliest,
                expectedFinish,
                latest);
    }

    private ForecastTrend trend(
            EarnedValueResult current,
            Optional<ProjectEvmSnapshot> latestSnapshot) {

        if (latestSnapshot.isEmpty()) {

            return ForecastTrend.NO_HISTORY;
        }

        ProjectEvmSnapshot previous =
                latestSnapshot.get();

        double cpiDelta =
                current.cpi()
                        .subtract(
                                previous.getCpi())
                        .doubleValue();

        double spiDelta =
                current.spi()
                        .subtract(
                                previous.getSpi())
                        .doubleValue();

        double eacDeltaRatio =
                previous.getEstimateAtCompletion()
                                .signum()
                        == 0
                        ? 0
                        : current.estimateAtCompletion()
                                .subtract(
                                        previous.getEstimateAtCompletion())
                                .divide(
                                        previous.getEstimateAtCompletion(),
                                        8,
                                        RoundingMode.HALF_UP)
                                .doubleValue();

        boolean improving =
                (
                        cpiDelta >= 0.03
                        || spiDelta >= 0.03)
                        && eacDeltaRatio <= 0.02;

        boolean deteriorating =
                (
                        cpiDelta <= -0.03
                        || spiDelta <= -0.03)
                        || eacDeltaRatio >= 0.03;

        if (deteriorating) {

            return ForecastTrend.DETERIORATING;
        }

        if (improving) {

            return ForecastTrend.IMPROVING;
        }

        return ForecastTrend.STABLE;
    }

    private double predictiveScore(
            EarnedValueResult evm,
            long scheduleVarianceDays,
            ForecastTrend trend) {

        double score =
                100;

        double cpi =
                evm.cpi()
                        .doubleValue();

        double spi =
                evm.spi()
                        .doubleValue();

        if (cpi < 1) {

            score -=
                    Math.min(
                            30,
                            (
                                    1
                                    - cpi)
                                    * 75);
        }

        if (spi < 1) {

            score -=
                    Math.min(
                            25,
                            (
                                    1
                                    - spi)
                                    * 65);
        }

        if (evm.bac().signum() > 0
                && evm.varianceAtCompletion()
                        .signum()
                        < 0) {

            double overrunRatio =
                    evm.varianceAtCompletion()
                            .abs()
                            .divide(
                                    evm.bac(),
                                    8,
                                    RoundingMode.HALF_UP)
                            .doubleValue();

            score -=
                    Math.min(
                            25,
                            overrunRatio
                                    * 100);
        }

        if (scheduleVarianceDays > 0) {

            score -=
                    Math.min(
                            20,
                            scheduleVarianceDays
                                    * 0.75);
        }

        if (trend
                == ForecastTrend.DETERIORATING) {

            score -=
                    12;
        }

        if (trend
                == ForecastTrend.IMPROVING) {

            score +=
                    3;
        }

        return clamp(
                score,
                0,
                100);
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100.0)
                / 100.0;
    }

    private double clamp(
            double value,
            double minimum,
            double maximum) {

        return Math.max(
                minimum,
                Math.min(
                        maximum,
                        value));
    }

    private record ForecastEnvelope(
            BigDecimal lowerCost,
            BigDecimal expectedCost,
            BigDecimal upperCost,
            LocalDate earliestFinish,
            LocalDate expectedFinish,
            LocalDate latestFinish) {
    }
}
