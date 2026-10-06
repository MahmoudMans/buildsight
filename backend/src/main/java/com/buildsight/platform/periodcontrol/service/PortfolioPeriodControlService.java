package com.buildsight.platform.periodcontrol.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodControlIntelligenceResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PortfolioPeriodControlProjectResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PortfolioPeriodControlResponse;
import com.buildsight.platform.periodcontrol.domain.PeriodControlRiskLevel;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioPeriodControlService {

    private final ProjectRepository
            projectRepository;

    private final PeriodControlService
            periodControlService;

    private final Clock
            clock;

    public PortfolioPeriodControlService(
            ProjectRepository projectRepository,
            PeriodControlService periodControlService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.periodControlService =
                periodControlService;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PortfolioPeriodControlResponse get() {

        List<PortfolioPeriodControlProjectResponse> projects =
                projectRepository
                        .findAll()
                        .stream()
                        .map(
                                this::project)
                        .sorted(
                                Comparator
                                        .comparingDouble(
                                                PortfolioPeriodControlProjectResponse::periodControlScore)
                                        .thenComparing(
                                                PortfolioPeriodControlProjectResponse::projectCode))
                        .toList();

        long withBaseline =
                projects.stream()
                        .filter(
                                project ->
                                        project.activeBaselineVersionCode()
                                                != null)
                        .count();

        long withOpenPeriod =
                projects.stream()
                        .filter(
                                project ->
                                        project.openPeriodCode()
                                                != null)
                        .count();

        long onTrack =
                projects.stream()
                        .filter(
                                project ->
                                        project.periodControlRisk()
                                                == PeriodControlRiskLevel.ON_TRACK)
                        .count();

        long watch =
                projects.stream()
                        .filter(
                                project ->
                                        project.periodControlRisk()
                                                == PeriodControlRiskLevel.WATCH)
                        .count();

        long atRisk =
                projects.stream()
                        .filter(
                                project ->
                                        project.periodControlRisk()
                                                == PeriodControlRiskLevel.AT_RISK)
                        .count();

        BigDecimal totalCostVariance =
                projects.stream()
                        .map(
                                PortfolioPeriodControlProjectResponse::costVarianceToBaseline)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        long totalFinishVariance =
                projects.stream()
                        .mapToLong(
                                PortfolioPeriodControlProjectResponse::finishVarianceDays)
                        .sum();

        double average =
                projects.stream()
                        .mapToDouble(
                                PortfolioPeriodControlProjectResponse::periodControlScore)
                        .average()
                        .orElse(
                                75);

        return new PortfolioPeriodControlResponse(
                LocalDate.now(
                        clock),

                projects.size(),
                withBaseline,
                withOpenPeriod,

                onTrack,
                watch,
                atRisk,

                totalCostVariance,

                totalFinishVariance,

                roundOne(
                        average),

                projects);
    }

    private PortfolioPeriodControlProjectResponse project(
            Project project) {

        PeriodControlIntelligenceResponse intelligence =
                periodControlService
                        .intelligence(
                                project.getId());

        return new PortfolioPeriodControlProjectResponse(
                project.getId(),
                project.getCode(),
                project.getName(),

                intelligence.activeBaselineVersionCode(),

                intelligence.openPeriodCode(),
                intelligence.latestClosedPeriodCode(),

                intelligence.baselineCostTarget(),
                intelligence.currentExpectedForecastCost(),

                intelligence.costVarianceToBaseline(),
                intelligence.finishVarianceDays(),

                intelligence.plannedProgressPercentage(),
                intelligence.earnedProgressPercentage(),

                intelligence.costPerformanceIndex(),
                intelligence.schedulePerformanceIndex(),

                intelligence.periodControlScore(),
                intelligence.periodControlRisk());
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10)
                / 10.0;
    }
}
