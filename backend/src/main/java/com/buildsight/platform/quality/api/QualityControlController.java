package com.buildsight.platform.quality.api;

import java.util.UUID;

import com.buildsight.platform.quality.service.QualityControlService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/quality")
public class QualityControlController {

    private final QualityControlService service;

    public QualityControlController(
            QualityControlService service) {

        this.service = service;
    }

    @GetMapping
    public QualityControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(projectId);
    }

    @PostMapping("/inspections")
    @ResponseStatus(HttpStatus.CREATED)
    public QualityInspectionResponse createInspection(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateQualityInspectionRequest request) {

        return service.createInspection(
                projectId,
                request);
    }

    @PutMapping("/inspections/{inspectionId}")
    public QualityInspectionResponse updateInspection(
            @PathVariable UUID projectId,
            @PathVariable UUID inspectionId,
            @Valid
            @RequestBody
            UpdateQualityInspectionRequest request) {

        return service.updateInspection(
                projectId,
                inspectionId,
                request);
    }

    @PostMapping("/ncrs")
    @ResponseStatus(HttpStatus.CREATED)
    public NcrResponse createNcr(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateNcrRequest request) {

        return service.createNcr(
                projectId,
                request);
    }

    @PutMapping("/ncrs/{ncrId}")
    public NcrResponse updateNcr(
            @PathVariable UUID projectId,
            @PathVariable UUID ncrId,
            @Valid
            @RequestBody
            UpdateNcrRequest request) {

        return service.updateNcr(
                projectId,
                ncrId,
                request);
    }

    @PostMapping("/punch-items")
    @ResponseStatus(HttpStatus.CREATED)
    public PunchItemResponse createPunchItem(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreatePunchItemRequest request) {

        return service.createPunchItem(
                projectId,
                request);
    }

    @PutMapping("/punch-items/{punchItemId}")
    public PunchItemResponse updatePunchItem(
            @PathVariable UUID projectId,
            @PathVariable UUID punchItemId,
            @Valid
            @RequestBody
            UpdatePunchItemRequest request) {

        return service.updatePunchItem(
                projectId,
                punchItemId,
                request);
    }

    @PostMapping("/handover-items")
    @ResponseStatus(HttpStatus.CREATED)
    public HandoverItemResponse createHandoverItem(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateHandoverItemRequest request) {

        return service.createHandoverItem(
                projectId,
                request);
    }

    @PutMapping("/handover-items/{handoverItemId}")
    public HandoverItemResponse updateHandoverItem(
            @PathVariable UUID projectId,
            @PathVariable UUID handoverItemId,
            @Valid
            @RequestBody
            UpdateHandoverItemRequest request) {

        return service.updateHandoverItem(
                projectId,
                handoverItemId,
                request);
    }
}
