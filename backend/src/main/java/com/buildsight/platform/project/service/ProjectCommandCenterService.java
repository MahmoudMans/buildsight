package com.buildsight.platform.project.service;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.service.CostControlService;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.service.DocumentControlService;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.service.ProcurementControlService;
import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.service.ProductionControlService;
import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.service.QualityControlService;
import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.service.SafetyControlService;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.service.RiskControlService;
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

    private final RiskControlService
            riskControlService;

    private final ProductionControlService
            productionControlService;

    private final DocumentControlService
            documentControlService;

    private final QualityControlService
            qualityControlService;

    private final SafetyControlService
            safetyControlService;

    public ProjectCommandCenterService(
            ProjectRepository projectRepository,
            ProjectMilestoneRepository milestoneRepository,
            ProjectProgressUpdateRepository progressUpdateRepository,
            ProjectMapper projectMapper,
            MilestoneMapper milestoneMapper,
            ProgressUpdateMapper progressUpdateMapper,
            ProjectHealthScoreService healthScoreService,
            CostControlService costControlService,
            ProcurementControlService procurementControlService,
            RiskControlService riskControlService,
            ProductionControlService productionControlService,
            DocumentControlService documentControlService,
            QualityControlService qualityControlService,
            SafetyControlService safetyControlService) {

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

        this.riskControlService =
                riskControlService;

        this.productionControlService =
                productionControlService;

        this.documentControlService =
                documentControlService;

        this.qualityControlService =
                qualityControlService;

        this.safetyControlService =
                safetyControlService;
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

        RiskIntelligenceResponse risk =
                riskControlService
                        .intelligence(
                                projectId);

        ProductionIntelligenceResponse production =
                productionControlService
                        .intelligence(
                                projectId);

        DocumentIntelligenceResponse information =
                documentControlService
                        .intelligence(
                                projectId);

        QualityIntelligenceResponse quality =
                qualityControlService
                        .intelligence(
                                projectId);

        SafetyIntelligenceResponse safety =
                safetyControlService
                        .intelligence(
                                projectId);

        return new ProjectCommandCenterResponse(
                projectMapper.toResponse(
                        project),

                healthScoreService.calculate(
                        project,
                        milestones,
                        cost,
                        procurement,
                        risk,
                        production,
                        information,
                        quality,
                        safety),

                milestoneResponses,
                progressUpdates);
    }
}
