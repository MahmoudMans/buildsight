package com.buildsight.platform.document.api;

public record DocumentIntelligenceResponse(
        long totalDocuments,
        long totalRevisions,
        long drawingDocuments,
        long extractedTextRevisions,
        long openRfis,
        long overdueRfis,
        long criticalOpenRfis,
        long draftTransmittals,
        long staleDraftTransmittals,
        long issuedTransmittals,
        double informationScore,
        InformationRiskLevel informationRisk,
        String explanation) {
}
