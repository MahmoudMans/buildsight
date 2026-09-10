package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.CostCodeCategory;
import com.buildsight.platform.cost.domain.ProjectActualCost;
import com.buildsight.platform.cost.domain.ProjectBudgetLine;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.cost.domain.ProjectCostCode;
import com.buildsight.platform.cost.repository.ProjectActualCostRepository;
import com.buildsight.platform.cost.repository.ProjectBudgetLineRepository;
import com.buildsight.platform.cost.repository.ProjectCommitmentRepository;
import com.buildsight.platform.cost.repository.ProjectCostCodeRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(20)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoCostControlSeeder
        implements ApplicationRunner {

    private static final BigDecimal
            HUNDRED =
            new BigDecimal("100.00");

    private final ProjectRepository
            projectRepository;

    private final ProjectCostCodeRepository
            costCodeRepository;

    private final ProjectBudgetLineRepository
            budgetLineRepository;

    private final ProjectCommitmentRepository
            commitmentRepository;

    private final ProjectActualCostRepository
            actualCostRepository;

    public DemoCostControlSeeder(
            ProjectRepository projectRepository,
            ProjectCostCodeRepository costCodeRepository,
            ProjectBudgetLineRepository budgetLineRepository,
            ProjectCommitmentRepository commitmentRepository,
            ProjectActualCostRepository actualCostRepository) {

        this.projectRepository =
                projectRepository;

        this.costCodeRepository =
                costCodeRepository;

        this.budgetLineRepository =
                budgetLineRepository;

        this.commitmentRepository =
                commitmentRepository;

        this.actualCostRepository =
                actualCostRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seedProject(
                    project);
        }
    }

    private void seedProject(
            Project project) {

        if (costCodeRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        Map<String, ProjectCostCode>
                codes =
                seedCostCodes(
                        project);

        List<ProjectBudgetLine>
                lines =
                seedBudgetLines(
                        project,
                        codes);

        seedCommitmentsAndActuals(
                project,
                codes,
                lines);

        System.out.println(
                "[BuildSight] Cost-control demo data created for "
                        + project.getCode());
    }

    private Map<String, ProjectCostCode>
    seedCostCodes(
            Project project) {

        List<ProjectCostCode> saved =
                costCodeRepository.saveAll(
                        List.of(
                                costCode(
                                        project,
                                        "PRELIM",
                                        "Preliminaries",
                                        CostCodeCategory.PRELIMINARIES,
                                        10),

                                costCode(
                                        project,
                                        "STRUCT",
                                        "Structural Works",
                                        CostCodeCategory.STRUCTURE,
                                        20),

                                costCode(
                                        project,
                                        "MEP",
                                        "Mechanical Electrical Plumbing",
                                        CostCodeCategory.MEP,
                                        30),

                                costCode(
                                        project,
                                        "FINISH",
                                        "Architectural Finishes",
                                        CostCodeCategory.ARCHITECTURAL,
                                        40)));

        Map<String, ProjectCostCode>
                map =
                new LinkedHashMap<>();

        for (ProjectCostCode code :
                saved) {

            map.put(
                    code.getCode(),
                    code);
        }

        return map;
    }

    private ProjectCostCode costCode(
            Project project,
            String code,
            String name,
            CostCodeCategory category,
            int order) {

        return ProjectCostCode.create(
                UUID.randomUUID(),
                project.getId(),
                code,
                name,
                category,
                "Portfolio demonstration cost code.",
                order);
    }

    private List<ProjectBudgetLine>
    seedBudgetLines(
            Project project,
            Map<String, ProjectCostCode> codes) {

        BigDecimal approved =
                money(
                        project.getApprovedBudget());

        BigDecimal originalPlan =
                money(
                        approved.multiply(
                                new BigDecimal("0.97")));

        BigDecimal approvedChanges =
                approved.subtract(
                        originalPlan);

        BigDecimal prelimOriginal =
                portion(
                        originalPlan,
                        "0.10");

        BigDecimal structureOriginal =
                portion(
                        originalPlan,
                        "0.30");

        BigDecimal mepOriginal =
                portion(
                        originalPlan,
                        "0.30");

        BigDecimal finishesOriginal =
                originalPlan
                        .subtract(
                                prelimOriginal)
                        .subtract(
                                structureOriginal)
                        .subtract(
                                mepOriginal);

        BigDecimal forecastFactor =
                forecastFactor(
                        project.getCode());

        List<ProjectBudgetLine> lines =
                List.of(
                        line(
                                project,
                                codes.get(
                                        "PRELIM"),
                                "Site establishment, temporary facilities and management.",
                                prelimOriginal,
                                BigDecimal.ZERO,
                                forecastFactor),

                        line(
                                project,
                                codes.get(
                                        "STRUCT"),
                                "Primary structural construction package.",
                                structureOriginal,
                                BigDecimal.ZERO,
                                forecastFactor),

                        line(
                                project,
                                codes.get(
                                        "MEP"),
                                "Mechanical, electrical and plumbing package.",
                                mepOriginal,
                                approvedChanges,
                                forecastFactor),

                        line(
                                project,
                                codes.get(
                                        "FINISH"),
                                "Architectural finishes and fit-out works.",
                                finishesOriginal,
                                BigDecimal.ZERO,
                                forecastFactor));

        return budgetLineRepository
                .saveAll(
                        lines);
    }

    private ProjectBudgetLine line(
            Project project,
            ProjectCostCode costCode,
            String description,
            BigDecimal original,
            BigDecimal change,
            BigDecimal forecastFactor) {

        BigDecimal revised =
                original.add(
                        change);

        BigDecimal forecast =
                money(
                        revised.multiply(
                                forecastFactor));

        return ProjectBudgetLine.create(
                UUID.randomUUID(),
                project.getId(),
                costCode.getId(),
                description,
                money(original),
                money(change),
                forecast);
    }

    private void seedCommitmentsAndActuals(
            Project project,
            Map<String, ProjectCostCode> codes,
            List<ProjectBudgetLine> lines) {

        BigDecimal progressRatio =
                project
                        .getPhysicalProgressPercentage()
                        .divide(
                                HUNDRED,
                                6,
                                RoundingMode.HALF_UP);

        BigDecimal commitmentRatio =
                progressRatio.add(
                        new BigDecimal("0.25"));

        if (commitmentRatio.compareTo(
                        new BigDecimal("0.90"))
                > 0) {

            commitmentRatio =
                    new BigDecimal("0.90");
        }

        if (commitmentRatio.compareTo(
                        new BigDecimal("0.15"))
                < 0) {

            commitmentRatio =
                    new BigDecimal("0.15");
        }

        CommitmentStatus commitmentStatus =
                project.getStatus()
                                == ProjectStatus.PLANNING
                        ? CommitmentStatus.DRAFT
                        : CommitmentStatus.APPROVED;

        int index = 1;

        for (ProjectBudgetLine line :
                lines) {

            ProjectCostCode code =
                    codes.values()
                            .stream()
                            .filter(
                                    candidate ->
                                            candidate.getId()
                                                    .equals(
                                                            line.getCostCodeId()))
                            .findFirst()
                            .orElseThrow();

            BigDecimal commitmentAmount =
                    money(
                            line.revisedBudget()
                                    .multiply(
                                            commitmentRatio));

            ProjectCommitment commitment =
                    ProjectCommitment.create(
                            UUID.randomUUID(),
                            project.getId(),
                            code.getId(),
                            "PO-"
                                    + project
                                            .getCode()
                                            .replace(
                                                    "BS-",
                                                    "")
                                    + "-"
                                    + index,
                            vendorName(
                                    index),
                            "Demonstration subcontract or purchase commitment.",
                            commitmentAmount,
                            commitmentStatus,
                            commitmentDate(
                                    project,
                                    index));

            commitmentRepository.save(
                    commitment);

            if (project
                            .getPhysicalProgressPercentage()
                            .signum()
                    > 0
                    && commitmentStatus
                            == CommitmentStatus.APPROVED) {

                BigDecimal actualAmount =
                        money(
                                line.revisedBudget()
                                        .multiply(
                                                progressRatio)
                                        .multiply(
                                                new BigDecimal(
                                                        "0.90")));

                if (actualAmount.signum()
                        > 0) {

                    actualCostRepository.save(
                            ProjectActualCost.create(
                                    UUID.randomUUID(),
                                    project.getId(),
                                    code.getId(),
                                    commitment.getId(),
                                    "INV-"
                                            + project
                                                    .getCode()
                                                    .replace(
                                                            "BS-",
                                                            "")
                                            + "-"
                                            + index,
                                    vendorName(
                                            index),
                                    "Certified construction work and recorded project cost.",
                                    actualAmount,
                                    actualDate(
                                            project,
                                            index)));
                }
            }

            index++;
        }
    }

    private BigDecimal forecastFactor(
            String projectCode) {

        return switch (projectCode) {
            case "BS-2026-001" ->
                    new BigDecimal("1.0500");

            case "BS-2026-002" ->
                    new BigDecimal("0.9800");

            case "BS-2026-004" ->
                    new BigDecimal("1.0800");

            default ->
                    BigDecimal.ONE;
        };
    }

    private LocalDate commitmentDate(
            Project project,
            int index) {

        LocalDate base =
                project.getPlannedStartDate()
                        .plusDays(
                                (long) index
                                        * 14);

        LocalDate today =
                LocalDate.now();

        return base.isAfter(
                        today)
                ? today
                : base;
    }

    private LocalDate actualDate(
            Project project,
            int index) {

        LocalDate base =
                project.getPlannedStartDate()
                        .plusDays(
                                30L
                                        + (long) index
                                        * 20);

        LocalDate today =
                LocalDate.now();

        return base.isAfter(
                        today)
                ? today
                : base;
    }

    private String vendorName(
            int index) {

        return switch (index) {
            case 1 ->
                    "BuildCore Services";

            case 2 ->
                    "Structura Engineering";

            case 3 ->
                    "Electra MEP";

            default ->
                    "Forma Interiors";
        };
    }

    private BigDecimal portion(
            BigDecimal value,
            String ratio) {

        return money(
                value.multiply(
                        new BigDecimal(
                                ratio)));
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }
}
