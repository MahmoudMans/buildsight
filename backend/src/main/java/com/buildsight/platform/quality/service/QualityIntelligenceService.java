package com.buildsight.platform.quality.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.api.QualityRiskLevel;
import com.buildsight.platform.quality.domain.HandoverStatus;
import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;
import com.buildsight.platform.quality.domain.NcrStatus;
import com.buildsight.platform.quality.domain.ProjectHandoverItem;
import com.buildsight.platform.quality.domain.ProjectNcr;
import com.buildsight.platform.quality.domain.ProjectPunchItem;
import com.buildsight.platform.quality.domain.ProjectQualityInspection;
import com.buildsight.platform.quality.domain.PunchStatus;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;

import org.springframework.stereotype.Service;

@Service
public class QualityIntelligenceService {

    private final Clock clock;

    public QualityIntelligenceService(
            Clock clock) {

        this.clock = clock;
    }

    public QualityIntelligenceResponse calculate(
            List<ProjectQualityInspection> inspections,
            List<ProjectNcr> ncrs,
            List<ProjectPunchItem> punchItems,
            List<ProjectHandoverItem> handoverItems) {

        if (inspections.isEmpty()
                && ncrs.isEmpty()
                && punchItems.isEmpty()
                && handoverItems.isEmpty()) {

            return new QualityIntelligenceResponse(
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
                    0,
                    0,
                    75,
                    QualityRiskLevel.NO_DATA,
                    "No quality-control records exist yet. BuildSight applies a neutral quality score until inspection, NCR, punch or handover controls are established.");
        }

        LocalDate today =
                LocalDate.now(clock);

        List<ProjectQualityInspection> completed =
                inspections.stream()
                        .filter(
                                inspection ->
                                        inspection.getStatus()
                                                == QualityInspectionStatus.COMPLETED)
                        .toList();

        long passed =
                completed.stream()
                        .filter(
                                inspection ->
                                        inspection.getResult()
                                                        == QualityInspectionResult.PASS
                                                || inspection.getResult()
                                                        == QualityInspectionResult.PASS_WITH_OBSERVATIONS)
                        .count();

        long failed =
                completed.stream()
                        .filter(
                                inspection ->
                                        inspection.getResult()
                                                == QualityInspectionResult.FAIL)
                        .count();

        double passRate =
                completed.isEmpty()
                        ? 100
                        : passed
                                * 100.0
                                / completed.size();

        long openNcrs =
                ncrs.stream()
                        .filter(this::isOpenNcr)
                        .count();

        long criticalOpenNcrs =
                ncrs.stream()
                        .filter(this::isOpenNcr)
                        .filter(
                                ncr ->
                                        ncr.getSeverity()
                                                == NcrSeverity.CRITICAL)
                        .count();

        long overdueNcrs =
                ncrs.stream()
                        .filter(this::isOpenNcr)
                        .filter(
                                ncr ->
                                        ncr.getDueDate()
                                                .isBefore(today))
                        .count();

        Map<NcrCategory, Long> categoryCount =
                ncrs.stream()
                        .filter(
                                ncr ->
                                        ncr.getStatus()
                                                != NcrStatus.VOID)
                        .collect(
                                Collectors.groupingBy(
                                        ProjectNcr::getCategory,
                                        Collectors.counting()));

        long recurringDefectCategories =
                categoryCount.values()
                        .stream()
                        .filter(
                                count ->
                                        count >= 2)
                        .count();

        long openPunchItems =
                punchItems.stream()
                        .filter(this::isOpenPunch)
                        .count();

        long overduePunchItems =
                punchItems.stream()
                        .filter(this::isOpenPunch)
                        .filter(
                                punch ->
                                        punch.getDueDate()
                                                .isBefore(today))
                        .count();

        List<ProjectHandoverItem> requiredHandover =
                handoverItems.stream()
                        .filter(
                                item ->
                                        item.getStatus()
                                                != HandoverStatus.NOT_REQUIRED)
                        .toList();

        long approvedHandover =
                requiredHandover.stream()
                        .filter(
                                item ->
                                        item.getStatus()
                                                == HandoverStatus.APPROVED)
                        .count();

        long overdueHandover =
                requiredHandover.stream()
                        .filter(
                                item ->
                                        item.getStatus()
                                                != HandoverStatus.APPROVED)
                        .filter(
                                item ->
                                        item.getDueDate()
                                                .isBefore(today))
                        .count();

        double handoverReadiness =
                requiredHandover.isEmpty()
                        ? 100
                        : approvedHandover
                                * 100.0
                                / requiredHandover.size();

        double score =
                100.0;

        if (!completed.isEmpty()) {
            score -=
                    Math.min(
                            25,
                            Math.max(
                                    0,
                                    100 - passRate)
                                    * 0.35);
        }

        score -=
                Math.min(
                        30,
                        criticalOpenNcrs * 15.0);

        score -=
                Math.min(
                        32,
                        overdueNcrs * 8.0);

        score -=
                Math.min(
                        18,
                        recurringDefectCategories * 6.0);

        score -=
                Math.min(
                        18,
                        overduePunchItems * 3.0);

        score -=
                Math.min(
                        20,
                        overdueHandover * 5.0);

        score =
                clamp(
                        score,
                        0,
                        100);

        QualityRiskLevel risk =
                score >= 80
                        ? QualityRiskLevel.ON_TRACK
                        : score >= 60
                                ? QualityRiskLevel.WATCH
                                : QualityRiskLevel.AT_RISK;

        return new QualityIntelligenceResponse(
                inspections.size(),
                completed.size(),
                passed,
                failed,
                roundOne(passRate),
                openNcrs,
                criticalOpenNcrs,
                overdueNcrs,
                recurringDefectCategories,
                openPunchItems,
                overduePunchItems,
                requiredHandover.size(),
                approvedHandover,
                overdueHandover,
                roundOne(handoverReadiness),
                roundOne(score),
                risk,
                "Quality Intelligence combines completed inspection outcomes, critical and overdue NCRs, recurring defect categories, overdue punch items and overdue handover obligations. Handover readiness is reported separately so future deliverables do not reduce quality health before they are actually due.");
    }

    private boolean isOpenNcr(
            ProjectNcr ncr) {

        return ncr.getStatus() != NcrStatus.CLOSED
                && ncr.getStatus() != NcrStatus.VOID;
    }

    private boolean isOpenPunch(
            ProjectPunchItem item) {

        return item.getStatus() != PunchStatus.CLOSED
                && item.getStatus() != PunchStatus.VOID;
    }

    private double clamp(
            double value,
            double min,
            double max) {

        return Math.max(
                min,
                Math.min(
                        max,
                        value));
    }

    private double roundOne(
            double value) {

        return Math.round(value * 10.0) / 10.0;
    }
}
