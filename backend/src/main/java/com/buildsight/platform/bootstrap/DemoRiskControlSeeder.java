package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.risk.domain.ChangeEventStatus;
import com.buildsight.platform.risk.domain.DelayCause;
import com.buildsight.platform.risk.domain.DelayStatus;
import com.buildsight.platform.risk.domain.IssueSeverity;
import com.buildsight.platform.risk.domain.IssueStatus;
import com.buildsight.platform.risk.domain.ProjectChangeEvent;
import com.buildsight.platform.risk.domain.ProjectDelayEvent;
import com.buildsight.platform.risk.domain.ProjectIssue;
import com.buildsight.platform.risk.domain.ProjectRisk;
import com.buildsight.platform.risk.domain.RiskCategory;
import com.buildsight.platform.risk.domain.RiskStatus;
import com.buildsight.platform.risk.repository.ProjectChangeEventRepository;
import com.buildsight.platform.risk.repository.ProjectDelayEventRepository;
import com.buildsight.platform.risk.repository.ProjectIssueRepository;
import com.buildsight.platform.risk.repository.ProjectRiskRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(40)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoRiskControlSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectRiskRepository
            riskRepository;

    private final ProjectIssueRepository
            issueRepository;

    private final ProjectChangeEventRepository
            changeRepository;

    private final ProjectDelayEventRepository
            delayRepository;

    public DemoRiskControlSeeder(
            ProjectRepository projectRepository,
            ProjectRiskRepository riskRepository,
            ProjectIssueRepository issueRepository,
            ProjectChangeEventRepository changeRepository,
            ProjectDelayEventRepository delayRepository) {

        this.projectRepository =
                projectRepository;

        this.riskRepository =
                riskRepository;

        this.issueRepository =
                issueRepository;

        this.changeRepository =
                changeRepository;

        this.delayRepository =
                delayRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seedProject(
                    project);
        }
    }

    private void seedProject(
            Project project) {

        if (riskRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        boolean activeRisk =
                project.getCode()
                        .endsWith("001")
                        || stressed;

        ProjectRisk procurementRisk =
                ProjectRisk.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "RISK",
                                1),
                        "Long-lead package delivery risk",
                        "Late technical approvals or supplier lead times could affect downstream construction activities.",
                        RiskCategory.PROCUREMENT,
                        "Commercial Manager",
                        stressed ? 5 : 4,
                        stressed ? 5 : 4,
                        stressed ? 4 : 2,
                        stressed ? 5 : 4,
                        "Freeze technical scope, track vendor submittals weekly and maintain an alternative sourcing route.",
                        activeRisk
                                ? today.minusDays(
                                        stressed
                                                ? 12
                                                : 3)
                                : today.plusDays(20));

        procurementRisk.update(
                procurementRisk.getTitle(),
                procurementRisk.getDescription(),
                procurementRisk.getCategory(),
                procurementRisk.getOwnerName(),
                procurementRisk.getProbability(),
                procurementRisk.getImpact(),
                procurementRisk.getResidualProbability(),
                procurementRisk.getResidualImpact(),
                procurementRisk.getMitigationPlan(),
                procurementRisk.getMitigationDueDate(),
                activeRisk
                        ? RiskStatus.MITIGATING
                        : RiskStatus.OPEN);

        ProjectRisk commercialRisk =
                ProjectRisk.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "RISK",
                                2),
                        "Construction input price escalation",
                        "Material and specialist subcontract price movement may exceed current allowance.",
                        RiskCategory.COST,
                        "Project Commercial Lead",
                        4,
                        4,
                        2,
                        stressed ? 5 : 3,
                        "Lock high-value packages early and maintain live forecast-at-completion reviews.",
                        today.plusDays(28));

        riskRepository.saveAll(
                List.of(
                        procurementRisk,
                        commercialRisk));

        ProjectIssue issue =
                ProjectIssue.create(
                        UUID.randomUUID(),
                        project.getId(),
                        procurementRisk.getId(),
                        reference(
                                project,
                                "ISS",
                                1),
                        stressed
                                ? "Public-area design approval outstanding"
                                : "Technical submittal requires resolution",
                        "An active coordination item requires closure to protect the construction programme.",
                        stressed
                                ? IssueSeverity.CRITICAL
                                : IssueSeverity.MEDIUM,
                        "Design Manager",
                        stressed
                                ? today.minusDays(7)
                                : today.plusDays(10));

        if (!stressed) {
            issue.update(
                    procurementRisk.getId(),
                    issue.getTitle(),
                    issue.getDescription(),
                    issue.getSeverity(),
                    issue.getOwnerName(),
                    issue.getTargetResolutionDate(),
                    IssueStatus.IN_PROGRESS);
        }

        issueRepository.save(
                issue);

        ProjectChangeEvent change =
                ProjectChangeEvent.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "CHG",
                                1),
                        "Client requested scope enhancement",
                        "Requested enhancement affecting selected finishes and associated installation activities.",
                        "Client Representative",
                        today.minusDays(18),
                        project.getApprovedBudget()
                                .multiply(
                                        stressed
                                                ? new BigDecimal("0.035")
                                                : new BigDecimal("0.010")),
                        stressed ? 10 : 3);

        change.update(
                change.getTitle(),
                change.getDescription(),
                change.getOriginator(),
                change.getRequestedDate(),
                today.minusDays(6),
                change.getCostImpact(),
                change.getScheduleImpactDays(),
                stressed
                        ? ChangeEventStatus.UNDER_REVIEW
                        : ChangeEventStatus.APPROVED,
                today);

        changeRepository.save(
                change);

        if (activeRisk) {
            ProjectDelayEvent delay =
                    ProjectDelayEvent.create(
                            UUID.randomUUID(),
                            project.getId(),
                            reference(
                                    project,
                                    "DLY",
                                    1),
                            stressed
                                    ? "Design information delay"
                                    : "MEP coordination delay",
                            "A live delay event is being managed against the current project programme.",
                            stressed
                                    ? DelayCause.DESIGN
                                    : DelayCause.PROCUREMENT,
                            "Planning Manager",
                            today.minusDays(
                                    stressed
                                            ? 16
                                            : 6),
                            stressed
                                    ? 21
                                    : 7,
                            stressed,
                            false);

            delay.update(
                    delay.getTitle(),
                    delay.getDescription(),
                    delay.getCause(),
                    delay.getOwnerName(),
                    delay.getStartDate(),
                    null,
                    delay.getForecastDelayDays(),
                    delay.isExcusable(),
                    delay.isCompensable(),
                    DelayStatus.MITIGATING,
                    today);

            delayRepository.save(
                    delay);
        }

        System.out.println(
                "[BuildSight] Risk-control demo data created for "
                        + project.getCode());
    }

    private String reference(
            Project project,
            String type,
            int number) {

        return type
                + "-"
                + project.getCode()
                        .replace(
                                "BS-",
                                "")
                + "-"
                + String.format(
                        "%02d",
                        number);
    }
}
