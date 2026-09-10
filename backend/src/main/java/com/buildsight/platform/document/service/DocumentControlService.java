package com.buildsight.platform.document.service;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.document.api.CreateDocumentRequest;
import com.buildsight.platform.document.api.CreateRfiRequest;
import com.buildsight.platform.document.api.CreateTransmittalRequest;
import com.buildsight.platform.document.api.DocumentControlResponse;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.api.DocumentResponse;
import com.buildsight.platform.document.api.DocumentRevisionResponse;
import com.buildsight.platform.document.api.IssueTransmittalRequest;
import com.buildsight.platform.document.api.RfiResponse;
import com.buildsight.platform.document.api.TransmittalResponse;
import com.buildsight.platform.document.api.UpdateDocumentRevisionStatusRequest;
import com.buildsight.platform.document.api.UpdateRfiRequest;
import com.buildsight.platform.document.domain.DocumentRevision;
import com.buildsight.platform.document.domain.DocumentRevisionStatus;
import com.buildsight.platform.document.domain.ProjectDocument;
import com.buildsight.platform.document.domain.ProjectRfi;
import com.buildsight.platform.document.domain.ProjectTransmittal;
import com.buildsight.platform.document.domain.RfiStatus;
import com.buildsight.platform.document.domain.TransmittalRevisionLink;
import com.buildsight.platform.document.domain.TransmittalStatus;
import com.buildsight.platform.document.repository.DocumentRevisionRepository;
import com.buildsight.platform.document.repository.ProjectDocumentRepository;
import com.buildsight.platform.document.repository.ProjectRfiRepository;
import com.buildsight.platform.document.repository.ProjectTransmittalRepository;
import com.buildsight.platform.document.repository.TransmittalRevisionLinkRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentControlService {

    private static final long
            MAX_FILE_SIZE =
            50L * 1024L * 1024L;

    private static final Map<
            DocumentRevisionStatus,
            Set<DocumentRevisionStatus>>
            REVISION_TRANSITIONS =
            revisionTransitions();

    private static final Map<
            RfiStatus,
            Set<RfiStatus>>
            RFI_TRANSITIONS =
            rfiTransitions();

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
            transmittalRevisionLinkRepository;

    private final DocumentIntelligenceService
            intelligenceService;

    private final DocumentTextExtractionService
            extractionService;

    private final DocumentHashService
            hashService;

    private final LocalDocumentStorageService
            storageService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public DocumentControlService(
            ProjectRepository projectRepository,
            ProjectDocumentRepository documentRepository,
            DocumentRevisionRepository revisionRepository,
            ProjectRfiRepository rfiRepository,
            ProjectTransmittalRepository transmittalRepository,
            TransmittalRevisionLinkRepository transmittalRevisionLinkRepository,
            DocumentIntelligenceService intelligenceService,
            DocumentTextExtractionService extractionService,
            DocumentHashService hashService,
            LocalDocumentStorageService storageService,
            ProjectMapper projectMapper,
            Clock clock) {

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

        this.transmittalRevisionLinkRepository =
                transmittalRevisionLinkRepository;

        this.intelligenceService =
                intelligenceService;

        this.extractionService =
                extractionService;

        this.hashService =
                hashService;

        this.storageService =
                storageService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public DocumentControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectDocument> documents =
                documentRepository
                        .findByProjectIdOrderByDocumentNumberAsc(
                                projectId);

        List<UUID> documentIds =
                documents.stream()
                        .map(
                                ProjectDocument::getId)
                        .toList();

        List<DocumentRevision> revisions =
                documentIds.isEmpty()
                        ? List.of()
                        : revisionRepository
                                .findByDocumentIdInOrderByCreatedAtDesc(
                                        documentIds);

        List<ProjectRfi> rfis =
                rfiRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectTransmittal> transmittals =
                transmittalRepository
                        .findByProjectIdOrderByTransmittalDateDescCreatedAtDesc(
                                projectId);

        List<UUID> transmittalIds =
                transmittals.stream()
                        .map(
                                ProjectTransmittal::getId)
                        .toList();

        List<TransmittalRevisionLink> links =
                transmittalIds.isEmpty()
                        ? List.of()
                        : transmittalRevisionLinkRepository
                                .findByTransmittalIdIn(
                                        transmittalIds);

        Map<UUID, ProjectDocument> documentMap =
                documents.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectDocument::getId,
                                        Function.identity()));

        Map<UUID, DocumentRevision> revisionMap =
                revisions.stream()
                        .collect(
                                Collectors.toMap(
                                        DocumentRevision::getId,
                                        Function.identity()));

        Map<UUID, List<DocumentRevision>>
                revisionsByDocument =
                revisions.stream()
                        .collect(
                                Collectors.groupingBy(
                                        DocumentRevision::getDocumentId));

        Map<UUID, List<TransmittalRevisionLink>>
                linksByTransmittal =
                links.stream()
                        .collect(
                                Collectors.groupingBy(
                                        TransmittalRevisionLink::getTransmittalId));

        return new DocumentControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        documents,
                        revisions,
                        rfis,
                        transmittals),

                documents.stream()
                        .map(
                                document ->
                                        toDocumentResponse(
                                                document,
                                                revisionsByDocument.getOrDefault(
                                                        document.getId(),
                                                        List.of())))
                        .toList(),

                revisions.stream()
                        .map(
                                revision ->
                                        toRevisionResponse(
                                                revision,
                                                requireDocument(
                                                        documentMap,
                                                        revision.getDocumentId())))
                        .toList(),

                rfis.stream()
                        .map(
                                this::toRfiResponse)
                        .toList(),

                transmittals.stream()
                        .map(
                                transmittal ->
                                        toTransmittalResponse(
                                                transmittal,
                                                linksByTransmittal.getOrDefault(
                                                        transmittal.getId(),
                                                        List.of()),
                                                revisionMap,
                                                documentMap))
                        .toList());
    }

    @Transactional(readOnly = true)
    public DocumentIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        List<ProjectDocument> documents =
                documentRepository
                        .findByProjectIdOrderByDocumentNumberAsc(
                                projectId);

        List<UUID> documentIds =
                documents.stream()
                        .map(
                                ProjectDocument::getId)
                        .toList();

        List<DocumentRevision> revisions =
                documentIds.isEmpty()
                        ? List.of()
                        : revisionRepository
                                .findByDocumentIdInOrderByCreatedAtDesc(
                                        documentIds);

        return intelligenceService.calculate(
                documents,
                revisions,
                rfiRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId),
                transmittalRepository
                        .findByProjectIdOrderByTransmittalDateDescCreatedAtDesc(
                                projectId));
    }

    @Transactional
    public DocumentResponse createDocument(
            UUID projectId,
            CreateDocumentRequest request) {

        requireProject(
                projectId);

        String documentNumber =
                request.documentNumber()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (documentRepository
                .existsByProjectIdAndDocumentNumberIgnoreCase(
                        projectId,
                        documentNumber)) {

            throw new ConflictException(
                    "Document number '%s' already exists for this project."
                            .formatted(
                                    documentNumber));
        }

        ProjectDocument document =
                ProjectDocument.create(
                        UUID.randomUUID(),
                        projectId,
                        documentNumber,
                        request.title()
                                .trim(),
                        request.documentType(),
                        request.discipline(),
                        normalize(
                                request.ownerName()));

        ProjectDocument saved =
                documentRepository.save(
                        document);

        return toDocumentResponse(
                saved,
                List.of());
    }

    @Transactional
    public DocumentRevisionResponse uploadRevision(
            UUID projectId,
            UUID documentId,
            String revisionCode,
            DocumentRevisionStatus status,
            LocalDate issuedDate,
            MultipartFile file) {

        requireProject(
                projectId);

        ProjectDocument document =
                documentRepository
                        .findByIdAndProjectId(
                                documentId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Document '%s' was not found for this project."
                                                        .formatted(
                                                                documentId)));

        if (file == null
                || file.isEmpty()) {

            throw new InvalidRequestException(
                    "Revision file is required.");
        }

        if (file.getSize()
                > MAX_FILE_SIZE) {

            throw new InvalidRequestException(
                    "Document file exceeds the 50 MB local upload limit.");
        }

        if (status
                == DocumentRevisionStatus.SUPERSEDED) {

            throw new InvalidRequestException(
                    "A newly uploaded revision cannot start as SUPERSEDED.");
        }

        validateNotFuture(
                issuedDate,
                "Revision issue date");

        String normalizedRevision =
                revisionCode
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (normalizedRevision.isBlank()) {

            throw new InvalidRequestException(
                    "Revision code is required.");
        }

        if (revisionRepository
                .existsByDocumentIdAndRevisionCodeIgnoreCase(
                        documentId,
                        normalizedRevision)) {

            throw new ConflictException(
                    "Revision '%s' already exists for document '%s'."
                            .formatted(
                                    normalizedRevision,
                                    document.getDocumentNumber()));
        }

        byte[] content;

        try {
            content =
                    file.getBytes();

        } catch (IOException exception) {

            throw new InvalidRequestException(
                    "BuildSight could not read the uploaded file.");
        }

        String originalFileName =
                file.getOriginalFilename() == null
                        ? "document.bin"
                        : file.getOriginalFilename();

        String contentType =
                file.getContentType() == null
                        ? "application/octet-stream"
                        : file.getContentType();

        String extractedText =
                extractionService.extract(
                        content,
                        originalFileName,
                        contentType);

        String sha256 =
                hashService.sha256(
                        content);

        UUID revisionId =
                UUID.randomUUID();

        String storagePath =
                storageService.upload(
                        projectId,
                        documentId,
                        revisionId,
                        originalFileName,
                        contentType,
                        content);

        String searchText =
                buildRevisionSearchText(
                        document,
                        normalizedRevision,
                        originalFileName,
                        extractedText);

        try {
            if (status
                            == DocumentRevisionStatus.ISSUED
                    || status
                            == DocumentRevisionStatus.APPROVED) {

                supersedePublishedRevisions(
                        documentId,
                        null);
            }

            DocumentRevision revision =
                    DocumentRevision.create(
                            revisionId,
                            documentId,
                            normalizedRevision,
                            status,
                            issuedDate,
                            originalFileName,
                            contentType,
                            content.length,
                            sha256,
                            storagePath,
                            extractedText,
                            searchText);

            DocumentRevision saved =
                    revisionRepository.save(
                            revision);

            return toRevisionResponse(
                    saved,
                    document);

        } catch (RuntimeException exception) {

            storageService.deleteQuietly(
                    storagePath);

            throw exception;
        }
    }

    @Transactional
    public DocumentRevisionResponse updateRevisionStatus(
            UUID projectId,
            UUID documentId,
            UUID revisionId,
            UpdateDocumentRevisionStatusRequest request) {

        requireProject(
                projectId);

        ProjectDocument document =
                documentRepository
                        .findByIdAndProjectId(
                                documentId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Document was not found."));

        DocumentRevision revision =
                revisionRepository
                        .findByIdAndDocumentId(
                                revisionId,
                                documentId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Document revision was not found."));

        verifyVersion(
                revision.getVersion(),
                request.version(),
                "document revision");

        validateTransition(
                REVISION_TRANSITIONS,
                revision.getRevisionStatus(),
                request.status(),
                "document revision");

        if (request.status()
                        == DocumentRevisionStatus.ISSUED
                || request.status()
                        == DocumentRevisionStatus.APPROVED) {

            supersedePublishedRevisions(
                    documentId,
                    revisionId);
        }

        revision.changeStatus(
                request.status());

        return toRevisionResponse(
                revisionRepository
                        .saveAndFlush(
                                revision),
                document);
    }

    @Transactional(readOnly = true)
    public DocumentBinaryResponse download(
            UUID projectId,
            UUID documentId,
            UUID revisionId) {

        requireProject(
                projectId);

        documentRepository
                .findByIdAndProjectId(
                        documentId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Document was not found."));

        DocumentRevision revision =
                revisionRepository
                        .findByIdAndDocumentId(
                                revisionId,
                                documentId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Document revision was not found."));

        return new DocumentBinaryResponse(
                revision.getFileName(),
                revision.getContentType(),
                storageService.download(
                        revision.getStoragePath()));
    }

    @Transactional
    public RfiResponse createRfi(
            UUID projectId,
            CreateRfiRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.raisedDate(),
                "RFI raised date");

        if (request.dueDate()
                .isBefore(
                        request.raisedDate())) {

            throw new InvalidRequestException(
                    "RFI due date cannot be before its raised date.");
        }

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (rfiRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "RFI reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        String subject =
                request.subject()
                        .trim();

        String question =
                request.question()
                        .trim();

        ProjectRfi rfi =
                ProjectRfi.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        subject,
                        question,
                        normalize(
                                request.raisedBy()),
                        normalize(
                                request.assignedTo()),
                        request.raisedDate(),
                        request.dueDate(),
                        request.priority(),
                        buildRfiSearchText(
                                reference,
                                subject,
                                question,
                                null));

        return toRfiResponse(
                rfiRepository.save(
                        rfi));
    }

    @Transactional
    public RfiResponse updateRfi(
            UUID projectId,
            UUID rfiId,
            UpdateRfiRequest request) {

        requireProject(
                projectId);

        ProjectRfi rfi =
                rfiRepository
                        .findByIdAndProjectId(
                                rfiId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "RFI '%s' was not found."
                                                        .formatted(
                                                                rfiId)));

        verifyVersion(
                rfi.getVersion(),
                request.version(),
                "RFI");

        validateTransition(
                RFI_TRANSITIONS,
                rfi.getStatus(),
                request.status(),
                "RFI");

        if (request.dueDate()
                .isBefore(
                        rfi.getRaisedDate())) {

            throw new InvalidRequestException(
                    "RFI due date cannot be before its raised date.");
        }

        String response =
                normalize(
                        request.response());

        if ((request.status()
                        == RfiStatus.ANSWERED
                || request.status()
                        == RfiStatus.CLOSED)
                && response == null) {

            throw new InvalidRequestException(
                    "An answered or closed RFI requires a response.");
        }

        String subject =
                request.subject()
                        .trim();

        String question =
                request.question()
                        .trim();

        rfi.update(
                subject,
                question,
                response,
                normalize(
                        request.assignedTo()),
                request.dueDate(),
                request.priority(),
                request.status(),
                buildRfiSearchText(
                        rfi.getReference(),
                        subject,
                        question,
                        response),
                LocalDate.now(
                        clock));

        return toRfiResponse(
                rfiRepository
                        .saveAndFlush(
                                rfi));
    }

    @Transactional
    public TransmittalResponse createTransmittal(
            UUID projectId,
            CreateTransmittalRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.transmittalDate(),
                "Transmittal date");

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (transmittalRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Transmittal reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        Map<UUID, DocumentRevision> revisions =
                new HashMap<>();

        Map<UUID, ProjectDocument> documents =
                new HashMap<>();

        for (UUID revisionId :
                request.revisionIds()
                        .stream()
                        .distinct()
                        .toList()) {

            DocumentRevision revision =
                    revisionRepository
                            .findById(
                                    revisionId)
                            .orElseThrow(
                                    () ->
                                            new ResourceNotFoundException(
                                                    "Selected document revision '%s' was not found."
                                                            .formatted(
                                                                    revisionId)));

            ProjectDocument document =
                    documentRepository
                            .findByIdAndProjectId(
                                    revision.getDocumentId(),
                                    projectId)
                            .orElseThrow(
                                    () ->
                                            new InvalidRequestException(
                                                    "A selected document revision does not belong to this project."));

            revisions.put(
                    revision.getId(),
                    revision);

            documents.put(
                    document.getId(),
                    document);
        }

        ProjectTransmittal transmittal =
                ProjectTransmittal.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.recipient()
                                .trim(),
                        request.purpose()
                                .trim(),
                        request.transmittalDate(),
                        normalize(
                                request.notes()));

        ProjectTransmittal saved =
                transmittalRepository.save(
                        transmittal);

        List<TransmittalRevisionLink> links =
                request.revisionIds()
                        .stream()
                        .distinct()
                        .map(
                                revisionId ->
                                        TransmittalRevisionLink.create(
                                                UUID.randomUUID(),
                                                saved.getId(),
                                                revisionId))
                        .toList();

        transmittalRevisionLinkRepository
                .saveAll(
                        links);

        return toTransmittalResponse(
                saved,
                links,
                revisions,
                documents);
    }

    @Transactional
    public TransmittalResponse issueTransmittal(
            UUID projectId,
            UUID transmittalId,
            IssueTransmittalRequest request) {

        requireProject(
                projectId);

        ProjectTransmittal transmittal =
                transmittalRepository
                        .findByIdAndProjectId(
                                transmittalId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Transmittal '%s' was not found."
                                                        .formatted(
                                                                transmittalId)));

        verifyVersion(
                transmittal.getVersion(),
                request.version(),
                "transmittal");

        if (transmittal.getStatus()
                == TransmittalStatus.ISSUED) {

            return buildTransmittalResponse(
                    projectId,
                    transmittal);
        }

        transmittal.issue(
                LocalDate.now(
                        clock));

        ProjectTransmittal saved =
                transmittalRepository
                        .saveAndFlush(
                                transmittal);

        return buildTransmittalResponse(
                projectId,
                saved);
    }

    private TransmittalResponse buildTransmittalResponse(
            UUID projectId,
            ProjectTransmittal transmittal) {

        List<TransmittalRevisionLink> links =
                transmittalRevisionLinkRepository
                        .findByTransmittalIdIn(
                                List.of(
                                        transmittal.getId()));

        Map<UUID, DocumentRevision> revisions =
                revisionRepository
                        .findAllById(
                                links.stream()
                                        .map(
                                                TransmittalRevisionLink::getDocumentRevisionId)
                                        .toList())
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        DocumentRevision::getId,
                                        Function.identity()));

        Map<UUID, ProjectDocument> documents =
                documentRepository
                        .findByProjectIdOrderByDocumentNumberAsc(
                                projectId)
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectDocument::getId,
                                        Function.identity()));

        return toTransmittalResponse(
                transmittal,
                links,
                revisions,
                documents);
    }

    private void supersedePublishedRevisions(
            UUID documentId,
            UUID exceptRevisionId) {

        List<DocumentRevision> existing =
                revisionRepository
                        .findByDocumentIdOrderByCreatedAtDesc(
                                documentId);

        boolean changed =
                false;

        for (DocumentRevision candidate :
                existing) {

            if (exceptRevisionId != null
                    && candidate.getId()
                            .equals(
                                    exceptRevisionId)) {

                continue;
            }

            if (candidate.getRevisionStatus()
                            == DocumentRevisionStatus.ISSUED
                    || candidate.getRevisionStatus()
                            == DocumentRevisionStatus.APPROVED) {

                candidate.supersede();

                changed =
                        true;
            }
        }

        if (changed) {
            revisionRepository.saveAll(
                    existing);
        }
    }

    private Project requireProject(
            UUID projectId) {

        return projectRepository
                .findById(
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Project '%s' was not found."
                                                .formatted(
                                                        projectId)));
    }

    private void validateNotFuture(
            LocalDate date,
            String field) {

        if (date.isAfter(
                LocalDate.now(
                        clock))) {

            throw new InvalidRequestException(
                    field
                            + " cannot be in the future.");
        }
    }

    private void verifyVersion(
            long current,
            long requested,
            String resource) {

        if (current != requested) {

            throw new ConflictException(
                    "The %s was changed by another operation. Refresh before submitting your change."
                            .formatted(
                                    resource));
        }
    }

    private <T extends Enum<T>>
    void validateTransition(
            Map<T, Set<T>> transitions,
            T current,
            T target,
            String resource) {

        if (current == target) {
            return;
        }

        if (!transitions
                .getOrDefault(
                        current,
                        Set.of())
                .contains(
                        target)) {

            throw new InvalidRequestException(
                    "%s status cannot transition from '%s' to '%s'."
                            .formatted(
                                    resource,
                                    current,
                                    target));
        }
    }

    private String buildRevisionSearchText(
            ProjectDocument document,
            String revisionCode,
            String fileName,
            String extractedText) {

        return String.join(
                " ",
                document.getDocumentNumber(),
                document.getTitle(),
                document.getDocumentType()
                        .name(),
                document.getDiscipline()
                        .name(),
                revisionCode,
                fileName,
                extractedText == null
                        ? ""
                        : extractedText);
    }

    private String buildRfiSearchText(
            String reference,
            String subject,
            String question,
            String response) {

        return String.join(
                " ",
                reference,
                subject,
                question,
                response == null
                        ? ""
                        : response);
    }

    private String normalize(
            String value) {

        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isBlank()
                ? null
                : trimmed;
    }

    private DocumentResponse toDocumentResponse(
            ProjectDocument document,
            List<DocumentRevision> revisions) {

        DocumentRevision latest =
                revisions.stream()
                        .findFirst()
                        .orElse(null);

        return new DocumentResponse(
                document.getId(),
                document.getProjectId(),
                document.getDocumentNumber(),
                document.getTitle(),
                document.getDocumentType(),
                document.getDiscipline(),
                document.getOwnerName(),
                revisions.size(),
                latest == null
                        ? null
                        : latest.getRevisionCode(),
                latest == null
                        ? null
                        : latest.getRevisionStatus()
                                .name(),
                document.getVersion(),
                document.getCreatedAt(),
                document.getUpdatedAt());
    }

    private DocumentRevisionResponse toRevisionResponse(
            DocumentRevision revision,
            ProjectDocument document) {

        return new DocumentRevisionResponse(
                revision.getId(),
                revision.getDocumentId(),
                document.getDocumentNumber(),
                document.getTitle(),
                revision.getRevisionCode(),
                revision.getRevisionStatus(),
                revision.getIssuedDate(),
                revision.getFileName(),
                revision.getContentType(),
                revision.getFileSize(),
                revision.getSha256(),
                revision.getExtractedText()
                                == null
                        ? 0
                        : revision
                                .getExtractedText()
                                .length(),
                revision.getVersion(),
                revision.getCreatedAt(),
                revision.getUpdatedAt());
    }

    private RfiResponse toRfiResponse(
            ProjectRfi rfi) {

        boolean overdue =
                rfi.getStatus()
                                == RfiStatus.OPEN
                        && rfi.getDueDate()
                                .isBefore(
                                        LocalDate.now(
                                                clock));

        return new RfiResponse(
                rfi.getId(),
                rfi.getProjectId(),
                rfi.getReference(),
                rfi.getSubject(),
                rfi.getQuestion(),
                rfi.getResponse(),
                rfi.getRaisedBy(),
                rfi.getAssignedTo(),
                rfi.getRaisedDate(),
                rfi.getDueDate(),
                rfi.getRespondedDate(),
                rfi.getPriority(),
                rfi.getStatus(),
                overdue,
                rfi.getVersion(),
                rfi.getCreatedAt(),
                rfi.getUpdatedAt());
    }

    private TransmittalResponse toTransmittalResponse(
            ProjectTransmittal transmittal,
            List<TransmittalRevisionLink> links,
            Map<UUID, DocumentRevision> revisionMap,
            Map<UUID, ProjectDocument> documentMap) {

        List<UUID> revisionIds =
                links.stream()
                        .map(
                                TransmittalRevisionLink::getDocumentRevisionId)
                        .toList();

        List<String> revisionReferences =
                links.stream()
                        .map(
                                link -> {
                                    DocumentRevision revision =
                                            revisionMap.get(
                                                    link.getDocumentRevisionId());

                                    if (revision == null) {
                                        return "Unknown revision";
                                    }

                                    ProjectDocument document =
                                            documentMap.get(
                                                    revision.getDocumentId());

                                    if (document == null) {
                                        return "Unknown document · Rev "
                                                + revision.getRevisionCode();
                                    }

                                    return document.getDocumentNumber()
                                            + " · Rev "
                                            + revision.getRevisionCode();
                                })
                        .toList();

        return new TransmittalResponse(
                transmittal.getId(),
                transmittal.getProjectId(),
                transmittal.getReference(),
                transmittal.getRecipient(),
                transmittal.getPurpose(),
                transmittal.getTransmittalDate(),
                transmittal.getIssuedDate(),
                transmittal.getNotes(),
                transmittal.getStatus(),
                revisionIds,
                revisionReferences,
                transmittal.getVersion(),
                transmittal.getCreatedAt(),
                transmittal.getUpdatedAt());
    }

    private ProjectDocument requireDocument(
            Map<UUID, ProjectDocument> map,
            UUID id) {

        ProjectDocument result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown project document: "
                            + id);
        }

        return result;
    }

    private static Map<
            DocumentRevisionStatus,
            Set<DocumentRevisionStatus>>
    revisionTransitions() {

        Map<
                DocumentRevisionStatus,
                Set<DocumentRevisionStatus>>
                map =
                new EnumMap<>(
                        DocumentRevisionStatus.class);

        map.put(
                DocumentRevisionStatus.DRAFT,
                Set.of(
                        DocumentRevisionStatus.FOR_REVIEW,
                        DocumentRevisionStatus.ISSUED,
                        DocumentRevisionStatus.APPROVED));

        map.put(
                DocumentRevisionStatus.FOR_REVIEW,
                Set.of(
                        DocumentRevisionStatus.DRAFT,
                        DocumentRevisionStatus.ISSUED,
                        DocumentRevisionStatus.APPROVED));

        map.put(
                DocumentRevisionStatus.ISSUED,
                Set.of(
                        DocumentRevisionStatus.APPROVED,
                        DocumentRevisionStatus.SUPERSEDED));

        map.put(
                DocumentRevisionStatus.APPROVED,
                Set.of(
                        DocumentRevisionStatus.SUPERSEDED));

        map.put(
                DocumentRevisionStatus.SUPERSEDED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            RfiStatus,
            Set<RfiStatus>>
    rfiTransitions() {

        Map<
                RfiStatus,
                Set<RfiStatus>>
                map =
                new EnumMap<>(
                        RfiStatus.class);

        map.put(
                RfiStatus.OPEN,
                Set.of(
                        RfiStatus.ANSWERED,
                        RfiStatus.VOID));

        map.put(
                RfiStatus.ANSWERED,
                Set.of(
                        RfiStatus.OPEN,
                        RfiStatus.CLOSED));

        map.put(
                RfiStatus.CLOSED,
                Set.of());

        map.put(
                RfiStatus.VOID,
                Set.of());

        return Map.copyOf(
                map);
    }
}
