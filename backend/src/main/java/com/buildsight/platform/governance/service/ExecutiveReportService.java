package com.buildsight.platform.governance.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.service.ForecastControlService;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveAttentionItemResponse;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportResponse;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.domain.GovernanceActionPriority;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.ProjectGovernanceAction;
import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;
import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;
import com.buildsight.platform.governance.repository.ProjectGovernanceActionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceDecisionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceMeetingRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleIntelligenceResponse;
import com.buildsight.platform.schedule.service.ScheduleControlService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExecutiveReportService {

    private final ProjectRepository
            projectRepository;

    private final ProjectGovernanceMeetingRepository
            meetingRepository;

    private final ProjectGovernanceDecisionRepository
            decisionRepository;

    private final ProjectGovernanceActionRepository
            actionRepository;

    private final GovernanceIntelligenceService
            governanceIntelligenceService;

    private final ScheduleControlService
            scheduleControlService;

    private final ForecastControlService
            forecastControlService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public ExecutiveReportService(
            ProjectRepository projectRepository,
            ProjectGovernanceMeetingRepository meetingRepository,
            ProjectGovernanceDecisionRepository decisionRepository,
            ProjectGovernanceActionRepository actionRepository,
            GovernanceIntelligenceService governanceIntelligenceService,
            ScheduleControlService scheduleControlService,
            ForecastControlService forecastControlService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.meetingRepository =
                meetingRepository;

        this.decisionRepository =
                decisionRepository;

        this.actionRepository =
                actionRepository;

        this.governanceIntelligenceService =
                governanceIntelligenceService;

        this.scheduleControlService =
                scheduleControlService;

        this.forecastControlService =
                forecastControlService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ExecutiveReportResponse generate(
            UUID projectId) {

        Project project =
                projectRepository
                        .findById(
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Project '%s' was not found."
                                                        .formatted(
                                                                projectId)));

        List<ProjectGovernanceMeeting> meetings =
                meetingRepository
                        .findByProjectIdOrderByScheduledAtDescMeetingNumberAsc(
                                projectId);

        List<ProjectGovernanceDecision> decisions =
                decisionRepository
                        .findByProjectIdOrderByDecisionDateDescDecisionNumberAsc(
                                projectId);

        List<ProjectGovernanceAction> actions =
                actionRepository
                        .findByProjectIdOrderByDueDateAscActionNumberAsc(
                                projectId);

        GovernanceIntelligenceResponse governance =
                governanceIntelligenceService
                        .calculate(
                                meetings,
                                decisions,
                                actions);

        ScheduleIntelligenceResponse schedule =
                scheduleControlService
                        .intelligence(
                                projectId);

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        List<ExecutiveAttentionItemResponse> attention =
                attentionItems(
                        actions,
                        decisions,
                        meetings,
                        schedule,
                        forecast);

        String summary =
                summary(
                        project,
                        governance,
                        schedule,
                        forecast);

        return new ExecutiveReportResponse(
                projectMapper.toResponse(
                        project),

                LocalDate.now(
                        clock),

                roundOne(
                        project.getPhysicalProgressPercentage()
                                .doubleValue()),

                schedule.scheduleScore(),
                schedule.scheduleRisk()
                        .name(),

                forecast.predictiveScore(),
                forecast.predictiveRisk()
                        .name(),
                forecast.trend()
                        .name(),

                forecast.cpi(),
                forecast.spi(),

                forecast.expectedForecastCost(),
                forecast.expectedForecastFinishDate(),

                governance.governanceScore(),
                governance.governanceRisk(),

                governance.openActions(),
                governance.overdueActions(),
                governance.blockedActions(),

                governance.pendingDecisions(),
                governance.overdueDecisions(),

                governance.meetingsWithoutMinutes(),

                summary,

                attention);
    }

    private List<ExecutiveAttentionItemResponse> attentionItems(
            List<ProjectGovernanceAction> actions,
            List<ProjectGovernanceDecision> decisions,
            List<ProjectGovernanceMeeting> meetings,
            ScheduleIntelligenceResponse schedule,
            ForecastIntelligenceResponse forecast) {

        LocalDate today =
                LocalDate.now(
                        clock);

        List<ExecutiveAttentionItemResponse> items =
                new ArrayList<>();

        actions.stream()
                .filter(
                        action ->
                                action.getStatus()
                                        != GovernanceActionStatus.DONE
                                        && action.getStatus()
                                        != GovernanceActionStatus.VOID)
                .filter(
                        action ->
                                action.getPriority()
                                        == GovernanceActionPriority.CRITICAL
                                        || action.getStatus()
                                        == GovernanceActionStatus.BLOCKED
                                        || action.getDueDate()
                                                .isBefore(
                                                        today))
                .limit(8)
                .forEach(
                        action ->
                                items.add(
                                        new ExecutiveAttentionItemResponse(
                                                "ACTION",
                                                action.getPriority()
                                                                == GovernanceActionPriority.CRITICAL
                                                        ? "CRITICAL"
                                                        : action.getStatus()
                                                                        == GovernanceActionStatus.BLOCKED
                                                                ? "HIGH"
                                                                : "HIGH",
                                                action.getActionNumber(),
                                                action.getTitle(),
                                                action.getOwnerName(),
                                                action.getDueDate(),
                                                action.getStatus()
                                                                == GovernanceActionStatus.BLOCKED
                                                        ? "Blocked: "
                                                                + safe(
                                                                        action.getBlockerReason())
                                                        : "Action requires management follow-through.")));

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
                .limit(5)
                .forEach(
                        decision ->
                                items.add(
                                        new ExecutiveAttentionItemResponse(
                                                "DECISION",
                                                "HIGH",
                                                decision.getDecisionNumber(),
                                                decision.getTitle(),
                                                decision.getOwnerName(),
                                                decision.getDueDate(),
                                                "Decision implementation is overdue.")));

        meetings.stream()
                .filter(
                        meeting ->
                                meeting.getStatus()
                                        == GovernanceMeetingStatus.HELD)
                .filter(
                        meeting ->
                                meeting.getMinutes()
                                        == null
                                        || meeting.getMinutes()
                                                .isBlank())
                .limit(3)
                .forEach(
                        meeting ->
                                items.add(
                                        new ExecutiveAttentionItemResponse(
                                                "MEETING",
                                                "MEDIUM",
                                                meeting.getMeetingNumber(),
                                                meeting.getTitle(),
                                                meeting.getChairName(),
                                                meeting.getHeldAt() == null
                                                        ? null
                                                        : meeting.getHeldAt()
                                                                .atZone(
                                                                        clock.getZone())
                                                                .toLocalDate(),
                                                "Meeting was held but minutes are not recorded.")));

        if (schedule.scheduleScore() < 60) {

            items.add(
                    new ExecutiveAttentionItemResponse(
                            "SCHEDULE",
                            "CRITICAL",
                            "CPM",
                            "Schedule performance requires executive attention",
                            null,
                            schedule.cpmForecastFinishDate(),
                            "%s critical activities, %s overdue constraints and %s days project finish variance."
                                    .formatted(
                                            schedule.criticalActivities(),
                                            schedule.overdueConstraints(),
                                            schedule.projectFinishVarianceDays())));
        }

        if (forecast.predictiveScore() < 60) {

            items.add(
                    new ExecutiveAttentionItemResponse(
                            "FORECAST",
                            "CRITICAL",
                            "EVM",
                            "Predictive project controls indicate elevated exposure",
                            null,
                            forecast.expectedForecastFinishDate(),
                            "CPI %s, SPI %s, EAC %s and trend %s."
                                    .formatted(
                                            forecast.cpi(),
                                            forecast.spi(),
                                            forecast.expectedForecastCost(),
                                            forecast.trend())));
        }

        return items.stream()
                .sorted(
                        Comparator.comparingInt(
                                item ->
                                        severity(
                                                item.severity())))
                .limit(12)
                .toList();
    }

    private String summary(
            Project project,
            GovernanceIntelligenceResponse governance,
            ScheduleIntelligenceResponse schedule,
            ForecastIntelligenceResponse forecast) {

        return "%s is %.1f%% physically complete. Schedule Intelligence is %.1f/100 (%s) with forecast completion %s. Predictive Controls are %.1f/100 (%s), CPI %s and SPI %s, with expected cost at completion %s. Governance is %.1f/100 (%s), with %d open actions, %d overdue actions, %d blocked actions, %d pending decisions and %d meetings without minutes."
                .formatted(
                        project.getCode(),
                        project.getPhysicalProgressPercentage()
                                .doubleValue(),
                        schedule.scheduleScore(),
                        schedule.scheduleRisk(),
                        schedule.cpmForecastFinishDate(),
                        forecast.predictiveScore(),
                        forecast.predictiveRisk(),
                        forecast.cpi(),
                        forecast.spi(),
                        forecast.expectedForecastCost(),
                        governance.governanceScore(),
                        governance.governanceRisk(),
                        governance.openActions(),
                        governance.overdueActions(),
                        governance.blockedActions(),
                        governance.pendingDecisions(),
                        governance.meetingsWithoutMinutes());
    }

    private int severity(
            String severity) {

        return switch (severity) {

            case "CRITICAL" ->
                    0;

            case "HIGH" ->
                    1;

            case "MEDIUM" ->
                    2;

            default ->
                    3;
        };
    }

    private String safe(
            String value) {

        return value == null
                ? "No blocker detail supplied."
                : value;
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }
}
