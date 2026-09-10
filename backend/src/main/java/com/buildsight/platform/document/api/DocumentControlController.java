package com.buildsight.platform.document.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.document.domain.DocumentRevisionStatus;
import com.buildsight.platform.document.service.DocumentBinaryResponse;
import com.buildsight.platform.document.service.DocumentControlService;
import com.buildsight.platform.document.service.DocumentSearchService;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/documents")
public class DocumentControlController {

    private final DocumentControlService
            documentControlService;

    private final DocumentSearchService
            searchService;

    public DocumentControlController(
            DocumentControlService documentControlService,
            DocumentSearchService searchService) {

        this.documentControlService =
                documentControlService;

        this.searchService =
                searchService;
    }

    @GetMapping
    public DocumentControlResponse get(
            @PathVariable UUID projectId) {

        return documentControlService.get(
                projectId);
    }

    @PostMapping
    public DocumentResponse createDocument(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateDocumentRequest request) {

        return documentControlService
                .createDocument(
                        projectId,
                        request);
    }

    @PostMapping(
            value = "/{documentId}/revisions",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentRevisionResponse uploadRevision(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @RequestParam String revisionCode,
            @RequestParam DocumentRevisionStatus status,
            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE)
            LocalDate issuedDate,
            @RequestPart("file")
            MultipartFile file) {

        return documentControlService
                .uploadRevision(
                        projectId,
                        documentId,
                        revisionCode,
                        status,
                        issuedDate,
                        file);
    }

    @PutMapping(
            "/{documentId}/revisions/{revisionId}/status")
    public DocumentRevisionResponse updateRevisionStatus(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @PathVariable UUID revisionId,
            @Valid
            @RequestBody
            UpdateDocumentRevisionStatusRequest request) {

        return documentControlService
                .updateRevisionStatus(
                        projectId,
                        documentId,
                        revisionId,
                        request);
    }

    @GetMapping(
            "/{documentId}/revisions/{revisionId}/content")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID projectId,
            @PathVariable UUID documentId,
            @PathVariable UUID revisionId) {

        DocumentBinaryResponse binary =
                documentControlService.download(
                        projectId,
                        documentId,
                        revisionId);

        MediaType mediaType;

        try {
            mediaType =
                    MediaType.parseMediaType(
                            binary.contentType());

        } catch (Exception exception) {
            mediaType =
                    MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(
                        mediaType)
                .contentLength(
                        binary.content().length)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition
                                .attachment()
                                .filename(
                                        binary.fileName())
                                .build()
                                .toString())
                .body(
                        binary.content());
    }

    @PostMapping("/rfis")
    public RfiResponse createRfi(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateRfiRequest request) {

        return documentControlService
                .createRfi(
                        projectId,
                        request);
    }

    @PutMapping("/rfis/{rfiId}")
    public RfiResponse updateRfi(
            @PathVariable UUID projectId,
            @PathVariable UUID rfiId,
            @Valid
            @RequestBody
            UpdateRfiRequest request) {

        return documentControlService
                .updateRfi(
                        projectId,
                        rfiId,
                        request);
    }

    @PostMapping("/transmittals")
    public TransmittalResponse createTransmittal(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateTransmittalRequest request) {

        return documentControlService
                .createTransmittal(
                        projectId,
                        request);
    }

    @PostMapping(
            "/transmittals/{transmittalId}/issue")
    public TransmittalResponse issueTransmittal(
            @PathVariable UUID projectId,
            @PathVariable UUID transmittalId,
            @Valid
            @RequestBody
            IssueTransmittalRequest request) {

        return documentControlService
                .issueTransmittal(
                        projectId,
                        transmittalId,
                        request);
    }

    @GetMapping("/search")
    public List<DocumentSearchResultResponse> search(
            @PathVariable UUID projectId,
            @RequestParam String q) {

        return searchService.search(
                projectId,
                q);
    }
}
