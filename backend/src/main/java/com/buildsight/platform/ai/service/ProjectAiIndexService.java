package com.buildsight.platform.ai.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.ai.api.AiIndexResponse;
import com.buildsight.platform.ai.domain.AiSourceType;
import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.commercial.service.CommercialControlService;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.service.CostControlService;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.domain.DocumentRevision;
import com.buildsight.platform.document.domain.DocumentRevisionStatus;
import com.buildsight.platform.document.domain.ProjectDocument;
import com.buildsight.platform.document.domain.ProjectRfi;
import com.buildsight.platform.document.domain.RfiStatus;
import com.buildsight.platform.document.repository.DocumentRevisionRepository;
import com.buildsight.platform.document.repository.ProjectDocumentRepository;
import com.buildsight.platform.document.repository.ProjectRfiRepository;
import com.buildsight.platform.document.service.DocumentControlService;
import com.buildsight.platform.document.service.DocumentHashService;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.service.ProcurementControlService;
import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.service.ProductionControlService;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.resource.api.ResourceModels.ResourceIntelligenceResponse;
import com.buildsight.platform.resource.service.ResourceControlService;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.service.RiskControlService;

import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleIntelligenceResponse;
import com.buildsight.platform.schedule.service.ScheduleControlService;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.service.ForecastControlService;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.service.GovernanceControlService;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactIntelligenceResponse;
import com.buildsight.platform.recovery.service.ChangeImpactControlService;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodControlIntelligenceResponse;
import com.buildsight.platform.periodcontrol.service.PeriodControlService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ProjectAiIndexService {

    private static final int
            MAX_CHUNKS_PER_PROJECT =
            2500;

    private final ProjectRepository
            projectRepository;

    private final ProjectDocumentRepository
            documentRepository;

    private final DocumentRevisionRepository
            revisionRepository;

    private final ProjectRfiRepository
            rfiRepository;

    private final CommercialControlService
            commercialControlService;

    private final ResourceControlService
            resourceControlService;

    private final ScheduleControlService
            scheduleControlService;

    private final ForecastControlService
            forecastControlService;

    private final GovernanceControlService
            governanceControlService;

    private final ChangeImpactControlService
            changeImpactControlService;

    private final PeriodControlService
            periodControlService;

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

    private final TextChunkingService
            chunkingService;

    private final DocumentHashService
            hashService;

    private final LocalOllamaClient
            ollamaClient;

    private final AiVectorStore
            vectorStore;

    private final String
            embeddingModel;

    private final int
            embeddingDimensions;

    private final int
            embeddingBatchSize;

    public ProjectAiIndexService(
            ProjectRepository projectRepository,
            ProjectDocumentRepository documentRepository,
            DocumentRevisionRepository revisionRepository,
            ProjectRfiRepository rfiRepository,
            CommercialControlService commercialControlService,
            ResourceControlService resourceControlService,
            ScheduleControlService scheduleControlService,
            ForecastControlService forecastControlService,
            GovernanceControlService governanceControlService,
            ChangeImpactControlService changeImpactControlService,
            PeriodControlService periodControlService,
            CostControlService costControlService,
            ProcurementControlService procurementControlService,
            RiskControlService riskControlService,
            ProductionControlService productionControlService,
            DocumentControlService documentControlService,
            TextChunkingService chunkingService,
            DocumentHashService hashService,
            LocalOllamaClient ollamaClient,
            AiVectorStore vectorStore,
            @Value(
                    "${buildsight.ai.embedding-model:qwen3-embedding:0.6b}")
            String embeddingModel,
            @Value(
                    "${buildsight.ai.embedding-dimensions:1024}")
            int embeddingDimensions,
            @Value(
                    "${buildsight.ai.embedding-batch-size:16}")
            int embeddingBatchSize) {

        this.projectRepository =
                projectRepository;

        this.documentRepository =
                documentRepository;

        this.revisionRepository =
                revisionRepository;

        this.rfiRepository =
                rfiRepository;

        this.commercialControlService =
                commercialControlService;

        this.resourceControlService =
                resourceControlService;

        this.scheduleControlService =
                scheduleControlService;

        this.forecastControlService =
                forecastControlService;

        this.governanceControlService =
                governanceControlService;

        this.changeImpactControlService =
                changeImpactControlService;

        this.periodControlService =
                periodControlService;

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

        this.chunkingService =
                chunkingService;

        this.hashService =
                hashService;

        this.ollamaClient =
                ollamaClient;

        this.vectorStore =
                vectorStore;

        this.embeddingModel =
                embeddingModel;

        this.embeddingDimensions =
                embeddingDimensions;

        this.embeddingBatchSize =
                Math.max(
                        1,
                        embeddingBatchSize);
    }

    public AiIndexResponse rebuild(
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

        LocalOllamaClient.OllamaAvailability availability =
                ollamaClient
                        .availability();

        if (!availability.reachable()) {

            throw new InvalidRequestException(
                    "Ollama is not reachable. Start the local Ollama service first.");
        }

        if (!ollamaClient.modelAvailable(
                availability,
                embeddingModel)) {

            throw new InvalidRequestException(
                    "Embedding model '"
                            + embeddingModel
                            + "' is not installed. Run scripts/ai-models-pull.sh first.");
        }

        List<AiSourceDraft> sources =
                buildSources(
                        project);

        List<AiChunkDraft> chunks =
                buildChunks(
                        projectId,
                        sources);

        if (chunks.size()
                > MAX_CHUNKS_PER_PROJECT) {

            throw new InvalidRequestException(
                    "AI indexing stopped because the project exceeds the current "
                            + MAX_CHUNKS_PER_PROJECT
                            + "-chunk local safety limit.");
        }

        List<EmbeddedAiChunk> embedded =
                embedChunks(
                        chunks);

        /*
         * We only replace the previous index after every
         * embedding has succeeded. A failed Ollama request
         * therefore leaves the previous usable index intact.
         */
        vectorStore.replaceProject(
                projectId,
                embedded);

        return new AiIndexResponse(
                sources.size(),
                embedded.size(),
                embeddingModel,
                embeddingDimensions,
                Instant.now());
    }

    private List<AiSourceDraft> buildSources(
            Project project) {

        List<AiSourceDraft> sources =
                new ArrayList<>();

        sources.add(
                projectFactSource(
                        project));

        List<ProjectDocument> documents =
                documentRepository
                        .findByProjectIdOrderByDocumentNumberAsc(
                                project.getId());

        var documentMap =
                documents.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectDocument::getId,
                                        Function.identity()));

        List<UUID> documentIds =
                documents.stream()
                        .map(
                                ProjectDocument::getId)
                        .toList();

        if (!documentIds.isEmpty()) {

            List<DocumentRevision> revisions =
                    revisionRepository
                            .findByDocumentIdInOrderByCreatedAtDesc(
                                    documentIds);

            for (DocumentRevision revision :
                    revisions) {

                if (revision.getRevisionStatus()
                        == DocumentRevisionStatus.SUPERSEDED) {

                    continue;
                }

                ProjectDocument document =
                        documentMap.get(
                                revision.getDocumentId());

                if (document == null) {
                    continue;
                }

                String content =
                        """
                        CONTROLLED DOCUMENT
                        Document Number: %s
                        Title: %s
                        Type: %s
                        Discipline: %s
                        Revision: %s
                        Revision Status: %s
                        Issue Date: %s
                        File Name: %s

                        Extracted Content:
                        %s
                        """
                        .formatted(
                                document.getDocumentNumber(),
                                document.getTitle(),
                                document.getDocumentType(),
                                document.getDiscipline(),
                                revision.getRevisionCode(),
                                revision.getRevisionStatus(),
                                revision.getIssuedDate(),
                                revision.getFileName(),
                                revision.getExtractedText());

                sources.add(
                        new AiSourceDraft(
                                AiSourceType.DOCUMENT_REVISION,
                                revision.getId(),
                                document.getId(),
                                document.getDocumentNumber()
                                        + " Rev "
                                        + revision.getRevisionCode(),
                                document.getTitle(),
                                content));
            }
        }

        List<ProjectRfi> rfis =
                rfiRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                project.getId());

        for (ProjectRfi rfi :
                rfis) {

            if (rfi.getStatus()
                    == RfiStatus.VOID) {

                continue;
            }

            String content =
                    """
                    REQUEST FOR INFORMATION
                    Reference: %s
                    Subject: %s
                    Priority: %s
                    Status: %s
                    Raised By: %s
                    Assigned To: %s
                    Raised Date: %s
                    Due Date: %s
                    Responded Date: %s

                    Question:
                    %s

                    Response:
                    %s
                    """
                    .formatted(
                            rfi.getReference(),
                            rfi.getSubject(),
                            rfi.getPriority(),
                            rfi.getStatus(),
                            safe(
                                    rfi.getRaisedBy()),
                            safe(
                                    rfi.getAssignedTo()),
                            rfi.getRaisedDate(),
                            rfi.getDueDate(),
                            safe(
                                    rfi.getRespondedDate()),
                            rfi.getQuestion(),
                            safe(
                                    rfi.getResponse()));

            sources.add(
                    new AiSourceDraft(
                            AiSourceType.RFI,
                            rfi.getId(),
                            null,
                            rfi.getReference(),
                            rfi.getSubject(),
                            content));
        }

        return List.copyOf(
                sources);
    }

    private AiSourceDraft projectFactSource(
            Project project) {

        CommercialIntelligenceResponse commercial =
                commercialControlService
                        .intelligence(
                                project.getId());

        ResourceIntelligenceResponse resources =
                resourceControlService
                        .intelligence(
                                project.getId());

        ScheduleIntelligenceResponse schedule =
                scheduleControlService
                        .intelligence(
                                project.getId());

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                project.getId());

        GovernanceIntelligenceResponse governance =
                governanceControlService
                        .intelligence(
                                project.getId());

        ChangeImpactIntelligenceResponse recovery =
                changeImpactControlService
                        .intelligence(
                                project.getId());

        PeriodControlIntelligenceResponse periodControl =
                periodControlService
                        .intelligence(
                                project.getId());

        CostIntelligenceResponse cost =
                costControlService
                        .get(
                                project.getId())
                        .intelligence();

        ProcurementIntelligenceResponse procurement =
                procurementControlService
                        .intelligence(
                                project.getId());

        RiskIntelligenceResponse risk =
                riskControlService
                        .intelligence(
                                project.getId());

        ProductionIntelligenceResponse production =
                productionControlService
                        .intelligence(
                                project.getId());

        DocumentIntelligenceResponse information =
                documentControlService
                        .intelligence(
                                project.getId());

        String content =
                """
                BUILDSIGHT STRUCTURED PROJECT FACTS

                Project
                Code: %s
                Name: %s
                Client: %s
                Location: %s
                Status: %s
                Physical Progress: %s percent
                Planned Start: %s
                Planned Finish: %s
                Forecast Finish: %s
                Approved Budget: %s

                Cost Intelligence
                Revised Cost Plan: %s
                Actual Costs: %s
                Outstanding Commitments: %s
                Forecast at Completion: %s
                Variance at Completion: %s
                Cost Score: %s
                Cost Risk: %s

                Procurement Intelligence
                Open Packages: %s
                Delayed Packages: %s
                Conditional Awards: %s
                Competition Coverage: %s percent
                Procurement Score: %s
                Procurement Risk: %s

                Risk and Delay Intelligence
                High Exposure Risks: %s
                Overdue Mitigations: %s
                Critical Open Issues: %s
                Pending Changes: %s
                Active Delays: %s
                Forecast Delay Days: %s
                Risk Score: %s
                Risk Level: %s

                Production Intelligence
                Active Work Packages: %s
                Blocked Work Packages: %s
                Average Package Completion: %s percent
                Expected Package Progress: %s percent
                Production Variance: %s points
                Productivity Index: %s
                Production Score: %s
                Production Risk: %s

                Information Intelligence
                Controlled Documents: %s
                Document Revisions: %s
                Open RFIs: %s
                Overdue RFIs: %s
                Critical Open RFIs: %s
                Draft Transmittals: %s
                Information Score: %s
                Information Risk: %s


                Commercial Intelligence
                Pending Change Orders: %s
                Overdue Change Decisions: %s
                Approved Change Value: %s
                Open Claims: %s
                Overdue Claim Responses: %s
                Claimed Value: %s
                Awarded Claim Value: %s
                Awaiting Certification: %s
                Overdue Certifications: %s
                Certified Value: %s
                Retention Held: %s
                Amount Paid: %s
                Outstanding Certified Amount: %s
                Overdue Payments: %s
                Forecast Net Cashflow: %s
                Forecast Cashflow Variance: %s
                Commercial Score: %s
                Commercial Risk: %s


                Resource Intelligence
                Workforce Plans: %s
                Workforce Deployments: %s
                Planned Labor Hours: %s
                Actual Labor Hours: %s
                Productive Labor Hours: %s
                Overtime Hours: %s
                Overtime Percentage: %s
                Labor Utilization Percentage: %s
                Average Productivity Index: %s
                Low Productivity Work Packages: %s
                Equipment Count: %s
                Idle Equipment: %s
                Equipment Utilization Percentage: %s
                Equipment Downtime Hours: %s
                Worker Demand Gap: %s
                Equipment Demand Gap: %s
                Resource Score: %s
                Resource Risk: %s

                Schedule Intelligence
                Network Valid: %s
                Activity Count: %s
                Overdue Activities: %s
                Critical Activities: %s
                Near-Critical Activities: %s
                Critical Path Length Days: %s
                Open Constraints: %s
                Overdue Constraints: %s
                Constrained Critical Activities: %s
                Approved Baseline: %s
                Baseline Finish: %s
                CPM Forecast Finish: %s
                Baseline Finish Variance Days: %s
                Project Finish Variance Days: %s
                Schedule Score: %s
                Schedule Risk: %s
                Critical Activity Codes: %s

                Predictive Forecast
                BAC: %s
                Planned Value: %s
                Earned Value: %s
                Actual Cost: %s
                Cost Variance: %s
                Schedule Variance: %s
                CPI: %s
                SPI: %s
                EAC: %s
                ETC: %s
                VAC: %s
                TCPI: %s
                Cost Forecast Lower: %s
                Expected Forecast Cost: %s
                Cost Forecast Upper: %s
                Expected Forecast Finish: %s
                Schedule Variance Days: %s
                Predictive Score: %s
                Predictive Risk: %s
                Forecast Trend: %s

                Governance Intelligence
                Open Actions: %s
                Overdue Actions: %s
                Critical Open Actions: %s
                Blocked Actions: %s
                Actions Due Next 14 Days: %s
                Pending Decisions: %s
                Overdue Decisions: %s
                Meetings Without Minutes: %s
                Action Closure Rate: %s
                Decision Closure Rate: %s
                Governance Score: %s
                Governance Risk: %s

                Change & Recovery Intelligence
                Simulation Count: %s
                Active Simulation: %s
                Simulation Status: %s
                Baseline Forecast Cost: %s
                Impacted Forecast Cost: %s
                Change Cost Exposure: %s
                Impacted Forecast Finish: %s
                Schedule Impact Days: %s
                Recommended Recovery Option: %s
                Recovery Cost: %s
                Recoverable Days: %s
                Residual Delay Days: %s
                Recovery Score: %s
                Recovery Risk: %s

                Period-End Controls
                Control Baseline: %s
                Open Period: %s
                Baseline Cost Target: %s
                Baseline Finish Target: %s
                Current Forecast Cost: %s
                Cost Variance to Baseline: %s
                Finish Variance Days: %s
                Planned Progress: %s
                Earned Progress: %s
                CPI: %s
                SPI: %s
                Period Control Score: %s
                Period Control Risk: %s
"""
                .formatted(
                        project.getCode(),
                        project.getName(),
                        project.getClientName(),
                        project.getLocation(),
                        project.getStatus(),
                        project.getPhysicalProgressPercentage(),
                        project.getPlannedStartDate(),
                        project.getPlannedEndDate(),
                        project.getForecastEndDate(),
                        project.getApprovedBudget(),

                        cost.revisedCostPlan(),
                        cost.actualCosts(),
                        cost.outstandingCommitments(),
                        cost.forecastAtCompletion(),
                        cost.varianceAtCompletion(),
                        cost.costScore(),
                        cost.costRisk(),

                        procurement.openPackages(),
                        procurement.delayedPackages(),
                        procurement.conditionalAwards(),
                        procurement.competitionCoveragePercentage(),
                        procurement.procurementScore(),
                        procurement.procurementRisk(),

                        risk.highExposureRisks(),
                        risk.overdueMitigations(),
                        risk.criticalOpenIssues(),
                        risk.pendingChanges(),
                        risk.activeDelays(),
                        risk.forecastDelayDays(),
                        risk.riskScore(),
                        risk.riskLevel(),

                        production.activePackages(),
                        production.blockedPackages(),
                        production.averagePackageCompletionPercentage(),
                        production.averageExpectedProgressPercentage(),
                        production.productionVariancePoints(),
                        production.overallProductivityIndex(),
                        production.productionScore(),
                        production.productionRisk(),

                        information.totalDocuments(),
                        information.totalRevisions(),
                        information.openRfis(),
                        information.overdueRfis(),
                        information.criticalOpenRfis(),
                        information.draftTransmittals(),
                        information.informationScore(),
                        information.informationRisk(),

                        commercial.pendingChangeOrders(),
                        commercial.overdueChangeDecisions(),
                        commercial.approvedChangeValue(),
                        commercial.openClaims(),
                        commercial.overdueClaimResponses(),
                        commercial.claimedValue(),
                        commercial.awardedClaimValue(),
                        commercial.awaitingCertification(),
                        commercial.overdueCertifications(),
                        commercial.certifiedValue(),
                        commercial.retentionHeld(),
                        commercial.amountPaid(),
                        commercial.outstandingCertifiedAmount(),
                        commercial.overduePayments(),
                        commercial.forecastNetCashflow(),
                        commercial.forecastCashflowVariance(),
                        commercial.commercialScore(),
                        commercial.commercialRisk(),

                        resources.workforcePlans(),
                        resources.workforceDeployments(),
                        resources.plannedLaborHours(),
                        resources.actualLaborHours(),
                        resources.productiveLaborHours(),
                        resources.overtimeHours(),
                        resources.overtimePercentage(),
                        resources.laborUtilizationPercentage(),
                        resources.averageProductivityIndex(),
                        resources.lowProductivityWorkPackages(),
                        resources.equipmentCount(),
                        resources.idleEquipment(),
                        resources.equipmentUtilizationPercentage(),
                        resources.equipmentDowntimeHours(),
                        resources.workerDemandGap(),
                        resources.equipmentDemandGap(),
                        resources.resourceScore(),
                        resources.resourceRisk(),

                        schedule.networkValid(),
                        schedule.activityCount(),
                        schedule.overdueActivities(),
                        schedule.criticalActivities(),
                        schedule.nearCriticalActivities(),
                        schedule.criticalPathLengthDays(),
                        schedule.openConstraints(),
                        schedule.overdueConstraints(),
                        schedule.constrainedCriticalActivities(),
                        schedule.approvedBaselineName(),
                        schedule.baselineFinishDate(),
                        schedule.cpmForecastFinishDate(),
                        schedule.baselineFinishVarianceDays(),
                        schedule.projectFinishVarianceDays(),
                        schedule.scheduleScore(),
                        schedule.scheduleRisk(),
                        schedule.criticalPathActivityCodes(),

                        forecast.bac(),
                        forecast.plannedValue(),
                        forecast.earnedValue(),
                        forecast.actualCost(),
                        forecast.costVariance(),
                        forecast.scheduleVariance(),
                        forecast.cpi(),
                        forecast.spi(),
                        forecast.estimateAtCompletion(),
                        forecast.estimateToComplete(),
                        forecast.varianceAtCompletion(),
                        forecast.tcpi(),
                        forecast.costForecastLower(),
                        forecast.expectedForecastCost(),
                        forecast.costForecastUpper(),
                        forecast.expectedForecastFinishDate(),
                        forecast.scheduleVarianceDays(),
                        forecast.predictiveScore(),
                        forecast.predictiveRisk(),
                        forecast.trend(),

                        governance.openActions(),
                        governance.overdueActions(),
                        governance.criticalOpenActions(),
                        governance.blockedActions(),
                        governance.actionsDueNext14Days(),
                        governance.pendingDecisions(),
                        governance.overdueDecisions(),
                        governance.meetingsWithoutMinutes(),
                        governance.actionClosureRate(),
                        governance.decisionClosureRate(),
                        governance.governanceScore(),
                        governance.governanceRisk(),

                        recovery.simulationCount(),
                        recovery.activeSimulationNumber(),
                        recovery.simulationStatus(),
                        recovery.baselineForecastCost(),
                        recovery.impactedForecastCost(),
                        recovery.changeCostExposure(),
                        recovery.impactedForecastFinishDate(),
                        recovery.scheduleImpactDays(),
                        recovery.recommendedRecoveryOptionNumber(),
                        recovery.recoveryCost(),
                        recovery.recoverableDays(),
                        recovery.residualDelayDays(),
                        recovery.recoveryScore(),
                        recovery.recoveryRisk(),

                        periodControl.activeBaselineVersionCode(),
                        periodControl.openPeriodCode(),
                        periodControl.baselineCostTarget(),
                        periodControl.baselineFinishTarget(),
                        periodControl.currentExpectedForecastCost(),
                        periodControl.costVarianceToBaseline(),
                        periodControl.finishVarianceDays(),
                        periodControl.plannedProgressPercentage(),
                        periodControl.earnedProgressPercentage(),
                        periodControl.costPerformanceIndex(),
                        periodControl.schedulePerformanceIndex(),
                        periodControl.periodControlScore(),
                        periodControl.periodControlRisk());
        return new AiSourceDraft(
                AiSourceType.PROJECT_FACT,
                project.getId(),
                null,
                "PROJECT-"
                        + project.getCode(),
                project.getName()
                        + " — Structured Project Facts",
                content);
    }

    private List<AiChunkDraft> buildChunks(
            UUID projectId,
            List<AiSourceDraft> sources) {

        List<AiChunkDraft> chunks =
                new ArrayList<>();

        for (AiSourceDraft source :
                sources) {

            List<String> sourceChunks =
                    chunkingService.chunk(
                            source.content());

            for (int index = 0;
                    index < sourceChunks.size();
                    index++) {

                String content =
                        sourceChunks.get(
                                index);

                chunks.add(
                        new AiChunkDraft(
                                UUID.randomUUID(),
                                projectId,
                                source.sourceType(),
                                source.sourceId(),
                                source.sourceParentId(),
                                source.reference(),
                                source.title(),
                                index,
                                content,
                                hashService.sha256(
                                        content.getBytes(
                                                StandardCharsets.UTF_8))));
            }
        }

        return List.copyOf(
                chunks);
    }

    private List<EmbeddedAiChunk> embedChunks(
            List<AiChunkDraft> chunks) {

        List<EmbeddedAiChunk> result =
                new ArrayList<>();

        for (int start = 0;
                start < chunks.size();
                start += embeddingBatchSize) {

            int end =
                    Math.min(
                            chunks.size(),
                            start
                                    + embeddingBatchSize);

            List<AiChunkDraft> batch =
                    chunks.subList(
                            start,
                            end);

            List<String> texts =
                    batch.stream()
                            .map(
                                    AiChunkDraft::content)
                            .toList();

            List<List<Double>> embeddings =
                    ollamaClient.embed(
                            texts,
                            embeddingModel,
                            embeddingDimensions);

            for (int index = 0;
                    index < batch.size();
                    index++) {

                result.add(
                        new EmbeddedAiChunk(
                                batch.get(
                                        index),
                                embeddings.get(
                                        index),
                                embeddingModel));
            }
        }

        return List.copyOf(
                result);
    }

    private String safe(
            Object value) {

        return value == null
                ? "Not recorded"
                : value.toString();
    }
}
