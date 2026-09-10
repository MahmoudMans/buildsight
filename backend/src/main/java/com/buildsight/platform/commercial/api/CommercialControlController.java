package com.buildsight.platform.commercial.api;

import java.util.UUID;

import com.buildsight.platform.commercial.service.CommercialControlService;

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
        "/api/v1/projects/{projectId}/commercial")
public class CommercialControlController {

    private final CommercialControlService service;

    public CommercialControlController(
            CommercialControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public CommercialControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/change-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public CommercialChangeOrderResponse createChangeOrder(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateCommercialChangeOrderRequest request) {

        return service.createChangeOrder(
                projectId,
                request);
    }

    @PutMapping("/change-orders/{changeOrderId}")
    public CommercialChangeOrderResponse updateChangeOrder(
            @PathVariable UUID projectId,
            @PathVariable UUID changeOrderId,
            @Valid
            @RequestBody
            UpdateCommercialChangeOrderRequest request) {

        return service.updateChangeOrder(
                projectId,
                changeOrderId,
                request);
    }

    @PostMapping("/claims")
    @ResponseStatus(HttpStatus.CREATED)
    public CommercialClaimResponse createClaim(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateCommercialClaimRequest request) {

        return service.createClaim(
                projectId,
                request);
    }

    @PutMapping("/claims/{claimId}")
    public CommercialClaimResponse updateClaim(
            @PathVariable UUID projectId,
            @PathVariable UUID claimId,
            @Valid
            @RequestBody
            UpdateCommercialClaimRequest request) {

        return service.updateClaim(
                projectId,
                claimId,
                request);
    }

    @PostMapping("/payment-certificates")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentCertificateResponse createPaymentCertificate(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreatePaymentCertificateRequest request) {

        return service.createPaymentCertificate(
                projectId,
                request);
    }

    @PutMapping("/payment-certificates/{certificateId}")
    public PaymentCertificateResponse updatePaymentCertificate(
            @PathVariable UUID projectId,
            @PathVariable UUID certificateId,
            @Valid
            @RequestBody
            UpdatePaymentCertificateRequest request) {

        return service.updatePaymentCertificate(
                projectId,
                certificateId,
                request);
    }

    @PostMapping("/cashflow-periods")
    @ResponseStatus(HttpStatus.CREATED)
    public CashflowPeriodResponse createCashflowPeriod(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateCashflowPeriodRequest request) {

        return service.createCashflowPeriod(
                projectId,
                request);
    }

    @PutMapping("/cashflow-periods/{periodId}")
    public CashflowPeriodResponse updateCashflowPeriod(
            @PathVariable UUID projectId,
            @PathVariable UUID periodId,
            @Valid
            @RequestBody
            UpdateCashflowPeriodRequest request) {

        return service.updateCashflowPeriod(
                projectId,
                periodId,
                request);
    }
}
