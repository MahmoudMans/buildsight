package com.buildsight.platform.safety.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyRiskLevel;
import com.buildsight.platform.safety.domain.HazardCategory;
import com.buildsight.platform.safety.domain.ProjectSafetyAction;
import com.buildsight.platform.safety.domain.ProjectSafetyIncident;
import com.buildsight.platform.safety.domain.ProjectSafetyObservation;
import com.buildsight.platform.safety.domain.ProjectWorkPermit;
import com.buildsight.platform.safety.domain.SafetyActionStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetyObservationStatus;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.SafetySeverity;
import com.buildsight.platform.safety.domain.WorkPermitStatus;

import org.springframework.stereotype.Service;

@Service
public class SafetyIntelligenceService {

    private final Clock clock;

    public SafetyIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public SafetyIntelligenceResponse calculate(
            List<ProjectSafetyIncident> incidents,
            List<ProjectSafetyObservation> observations,
            List<ProjectSafetyAction> actions,
            List<ProjectWorkPermit> permits) {

        if (incidents.isEmpty()
                && observations.isEmpty()
                && actions.isEmpty()
                && permits.isEmpty()) {

            return new SafetyIntelligenceResponse(
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
                    0,
                    0,
                    null,
                    75,
                    SafetyRiskLevel.NO_DATA,
                    "No HSE records exist yet. BuildSight applies a neutral safety score until incidents, observations, actions or work permits are established.");
        }

        LocalDate today =
                LocalDate.now(clock);

        long openIncidents =
                incidents.stream()
                        .filter(this::isOpenIncident)
                        .count();

        long recordableIncidents =
                incidents.stream()
                        .filter(
                                incident ->
                                        incident.getStatus()
                                                != SafetyIncidentStatus.VOID)
                        .filter(this::isRecordable)
                        .count();

        long lostTimeIncidents =
                incidents.stream()
                        .filter(
                                incident ->
                                        incident.getStatus()
                                                != SafetyIncidentStatus.VOID)
                        .filter(
                                incident ->
                                        incident.getIncidentType()
                                                == SafetyIncidentType.LOST_TIME_INJURY)
                        .count();

        long criticalOpenIncidents =
                incidents.stream()
                        .filter(this::isOpenIncident)
                        .filter(
                                incident ->
                                        incident.getSeverity()
                                                == SafetySeverity.CRITICAL)
                        .count();

        long recentRecordables =
                incidents.stream()
                        .filter(
                                incident ->
                                        incident.getStatus()
                                                != SafetyIncidentStatus.VOID)
                        .filter(this::isRecordable)
                        .filter(
                                incident ->
                                        !incident.getOccurredDate()
                                                .isBefore(
                                                        today.minusDays(30)))
                        .count();

        long recentLostTime =
                incidents.stream()
                        .filter(
                                incident ->
                                        incident.getStatus()
                                                != SafetyIncidentStatus.VOID)
                        .filter(
                                incident ->
                                        incident.getIncidentType()
                                                == SafetyIncidentType.LOST_TIME_INJURY)
                        .filter(
                                incident ->
                                        !incident.getOccurredDate()
                                                .isBefore(
                                                        today.minusDays(90)))
                        .count();

        long unsafeObservations =
                observations.stream()
                        .filter(
                                observation ->
                                        observation.getStatus()
                                                != SafetyObservationStatus.VOID)
                        .filter(this::isUnsafeObservation)
                        .count();

        long positiveObservations =
                observations.stream()
                        .filter(
                                observation ->
                                        observation.getStatus()
                                                != SafetyObservationStatus.VOID)
                        .filter(
                                observation ->
                                        observation.getObservationType()
                                                        == SafetyObservationType.SAFE_ACT
                                                || observation.getObservationType()
                                                        == SafetyObservationType.GOOD_PRACTICE)
                        .count();

        long openUnsafeObservations =
                observations.stream()
                        .filter(this::isUnsafeObservation)
                        .filter(
                                observation ->
                                        observation.getStatus()
                                                        != SafetyObservationStatus.CLOSED
                                                && observation.getStatus()
                                                        != SafetyObservationStatus.VOID)
                        .count();

        Map<HazardCategory, Long> hazardCounts =
                observations.stream()
                        .filter(
                                observation ->
                                        observation.getStatus()
                                                != SafetyObservationStatus.VOID)
                        .filter(this::isUnsafeObservation)
                        .collect(
                                Collectors.groupingBy(
                                        ProjectSafetyObservation::getHazardCategory,
                                        Collectors.counting()));

        long recurringHazards =
                hazardCounts.values()
                        .stream()
                        .filter(
                                count ->
                                        count >= 2)
                        .count();

        long openActions =
                actions.stream()
                        .filter(this::isOpenAction)
                        .count();

        long overdueActions =
                actions.stream()
                        .filter(this::isOpenAction)
                        .filter(
                                action ->
                                        action.getDueDate()
                                                .isBefore(today))
                        .count();

        long activePermits =
                permits.stream()
                        .filter(
                                permit ->
                                        permit.getStatus()
                                                        == WorkPermitStatus.ACTIVE
                                                || permit.getStatus()
                                                        == WorkPermitStatus.SUSPENDED)
                        .count();

        long expiredPermits =
                permits.stream()
                        .filter(
                                permit ->
                                        permit.getStatus()
                                                        == WorkPermitStatus.ACTIVE
                                                || permit.getStatus()
                                                        == WorkPermitStatus.SUSPENDED)
                        .filter(
                                permit ->
                                        permit.getValidUntil()
                                                .isBefore(today))
                        .count();

        Long daysSinceLastRecordable =
                incidents.stream()
                        .filter(
                                incident ->
                                        incident.getStatus()
                                                != SafetyIncidentStatus.VOID)
                        .filter(this::isRecordable)
                        .map(
                                ProjectSafetyIncident::getOccurredDate)
                        .max(LocalDate::compareTo)
                        .map(
                                date ->
                                        ChronoUnit.DAYS.between(
                                                date,
                                                today))
                        .orElse(null);

        double score =
                100;

        score -=
                Math.min(
                        40,
                        criticalOpenIncidents
                                * 20.0);

        score -=
                Math.min(
                        24,
                        recentRecordables
                                * 12.0);

        score -=
                Math.min(
                        40,
                        recentLostTime
                                * 20.0);

        score -=
                Math.min(
                        32,
                        overdueActions
                                * 8.0);

        score -=
                Math.min(
                        30,
                        expiredPermits
                                * 15.0);

        score -=
                Math.min(
                        15,
                        recurringHazards
                                * 5.0);

        score -=
                Math.min(
                        15,
                        openUnsafeObservations
                                * 3.0);

        score =
                clamp(
                        score,
                        0,
                        100);

        SafetyRiskLevel risk =
                score >= 80
                        ? SafetyRiskLevel.ON_TRACK
                        : score >= 60
                                ? SafetyRiskLevel.WATCH
                                : SafetyRiskLevel.AT_RISK;

        return new SafetyIntelligenceResponse(
                incidents.size(),
                openIncidents,
                recordableIncidents,
                lostTimeIncidents,
                criticalOpenIncidents,
                observations.size(),
                unsafeObservations,
                positiveObservations,
                openActions,
                overdueActions,
                activePermits,
                expiredPermits,
                recurringHazards,
                daysSinceLastRecordable,
                roundOne(score),
                risk,
                "HSE Intelligence combines lagging incident severity with leading controls: unresolved unsafe observations, overdue HSE actions, recurring hazard themes and expired permits-to-work. Observation reporting itself is not penalized; unresolved risk and control failure are.");
    }

    private boolean isOpenIncident(
            ProjectSafetyIncident incident) {

        return incident.getStatus()
                        != SafetyIncidentStatus.CLOSED
                && incident.getStatus()
                        != SafetyIncidentStatus.VOID;
    }

    private boolean isRecordable(
            ProjectSafetyIncident incident) {

        return incident.getIncidentType()
                        == SafetyIncidentType.MEDICAL_TREATMENT
                || incident.getIncidentType()
                        == SafetyIncidentType.LOST_TIME_INJURY;
    }

    private boolean isUnsafeObservation(
            ProjectSafetyObservation observation) {

        return observation.getObservationType()
                        == SafetyObservationType.UNSAFE_ACT
                || observation.getObservationType()
                        == SafetyObservationType.UNSAFE_CONDITION;
    }

    private boolean isOpenAction(
            ProjectSafetyAction action) {

        return action.getStatus()
                        != SafetyActionStatus.CLOSED
                && action.getStatus()
                        != SafetyActionStatus.VOID;
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
