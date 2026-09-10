package com.buildsight.platform.cost.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_cost_codes")
public class ProjectCostCode {

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
            name = "code",
            nullable = false,
            length = 32)
    private String code;

    @Column(
            name = "name",
            nullable = false,
            length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "category",
            nullable = false,
            length = 40)
    private CostCodeCategory category;

    @Column(
            name = "description",
            length = 1000)
    private String description;

    @Column(
            name = "sort_order",
            nullable = false)
    private int sortOrder;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectCostCode() {
    }

    private ProjectCostCode(
            UUID id,
            UUID projectId,
            String code,
            String name,
            CostCodeCategory category,
            String description,
            int sortOrder) {

        this.id = Objects.requireNonNull(id);
        this.projectId =
                Objects.requireNonNull(projectId);
        this.code =
                Objects.requireNonNull(code);
        this.name =
                Objects.requireNonNull(name);
        this.category =
                Objects.requireNonNull(category);
        this.description = description;
        this.sortOrder = sortOrder;
    }

    public static ProjectCostCode create(
            UUID id,
            UUID projectId,
            String code,
            String name,
            CostCodeCategory category,
            String description,
            int sortOrder) {

        return new ProjectCostCode(
                id,
                projectId,
                code,
                name,
                category,
                description,
                sortOrder);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public CostCodeCategory getCategory() {
        return category;
    }

    public String getDescription() {
        return description;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
