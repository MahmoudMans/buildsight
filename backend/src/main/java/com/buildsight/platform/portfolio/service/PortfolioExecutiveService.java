package com.buildsight.platform.portfolio.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.commercial.service.CommercialControlService;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.service.CostControlService;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.service.DocumentControlService;
import com.buildsight.platform.portfolio.api.PortfolioBenchmarksResponse;
import com.buildsight.platform.portfolio.api.PortfolioComparisonMetricResponse;
import com.buildsight.platform.portfolio.api.PortfolioExecutiveResponse;
import com.buildsight.platform.portfolio.api.PortfolioProjectComparisonResponse;
import com.buildsight.platform.portfolio.api.PortfolioProjectSnapshotResponse;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.service.ProcurementControlService;
import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.service.ProductionControlService;
import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.service.QualityControlService;
import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.service.SafetyControlService;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectMilestoneRepository;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectHealthScoreService;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.service.RiskControlService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortfolioExecutiveService {

    private final ProjectRepository
            projectRepository;

    private final ProjectMilestoneRepository
            milestoneRepository;

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

    private final CommercialControlService
            commercialControlService;

    private final ProjectHealthScoreService
            healthScoreService;

    private final PortfolioExecutiveCalculator
            calculator;

    private final PortfolioSupplierAnalyticsService
            supplierAnalyticsService;

    private final Clock
            clock;

    public PortfolioExecutiveService(
            ProjectRepository projectRepository,
            ProjectMilestoneRepository milestoneRepository,
            CostControlService costControlService,
            ProcurementControlService procurementControlService,
            RiskControlService riskControlService,
            ProductionControlService productionControlService,
            DocumentControlService documentControlService,
            QualityControlService qualityControlService,
            SafetyControlService safetyControlService,
            CommercialControlService commercialControlService,
            ProjectHealthScoreService healthScoreService,
            PortfolioExecutiveCalculator calculator,
            PortfolioSupplierAnalyticsService supplierAnalyticsService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.milestoneRepository =
                milestoneRepository;

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

        this.commercialControlService =
                commercialControlService;

        this.healthScoreService =
                healthScoreService;

        this.calculator =
                calculator;

        this.supplierAnalyticsService =
                supplierAnalyticsService;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PortfolioExecutiveResponse executive() {

        List<Project> projects =
                projectRepository
                        .findAll()
                        .stream()
                        .sorted(
                                Comparator.comparing(
                                        Project::getCode))
                        .toList();

        List<PortfolioProjectSnapshotResponse>
                rawSnapshots =
                projects.stream()
                        .map(
                                this::snapshot)
                        .toList();

        List<PortfolioProjectSnapshotResponse>
                healthOrdered =
                rawSnapshots.stream()
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                PortfolioProjectSnapshotResponse::healthScore)
                                        .reversed()
                                        .thenComparing(
                                                PortfolioProjectSnapshotResponse::code))
                        .toList();

        List<PortfolioProjectSnapshotResponse>
                ranked =
                IntStream.range(
                                0,
                                healthOrdered.size())
                        .mapToObj(
                                index ->
                                        healthOrdered
                                                .get(index)
                                                .withHealthRank(
                                                        index + 1))
                        .toList();

        List<PortfolioProjectSnapshotResponse>
                executiveOrder =
                ranked.stream()
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                PortfolioProjectSnapshotResponse::attentionScore)
                                        .reversed()
                                        .thenComparingInt(
                                                PortfolioProjectSnapshotResponse::healthRank))
                        .toList();

        var exceptions =
                calculator.exceptions(
                        executiveOrder);

        return new PortfolioExecutiveResponse(
                LocalDate.now(
                        clock),

                calculator.summary(
                        ranked,
                        exceptions.size()),

                calculator.benchmarks(
                        ranked),

                executiveOrder,

                exceptions,

                supplierAnalyticsService
                        .concentration());
    }

    @Transactional(readOnly = true)
    public PortfolioProjectComparisonResponse comparison(
            UUID projectId) {

        PortfolioExecutiveResponse executive =
                executive();

        PortfolioProjectSnapshotResponse project =
                executive.projects()
                        .stream()
                        .filter(
                                snapshot ->
                                        snapshot.projectId()
                                                .equals(
                                                        projectId))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Project '%s' was not found in the portfolio."
                                                        .formatted(
                                                                projectId)));

        PortfolioBenchmarksResponse benchmark =
                executive.benchmarks();

        int total =
                executive.projects()
                        .size();

        double percentile =
                total == 0
                        ? 0
                        : (total
                                - project.healthRank()
                                + 1)
                                * 100.0
                                / total;

        return new PortfolioProjectComparisonResponse(
                project.projectId(),
                project.code(),
                project.name(),
                project.healthRank(),
                total,
                roundOne(
                        percentile),

                List.of(
                        metric(
                                "Health score",
                                project.healthScore(),
                                benchmark.averageHealthScore(),
                                "/100",
                                true),

                        metric(
                                "Cost score",
                                project.costScore(),
                                benchmark.averageCostScore(),
                                "/100",
                                true),

                        metric(
                                "Procurement score",
                                project.procurementScore(),
                                benchmark.averageProcurementScore(),
                                "/100",
                                true),

                        metric(
                                "Risk-control score",
                                project.riskScore(),
                                benchmark.averageRiskScore(),
                                "/100",
                                true),

                        metric(
                                "Production score",
                                project.productionScore(),
                                benchmark.averageProductionScore(),
                                "/100",
                                true),

                        metric(
                                "Information score",
                                project.informationScore(),
                                benchmark.averageInformationScore(),
                                "/100",
                                true),

                        metric(
                                "Commercial score",
                                project.commercialScore(),
                                benchmark.averageCommercialScore(),
                                "/100",
                                true),

                        metric(
                                "Productivity index",
                                project.productivityIndex(),
                                benchmark.averageProductivityIndex(),
                                "x",
                                true)));
    }

    private PortfolioProjectSnapshotResponse snapshot(
            Project project) {

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

        QualityIntelligenceResponse quality =
                qualityControlService
                        .intelligence(
                                project.getId());

        SafetyIntelligenceResponse safety =
                safetyControlService
                        .intelligence(
                                project.getId());

        CommercialIntelligenceResponse commercial =
                commercialControlService
                        .intelligence(
                                project.getId());

        ProjectHealthScoreResponse health =
                healthScoreService
                        .calculate(
                                project,

                                milestoneRepository
                                        .findByProjectIdOrderBySortOrderAscPlannedDateAsc(
                                                project.getId()),

                                cost,
                                procurement,
                                risk,
                                production,
                                information,
                                quality,
                                safety,
                                commercial);

        int attentionScore =
                calculator.attentionScore(
                        health.score(),
                        health.scheduleVarianceDays(),
                        cost.varianceAtCompletion(),
                        cost.revisedCostPlan(),
                        procurement.delayedPackages(),
                        risk.highExposureRisks(),
                        risk.criticalOpenIssues(),
                        risk.forecastDelayDays(),
                        production.blockedPackages(),
                        information.overdueRfis(),
                        information.criticalOpenRfis(),
                        safety.openIncidents(),
                        safety.criticalOpenIncidents(),
                        safety.overdueActions(),
                        safety.expiredPermits(),
                        commercial.pendingChangeOrders(),
                        commercial.overdueChangeDecisions(),
                        commercial.openClaims(),
                        commercial.overdueClaimResponses(),
                        commercial.overdueCertifications(),
                        commercial.overduePayments());

        return new PortfolioProjectSnapshotResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                project.getClientName(),
                project.getLocation(),
                project.getStatus(),
                health.score(),
                health.healthBand(),
                health.scheduleVarianceDays(),
                money(
                        project.getApprovedBudget()),
                money(
                        cost.revisedCostPlan()),
                money(
                        cost.forecastAtCompletion()),
                money(
                        cost.actualCosts()),
                money(
                        cost.outstandingCommitments()),
                money(
                        cost.varianceAtCompletion()),
                cost.costScore(),
                procurement.delayedPackages(),
                procurement.procurementScore(),
                risk.highExposureRisks(),
                risk.criticalOpenIssues(),
                risk.forecastDelayDays(),
                risk.riskScore(),
                production.blockedPackages(),
                production.productionScore(),
                production.overallProductivityIndex(),
                information.overdueRfis(),
                information.criticalOpenRfis(),
                information.informationScore(),
                safety.openIncidents(),
                safety.criticalOpenIncidents(),
                safety.overdueActions(),
                safety.expiredPermits(),
                safety.safetyScore(),
                commercial.pendingChangeOrders(),
                commercial.overdueChangeDecisions(),
                commercial.openClaims(),
                commercial.overdueClaimResponses(),
                commercial.overdueCertifications(),
                commercial.overduePayments(),
                commercial.outstandingCertifiedAmount(),
                commercial.forecastCashflowVariance(),
                commercial.commercialScore(),
                attentionScore,
                0);
    }

    private PortfolioComparisonMetricResponse metric(
            String name,
            double project,
            double average,
            String unit,
            boolean higherIsBetter) {

        double delta =
                project
                        - average;

        boolean favorable =
                higherIsBetter
                        ? delta >= 0
                        : delta <= 0;

        return new PortfolioComparisonMetricResponse(
                name,
                roundTwo(
                        project),
                roundTwo(
                        average),
                roundTwo(
                        delta),
                unit,
                higherIsBetter,
                favorable);
    }

    private BigDecimal money(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(2)
                : value.setScale(
                        2,
                        java.math.RoundingMode.HALF_UP);
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100.0)
                / 100.0;
    }
}
