package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.cost.domain.ProjectCostCode;
import com.buildsight.platform.cost.repository.ProjectCommitmentRepository;
import com.buildsight.platform.cost.repository.ProjectCostCodeRepository;
import com.buildsight.platform.procurement.domain.ProcurementBid;
import com.buildsight.platform.procurement.domain.ProcurementPackage;
import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;
import com.buildsight.platform.procurement.domain.Supplier;
import com.buildsight.platform.procurement.domain.SupplierPerformanceEvaluation;
import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;
import com.buildsight.platform.procurement.domain.SupplierType;
import com.buildsight.platform.procurement.repository.ProcurementBidRepository;
import com.buildsight.platform.procurement.repository.ProcurementPackageRepository;
import com.buildsight.platform.procurement.repository.SupplierPerformanceEvaluationRepository;
import com.buildsight.platform.procurement.repository.SupplierRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(30)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoProcurementSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectCostCodeRepository
            costCodeRepository;

    private final ProjectCommitmentRepository
            commitmentRepository;

    private final SupplierRepository
            supplierRepository;

    private final ProcurementPackageRepository
            packageRepository;

    private final ProcurementBidRepository
            bidRepository;

    private final SupplierPerformanceEvaluationRepository
            evaluationRepository;

    public DemoProcurementSeeder(
            ProjectRepository projectRepository,
            ProjectCostCodeRepository costCodeRepository,
            ProjectCommitmentRepository commitmentRepository,
            SupplierRepository supplierRepository,
            ProcurementPackageRepository packageRepository,
            ProcurementBidRepository bidRepository,
            SupplierPerformanceEvaluationRepository evaluationRepository) {

        this.projectRepository =
                projectRepository;

        this.costCodeRepository =
                costCodeRepository;

        this.commitmentRepository =
                commitmentRepository;

        this.supplierRepository =
                supplierRepository;

        this.packageRepository =
                packageRepository;

        this.bidRepository =
                bidRepository;

        this.evaluationRepository =
                evaluationRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        seedSuppliers();

        Map<String, Supplier> suppliers =
                supplierRepository
                        .findAllByOrderByNameAsc()
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        Supplier::getCode,
                                        Function.identity()));

        for (Project project :
                projectRepository.findAll()) {

            seedProject(
                    project,
                    suppliers);
        }
    }

    private void seedSuppliers() {

        if (supplierRepository.count()
                > 0) {

            return;
        }

        supplierRepository.saveAll(
                List.of(
                        supplier(
                                "SUP-001",
                                "Structura Engineering",
                                SupplierType.SUBCONTRACTOR,
                                "Structural works",
                                "France",
                                SupplierQualificationStatus.QUALIFIED),

                        supplier(
                                "SUP-002",
                                "Electra MEP",
                                SupplierType.SUBCONTRACTOR,
                                "Mechanical and electrical",
                                "France",
                                SupplierQualificationStatus.QUALIFIED),

                        supplier(
                                "SUP-003",
                                "Forma Interiors",
                                SupplierType.SUBCONTRACTOR,
                                "Interior fit-out",
                                "France",
                                SupplierQualificationStatus.CONDITIONAL),

                        supplier(
                                "SUP-004",
                                "BuildCore Materials",
                                SupplierType.SUPPLIER,
                                "General construction materials",
                                "Tunisia",
                                SupplierQualificationStatus.QUALIFIED),

                        supplier(
                                "SUP-005",
                                "Nova Engineering Consultants",
                                SupplierType.CONSULTANT,
                                "Engineering consultancy",
                                "France",
                                SupplierQualificationStatus.PENDING)));
    }

    private Supplier supplier(
            String code,
            String name,
            SupplierType type,
            String trade,
            String country,
            SupplierQualificationStatus qualification) {

        return Supplier.create(
                UUID.randomUUID(),
                code,
                name,
                type,
                trade,
                country,
                "Procurement Team",
                null,
                qualification);
    }

    private void seedProject(
            Project project,
            Map<String, Supplier> suppliers) {

        if (packageRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        List<ProjectCostCode> costCodes =
                costCodeRepository
                        .findByProjectIdOrderBySortOrderAscCodeAsc(
                                project.getId());

        if (costCodes.size()
                < 2) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        ProjectCostCode first =
                costCodes.get(0);

        ProjectCostCode second =
                costCodes.get(1);

        BigDecimal packageValue =
                project.getApprovedBudget()
                        .multiply(
                                new BigDecimal("0.12"))
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        ProcurementPackage awarded =
                ProcurementPackage.create(
                        UUID.randomUUID(),
                        project.getId(),
                        first.getId(),
                        packageReference(
                                project,
                                1),
                        "Primary subcontract package",
                        "Demonstration procurement package integrated with project cost commitments.",
                        packageValue,
                        today.minusDays(90),
                        today.minusDays(70),
                        today.minusDays(55),
                        today.minusDays(52),
                        today.plusDays(30));

        awarded.changeStatus(
                ProcurementPackageStatus.TENDERING,
                today.minusDays(90));

        awarded.changeStatus(
                ProcurementPackageStatus.EVALUATION,
                today.minusDays(65));

        packageRepository.save(
                awarded);

        Supplier supplierOne =
                suppliers.get(
                        "SUP-001");

        Supplier supplierTwo =
                suppliers.get(
                        "SUP-004");

        ProcurementBid bidOne =
                bid(
                        awarded,
                        supplierOne,
                        packageValue
                                .multiply(
                                        new BigDecimal("0.97")),
                        today.minusDays(65),
                        "86.00",
                        "82.00",
                        35);

        ProcurementBid bidTwo =
                bid(
                        awarded,
                        supplierTwo,
                        packageValue
                                .multiply(
                                        new BigDecimal("1.03")),
                        today.minusDays(63),
                        "79.00",
                        "88.00",
                        31);

        bidRepository.saveAll(
                List.of(
                        bidOne,
                        bidTwo));

        BigDecimal awardValue =
                bidOne.getBidAmount();

        String commitmentReference =
                "PROC-"
                        + awarded.getReference();

        ProjectCommitment commitment =
                ProjectCommitment.create(
                        UUID.randomUUID(),
                        project.getId(),
                        awarded.getCostCodeId(),
                        commitmentReference,
                        supplierOne.getName(),
                        "Procurement award: "
                                + awarded.getTitle(),
                        awardValue,
                        CommitmentStatus.APPROVED,
                        today.minusDays(50));

        commitmentRepository.save(
                commitment);

        bidOne.select();
        bidTwo.reject();

        bidRepository.saveAll(
                List.of(
                        bidOne,
                        bidTwo));

        awarded.award(
                supplierOne.getId(),
                awardValue,
                today.minusDays(50),
                commitment.getId());

        packageRepository.save(
                awarded);

        evaluationRepository.save(
                SupplierPerformanceEvaluation.create(
                        UUID.randomUUID(),
                        project.getId(),
                        supplierOne.getId(),
                        awarded.getId(),
                        today.minusDays(5),
                        new BigDecimal("84.00"),
                        new BigDecimal("78.00"),
                        new BigDecimal("92.00"),
                        new BigDecimal("81.00"),
                        "Supplier demonstrating good overall package performance."));

        ProcurementPackage current =
                ProcurementPackage.create(
                        UUID.randomUUID(),
                        project.getId(),
                        second.getId(),
                        packageReference(
                                project,
                                2),
                        "Secondary construction package",
                        "Competitive tender package demonstrating procurement lead-time intelligence.",
                        packageValue
                                .multiply(
                                        new BigDecimal("0.75"))
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP),
                        today.minusDays(35),
                        today.minusDays(18),
                        today.minusDays(4),
                        project.getCode()
                                        .endsWith("004")
                                ? today.plusDays(14)
                                : today.plusDays(3),
                        today.plusDays(60));

        current.changeStatus(
                ProcurementPackageStatus.TENDERING,
                today.minusDays(35));

        current.changeStatus(
                ProcurementPackageStatus.EVALUATION,
                today.minusDays(15));

        packageRepository.save(
                current);

        ProcurementBid currentBidOne =
                bid(
                        current,
                        suppliers.get(
                                "SUP-002"),
                        current.getEstimatedValue()
                                .multiply(
                                        new BigDecimal("0.99")),
                        today.minusDays(15),
                        "88.00",
                        "80.00",
                        28);

        currentBidOne.update(
                currentBidOne.getBidAmount(),
                currentBidOne.getSubmittedDate(),
                currentBidOne.getTechnicalScore(),
                currentBidOne.getCommercialScore(),
                currentBidOne.getDeliveryDays(),
                com.buildsight.platform.procurement.domain.ProcurementBidStatus.SHORTLISTED,
                "Preferred technical submission.");

        bidRepository.save(
                currentBidOne);

        if (!project.getCode()
                .endsWith("004")) {

            bidRepository.save(
                    bid(
                            current,
                            suppliers.get(
                                    "SUP-003"),
                            current.getEstimatedValue()
                                    .multiply(
                                            new BigDecimal("0.95")),
                            today.minusDays(13),
                            "74.00",
                            "91.00",
                            34));
        }

        System.out.println(
                "[BuildSight] Procurement demo data created for "
                        + project.getCode());
    }

    private ProcurementBid bid(
            ProcurementPackage packageItem,
            Supplier supplier,
            BigDecimal amount,
            LocalDate submitted,
            String technical,
            String commercial,
            int deliveryDays) {

        return ProcurementBid.create(
                UUID.randomUUID(),
                packageItem.getId(),
                supplier.getId(),
                amount.setScale(
                        2,
                        RoundingMode.HALF_UP),
                submitted,
                new BigDecimal(
                        technical),
                new BigDecimal(
                        commercial),
                deliveryDays,
                "Demonstration competitive procurement submission.");
    }

    private String packageReference(
            Project project,
            int number) {

        return "PKG-"
                + project.getCode()
                        .replace(
                                "BS-",
                                "")
                + "-"
                + String.format(
                        "%02d",
                        number);
    }
}
