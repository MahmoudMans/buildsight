package com.buildsight.platform.schedule.domain;

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
@Table(name = "project_schedule_dependencies")
public class ProjectScheduleDependency {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "predecessor_activity_id",
            nullable = false,
            updatable = false)
    private UUID predecessorActivityId;

    @Column(
            name = "successor_activity_id",
            nullable = false,
            updatable = false)
    private UUID successorActivityId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "dependency_type",
            nullable = false,
            length = 8,
            updatable = false)
    private ScheduleDependencyType dependencyType;

    @Column(
            name = "lag_days",
            nullable = false,
            updatable = false)
    private int lagDays;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectScheduleDependency() {
    }

    private ProjectScheduleDependency(
            UUID id,
            UUID projectId,
            UUID predecessorActivityId,
            UUID successorActivityId,
            ScheduleDependencyType dependencyType,
            int lagDays) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.predecessorActivityId =
                Objects.requireNonNull(
                        predecessorActivityId);

        this.successorActivityId =
                Objects.requireNonNull(
                        successorActivityId);

        this.dependencyType =
                Objects.requireNonNull(
                        dependencyType);

        this.lagDays =
                lagDays;
    }

    public static ProjectScheduleDependency create(
            UUID id,
            UUID projectId,
            UUID predecessorActivityId,
            UUID successorActivityId,
            ScheduleDependencyType dependencyType,
            int lagDays) {

        return new ProjectScheduleDependency(
                id,
                projectId,
                predecessorActivityId,
                successorActivityId,
                dependencyType,
                lagDays);
    }

    @PrePersist
    void onCreate() {

        if (createdAt == null) {
            createdAt =
                    Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getPredecessorActivityId() {
        return predecessorActivityId;
    }

    public UUID getSuccessorActivityId() {
        return successorActivityId;
    }

    public ScheduleDependencyType getDependencyType() {
        return dependencyType;
    }

    public int getLagDays() {
        return lagDays;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
