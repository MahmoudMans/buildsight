package com.buildsight.platform.bootstrap;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.document.domain.DocumentDiscipline;
import com.buildsight.platform.document.domain.DocumentRevision;
import com.buildsight.platform.document.domain.DocumentRevisionStatus;
import com.buildsight.platform.document.domain.DocumentType;
import com.buildsight.platform.document.domain.ProjectDocument;
import com.buildsight.platform.document.domain.ProjectRfi;
import com.buildsight.platform.document.domain.ProjectTransmittal;
import com.buildsight.platform.document.domain.RfiPriority;
import com.buildsight.platform.document.domain.RfiStatus;
import com.buildsight.platform.document.domain.TransmittalRevisionLink;
import com.buildsight.platform.document.repository.DocumentRevisionRepository;
import com.buildsight.platform.document.repository.ProjectDocumentRepository;
import com.buildsight.platform.document.repository.ProjectRfiRepository;
import com.buildsight.platform.document.repository.ProjectTransmittalRepository;
import com.buildsight.platform.document.repository.TransmittalRevisionLinkRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(60)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoDocumentControlSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectDocumentRepository
            documentRepository;

    private final DocumentRevisionRepository
            revisionRepository;

    private final ProjectRfiRepository
            rfiRepository;

    private final ProjectTransmittalRepository
            transmittalRepository;

    private final TransmittalRevisionLinkRepository
            linkRepository;

    public DemoDocumentControlSeeder(
            ProjectRepository projectRepository,
            ProjectDocumentRepository documentRepository,
            DocumentRevisionRepository revisionRepository,
            ProjectRfiRepository rfiRepository,
            ProjectTransmittalRepository transmittalRepository,
            TransmittalRevisionLinkRepository linkRepository) {

        this.projectRepository =
                projectRepository;

        this.documentRepository =
                documentRepository;

        this.revisionRepository =
                revisionRepository;

        this.rfiRepository =
                rfiRepository;

        this.transmittalRepository =
                transmittalRepository;

        this.linkRepository =
                linkRepository;
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

        if (documentRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        ProjectDocument drawing =
                ProjectDocument.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "A-1001",
                        "General Arrangement Plan",
                        DocumentType.DRAWING,
                        DocumentDiscipline.ARCHITECTURAL,
                        "Design Manager");

        ProjectDocument specification =
                ProjectDocument.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "SPEC-MEP-001",
                        "MEP Installation Specification",
                        DocumentType.SPECIFICATION,
                        DocumentDiscipline.MEP,
                        "MEP Manager");

        documentRepository.saveAll(
                List.of(
                        drawing,
                        specification));

        DocumentRevision drawingRevision =
                demoRevision(
                        drawing,
                        "C01",
                        DocumentRevisionStatus.APPROVED,
                        today.minusDays(25),
                        "general-arrangement-C01.pdf",
                        "General arrangement plan approved for construction. Architectural coordination drawing showing principal work areas.");

        DocumentRevision specificationRevision =
                demoRevision(
                        specification,
                        "P02",
                        DocumentRevisionStatus.FOR_REVIEW,
                        today.minusDays(12),
                        "mep-specification-P02.pdf",
                        "MEP installation specification covering mechanical electrical plumbing installation requirements testing commissioning and coordination.");

        revisionRepository.saveAll(
                List.of(
                        drawingRevision,
                        specificationRevision));

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectRfi rfi =
                ProjectRfi.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "RFI-"
                                + project.getCode()
                                        .replace(
                                                "BS-",
                                                "")
                                + "-001",
                        stressed
                                ? "Outstanding public-area ceiling coordination"
                                : "MEP ceiling coordination clarification",
                        stressed
                                ? "Confirm revised ceiling levels and coordinated service zones before public-area works continue."
                                : "Confirm coordinated ceiling service zones before final installation.",
                        "Site Manager",
                        "Design Manager",
                        today.minusDays(
                                stressed
                                        ? 18
                                        : 5),
                        stressed
                                ? today.minusDays(6)
                                : today.plusDays(5),
                        stressed
                                ? RfiPriority.CRITICAL
                                : RfiPriority.MEDIUM,
                        "");

        String search =
                rfi.getReference()
                        + " "
                        + rfi.getSubject()
                        + " "
                        + rfi.getQuestion();

        rfi.update(
                rfi.getSubject(),
                rfi.getQuestion(),
                stressed
                        ? null
                        : "Coordinate services within the issued reflected ceiling layout.",
                rfi.getAssignedTo(),
                rfi.getDueDate(),
                rfi.getPriority(),
                stressed
                        ? RfiStatus.OPEN
                        : RfiStatus.ANSWERED,
                search
                        + (stressed
                                ? ""
                                : " Coordinate services within the issued reflected ceiling layout."),
                today);

        rfiRepository.save(
                rfi);

        ProjectTransmittal transmittal =
                ProjectTransmittal.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "TR-"
                                + project.getCode()
                                        .replace(
                                                "BS-",
                                                "")
                                + "-001",
                        "Main Contractor Delivery Team",
                        "Construction information issue",
                        today.minusDays(8),
                        "Controlled issue of current project information.");

        transmittalRepository.save(
                transmittal);

        linkRepository.saveAll(
                List.of(
                        TransmittalRevisionLink.create(
                                UUID.randomUUID(),
                                transmittal.getId(),
                                drawingRevision.getId()),
                        TransmittalRevisionLink.create(
                                UUID.randomUUID(),
                                transmittal.getId(),
                                specificationRevision.getId())));

        if (!stressed) {
            transmittal.issue(
                    today.minusDays(7));

            transmittalRepository.save(
                    transmittal);
        }

        System.out.println(
                "[BuildSight] Document-control demo data created for "
                        + project.getCode());
    }

    private DocumentRevision demoRevision(
            ProjectDocument document,
            String revision,
            DocumentRevisionStatus status,
            LocalDate issuedDate,
            String fileName,
            String extractedText) {

        String searchText =
                document.getDocumentNumber()
                        + " "
                        + document.getTitle()
                        + " "
                        + revision
                        + " "
                        + extractedText;

        return DocumentRevision.create(
                UUID.randomUUID(),
                document.getId(),
                revision,
                status,
                issuedDate,
                fileName,
                "application/pdf",
                0,
                "0000000000000000000000000000000000000000000000000000000000000000",
                "/demo/not-backed-by-storage/"
                        + fileName,
                extractedText,
                searchText);
    }
}
