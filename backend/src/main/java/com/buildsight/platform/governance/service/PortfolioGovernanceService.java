package com.buildsight.platform.governance.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.api.GovernanceModels.PortfolioGovernanceProjectResponse;
import com.buildsight.platform.governance.api.GovernanceModels.PortfolioGovernanceResponse;
import com.buildsight.platform.governance.domain.GovernanceRiskLevel;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioGovernanceService {

    private final ProjectRepository
            projectRepository;

    private final GovernanceControlService
            governanceControlService;

    private final Clock
            clock;

    public PortfolioGovernanceService(
            ProjectRepository projectRepository,
            GovernanceControlService governanceControlService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.governanceControlService =
                governanceControlService;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PortfolioGovernanceResponse get() {

        List<PortfolioGovernanceProjectResponse> projects =
                projectRepository
                        .findAll()
                        .stream()
                        .map(
                                this::project)
                        .sorted(
                                Comparator.comparingDouble(
                                                PortfolioGovernanceProjectResponse::governanceScore)
                                        .thenComparing(
                                                PortfolioGovernanceProjectResponse::projectCode))
                        .toList();

        long onTrack =
                projects.stream()
                        .filter(
                                project ->
                                        project.governanceRisk()
                                                == GovernanceRiskLevel.ON_TRACK)
                        .count();

        long watch =
                projects.stream()
                        .filter(
                                project ->
                                        project.governanceRisk()
                                                == GovernanceRiskLevel.WATCH)
                        .count();

        long atRisk =
                projects.stream()
                        .filter(
                                project ->
                                        project.governanceRisk()
                                                == GovernanceRiskLevel.AT_RISK)
                        .count();

        double averageScore =
                projects.stream()
                        .mapToDouble(
                                PortfolioGovernanceProjectResponse::governanceScore)
                        .average()
                        .orElse(
                                75);

        return new PortfolioGovernanceResponse(
                LocalDate.now(
                        clock),

                projects.size(),
                onTrack,
                watch,
                atRisk,

                sum(
                        projects,
                        Metric.OPEN_ACTIONS),

                sum(
                        projects,
                        Metric.OVERDUE_ACTIONS),

                sum(
                        projects,
                        Metric.CRITICAL_ACTIONS),

                sum(
                        projects,
                        Metric.BLOCKED_ACTIONS),

                sum(
                        projects,
                        Metric.PENDING_DECISIONS),

                sum(
                        projects,
                        Metric.OVERDUE_DECISIONS),

                sum(
                        projects,
                        Metric.MISSING_MINUTES),

                roundOne(
                        averageScore),

                projects);
    }

    private PortfolioGovernanceProjectResponse project(
            Project project) {

        GovernanceIntelligenceResponse governance =
                governanceControlService
                        .intelligence(
                                project.getId());

        return new PortfolioGovernanceProjectResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                governance.governanceScore(),
                governance.governanceRisk(),
                governance.openActions(),
                governance.overdueActions(),
                governance.criticalOpenActions(),
                governance.blockedActions(),
                governance.pendingDecisions(),
                governance.overdueDecisions(),
                governance.meetingsWithoutMinutes());
    }

    private long sum(
            List<PortfolioGovernanceProjectResponse> projects,
            Metric metric) {

        return projects.stream()
                .mapToLong(
                        project ->
                                switch (metric) {

                                    case OPEN_ACTIONS ->
                                            project.openActions();

                                    case OVERDUE_ACTIONS ->
                                            project.overdueActions();

                                    case CRITICAL_ACTIONS ->
                                            project.criticalOpenActions();

                                    case BLOCKED_ACTIONS ->
                                            project.blockedActions();

                                    case PENDING_DECISIONS ->
                                            project.pendingDecisions();

                                    case OVERDUE_DECISIONS ->
                                            project.overdueDecisions();

                                    case MISSING_MINUTES ->
                                            project.meetingsWithoutMinutes();
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
        OPEN_ACTIONS,
        OVERDUE_ACTIONS,
        CRITICAL_ACTIONS,
        BLOCKED_ACTIONS,
        PENDING_DECISIONS,
        OVERDUE_DECISIONS,
        MISSING_MINUTES
    }
}
