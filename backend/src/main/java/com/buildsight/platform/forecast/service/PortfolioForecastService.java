package com.buildsight.platform.forecast.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.api.ForecastModels.PortfolioForecastProjectResponse;
import com.buildsight.platform.forecast.api.ForecastModels.PortfolioForecastResponse;
import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ForecastTrend;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioForecastService {

    private final ProjectRepository
            projectRepository;

    private final ForecastIntelligenceService
            forecastIntelligenceService;

    private final Clock
            clock;

    public PortfolioForecastService(
            ProjectRepository projectRepository,
            ForecastIntelligenceService forecastIntelligenceService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.forecastIntelligenceService =
                forecastIntelligenceService;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PortfolioForecastResponse get() {

        List<PortfolioForecastProjectResponse> projects =
                projectRepository
                        .findAll()
                        .stream()
                        .map(
                                this::project)
                        .sorted(
                                Comparator.comparingDouble(
                                                PortfolioForecastProjectResponse::predictiveScore)
                                        .thenComparing(
                                                PortfolioForecastProjectResponse::projectCode))
                        .toList();

        BigDecimal bac =
                sum(
                        projects,
                        Metric.BAC);

        BigDecimal pv =
                sum(
                        projects,
                        Metric.PV);

        BigDecimal ev =
                sum(
                        projects,
                        Metric.EV);

        BigDecimal ac =
                sum(
                        projects,
                        Metric.AC);

        BigDecimal forecast =
                sum(
                        projects,
                        Metric.FORECAST);

        BigDecimal vac =
                bac.subtract(
                                forecast)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        BigDecimal weightedCpi =
                ratio(
                        ev,
                        ac);

        BigDecimal weightedSpi =
                ratio(
                        ev,
                        pv);

        long onTrack =
                projects.stream()
                        .filter(
                                project ->
                                        project.predictiveRisk()
                                                == ForecastRiskLevel.ON_TRACK)
                        .count();

        long watch =
                projects.stream()
                        .filter(
                                project ->
                                        project.predictiveRisk()
                                                == ForecastRiskLevel.WATCH)
                        .count();

        long atRisk =
                projects.stream()
                        .filter(
                                project ->
                                        project.predictiveRisk()
                                                == ForecastRiskLevel.AT_RISK)
                        .count();

        long deteriorating =
                projects.stream()
                        .filter(
                                project ->
                                        project.trend()
                                                == ForecastTrend.DETERIORATING)
                        .count();

        return new PortfolioForecastResponse(
                LocalDate.now(
                        clock),
                projects.size(),
                onTrack,
                watch,
                atRisk,
                deteriorating,
                bac,
                pv,
                ev,
                ac,
                forecast,
                vac,
                weightedCpi,
                weightedSpi,
                projects);
    }

    private PortfolioForecastProjectResponse project(
            Project project) {

        ForecastIntelligenceResponse forecast =
                forecastIntelligenceService
                        .calculate(
                                project.getId());

        return new PortfolioForecastProjectResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                forecast.bac(),
                forecast.plannedValue(),
                forecast.earnedValue(),
                forecast.actualCost(),
                forecast.expectedForecastCost(),
                forecast.varianceAtCompletion(),
                forecast.cpi(),
                forecast.spi(),
                forecast.expectedForecastFinishDate(),
                forecast.scheduleVarianceDays(),
                forecast.predictiveScore(),
                forecast.predictiveRisk(),
                forecast.trend());
    }

    private BigDecimal sum(
            List<PortfolioForecastProjectResponse> projects,
            Metric metric) {

        return projects.stream()
                .map(
                        project ->
                                switch (metric) {

                                    case BAC ->
                                            project.bac();

                                    case PV ->
                                            project.plannedValue();

                                    case EV ->
                                            project.earnedValue();

                                    case AC ->
                                            project.actualCost();

                                    case FORECAST ->
                                            project.expectedForecastCost();
                                })
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);
    }

    private BigDecimal ratio(
            BigDecimal numerator,
            BigDecimal denominator) {

        if (denominator.signum() == 0) {

            if (numerator.signum() == 0) {

                return BigDecimal.ONE
                        .setScale(
                                4,
                                RoundingMode.HALF_UP);
            }

            return BigDecimal.ZERO
                    .setScale(
                            4,
                            RoundingMode.HALF_UP);
        }

        return numerator.divide(
                denominator,
                4,
                RoundingMode.HALF_UP);
    }

    private enum Metric {
        BAC,
        PV,
        EV,
        AC,
        FORECAST
    }
}
