package com.buildsight.platform.risk.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.buildsight.platform.risk.api.RiskIntelligenceLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.domain.ChangeEventStatus;
import com.buildsight.platform.risk.domain.DelayStatus;
import com.buildsight.platform.risk.domain.IssueSeverity;
import com.buildsight.platform.risk.domain.IssueStatus;
import com.buildsight.platform.risk.domain.ProjectChangeEvent;
import com.buildsight.platform.risk.domain.ProjectDelayEvent;
import com.buildsight.platform.risk.domain.ProjectIssue;
import com.buildsight.platform.risk.domain.ProjectRisk;
import com.buildsight.platform.risk.domain.RiskStatus;

import org.springframework.stereotype.Service;

@Service
public class RiskIntelligenceService {

    private static final BigDecimal ZERO =
            BigDecimal.ZERO.setScale(2);

    private final Clock clock;

    public RiskIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public RiskIntelligenceResponse calculate(
            List<ProjectRisk> risks,
            List<ProjectIssue> issues,
            List<ProjectChangeEvent> changes,
            List<ProjectDelayEvent> delays) {

        if (risks.isEmpty()
                && issues.isEmpty()
                && changes.isEmpty()
                && delays.isEmpty()) {

            return new RiskIntelligenceResponse(
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    ZERO,
                    0,
                    0,
                    0,
                    75.0,
                    RiskIntelligenceLevel.NO_DATA,
                    "No project risk, issue, change or delay records exist yet. BuildSight applies a neutral risk-management score until the project control registers are established.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        long openRisks =
                risks.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                != RiskStatus.CLOSED)
                        .count();

        long highExposureRisks =
                risks.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                != RiskStatus.CLOSED)
                        .filter(
                                risk ->
                                        risk.residualScore()
                                                >= 15)
                        .count();

        long overdueMitigations =
                risks.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                == RiskStatus.OPEN
                                                || risk.getStatus()
                                                == RiskStatus.MITIGATING)
                        .filter(
                                risk ->
                                        risk.getMitigationDueDate()
                                                .isBefore(
                                                        today))
                        .count();

        int maximumResidualExposure =
                risks.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                != RiskStatus.CLOSED)
                        .mapToInt(
                                ProjectRisk::residualScore)
                        .max()
                        .orElse(0);

        double averageResidualExposure =
                risks.stream()
                        .filter(
                                risk ->
                                        risk.getStatus()
                                                != RiskStatus.CLOSED)
                        .mapToInt(
                                ProjectRisk::residualScore)
                        .average()
                        .orElse(0);

        long openIssues =
                issues.stream()
                        .filter(
                                issue ->
                                        issue.getStatus()
                                                != IssueStatus.RESOLVED
                                                && issue.getStatus()
                                                != IssueStatus.CLOSED)
                        .count();

        long criticalOpenIssues =
                issues.stream()
                        .filter(
                                issue ->
                                        issue.getSeverity()
                                                == IssueSeverity.CRITICAL)
                        .filter(
                                issue ->
                                        issue.getStatus()
                                                != IssueStatus.RESOLVED
                                                && issue.getStatus()
                                                != IssueStatus.CLOSED)
                        .count();

        long overdueIssues =
                issues.stream()
                        .filter(
                                issue ->
                                        issue.getStatus()
                                                != IssueStatus.RESOLVED
                                                && issue.getStatus()
                                                != IssueStatus.CLOSED)
                        .filter(
                                issue ->
                                        issue.getTargetResolutionDate()
                                                .isBefore(
                                                        today))
                        .count();

        long pendingChanges =
                changes.stream()
                        .filter(
                                change ->
                                        change.getStatus()
                                                == ChangeEventStatus.DRAFT
                                                || change.getStatus()
                                                == ChangeEventStatus.UNDER_REVIEW)
                        .count();

        List<ProjectChangeEvent> approvedChangeEvents =
                changes.stream()
                        .filter(
                                change ->
                                        change.getStatus()
                                                == ChangeEventStatus.APPROVED
                                                || change.getStatus()
                                                == ChangeEventStatus.IMPLEMENTED)
                        .toList();

        BigDecimal approvedChangeCostImpact =
                approvedChangeEvents.stream()
                        .map(
                                ProjectChangeEvent::getCostImpact)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        long approvedChangeScheduleImpactDays =
                approvedChangeEvents.stream()
                        .mapToLong(
                                ProjectChangeEvent::getScheduleImpactDays)
                        .sum();

        long activeDelays =
                delays.stream()
                        .filter(
                                delay ->
                                        delay.getStatus()
                                                == DelayStatus.OPEN
                                                || delay.getStatus()
                                                == DelayStatus.MITIGATING)
                        .count();

        long forecastDelayDays =
                delays.stream()
                        .filter(
                                delay ->
                                        delay.getStatus()
                                                == DelayStatus.OPEN
                                                || delay.getStatus()
                                                == DelayStatus.MITIGATING)
                        .mapToLong(
                                ProjectDelayEvent::getForecastDelayDays)
                        .sum();

        double score =
                100.0;

        score -=
                Math.min(
                        40.0,
                        highExposureRisks
                                * 10.0);

        score -=
                Math.min(
                        24.0,
                        overdueMitigations
                                * 8.0);

        score -=
                Math.min(
                        30.0,
                        criticalOpenIssues
                                * 15.0);

        score -=
                Math.min(
                        21.0,
                        overdueIssues
                                * 7.0);

        score -=
                Math.min(
                        16.0,
                        pendingChanges
                                * 4.0);

        score -=
                Math.min(
                        18.0,
                        activeDelays
                                * 6.0);

        score -=
                Math.min(
                        20.0,
                        forecastDelayDays
                                * 0.5);

        score =
                clamp(
                        score,
                        0,
                        100);

        RiskIntelligenceLevel level =
                score >= 80
                        ? RiskIntelligenceLevel.ON_TRACK
                        : score >= 60
                                ? RiskIntelligenceLevel.WATCH
                                : RiskIntelligenceLevel.AT_RISK;

        return new RiskIntelligenceResponse(
                risks.size(),
                openRisks,
                highExposureRisks,
                overdueMitigations,
                maximumResidualExposure,
                roundOne(
                        averageResidualExposure),
                openIssues,
                criticalOpenIssues,
                overdueIssues,
                pendingChanges,
                approvedChangeEvents.size(),
                money(
                        approvedChangeCostImpact),
                approvedChangeScheduleImpactDays,
                activeDelays,
                forecastDelayDays,
                roundOne(
                        score),
                level,
                "Risk Intelligence combines residual risk exposure, overdue mitigations, unresolved issues, pending changes and active delay events. Approved change impacts remain visible separately so accepted commercial changes are not automatically treated as uncontrolled risk.");
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
