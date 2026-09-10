package com.buildsight.platform.commercial.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.commercial.api.CommercialRiskLevel;
import com.buildsight.platform.commercial.domain.CommercialChangeOrder;
import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;
import com.buildsight.platform.commercial.domain.CommercialClaim;
import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.PaymentCertificate;
import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;
import com.buildsight.platform.commercial.domain.ProjectCashflowPeriod;

import org.springframework.stereotype.Service;

@Service
public class CommercialIntelligenceService {

    private final Clock clock;

    public CommercialIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public CommercialIntelligenceResponse calculate(
            List<CommercialChangeOrder> changeOrders,
            List<CommercialClaim> claims,
            List<PaymentCertificate> certificates,
            List<ProjectCashflowPeriod> cashflowPeriods) {

        if (changeOrders.isEmpty()
                && claims.isEmpty()
                && certificates.isEmpty()
                && cashflowPeriods.isEmpty()) {

            return new CommercialIntelligenceResponse(
                    0,
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    0,
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    0,
                    0,
                    0,
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    75,
                    CommercialRiskLevel.NO_DATA,
                    "No commercial-control records exist yet. BuildSight applies a neutral commercial score until change, claim, certification or cash-flow controls are established.");
        }

        LocalDate today =
                LocalDate.now(clock);

        long pendingChanges =
                changeOrders.stream()
                        .filter(this::isPendingChange)
                        .count();

        long overdueChangeDecisions =
                changeOrders.stream()
                        .filter(this::isPendingChange)
                        .filter(
                                change ->
                                        change.getDecisionDueDate() != null)
                        .filter(
                                change ->
                                        change.getDecisionDueDate()
                                                .isBefore(today))
                        .count();

        BigDecimal submittedChangeValue =
                changeOrders.stream()
                        .filter(
                                change ->
                                        change.getStatus()
                                                != CommercialChangeOrderStatus.VOID)
                        .map(
                                CommercialChangeOrder::getSubmittedAmount)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal approvedChangeValue =
                changeOrders.stream()
                        .filter(
                                change ->
                                        change.getStatus()
                                                == CommercialChangeOrderStatus.APPROVED)
                        .map(
                                CommercialChangeOrder::getApprovedAmount)
                        .filter(
                                value ->
                                        value != null)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        long openClaims =
                claims.stream()
                        .filter(this::isOpenClaim)
                        .count();

        long overdueClaimResponses =
                claims.stream()
                        .filter(this::awaitingClaimDecision)
                        .filter(
                                claim ->
                                        claim.getResponseDueDate() != null)
                        .filter(
                                claim ->
                                        claim.getResponseDueDate()
                                                .isBefore(today))
                        .count();

        BigDecimal claimedValue =
                claims.stream()
                        .filter(
                                claim ->
                                        claim.getStatus()
                                                != CommercialClaimStatus.VOID)
                        .map(
                                CommercialClaim::getClaimedAmount)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal awardedClaimValue =
                claims.stream()
                        .filter(
                                claim ->
                                        claim.getStatus()
                                                != CommercialClaimStatus.VOID)
                        .map(
                                CommercialClaim::getAwardedAmount)
                        .filter(
                                value ->
                                        value != null)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        long claimedDays =
                claims.stream()
                        .filter(
                                claim ->
                                        claim.getStatus()
                                                != CommercialClaimStatus.VOID)
                        .mapToLong(
                                CommercialClaim::getClaimedDays)
                        .sum();

        long awardedDays =
                claims.stream()
                        .filter(
                                claim ->
                                        claim.getStatus()
                                                != CommercialClaimStatus.VOID)
                        .mapToLong(
                                CommercialClaim::getAwardedDays)
                        .sum();

        long awaitingCertification =
                certificates.stream()
                        .filter(
                                certificate ->
                                        certificate.getStatus()
                                                == PaymentCertificateStatus.SUBMITTED)
                        .count();

        long overdueCertifications =
                certificates.stream()
                        .filter(
                                certificate ->
                                        certificate.getStatus()
                                                == PaymentCertificateStatus.SUBMITTED)
                        .filter(
                                certificate ->
                                        certificate.getCertificationDueDate()
                                                .isBefore(today))
                        .count();

        BigDecimal certifiedValue =
                certificates.stream()
                        .map(
                                PaymentCertificate::getCertifiedAmount)
                        .filter(
                                value ->
                                        value != null)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal retentionHeld =
                certificates.stream()
                        .map(
                                PaymentCertificate::getRetentionAmount)
                        .filter(
                                value ->
                                        value != null)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal paidValue =
                certificates.stream()
                        .map(
                                PaymentCertificate::getAmountPaid)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal outstandingCertified =
                certificates.stream()
                        .map(
                                PaymentCertificate::outstandingAmount)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        long overduePayments =
                certificates.stream()
                        .filter(
                                certificate ->
                                        certificate.getStatus()
                                                        == PaymentCertificateStatus.CERTIFIED
                                                || certificate.getStatus()
                                                        == PaymentCertificateStatus.PARTIALLY_PAID)
                        .filter(
                                certificate ->
                                        certificate.getPaymentDueDate() != null)
                        .filter(
                                certificate ->
                                        certificate.getPaymentDueDate()
                                                .isBefore(today))
                        .filter(
                                certificate ->
                                        certificate.outstandingAmount()
                                                .signum() > 0)
                        .count();

        BigDecimal plannedNet =
                cashflowPeriods.stream()
                        .map(
                                ProjectCashflowPeriod::plannedNet)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal forecastNet =
                cashflowPeriods.stream()
                        .map(
                                ProjectCashflowPeriod::forecastNet)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal actualNet =
                cashflowPeriods.stream()
                        .map(
                                ProjectCashflowPeriod::actualNet)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal forecastVariance =
                forecastNet.subtract(
                        plannedNet);

        BigDecimal plannedInflows =
                cashflowPeriods.stream()
                        .map(
                                ProjectCashflowPeriod::getPlannedInflow)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        double score =
                100;

        score -=
                Math.min(
                        18,
                        overdueChangeDecisions
                                * 6.0);

        score -=
                Math.min(
                        24,
                        overdueClaimResponses
                                * 8.0);

        score -=
                Math.min(
                        30,
                        overdueCertifications
                                * 10.0);

        score -=
                Math.min(
                        36,
                        overduePayments
                                * 12.0);

        if (certifiedValue.signum() > 0) {

            BigDecimal netCertified =
                    certifiedValue
                            .subtract(retentionHeld)
                            .max(BigDecimal.ZERO);

            if (netCertified.signum() > 0) {

                double outstandingPercent =
                        outstandingCertified
                                .multiply(
                                        BigDecimal.valueOf(100))
                                .divide(
                                        netCertified,
                                        6,
                                        RoundingMode.HALF_UP)
                                .doubleValue();

                if (outstandingPercent > 25) {

                    score -=
                            Math.min(
                                    15,
                                    (outstandingPercent - 25)
                                            * 0.3);
                }
            }
        }

        if (forecastVariance.signum() < 0
                && plannedInflows.signum() > 0) {

            double shortfall =
                    forecastVariance
                            .abs()
                            .multiply(
                                    BigDecimal.valueOf(100))
                            .divide(
                                    plannedInflows,
                                    6,
                                    RoundingMode.HALF_UP)
                            .doubleValue();

            score -=
                    Math.min(
                            20,
                            shortfall * 0.5);
        }

        score =
                clamp(
                        score,
                        0,
                        100);

        CommercialRiskLevel risk =
                score >= 80
                        ? CommercialRiskLevel.ON_TRACK
                        : score >= 60
                                ? CommercialRiskLevel.WATCH
                                : CommercialRiskLevel.AT_RISK;

        return new CommercialIntelligenceResponse(
                changeOrders.size(),
                pendingChanges,
                overdueChangeDecisions,
                money(submittedChangeValue),
                money(approvedChangeValue),
                claims.size(),
                openClaims,
                overdueClaimResponses,
                money(claimedValue),
                money(awardedClaimValue),
                claimedDays,
                awardedDays,
                certificates.size(),
                awaitingCertification,
                overdueCertifications,
                money(certifiedValue),
                money(retentionHeld),
                money(paidValue),
                money(outstandingCertified),
                overduePayments,
                cashflowPeriods.size(),
                money(plannedNet),
                money(forecastNet),
                money(actualNet),
                money(forecastVariance),
                roundOne(score),
                risk,
                "Commercial Intelligence measures decision-cycle discipline for changes and claims, certification/payment timeliness, outstanding certified cash and forecast cash-flow variance. Cost forecast performance remains governed separately by BuildSight Cost Intelligence.");
    }

    private boolean isPendingChange(
            CommercialChangeOrder change) {

        return change.getStatus()
                        == CommercialChangeOrderStatus.SUBMITTED
                || change.getStatus()
                        == CommercialChangeOrderStatus.UNDER_REVIEW;
    }

    private boolean isOpenClaim(
            CommercialClaim claim) {

        return claim.getStatus()
                        != CommercialClaimStatus.SETTLED
                && claim.getStatus()
                        != CommercialClaimStatus.REJECTED
                && claim.getStatus()
                        != CommercialClaimStatus.VOID;
    }

    private boolean awaitingClaimDecision(
            CommercialClaim claim) {

        return claim.getStatus()
                        == CommercialClaimStatus.SUBMITTED
                || claim.getStatus()
                        == CommercialClaimStatus.UNDER_REVIEW;
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private double clamp(
            double value,
            double minimum,
            double maximum) {

        return Math.max(
                minimum,
                Math.min(
                        maximum,
                        value));
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }
}
