package com.buildsight.platform.risk.domain;

import java.time.Instant;
import java.time.LocalDate;
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
@Table(name = "project_risks")
public class ProjectRisk {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "title",
            nullable = false,
            length = 180)
    private String title;

    @Column(
            name = "description",
            length = 1500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "category",
            nullable = false,
            length = 32)
    private RiskCategory category;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(
            name = "probability",
            nullable = false)
    private int probability;

    @Column(
            name = "impact",
            nullable = false)
    private int impact;

    @Column(
            name = "residual_probability",
            nullable = false)
    private int residualProbability;

    @Column(
            name = "residual_impact",
            nullable = false)
    private int residualImpact;

    @Column(
            name = "mitigation_plan",
            length = 2000)
    private String mitigationPlan;

    @Column(
            name = "mitigation_due_date",
            nullable = false)
    private LocalDate mitigationDueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private RiskStatus status;

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

    protected ProjectRisk() {
    }

    private ProjectRisk(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            RiskCategory category,
            String ownerName,
            int probability,
            int impact,
            int residualProbability,
            int residualImpact,
            String mitigationPlan,
            LocalDate mitigationDueDate,
            RiskStatus status) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.reference =
                Objects.requireNonNull(
                        reference);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.category =
                Objects.requireNonNull(
                        category);

        this.ownerName =
                ownerName;

        this.probability =
                probability;

        this.impact =
                impact;

        this.residualProbability =
                residualProbability;

        this.residualImpact =
                residualImpact;

        this.mitigationPlan =
                mitigationPlan;

        this.mitigationDueDate =
                Objects.requireNonNull(
                        mitigationDueDate);

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public static ProjectRisk create(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            RiskCategory category,
            String ownerName,
            int probability,
            int impact,
            int residualProbability,
            int residualImpact,
            String mitigationPlan,
            LocalDate mitigationDueDate) {

        return new ProjectRisk(
                id,
                projectId,
                reference,
                title,
                description,
                category,
                ownerName,
                probability,
                impact,
                residualProbability,
                residualImpact,
                mitigationPlan,
                mitigationDueDate,
                RiskStatus.OPEN);
    }

    public void update(
            String title,
            String description,
            RiskCategory category,
            String ownerName,
            int probability,
            int impact,
            int residualProbability,
            int residualImpact,
            String mitigationPlan,
            LocalDate mitigationDueDate,
            RiskStatus status) {

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.category =
                Objects.requireNonNull(
                        category);

        this.ownerName =
                ownerName;

        this.probability =
                probability;

        this.impact =
                impact;

        this.residualProbability =
                residualProbability;

        this.residualImpact =
                residualImpact;

        this.mitigationPlan =
                mitigationPlan;

        this.mitigationDueDate =
                Objects.requireNonNull(
                        mitigationDueDate);

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public int inherentScore() {
        return probability
                * impact;
    }

    public int residualScore() {
        return residualProbability
                * residualImpact;
    }

    @PrePersist
    void onCreate() {
        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
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

    public String getReference() {
        return reference;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public RiskCategory getCategory() {
        return category;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public int getProbability() {
        return probability;
    }

    public int getImpact() {
        return impact;
    }

    public int getResidualProbability() {
        return residualProbability;
    }

    public int getResidualImpact() {
        return residualImpact;
    }

    public String getMitigationPlan() {
        return mitigationPlan;
    }

    public LocalDate getMitigationDueDate() {
        return mitigationDueDate;
    }

    public RiskStatus getStatus() {
        return status;
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
