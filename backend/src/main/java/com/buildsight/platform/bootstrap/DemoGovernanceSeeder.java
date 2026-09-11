package com.buildsight.platform.bootstrap;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.governance.domain.GovernanceActionPriority;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionImpactArea;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingType;
import com.buildsight.platform.governance.domain.ProjectGovernanceAction;
import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;
import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;
import com.buildsight.platform.governance.repository.ProjectGovernanceActionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceDecisionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceMeetingRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(130)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoGovernanceSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectGovernanceMeetingRepository
            meetingRepository;

    private final ProjectGovernanceDecisionRepository
            decisionRepository;

    private final ProjectGovernanceActionRepository
            actionRepository;

    public DemoGovernanceSeeder(
            ProjectRepository projectRepository,
            ProjectGovernanceMeetingRepository meetingRepository,
            ProjectGovernanceDecisionRepository decisionRepository,
            ProjectGovernanceActionRepository actionRepository) {

        this.projectRepository =
                projectRepository;

        this.meetingRepository =
                meetingRepository;

        this.decisionRepository =
                decisionRepository;

        this.actionRepository =
                actionRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            if (meetingRepository
                    .existsByProjectId(
                            project.getId())) {

                continue;
            }

            seed(
                    project);
        }

        System.out.println(
                "[BuildSight] Governance demo data ready.");
    }

    private void seed(
            Project project) {

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectGovernanceMeeting progress =
                ProjectGovernanceMeeting.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "MTG-001",
                        "Weekly Progress Review",
                        GovernanceMeetingType.PROGRESS,
                        atNoon(
                                today.minusDays(
                                        7)),
                        "Project Director");

        progress.update(
                progress.getTitle(),
                progress.getMeetingType(),
                progress.getScheduledAt(),
                progress.getScheduledAt(),
                GovernanceMeetingStatus.HELD,
                progress.getChairName(),
                stressed
                        ? null
                        : "Progress, constraints, commercial exposure and recovery actions reviewed.",
                atNoon(
                        today));

        ProjectGovernanceMeeting executive =
                ProjectGovernanceMeeting.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "MTG-002",
                        "Executive Steering Review",
                        GovernanceMeetingType.EXECUTIVE,
                        atNoon(
                                today.plusDays(
                                        7)),
                        "Project Director");

        meetingRepository.saveAll(
                List.of(
                        progress,
                        executive));

        ProjectGovernanceDecision decision =
                ProjectGovernanceDecision.create(
                        UUID.randomUUID(),
                        project.getId(),
                        progress.getId(),
                        "DEC-001",
                        stressed
                                ? "Approve recovery acceleration package"
                                : "Approve coordinated installation sequence",
                        "Formal management decision arising from the progress review.",
                        today.minusDays(
                                7),
                        "Project Director",
                        stressed
                                ? today.minusDays(
                                        2)
                                : today.plusDays(
                                        7),
                        stressed
                                ? GovernanceDecisionImpactArea.SCHEDULE
                                : GovernanceDecisionImpactArea.TECHNICAL,
                        "Decision made against current project controls evidence.");

        decision.update(
                decision.getMeetingId(),
                decision.getTitle(),
                decision.getDescription(),
                decision.getDecisionDate(),
                decision.getOwnerName(),
                decision.getDueDate(),
                decision.getImpactArea(),
                decision.getRationale(),
                GovernanceDecisionStatus.APPROVED);

        decisionRepository.save(
                decision);

        ProjectGovernanceAction first =
                ProjectGovernanceAction.create(
                        UUID.randomUUID(),
                        project.getId(),
                        progress.getId(),
                        decision.getId(),
                        "ACT-001",
                        stressed
                                ? "Release recovery procurement package"
                                : "Release coordinated workface plan",
                        "Follow-up action from the weekly progress review.",
                        "Package Manager",
                        stressed
                                ? GovernanceActionPriority.CRITICAL
                                : GovernanceActionPriority.HIGH,
                        stressed
                                ? today.minusDays(
                                        3)
                                : today.plusDays(
                                        5));

        if (stressed) {

            first.update(
                    first.getMeetingId(),
                    first.getDecisionId(),
                    first.getTitle(),
                    first.getDescription(),
                    first.getOwnerName(),
                    first.getPriority(),
                    first.getDueDate(),
                    GovernanceActionStatus.BLOCKED,
                    "Supplier technical submittal remains outstanding.",
                    Instant.now());
        }

        ProjectGovernanceAction second =
                ProjectGovernanceAction.create(
                        UUID.randomUUID(),
                        project.getId(),
                        progress.getId(),
                        null,
                        "ACT-002",
                        "Update two-week constraint register",
                        "Confirm constraint ownership and due dates before the next progress review.",
                        "Planning Manager",
                        GovernanceActionPriority.MEDIUM,
                        today.plusDays(
                                3));

        actionRepository.saveAll(
                List.of(
                        first,
                        second));
    }

    private Instant atNoon(
            LocalDate date) {

        return date
                .atTime(
                        12,
                        0)
                .toInstant(
                        ZoneOffset.UTC);
    }
}
