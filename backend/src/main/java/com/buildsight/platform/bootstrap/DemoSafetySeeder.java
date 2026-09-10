package com.buildsight.platform.bootstrap;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.safety.domain.HazardCategory;
import com.buildsight.platform.safety.domain.ProjectSafetyAction;
import com.buildsight.platform.safety.domain.ProjectSafetyIncident;
import com.buildsight.platform.safety.domain.ProjectSafetyObservation;
import com.buildsight.platform.safety.domain.ProjectWorkPermit;
import com.buildsight.platform.safety.domain.SafetyActionStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetyObservationStatus;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.SafetySeverity;
import com.buildsight.platform.safety.domain.WorkPermitStatus;
import com.buildsight.platform.safety.domain.WorkPermitType;
import com.buildsight.platform.safety.repository.ProjectSafetyActionRepository;
import com.buildsight.platform.safety.repository.ProjectSafetyIncidentRepository;
import com.buildsight.platform.safety.repository.ProjectSafetyObservationRepository;
import com.buildsight.platform.safety.repository.ProjectWorkPermitRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(80)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoSafetySeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectSafetyIncidentRepository
            incidentRepository;

    private final ProjectSafetyObservationRepository
            observationRepository;

    private final ProjectSafetyActionRepository
            actionRepository;

    private final ProjectWorkPermitRepository
            permitRepository;

    public DemoSafetySeeder(
            ProjectRepository projectRepository,
            ProjectSafetyIncidentRepository incidentRepository,
            ProjectSafetyObservationRepository observationRepository,
            ProjectSafetyActionRepository actionRepository,
            ProjectWorkPermitRepository permitRepository) {

        this.projectRepository =
                projectRepository;

        this.incidentRepository =
                incidentRepository;

        this.observationRepository =
                observationRepository;

        this.actionRepository =
                actionRepository;

        this.permitRepository =
                permitRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seed(
                    project);
        }
    }

    private void seed(
            Project project) {

        if (incidentRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectSafetyIncident incident =
                ProjectSafetyIncident.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "INC",
                                1),
                        stressed
                                ? SafetyIncidentType.LOST_TIME_INJURY
                                : SafetyIncidentType.NEAR_MISS,
                        stressed
                                ? SafetySeverity.CRITICAL
                                : SafetySeverity.MEDIUM,
                        stressed
                                ? "Fall from access platform"
                                : "Material handling near miss",
                        stressed
                                ? "Operative sustained an injury during access-platform activity."
                                : "Material movement created a near-miss condition without injury.",
                        stressed
                                ? "Level 03"
                                : "Loading Area",
                        today.minusDays(
                                stressed
                                        ? 12
                                        : 24),
                        today.minusDays(
                                stressed
                                        ? 12
                                        : 24),
                        stressed
                                ? 1
                                : 0,
                        stressed
                                ? 5
                                : 0,
                        "Work stopped and area secured.");

        if (stressed) {

            incident.update(
                    incident.getIncidentType(),
                    incident.getSeverity(),
                    incident.getTitle(),
                    incident.getDescription(),
                    incident.getLocation(),
                    incident.getPeopleAffected(),
                    incident.getLostTimeDays(),
                    incident.getImmediateAction(),
                    "Access-platform control failure remains under investigation.",
                    "Initial investigation completed. Corrective actions remain outstanding.",
                    SafetyIncidentStatus.ACTION_IN_PROGRESS,
                    today);

        } else {

            incident.update(
                    incident.getIncidentType(),
                    incident.getSeverity(),
                    incident.getTitle(),
                    incident.getDescription(),
                    incident.getLocation(),
                    incident.getPeopleAffected(),
                    incident.getLostTimeDays(),
                    incident.getImmediateAction(),
                    "Pedestrian segregation was temporarily compromised.",
                    "Traffic arrangement reviewed and segregation restored.",
                    SafetyIncidentStatus.UNDER_INVESTIGATION,
                    today.minusDays(22));

            incident.update(
                    incident.getIncidentType(),
                    incident.getSeverity(),
                    incident.getTitle(),
                    incident.getDescription(),
                    incident.getLocation(),
                    incident.getPeopleAffected(),
                    incident.getLostTimeDays(),
                    incident.getImmediateAction(),
                    incident.getRootCause(),
                    incident.getInvestigationNotes(),
                    SafetyIncidentStatus.CLOSED,
                    today.minusDays(21));
        }

        incidentRepository.save(
                incident);

        ProjectSafetyObservation first =
                ProjectSafetyObservation.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "OBS",
                                1),
                        stressed
                                ? SafetyObservationType.UNSAFE_CONDITION
                                : SafetyObservationType.GOOD_PRACTICE,
                        stressed
                                ? HazardCategory.WORK_AT_HEIGHT
                                : HazardCategory.HOUSEKEEPING,
                        stressed
                                ? SafetySeverity.HIGH
                                : SafetySeverity.LOW,
                        stressed
                                ? "Incomplete edge protection"
                                : "Well-maintained access route",
                        stressed
                                ? "Edge protection requires immediate correction."
                                : "Access route remained clean and unobstructed.",
                        stressed
                                ? "Roof Zone"
                                : "Level 01",
                        today.minusDays(6),
                        "HSE Manager",
                        stressed
                                ? "Site Manager"
                                : null,
                        stressed
                                ? today.minusDays(1)
                                : null);

        observationRepository.save(
                first);

        if (stressed) {

            ProjectSafetyObservation second =
                    ProjectSafetyObservation.create(
                            UUID.randomUUID(),
                            project.getId(),
                            reference(
                                    project,
                                    "OBS",
                                    2),
                            SafetyObservationType.UNSAFE_ACT,
                            HazardCategory.WORK_AT_HEIGHT,
                            SafetySeverity.HIGH,
                            "Access equipment control breach",
                            "Work-at-height access control requirements were not consistently followed.",
                            "Level 03",
                            today.minusDays(4),
                            "HSE Manager",
                            "Construction Manager",
                            today.plusDays(1));

            observationRepository.save(
                    second);

            ProjectSafetyAction incidentAction =
                    ProjectSafetyAction.create(
                            UUID.randomUUID(),
                            project.getId(),
                            incident.getId(),
                            null,
                            reference(
                                    project,
                                    "ACT",
                                    1),
                            "Reinforce work-at-height control",
                            "Complete corrective work, toolbox briefing and supervisory inspection.",
                            "Construction Manager",
                            today.minusDays(2));

            incidentAction.update(
                    incidentAction.getTitle(),
                    incidentAction.getActionDescription(),
                    incidentAction.getOwnerName(),
                    incidentAction.getDueDate(),
                    SafetyActionStatus.IN_PROGRESS,
                    null,
                    today);

            actionRepository.save(
                    incidentAction);

        } else {

            first.update(
                    first.getObservationType(),
                    first.getHazardCategory(),
                    first.getSeverity(),
                    first.getTitle(),
                    first.getDescription(),
                    first.getLocation(),
                    first.getOwnerName(),
                    first.getDueDate(),
                    SafetyObservationStatus.CLOSED,
                    today.minusDays(5));

            observationRepository.save(
                    first);
        }

        ProjectWorkPermit permit =
                ProjectWorkPermit.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "PTW",
                                1),
                        stressed
                                ? WorkPermitType.WORK_AT_HEIGHT
                                : WorkPermitType.HOT_WORK,
                        stressed
                                ? "Roof access work permit"
                                : "Hot-work permit",
                        stressed
                                ? "Roof Zone"
                                : "Plant Room",
                        "HSE Manager",
                        "Trade Supervisor",
                        today.minusDays(3),
                        stressed
                                ? today.minusDays(1)
                                : today.plusDays(1),
                        "Area isolation, competent supervision, PPE and emergency controls confirmed.");

        permit.update(
                permit.getPermitType(),
                permit.getTitle(),
                permit.getLocation(),
                permit.getIssuerName(),
                permit.getReceiverName(),
                permit.getValidFrom(),
                permit.getValidUntil(),
                permit.getControls(),
                WorkPermitStatus.ACTIVE,
                today.minusDays(3));

        permitRepository.save(
                permit);

        System.out.println(
                "[BuildSight] HSE demo data created for "
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
