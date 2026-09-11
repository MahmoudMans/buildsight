package com.buildsight.platform.recovery.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactIntelligenceResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.PortfolioRecoveryProjectResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.PortfolioRecoveryResponse;
import com.buildsight.platform.recovery.domain.RecoveryRiskLevel;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioRecoveryService {

    private final ProjectRepository
            projectRepository;

    private final ChangeImpactControlService
            changeImpactControlService;

    private final Clock
            clock;

    public PortfolioRecoveryService(
            ProjectRepository projectRepository,
            ChangeImpactControlService changeImpactControlService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.changeImpactControlService =
                changeImpactControlService;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PortfolioRecoveryResponse get() {

        List<PortfolioRecoveryProjectResponse> projects =
                projectRepository
                        .findAll()
                        .stream()
                        .map(
                                this::project)
                        .sorted(
                                Comparator.comparingDouble(
                                                PortfolioRecoveryProjectResponse::recoveryScore)
                                        .thenComparing(
                                                PortfolioRecoveryProjectResponse::projectCode))
                        .toList();

        long active =
                projects.stream()
                        .filter(
                                project ->
                                        project.activeSimulationNumber()
                                                != null)
                        .count();

        long onTrack =
                projects.stream()
                        .filter(
                                project ->
                                        project.recoveryRisk()
                                                == RecoveryRiskLevel.ON_TRACK)
                        .count();

        long watch =
                projects.stream()
                        .filter(
                                project ->
                                        project.recoveryRisk()
                                                == RecoveryRiskLevel.WATCH)
                        .count();

        long atRisk =
                projects.stream()
                        .filter(
                                project ->
                                        project.recoveryRisk()
                                                == RecoveryRiskLevel.AT_RISK)
                        .count();

        double average =
                projects.stream()
                        .mapToDouble(
                                PortfolioRecoveryProjectResponse::recoveryScore)
                        .average()
                        .orElse(
                                75);

        return new PortfolioRecoveryResponse(
                LocalDate.now(
                        clock),

                projects.size(),
                active,

                onTrack,
                watch,
                atRisk,

                moneySum(
                        projects,
                        Metric.CHANGE_COST),

                longSum(
                        projects,
                        Metric.SCHEDULE_IMPACT),

                moneySum(
                        projects,
                        Metric.RECOVERY_COST),

                longSum(
                        projects,
                        Metric.RECOVERABLE_DAYS),

                longSum(
                        projects,
                        Metric.RESIDUAL_DELAY),

                roundOne(
                        average),

                projects);
    }

    private PortfolioRecoveryProjectResponse project(
            Project project) {

        ChangeImpactIntelligenceResponse intelligence =
                changeImpactControlService
                        .intelligence(
                                project.getId());

        return new PortfolioRecoveryProjectResponse(
                project.getId(),
                project.getCode(),
                project.getName(),

                intelligence.simulationCount(),

                intelligence.activeSimulationNumber(),

                intelligence.changeCostExposure(),

                intelligence.scheduleImpactDays(),

                intelligence.recommendedRecoveryOptionNumber(),

                intelligence.recoveryCost(),

                intelligence.recoverableDays(),
                intelligence.residualDelayDays(),

                intelligence.recoveryScore(),
                intelligence.recoveryRisk());
    }

    private BigDecimal moneySum(
            List<PortfolioRecoveryProjectResponse> projects,
            Metric metric) {

        return projects.stream()
                .map(
                        project ->
                                switch (metric) {

                                    case CHANGE_COST ->
                                            project.changeCostExposure();

                                    case RECOVERY_COST ->
                                            project.recoveryCost();

                                    default ->
                                            BigDecimal.ZERO;
                                })
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);
    }

    private long longSum(
            List<PortfolioRecoveryProjectResponse> projects,
            Metric metric) {

        return projects.stream()
                .mapToLong(
                        project ->
                                switch (metric) {

                                    case SCHEDULE_IMPACT ->
                                            project.scheduleImpactDays();

                                    case RECOVERABLE_DAYS ->
                                            project.recoverableDays();

                                    case RESIDUAL_DELAY ->
                                            project.residualDelayDays();

                                    default ->
                                            0;
                                })
                .sum();
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }

    private enum Metric {
        CHANGE_COST,
        SCHEDULE_IMPACT,
        RECOVERY_COST,
        RECOVERABLE_DAYS,
        RESIDUAL_DELAY
    }
}
