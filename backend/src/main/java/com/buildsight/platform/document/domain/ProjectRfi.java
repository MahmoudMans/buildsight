package com.buildsight.platform.document.domain;

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
@Table(name = "project_rfis")
public class ProjectRfi {

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
            name = "subject",
            nullable = false,
            length = 220)
    private String subject;

    @Column(
            name = "question",
            nullable = false,
            columnDefinition = "TEXT")
    private String question;

    @Column(
            name = "response",
            columnDefinition = "TEXT")
    private String response;

    @Column(
            name = "raised_by",
            length = 160)
    private String raisedBy;

    @Column(
            name = "assigned_to",
            length = 160)
    private String assignedTo;

    @Column(
            name = "raised_date",
            nullable = false)
    private LocalDate raisedDate;

    @Column(
            name = "due_date",
            nullable = false)
    private LocalDate dueDate;

    @Column(
            name = "responded_date")
    private LocalDate respondedDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "priority",
            nullable = false,
            length = 32)
    private RfiPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private RfiStatus status;

    @Column(
            name = "search_text",
            nullable = false,
            columnDefinition = "TEXT")
    private String searchText;

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

    protected ProjectRfi() {
    }

    private ProjectRfi(
            UUID id,
            UUID projectId,
            String reference,
            String subject,
            String question,
            String raisedBy,
            String assignedTo,
            LocalDate raisedDate,
            LocalDate dueDate,
            RfiPriority priority,
            String searchText) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.subject =
                Objects.requireNonNull(subject);

        this.question =
                Objects.requireNonNull(question);

        this.raisedBy =
                raisedBy;

        this.assignedTo =
                assignedTo;

        this.raisedDate =
                Objects.requireNonNull(raisedDate);

        this.dueDate =
                Objects.requireNonNull(dueDate);

        this.priority =
                Objects.requireNonNull(priority);

        this.status =
                RfiStatus.OPEN;

        this.searchText =
                Objects.requireNonNull(searchText);
    }

    public static ProjectRfi create(
            UUID id,
            UUID projectId,
            String reference,
            String subject,
            String question,
            String raisedBy,
            String assignedTo,
            LocalDate raisedDate,
            LocalDate dueDate,
            RfiPriority priority,
            String searchText) {

        return new ProjectRfi(
                id,
                projectId,
                reference,
                subject,
                question,
                raisedBy,
                assignedTo,
                raisedDate,
                dueDate,
                priority,
                searchText);
    }

    public void update(
            String subject,
            String question,
            String response,
            String assignedTo,
            LocalDate dueDate,
            RfiPriority priority,
            RfiStatus status,
            String searchText,
            LocalDate currentDate) {

        this.subject =
                Objects.requireNonNull(subject);

        this.question =
                Objects.requireNonNull(question);

        this.response =
                response;

        this.assignedTo =
                assignedTo;

        this.dueDate =
                Objects.requireNonNull(dueDate);

        this.priority =
                Objects.requireNonNull(priority);

        this.status =
                Objects.requireNonNull(status);

        this.searchText =
                Objects.requireNonNull(searchText);

        if (status == RfiStatus.ANSWERED
                || status == RfiStatus.CLOSED) {

            if (respondedDate == null) {
                respondedDate =
                        Objects.requireNonNull(currentDate);
            }

        } else if (status == RfiStatus.OPEN) {
            respondedDate =
                    null;
        }
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

    public String getSubject() {
        return subject;
    }

    public String getQuestion() {
        return question;
    }

    public String getResponse() {
        return response;
    }

    public String getRaisedBy() {
        return raisedBy;
    }

    public String getAssignedTo() {
        return assignedTo;
    }

    public LocalDate getRaisedDate() {
        return raisedDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public LocalDate getRespondedDate() {
        return respondedDate;
    }

    public RfiPriority getPriority() {
        return priority;
    }

    public RfiStatus getStatus() {
        return status;
    }

    public String getSearchText() {
        return searchText;
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
