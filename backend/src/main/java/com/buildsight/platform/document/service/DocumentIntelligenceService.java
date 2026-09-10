package com.buildsight.platform.document.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.api.InformationRiskLevel;
import com.buildsight.platform.document.domain.DocumentRevision;
import com.buildsight.platform.document.domain.DocumentType;
import com.buildsight.platform.document.domain.ProjectDocument;
import com.buildsight.platform.document.domain.ProjectRfi;
import com.buildsight.platform.document.domain.ProjectTransmittal;
import com.buildsight.platform.document.domain.RfiPriority;
import com.buildsight.platform.document.domain.RfiStatus;
import com.buildsight.platform.document.domain.TransmittalStatus;

import org.springframework.stereotype.Service;

@Service
public class DocumentIntelligenceService {

    private final Clock clock;

    public DocumentIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public DocumentIntelligenceResponse calculate(
            List<ProjectDocument> documents,
            List<DocumentRevision> revisions,
            List<ProjectRfi> rfis,
            List<ProjectTransmittal> transmittals) {

        if (documents.isEmpty()
                && rfis.isEmpty()
                && transmittals.isEmpty()) {

            return new DocumentIntelligenceResponse(
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
                    75.0,
                    InformationRiskLevel.NO_DATA,
                    "No document-control information exists yet. BuildSight applies a neutral information-management score until documents, RFIs or transmittals are established.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        long drawings =
                documents.stream()
                        .filter(
                                document ->
                                        document.getDocumentType()
                                                == DocumentType.DRAWING)
                        .count();

        long extracted =
                revisions.stream()
                        .filter(
                                revision ->
                                        revision.getExtractedText()
                                                != null
                                                && !revision
                                                        .getExtractedText()
                                                        .isBlank())
                        .count();

        long openRfis =
                rfis.stream()
                        .filter(
                                rfi ->
                                        rfi.getStatus()
                                                == RfiStatus.OPEN
                                                || rfi.getStatus()
                                                == RfiStatus.ANSWERED)
                        .count();

        long overdueRfis =
                rfis.stream()
                        .filter(
                                rfi ->
                                        rfi.getStatus()
                                                == RfiStatus.OPEN)
                        .filter(
                                rfi ->
                                        rfi.getDueDate()
                                                .isBefore(
                                                        today))
                        .count();

        long criticalOpenRfis =
                rfis.stream()
                        .filter(
                                rfi ->
                                        rfi.getStatus()
                                                == RfiStatus.OPEN)
                        .filter(
                                rfi ->
                                        rfi.getPriority()
                                                == RfiPriority.CRITICAL)
                        .count();

        long draftTransmittals =
                transmittals.stream()
                        .filter(
                                transmittal ->
                                        transmittal.getStatus()
                                                == TransmittalStatus.DRAFT)
                        .count();

        long staleDraftTransmittals =
                transmittals.stream()
                        .filter(
                                transmittal ->
                                        transmittal.getStatus()
                                                == TransmittalStatus.DRAFT)
                        .filter(
                                transmittal ->
                                        transmittal
                                                .getTransmittalDate()
                                                .isBefore(
                                                        today.minusDays(
                                                                7)))
                        .count();

        long issuedTransmittals =
                transmittals.stream()
                        .filter(
                                transmittal ->
                                        transmittal.getStatus()
                                                == TransmittalStatus.ISSUED)
                        .count();

        double score =
                100.0;

        score -=
                Math.min(
                        40.0,
                        overdueRfis
                                * 10.0);

        score -=
                Math.min(
                        36.0,
                        criticalOpenRfis
                                * 12.0);

        score -=
                Math.min(
                        20.0,
                        staleDraftTransmittals
                                * 5.0);

        if (!revisions.isEmpty()) {

            double extractionCoverage =
                    extracted
                            * 100.0
                            / revisions.size();

            if (extractionCoverage
                    < 50.0) {

                score -=
                        Math.min(
                                10.0,
                                (50.0
                                        - extractionCoverage)
                                        * 0.20);
            }
        }

        score =
                clamp(
                        score,
                        0,
                        100);

        InformationRiskLevel risk =
                score >= 80
                        ? InformationRiskLevel.ON_TRACK
                        : score >= 60
                                ? InformationRiskLevel.WATCH
                                : InformationRiskLevel.AT_RISK;

        return new DocumentIntelligenceResponse(
                documents.size(),
                revisions.size(),
                drawings,
                extracted,
                openRfis,
                overdueRfis,
                criticalOpenRfis,
                draftTransmittals,
                staleDraftTransmittals,
                issuedTransmittals,
                roundOne(
                        score),
                risk,
                "Information Intelligence measures overdue and critical RFIs, stale draft transmittals and local text-extraction coverage. Controlled document revisions remain searchable by metadata even when a binary file does not expose extractable text.");
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
