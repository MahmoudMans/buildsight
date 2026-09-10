package com.buildsight.platform.bootstrap;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.quality.domain.HandoverCategory;
import com.buildsight.platform.quality.domain.HandoverStatus;
import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;
import com.buildsight.platform.quality.domain.NcrStatus;
import com.buildsight.platform.quality.domain.ProjectHandoverItem;
import com.buildsight.platform.quality.domain.ProjectNcr;
import com.buildsight.platform.quality.domain.ProjectPunchItem;
import com.buildsight.platform.quality.domain.ProjectQualityInspection;
import com.buildsight.platform.quality.domain.PunchPriority;
import com.buildsight.platform.quality.domain.PunchStatus;
import com.buildsight.platform.quality.domain.QualityDiscipline;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;
import com.buildsight.platform.quality.domain.QualityInspectionType;
import com.buildsight.platform.quality.repository.ProjectHandoverItemRepository;
import com.buildsight.platform.quality.repository.ProjectNcrRepository;
import com.buildsight.platform.quality.repository.ProjectPunchItemRepository;
import com.buildsight.platform.quality.repository.ProjectQualityInspectionRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(70)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoQualitySeeder
        implements ApplicationRunner {

    private final ProjectRepository projectRepository;
    private final ProjectQualityInspectionRepository inspectionRepository;
    private final ProjectNcrRepository ncrRepository;
    private final ProjectPunchItemRepository punchRepository;
    private final ProjectHandoverItemRepository handoverRepository;

    public DemoQualitySeeder(
            ProjectRepository projectRepository,
            ProjectQualityInspectionRepository inspectionRepository,
            ProjectNcrRepository ncrRepository,
            ProjectPunchItemRepository punchRepository,
            ProjectHandoverItemRepository handoverRepository) {

        this.projectRepository = projectRepository;
        this.inspectionRepository = inspectionRepository;
        this.ncrRepository = ncrRepository;
        this.punchRepository = punchRepository;
        this.handoverRepository = handoverRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seedProject(project);
        }
    }

    private void seedProject(
            Project project) {

        if (inspectionRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectQualityInspection structure =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        project.getId(),
                        ref(project, "INS", 1),
                        "Structural works inspection",
                        QualityInspectionType.CONSULTANT,
                        QualityDiscipline.STRUCTURAL,
                        today.minusDays(22),
                        "Quality Engineer",
                        "Inspection of completed structural work.");

        structure.update(
                structure.getTitle(),
                structure.getInspectionType(),
                structure.getDiscipline(),
                structure.getPlannedDate(),
                today.minusDays(21),
                structure.getInspectorName(),
                QualityInspectionStatus.COMPLETED,
                stressed
                        ? QualityInspectionResult.FAIL
                        : QualityInspectionResult.PASS,
                structure.getNotes(),
                today);

        ProjectQualityInspection mep =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        project.getId(),
                        ref(project, "INS", 2),
                        "MEP installation inspection",
                        QualityInspectionType.INTERNAL,
                        QualityDiscipline.MEP,
                        today.minusDays(9),
                        "MEP QA Engineer",
                        "Inspection of service installation quality.");

        mep.update(
                mep.getTitle(),
                mep.getInspectionType(),
                mep.getDiscipline(),
                mep.getPlannedDate(),
                today.minusDays(8),
                mep.getInspectorName(),
                QualityInspectionStatus.COMPLETED,
                QualityInspectionResult.PASS_WITH_OBSERVATIONS,
                mep.getNotes(),
                today);

        ProjectQualityInspection finish =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        project.getId(),
                        ref(project, "INS", 3),
                        "Architectural finish inspection",
                        QualityInspectionType.INTERNAL,
                        QualityDiscipline.ARCHITECTURAL,
                        today.plusDays(8),
                        "Finishes Manager",
                        "Planned finishes quality inspection.");

        inspectionRepository.saveAll(
                List.of(
                        structure,
                        mep,
                        finish));

        if (stressed) {
            ProjectNcr critical =
                    ProjectNcr.create(
                            UUID.randomUUID(),
                            project.getId(),
                            structure.getId(),
                            ref(project, "NCR", 1),
                            "Structural finish non-conformance",
                            "Completed work does not meet the specified acceptance requirement and requires corrective action.",
                            NcrCategory.WORKMANSHIP,
                            NcrSeverity.CRITICAL,
                            today.minusDays(20),
                            today.minusDays(5),
                            "Construction Manager");

            critical.update(
                    structure.getId(),
                    critical.getTitle(),
                    critical.getDescription(),
                    critical.getCategory(),
                    critical.getSeverity(),
                    critical.getDueDate(),
                    critical.getOwnerName(),
                    "Incorrect execution sequence and insufficient inspection hold-point control.",
                    "Remove affected work, reinstate to approved detail and repeat inspection.",
                    null,
                    NcrStatus.CORRECTIVE_ACTION_IN_PROGRESS,
                    today);

            ProjectNcr repeated =
                    ProjectNcr.create(
                            UUID.randomUUID(),
                            project.getId(),
                            null,
                            ref(project, "NCR", 2),
                            "Finish workmanship defect",
                            "Finish installation requires correction.",
                            NcrCategory.WORKMANSHIP,
                            NcrSeverity.MAJOR,
                            today.minusDays(9),
                            today.minusDays(1),
                            "Finishes Manager");

            ncrRepository.saveAll(
                    List.of(
                            critical,
                            repeated));

        } else {
            ProjectNcr closed =
                    ProjectNcr.create(
                            UUID.randomUUID(),
                            project.getId(),
                            mep.getId(),
                            ref(project, "NCR", 1),
                            "Minor MEP support correction",
                            "Local support arrangement required correction before closure.",
                            NcrCategory.INSTALLATION,
                            NcrSeverity.MINOR,
                            today.minusDays(16),
                            today.minusDays(7),
                            "MEP Manager");

            closed.update(
                    mep.getId(),
                    closed.getTitle(),
                    closed.getDescription(),
                    closed.getCategory(),
                    closed.getSeverity(),
                    closed.getDueDate(),
                    closed.getOwnerName(),
                    "Support spacing was inconsistent with the approved installation detail.",
                    "Support spacing corrected and installation rechecked.",
                    "Corrective work verified and accepted.",
                    NcrStatus.CORRECTIVE_ACTION_IN_PROGRESS,
                    today.minusDays(8));

            closed.update(
                    mep.getId(),
                    closed.getTitle(),
                    closed.getDescription(),
                    closed.getCategory(),
                    closed.getSeverity(),
                    closed.getDueDate(),
                    closed.getOwnerName(),
                    closed.getRootCause(),
                    closed.getCorrectiveAction(),
                    closed.getVerificationNotes(),
                    NcrStatus.READY_FOR_VERIFICATION,
                    today.minusDays(7));

            closed.update(
                    mep.getId(),
                    closed.getTitle(),
                    closed.getDescription(),
                    closed.getCategory(),
                    closed.getSeverity(),
                    closed.getDueDate(),
                    closed.getOwnerName(),
                    closed.getRootCause(),
                    closed.getCorrectiveAction(),
                    closed.getVerificationNotes(),
                    NcrStatus.CLOSED,
                    today.minusDays(6));

            ncrRepository.save(
                    closed);
        }

        ProjectPunchItem punch =
                ProjectPunchItem.create(
                        UUID.randomUUID(),
                        project.getId(),
                        ref(project, "PCH", 1),
                        stressed
                                ? "Public-area ceiling finish defect"
                                : "Minor door hardware adjustment",
                        "Close-out item identified during quality walkdown.",
                        stressed
                                ? "Level 02 Public Area"
                                : "Level 01",
                        stressed
                                ? "Finishes"
                                : "Joinery",
                        stressed
                                ? PunchPriority.HIGH
                                : PunchPriority.LOW,
                        today.minusDays(7),
                        stressed
                                ? today.minusDays(2)
                                : today.plusDays(7),
                        stressed
                                ? "Finishes Manager"
                                : "Site Manager");

        if (!stressed) {
            punch.update(
                    punch.getTitle(),
                    punch.getDescription(),
                    punch.getLocation(),
                    punch.getTrade(),
                    punch.getPriority(),
                    punch.getDueDate(),
                    punch.getOwnerName(),
                    PunchStatus.IN_PROGRESS,
                    today);
        }

        punchRepository.save(
                punch);

        ProjectHandoverItem om =
                ProjectHandoverItem.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "HO-OM-001",
                        "Operations & Maintenance Manuals",
                        HandoverCategory.OM_MANUAL,
                        "Technical Manager",
                        stressed
                                ? today.minusDays(3)
                                : today.plusDays(45),
                        "Required handover documentation.");

        ProjectHandoverItem asBuilt =
                ProjectHandoverItem.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "HO-AB-001",
                        "As-built drawing package",
                        HandoverCategory.AS_BUILT,
                        "Design Manager",
                        today.plusDays(55),
                        "Final coordinated as-built information.");

        ProjectHandoverItem test =
                ProjectHandoverItem.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "HO-TEST-001",
                        "Testing & commissioning records",
                        HandoverCategory.TEST_RECORD,
                        "Commissioning Manager",
                        today.plusDays(40),
                        "Final testing evidence.");

        if (!stressed) {
            om.update(
                    om.getTitle(),
                    om.getCategory(),
                    om.getOwnerName(),
                    om.getDueDate(),
                    HandoverStatus.SUBMITTED,
                    om.getNotes(),
                    today.minusDays(2));

            om.update(
                    om.getTitle(),
                    om.getCategory(),
                    om.getOwnerName(),
                    om.getDueDate(),
                    HandoverStatus.APPROVED,
                    om.getNotes(),
                    today.minusDays(1));
        }

        handoverRepository.saveAll(
                List.of(
                        om,
                        asBuilt,
                        test));

        System.out.println(
                "[BuildSight] Quality demo data created for "
                        + project.getCode());
    }

    private String ref(
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
