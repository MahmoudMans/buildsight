package com.buildsight.platform.safety.api;

public record SafetyIntelligenceResponse(
        long totalIncidents,
        long openIncidents,
        long recordableIncidents,
        long lostTimeIncidents,
        long criticalOpenIncidents,
        long totalObservations,
        long unsafeObservations,
        long positiveObservations,
        long openActions,
        long overdueActions,
        long activePermits,
        long expiredPermits,
        long recurringHazardCategories,
        Long daysSinceLastRecordableIncident,
        double safetyScore,
        SafetyRiskLevel safetyRisk,
        String explanation) {
}
