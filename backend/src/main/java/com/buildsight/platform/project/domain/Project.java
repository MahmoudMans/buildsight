package com.buildsight.platform.project.domain;

import java.math.BigDecimal;
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
@Table(name = "projects")
public class Project {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 32)
    private String code;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "client_name", nullable = false, length = 160)
    private String clientName;

    @Column(name = "location", nullable = false, length = 200)
    private String location;

    @Column(
            name = "contract_value",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal contractValue;

    @Column(
            name = "approved_budget",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal approvedBudget;

    @Column(name = "planned_start_date", nullable = false)
    private LocalDate plannedStartDate;

    @Column(name = "planned_end_date", nullable = false)
    private LocalDate plannedEndDate;

    @Column(name = "actual_start_date")
    private LocalDate actualStartDate;

    @Column(name = "actual_end_date")
    private LocalDate actualEndDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProjectStatus status;

    @Column(
            name = "physical_progress_percentage",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal physicalProgressPercentage;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Project() {
    }

    private Project(
            UUID id,
            String code,
            String name,
            String description,
            String clientName,
            String location,
            BigDecimal contractValue,
            BigDecimal approvedBudget,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            ProjectStatus status,
            BigDecimal physicalProgressPercentage) {

        this.id = Objects.requireNonNull(id);
        this.code = Objects.requireNonNull(code);
        this.name = Objects.requireNonNull(name);
        this.description = description;
        this.clientName = Objects.requireNonNull(clientName);
        this.location = Objects.requireNonNull(location);
        this.contractValue = Objects.requireNonNull(contractValue);
        this.approvedBudget = Objects.requireNonNull(approvedBudget);
        this.plannedStartDate = Objects.requireNonNull(plannedStartDate);
        this.plannedEndDate = Objects.requireNonNull(plannedEndDate);
        this.status = Objects.requireNonNull(status);
        this.physicalProgressPercentage =
                Objects.requireNonNull(physicalProgressPercentage);
    }

    public static Project create(
            UUID id,
            String code,
            String name,
            String description,
            String clientName,
            String location,
            BigDecimal contractValue,
            BigDecimal approvedBudget,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            ProjectStatus status,
            BigDecimal physicalProgressPercentage) {

        return new Project(
                id,
                code,
                name,
                description,
                clientName,
                location,
                contractValue,
                approvedBudget,
                plannedStartDate,
                plannedEndDate,
                status,
                physicalProgressPercentage);
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getClientName() {
        return clientName;
    }

    public String getLocation() {
        return location;
    }

    public BigDecimal getContractValue() {
        return contractValue;
    }

    public BigDecimal getApprovedBudget() {
        return approvedBudget;
    }

    public LocalDate getPlannedStartDate() {
        return plannedStartDate;
    }

    public LocalDate getPlannedEndDate() {
        return plannedEndDate;
    }

    public LocalDate getActualStartDate() {
        return actualStartDate;
    }

    public LocalDate getActualEndDate() {
        return actualEndDate;
    }

    public ProjectStatus getStatus() {
        return status;
    }

    public BigDecimal getPhysicalProgressPercentage() {
        return physicalProgressPercentage;
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
