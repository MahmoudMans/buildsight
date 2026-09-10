package com.buildsight.platform.procurement.api;

import java.util.UUID;

import com.buildsight.platform.procurement.service.ProcurementControlService;

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
        "/api/v1/projects/{projectId}/procurement")
public class ProcurementControlController {

    private final ProcurementControlService
            procurementControlService;

    public ProcurementControlController(
            ProcurementControlService procurementControlService) {

        this.procurementControlService =
                procurementControlService;
    }

    @GetMapping
    public ProcurementControlResponse get(
            @PathVariable UUID projectId) {

        return procurementControlService
                .get(
                        projectId);
    }

    @PostMapping("/packages")
    @ResponseStatus(HttpStatus.CREATED)
    public ProcurementPackageResponse createPackage(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateProcurementPackageRequest request) {

        return procurementControlService
                .createPackage(
                        projectId,
                        request);
    }

    @PutMapping("/packages/{packageId}")
    public ProcurementPackageResponse updatePackage(
            @PathVariable UUID projectId,
            @PathVariable UUID packageId,
            @Valid
            @RequestBody
            UpdateProcurementPackageRequest request) {

        return procurementControlService
                .updatePackage(
                        projectId,
                        packageId,
                        request);
    }

    @PostMapping("/packages/{packageId}/bids")
    @ResponseStatus(HttpStatus.CREATED)
    public ProcurementBidResponse createBid(
            @PathVariable UUID projectId,
            @PathVariable UUID packageId,
            @Valid
            @RequestBody
            CreateProcurementBidRequest request) {

        return procurementControlService
                .createBid(
                        projectId,
                        packageId,
                        request);
    }

    @PutMapping(
            "/packages/{packageId}/bids/{bidId}")
    public ProcurementBidResponse updateBid(
            @PathVariable UUID projectId,
            @PathVariable UUID packageId,
            @PathVariable UUID bidId,
            @Valid
            @RequestBody
            UpdateProcurementBidRequest request) {

        return procurementControlService
                .updateBid(
                        projectId,
                        packageId,
                        bidId,
                        request);
    }

    @PostMapping("/packages/{packageId}/award")
    public ProcurementPackageResponse award(
            @PathVariable UUID projectId,
            @PathVariable UUID packageId,
            @Valid
            @RequestBody
            AwardProcurementPackageRequest request) {

        return procurementControlService
                .award(
                        projectId,
                        packageId,
                        request);
    }

    @PostMapping("/performance-evaluations")
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierPerformanceEvaluationResponse
    createPerformanceEvaluation(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateSupplierPerformanceEvaluationRequest request) {

        return procurementControlService
                .createPerformanceEvaluation(
                        projectId,
                        request);
    }
}
