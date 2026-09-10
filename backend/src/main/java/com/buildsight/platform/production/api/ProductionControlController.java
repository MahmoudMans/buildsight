package com.buildsight.platform.production.api;

import java.util.UUID;

import com.buildsight.platform.production.service.ProductionControlService;

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
        "/api/v1/projects/{projectId}/production")
public class ProductionControlController {

    private final ProductionControlService
            productionControlService;

    public ProductionControlController(
            ProductionControlService productionControlService) {

        this.productionControlService =
                productionControlService;
    }

    @GetMapping
    public ProductionControlResponse get(
            @PathVariable UUID projectId) {

        return productionControlService
                .get(
                        projectId);
    }

    @PostMapping("/work-packages")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkPackageResponse createWorkPackage(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateWorkPackageRequest request) {

        return productionControlService
                .createWorkPackage(
                        projectId,
                        request);
    }

    @PutMapping("/work-packages/{workPackageId}")
    public WorkPackageResponse updateWorkPackage(
            @PathVariable UUID projectId,
            @PathVariable UUID workPackageId,
            @Valid
            @RequestBody
            UpdateWorkPackageRequest request) {

        return productionControlService
                .updateWorkPackage(
                        projectId,
                        workPackageId,
                        request);
    }

    @PostMapping("/site-reports")
    @ResponseStatus(HttpStatus.CREATED)
    public SiteReportResponse createSiteReport(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateSiteReportRequest request) {

        return productionControlService
                .createSiteReport(
                        projectId,
                        request);
    }

    @PutMapping("/site-reports/{siteReportId}")
    public SiteReportResponse updateSiteReport(
            @PathVariable UUID projectId,
            @PathVariable UUID siteReportId,
            @Valid
            @RequestBody
            UpdateSiteReportRequest request) {

        return productionControlService
                .updateSiteReport(
                        projectId,
                        siteReportId,
                        request);
    }

    @PostMapping(
            "/site-reports/{siteReportId}/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductionEntryResponse createProductionEntry(
            @PathVariable UUID projectId,
            @PathVariable UUID siteReportId,
            @Valid
            @RequestBody
            CreateProductionEntryRequest request) {

        return productionControlService
                .createProductionEntry(
                        projectId,
                        siteReportId,
                        request);
    }

    @PutMapping(
            "/site-reports/{siteReportId}/entries/{entryId}")
    public ProductionEntryResponse updateProductionEntry(
            @PathVariable UUID projectId,
            @PathVariable UUID siteReportId,
            @PathVariable UUID entryId,
            @Valid
            @RequestBody
            UpdateProductionEntryRequest request) {

        return productionControlService
                .updateProductionEntry(
                        projectId,
                        siteReportId,
                        entryId,
                        request);
    }
}
