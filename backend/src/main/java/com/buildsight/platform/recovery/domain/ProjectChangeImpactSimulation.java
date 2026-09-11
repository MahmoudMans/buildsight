package com.buildsight.platform.recovery.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "project_change_impact_simulations")
public class ProjectChangeImpactSimulation {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "simulation_number",
            nullable = false,
            length = 64,
            updatable = false)
    private String simulationNumber;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "source_change_reference",
            nullable = false,
            length = 120)
    private String sourceChangeReference;

    @Column(
            name = "description",
            columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ChangeSimulationStatus status;

    @Column(
            name = "direct_cost_impact",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal directCostImpact;

    @Column(
            name = "delay_days",
            nullable = false)
    private int delayDays;

    @Column(
            name = "productivity_change_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal productivityChangePercentage;

    @Column(
            name = "procurement_delay_days",
            nullable = false)
    private int procurementDelayDays;

    @Column(
            name = "resource_capacity_change_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal resourceCapacityChangePercentage;

    @Column(
            name = "risk_contingency_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal riskContingencyPercentage;

    @Column(
            name = "notes",
            columnDefinition = "TEXT")
    private String notes;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Version
    @Column(
            name = "version",
            nullable = false)
    private long version;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false)
    private Instant updatedAt;

    protected ProjectChangeImpactSimulation() {
    }

    private ProjectChangeImpactSimulation(
            UUID id,
            UUID projectId,
            String simulationNumber,
            String title,
            String sourceChangeReference,
            String description,
            BigDecimal directCostImpact,
            int delayDays,
            BigDecimal productivityChangePercentage,
            int procurementDelayDays,
            BigDecimal resourceCapacityChangePercentage,
            BigDecimal riskContingencyPercentage,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.simulationNumber =
                Objects.requireNonNull(
                        simulationNumber);

        this.title =
                Objects.requireNonNull(
                        title);

        this.sourceChangeReference =
                Objects.requireNonNull(
                        sourceChangeReference);

        this.description =
                description;

        this.status =
                ChangeSimulationStatus.DRAFT;

        this.directCostImpact =
                Objects.requireNonNull(
                        directCostImpact);

        this.delayDays =
                delayDays;

        this.productivityChangePercentage =
                Objects.requireNonNull(
                        productivityChangePercentage);

        this.procurementDelayDays =
                procurementDelayDays;

        this.resourceCapacityChangePercentage =
                Objects.requireNonNull(
                        resourceCapacityChangePercentage);

        this.riskContingencyPercentage =
                Objects.requireNonNull(
                        riskContingencyPercentage);

        this.notes =
                notes;
    }

    public static ProjectChangeImpactSimulation create(
            UUID id,
            UUID projectId,
            String simulationNumber,
            String title,
            String sourceChangeReference,
            String description,
            BigDecimal directCostImpact,
            int delayDays,
            BigDecimal productivityChangePercentage,
            int procurementDelayDays,
            BigDecimal resourceCapacityChangePercentage,
            BigDecimal riskContingencyPercentage,
            String notes) {

        return new ProjectChangeImpactSimulation(
                id,
                projectId,
                simulationNumber,
                title,
                sourceChangeReference,
                description,
                directCostImpact,
                delayDays,
                productivityChangePercentage,
                procurementDelayDays,
                resourceCapacityChangePercentage,
                riskContingencyPercentage,
                notes);
    }

    public void update(
            String title,
            String sourceChangeReference,
            String description,
            BigDecimal directCostImpact,
            int delayDays,
            BigDecimal productivityChangePercentage,
            int procurementDelayDays,
            BigDecimal resourceCapacityChangePercentage,
            BigDecimal riskContingencyPercentage,
            String notes) {

        if (status != ChangeSimulationStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft change-impact simulations can be edited.");
        }

        this.title =
                Objects.requireNonNull(
                        title);

        this.sourceChangeReference =
                Objects.requireNonNull(
                        sourceChangeReference);

        this.description =
                description;

        this.directCostImpact =
                Objects.requireNonNull(
                        directCostImpact);

        this.delayDays =
                delayDays;

        this.productivityChangePercentage =
                Objects.requireNonNull(
                        productivityChangePercentage);

        this.procurementDelayDays =
                procurementDelayDays;

        this.resourceCapacityChangePercentage =
                Objects.requireNonNull(
                        resourceCapacityChangePercentage);

        this.riskContingencyPercentage =
                Objects.requireNonNull(
                        riskContingencyPercentage);

        this.notes =
                notes;
    }

    public void approve(
            Instant now) {

        if (status != ChangeSimulationStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft change-impact simulations can be approved.");
        }

        status =
                ChangeSimulationStatus.APPROVED;

        approvedAt =
                now;
    }

    public void archive() {

        if (status == ChangeSimulationStatus.ARCHIVED) {
            return;
        }

        status =
                ChangeSimulationStatus.ARCHIVED;
    }

    @PrePersist
    void onCreate() {

        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt =
                    now;
        }

        updatedAt =
                now;
    }

    @PreUpdate
    void onUpdate() {

        updatedAt =
                Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getSimulationNumber() {
        return simulationNumber;
    }

    public String getTitle() {
        return title;
    }

    public String getSourceChangeReference() {
        return sourceChangeReference;
    }

    public String getDescription() {
        return description;
    }

    public ChangeSimulationStatus getStatus() {
        return status;
    }

    public BigDecimal getDirectCostImpact() {
        return directCostImpact;
    }

    public int getDelayDays() {
        return delayDays;
    }

    public BigDecimal getProductivityChangePercentage() {
        return productivityChangePercentage;
    }

    public int getProcurementDelayDays() {
        return procurementDelayDays;
    }

    public BigDecimal getResourceCapacityChangePercentage() {
        return resourceCapacityChangePercentage;
    }

    public BigDecimal getRiskContingencyPercentage() {
        return riskContingencyPercentage;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
