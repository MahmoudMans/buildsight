package com.buildsight.platform.governance.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.governance.domain.GovernanceActionPriority;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionImpactArea;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingType;
import com.buildsight.platform.governance.domain.GovernanceRiskLevel;
import com.buildsight.platform.project.api.ProjectResponse;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class GovernanceModels {

    private GovernanceModels() {
    }

    public record CreateMeetingRequest(
            @NotBlank
            @Size(max = 64)
            String meetingNumber,

            @NotBlank
            @Size(max = 220)
            String title,

            @NotNull
            GovernanceMeetingType meetingType,

            @NotNull
            Instant scheduledAt,

            @Size(max = 160)
            String chairName) {
    }

    public record UpdateMeetingRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 220)
            String title,

            @NotNull
            GovernanceMeetingType meetingType,

            @NotNull
            Instant scheduledAt,

            Instant heldAt,

            @NotNull
            GovernanceMeetingStatus status,

            @Size(max = 160)
            String chairName,

            String minutes,

            Instant nextMeetingAt) {
    }

    public record MeetingResponse(
            UUID id,
            UUID projectId,
            String meetingNumber,
            String title,
            GovernanceMeetingType meetingType,
            Instant scheduledAt,
            Instant heldAt,
            GovernanceMeetingStatus status,
            String chairName,
            String minutes,
            Instant nextMeetingAt,
            boolean missingMinutes,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateDecisionRequest(
            UUID meetingId,

            @NotBlank
            @Size(max = 64)
            String decisionNumber,

            @NotBlank
            @Size(max = 220)
            String title,

            String description,

            @NotNull
            LocalDate decisionDate,

            @Size(max = 160)
            String ownerName,

            LocalDate dueDate,

            @NotNull
            GovernanceDecisionImpactArea impactArea,

            String rationale) {
    }

    public record UpdateDecisionRequest(
            @PositiveOrZero
            long version,

            UUID meetingId,

            @NotBlank
            @Size(max = 220)
            String title,

            String description,

            @NotNull
            LocalDate decisionDate,

            @Size(max = 160)
            String ownerName,

            LocalDate dueDate,

            @NotNull
            GovernanceDecisionImpactArea impactArea,

            String rationale,

            @NotNull
            GovernanceDecisionStatus status) {
    }

    public record DecisionResponse(
            UUID id,
            UUID projectId,
            UUID meetingId,
            String decisionNumber,
            String title,
            String description,
            LocalDate decisionDate,
            String ownerName,
            LocalDate dueDate,
            GovernanceDecisionImpactArea impactArea,
            String rationale,
            GovernanceDecisionStatus status,
            boolean overdue,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateActionRequest(
            UUID meetingId,
            UUID decisionId,

            @NotBlank
            @Size(max = 64)
            String actionNumber,

            @NotBlank
            @Size(max = 220)
            String title,

            String description,

            @Size(max = 160)
            String ownerName,

            @NotNull
            GovernanceActionPriority priority,

            @NotNull
            LocalDate dueDate) {
    }

    public record UpdateActionRequest(
            @PositiveOrZero
            long version,

            UUID meetingId,
            UUID decisionId,

            @NotBlank
            @Size(max = 220)
            String title,

            String description,

            @Size(max = 160)
            String ownerName,

            @NotNull
            GovernanceActionPriority priority,

            @NotNull
            LocalDate dueDate,

            @NotNull
            GovernanceActionStatus status,

            String blockerReason) {
    }

    public record ActionResponse(
            UUID id,
            UUID projectId,
            UUID meetingId,
            UUID decisionId,
            String actionNumber,
            String title,
            String description,
            String ownerName,
            GovernanceActionPriority priority,
            LocalDate dueDate,
            GovernanceActionStatus status,
            String blockerReason,
            Instant completedAt,
            boolean overdue,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record GovernanceIntelligenceResponse(
            LocalDate dataDate,

            long meetingCount,
            long plannedMeetings,
            long heldMeetings,
            long meetingsWithoutMinutes,

            long decisionCount,
            long pendingDecisions,
            long overdueDecisions,
            long implementedDecisions,

            long actionCount,
            long openActions,
            long overdueActions,
            long criticalOpenActions,
            long blockedActions,
            long actionsDueNext14Days,
            long completedActions,

            double actionClosureRate,
            double decisionClosureRate,

            double governanceScore,
            GovernanceRiskLevel governanceRisk,

            String explanation) {

        public static GovernanceIntelligenceResponse noData(
                LocalDate dataDate) {

            return new GovernanceIntelligenceResponse(
                    dataDate,
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
                    0,
                    0,
                    75,
                    GovernanceRiskLevel.WATCH,
                    "No governance records exist yet. BuildSight applies a neutral governance score until meetings, decisions and actions are recorded.");
        }
    }

    public record ExecutiveAttentionItemResponse(
            String type,
            String severity,
            String reference,
            String title,
            String owner,
            LocalDate dueDate,
            String detail) {
    }

    public record ExecutiveReportResponse(
            ProjectResponse project,

            LocalDate reportDate,

            double physicalProgressPercentage,

            double scheduleScore,
            String scheduleRisk,

            double predictiveScore,
            String predictiveRisk,
            String forecastTrend,

            BigDecimal cpi,
            BigDecimal spi,

            BigDecimal expectedForecastCost,
            LocalDate expectedForecastFinishDate,

            double governanceScore,
            GovernanceRiskLevel governanceRisk,

            long openActions,
            long overdueActions,
            long blockedActions,

            long pendingDecisions,
            long overdueDecisions,

            long meetingsWithoutMinutes,

            String executiveSummary,

            List<ExecutiveAttentionItemResponse> attentionItems) {
    }

    public record ExecutiveReportSnapshotResponse(
            UUID id,
            UUID projectId,
            LocalDate reportDate,

            BigDecimal physicalProgressPercentage,

            BigDecimal scheduleScore,
            String scheduleRisk,

            BigDecimal predictiveScore,
            String predictiveRisk,

            BigDecimal governanceScore,
            GovernanceRiskLevel governanceRisk,

            BigDecimal cpi,
            BigDecimal spi,

            BigDecimal expectedForecastCost,
            LocalDate expectedForecastFinishDate,

            long openActions,
            long overdueActions,
            long blockedActions,

            long pendingDecisions,
            long overdueDecisions,

            long meetingsWithoutMinutes,

            String executiveSummary,
            String attentionItems,

            Instant createdAt) {
    }

    public record GovernanceControlResponse(
            ProjectResponse project,

            GovernanceIntelligenceResponse intelligence,

            ExecutiveReportResponse executiveReport,

            List<MeetingResponse> meetings,
            List<DecisionResponse> decisions,
            List<ActionResponse> actions,

            List<ExecutiveReportSnapshotResponse> reportHistory) {
    }

    public record PortfolioGovernanceProjectResponse(
            UUID projectId,
            String projectCode,
            String projectName,

            double governanceScore,
            GovernanceRiskLevel governanceRisk,

            long openActions,
            long overdueActions,
            long criticalOpenActions,
            long blockedActions,

            long pendingDecisions,
            long overdueDecisions,

            long meetingsWithoutMinutes) {
    }

    public record PortfolioGovernanceResponse(
            LocalDate dataDate,

            long projectCount,
            long onTrackProjects,
            long watchProjects,
            long atRiskProjects,

            long openActions,
            long overdueActions,
            long criticalOpenActions,
            long blockedActions,

            long pendingDecisions,
            long overdueDecisions,

            long meetingsWithoutMinutes,

            double averageGovernanceScore,

            List<PortfolioGovernanceProjectResponse> projects) {
    }
}
