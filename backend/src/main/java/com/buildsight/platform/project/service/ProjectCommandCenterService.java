package com.buildsight.platform.project.service;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.service.CostControlService;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.service.ProcurementControlService;
import com.buildsight.platform.project.api.MilestoneResponse;
import com.buildsight.platform.project.api.ProgressUpdateResponse;
import com.buildsight.platform.project.api.ProjectCommandCenterResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectMilestone;
import com.buildsight.platform.project.repository.ProjectMilestoneRepository;
import com.buildsight.platform.project.repository.ProjectProgressUpdateRepository;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectCommandCenterService {

    private final ProjectRepository
            projectRepository;

    private final ProjectMilestoneRepository
            milestoneRepository;

    private final ProjectProgressUpdateRepository
            progressUpdateRepository;

    private final ProjectMapper
            projectMapper;

    private final MilestoneMapper
            milestoneMapper;

    private final ProgressUpdateMapper
            progressUpdateMapper;

    private final ProjectHealthScoreService
            healthScoreService;

    private final CostControlService
            costControlService;

    private final ProcurementControlService
            procurementControlService;

    public ProjectCommandCenterService(
            ProjectRepository projectRepository,
            ProjectMilestoneRepository milestoneRepository,
            ProjectProgressUpdateRepository progressUpdateRepository,
            ProjectMapper projectMapper,
            MilestoneMapper milestoneMapper,
            ProgressUpdateMapper progressUpdateMapper,
            ProjectHealthScoreService healthScoreService,
            CostControlService costControlService,
            ProcurementControlService procurementControlService) {

        this.projectRepository =
                projectRepository;

        this.milestoneRepository =
                milestoneRepository;

        this.progressUpdateRepository =
                progressUpdateRepository;

        this.projectMapper =
                projectMapper;

        this.milestoneMapper =
                milestoneMapper;

        this.progressUpdateMapper =
                progressUpdateMapper;

        this.healthScoreService =
                healthScoreService;

        this.costControlService =
                costControlService;

        this.procurementControlService =
                procurementControlService;
    }

    @Transactional(readOnly = true)
    public ProjectCommandCenterResponse get(
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

        List<ProjectMilestone> milestones =
                milestoneRepository
                        .findByProjectIdOrderBySortOrderAscPlannedDateAsc(
                                projectId);

        List<MilestoneResponse> milestoneResponses =
                milestones.stream()
                        .map(
                                milestoneMapper::toResponse)
                        .toList();

        List<ProgressUpdateResponse> progressUpdates =
                progressUpdateRepository
                        .findTop20ByProjectIdOrderByUpdateDateDescCreatedAtDesc(
                                projectId)
                        .stream()
                        .map(
                                progressUpdateMapper::toResponse)
                        .toList();

        CostIntelligenceResponse cost =
                costControlService
                        .get(
                                projectId)
                        .intelligence();

        ProcurementIntelligenceResponse procurement =
                procurementControlService
                        .intelligence(
                                projectId);

        return new ProjectCommandCenterResponse(
                projectMapper.toResponse(
                        project),

                healthScoreService.calculate(
                        project,
                        milestones,
                        cost,
                        procurement),

                milestoneResponses,
                progressUpdates);
    }
}
