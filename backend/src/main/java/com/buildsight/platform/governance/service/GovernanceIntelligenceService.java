package com.buildsight.platform.governance.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.domain.GovernanceActionPriority;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.GovernanceRiskLevel;
import com.buildsight.platform.governance.domain.ProjectGovernanceAction;
import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;
import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;

import org.springframework.stereotype.Service;

@Service
public class GovernanceIntelligenceService {

    private static final double COMPOUND_ACTION_BREAKDOWN_PENALTY =
            10;

    private final Clock clock;

    public GovernanceIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public GovernanceIntelligenceResponse calculate(
            List<ProjectGovernanceMeeting> meetings,
            List<ProjectGovernanceDecision> decisions,
            List<ProjectGovernanceAction> actions) {

        LocalDate today =
                LocalDate.now(
                        clock);

        if (
                meetings.isEmpty()
                && decisions.isEmpty()
                && actions.isEmpty()) {

            return GovernanceIntelligenceResponse.noData(
                    today);
        }

        long plannedMeetings =
                meetings.stream()
                        .filter(
                                meeting ->
                                        meeting.getStatus()
                                                == GovernanceMeetingStatus.PLANNED)
                        .count();

        long heldMeetings =
                meetings.stream()
                        .filter(
                                meeting ->
                                        meeting.getStatus()
                                                == GovernanceMeetingStatus.HELD)
                        .count();

        long meetingsWithoutMinutes =
                meetings.stream()
                        .filter(
                                meeting ->
                                        meeting.getStatus()
                                                == GovernanceMeetingStatus.HELD)
                        .filter(
                                meeting ->
                                        blank(
                                                meeting.getMinutes()))
                        .count();

        long pendingDecisions =
                decisions.stream()
                        .filter(
                                decision ->
                                        decision.getStatus()
                                                == GovernanceDecisionStatus.PROPOSED
                                                || decision.getStatus()
                                                == GovernanceDecisionStatus.APPROVED)
                        .count();

        long implementedDecisions =
                decisions.stream()
                        .filter(
                                decision ->
                                        decision.getStatus()
                                                == GovernanceDecisionStatus.IMPLEMENTED)
                        .count();

        long overdueDecisions =
                decisions.stream()
                        .filter(
                                decision ->
                                        decision.getDueDate()
                                                != null)
                        .filter(
                                decision ->
                                        decision.getDueDate()
                                                .isBefore(
                                                        today))
                        .filter(
                                decision ->
                                        decision.getStatus()
                                                != GovernanceDecisionStatus.IMPLEMENTED
                                                && decision.getStatus()
                                                != GovernanceDecisionStatus.REJECTED
                                                && decision.getStatus()
                                                != GovernanceDecisionStatus.SUPERSEDED)
                        .count();

        long openActions =
                actions.stream()
                        .filter(
                                action ->
                                        isOpen(
                                                action.getStatus()))
                        .count();

        long completedActions =
                actions.stream()
                        .filter(
                                action ->
                                        action.getStatus()
                                                == GovernanceActionStatus.DONE)
                        .count();

        long overdueActions =
                actions.stream()
                        .filter(
                                action ->
                                        isOpen(
                                                action.getStatus()))
                        .filter(
                                action ->
                                        action.getDueDate()
                                                .isBefore(
                                                        today))
                        .count();

        long criticalOpenActions =
                actions.stream()
                        .filter(
                                action ->
                                        isOpen(
                                                action.getStatus()))
                        .filter(
                                action ->
                                        action.getPriority()
                                                == GovernanceActionPriority.CRITICAL)
                        .count();

        long blockedActions =
                actions.stream()
                        .filter(
                                action ->
                                        action.getStatus()
                                                == GovernanceActionStatus.BLOCKED)
                        .count();

        LocalDate next14Days =
                today.plusDays(
                        14);

        long actionsDueNext14Days =
                actions.stream()
                        .filter(
                                action ->
                                        isOpen(
                                                action.getStatus()))
                        .filter(
                                action ->
                                        !action.getDueDate()
                                                .isBefore(
                                                        today))
                        .filter(
                                action ->
                                        !action.getDueDate()
                                                .isAfter(
                                                        next14Days))
                        .count();

        double actionClosureRate =
                actions.isEmpty()
                        ? 0
                        : completedActions
                                * 100.0
                                / actions.size();

        double decisionClosureRate =
                decisions.isEmpty()
                        ? 0
                        : decisions.stream()
                                .filter(
                                        decision ->
                                                decision.getStatus()
                                                        == GovernanceDecisionStatus.IMPLEMENTED
                                                        || decision.getStatus()
                                                        == GovernanceDecisionStatus.REJECTED
                                                        || decision.getStatus()
                                                        == GovernanceDecisionStatus.SUPERSEDED)
                                .count()
                                * 100.0
                                / decisions.size();

        double score =
                100;

        score -=
                Math.min(
                        30,
                        overdueActions
                                * 6.0);

        score -=
                Math.min(
                        20,
                        criticalOpenActions
                                * 5.0);

        score -=
                Math.min(
                        24,
                        blockedActions
                                * 8.0);

        score -=
                Math.min(
                        20,
                        overdueDecisions
                                * 5.0);

        score -=
                Math.min(
                        24,
                        meetingsWithoutMinutes
                                * 8.0);

        /*
         * A critical action that is both overdue and blocked represents
         * compounded management failure rather than three isolated signals.
         * Apply one bounded escalation penalty so severe follow-through
         * breakdown crosses the executive AT_RISK threshold.
         */
        if (
                overdueActions > 0
                && criticalOpenActions > 0
                && blockedActions > 0) {

            score -=
                    COMPOUND_ACTION_BREAKDOWN_PENALTY;
        }

        if (
                actions.size() >= 4
                && actionClosureRate < 50) {

            score -=
                    10;
        }

        if (
                decisions.size() >= 3
                && decisionClosureRate < 50) {

            score -=
                    8;
        }

        score =
                clamp(
                        score,
                        0,
                        100);

        GovernanceRiskLevel risk =
                score >= 80
                        ? GovernanceRiskLevel.ON_TRACK
                        : score >= 60
                                ? GovernanceRiskLevel.WATCH
                                : GovernanceRiskLevel.AT_RISK;

        return new GovernanceIntelligenceResponse(
                today,

                meetings.size(),
                plannedMeetings,
                heldMeetings,
                meetingsWithoutMinutes,

                decisions.size(),
                pendingDecisions,
                overdueDecisions,
                implementedDecisions,

                actions.size(),
                openActions,
                overdueActions,
                criticalOpenActions,
                blockedActions,
                actionsDueNext14Days,
                completedActions,

                roundOne(
                        actionClosureRate),

                roundOne(
                        decisionClosureRate),

                roundOne(
                        score),

                risk,

                "Governance Intelligence measures management follow-through rather than delivery performance. It considers overdue and critical actions, blockers, overdue decisions, missing meeting minutes and closure discipline.");
    }

    private boolean isOpen(
            GovernanceActionStatus status) {

        return status
                != GovernanceActionStatus.DONE
                && status
                != GovernanceActionStatus.VOID;
    }

    private boolean blank(
            String value) {

        return value == null
                || value.isBlank();
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
