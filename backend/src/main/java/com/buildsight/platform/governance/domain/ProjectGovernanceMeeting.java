package com.buildsight.platform.governance.domain;

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
@Table(name = "project_governance_meetings")
public class ProjectGovernanceMeeting {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "meeting_number",
            nullable = false,
            length = 64,
            updatable = false)
    private String meetingNumber;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "meeting_type",
            nullable = false,
            length = 40)
    private GovernanceMeetingType meetingType;

    @Column(
            name = "scheduled_at",
            nullable = false)
    private Instant scheduledAt;

    @Column(name = "held_at")
    private Instant heldAt;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private GovernanceMeetingStatus status;

    @Column(
            name = "chair_name",
            length = 160)
    private String chairName;

    @Column(
            name = "minutes",
            columnDefinition = "TEXT")
    private String minutes;

    @Column(name = "next_meeting_at")
    private Instant nextMeetingAt;

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

    protected ProjectGovernanceMeeting() {
    }

    private ProjectGovernanceMeeting(
            UUID id,
            UUID projectId,
            String meetingNumber,
            String title,
            GovernanceMeetingType meetingType,
            Instant scheduledAt,
            String chairName) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.meetingNumber =
                Objects.requireNonNull(
                        meetingNumber);

        this.title =
                Objects.requireNonNull(
                        title);

        this.meetingType =
                Objects.requireNonNull(
                        meetingType);

        this.scheduledAt =
                Objects.requireNonNull(
                        scheduledAt);

        this.chairName =
                chairName;

        this.status =
                GovernanceMeetingStatus.PLANNED;
    }

    public static ProjectGovernanceMeeting create(
            UUID id,
            UUID projectId,
            String meetingNumber,
            String title,
            GovernanceMeetingType meetingType,
            Instant scheduledAt,
            String chairName) {

        return new ProjectGovernanceMeeting(
                id,
                projectId,
                meetingNumber,
                title,
                meetingType,
                scheduledAt,
                chairName);
    }

    public void update(
            String title,
            GovernanceMeetingType meetingType,
            Instant scheduledAt,
            Instant heldAt,
            GovernanceMeetingStatus status,
            String chairName,
            String minutes,
            Instant nextMeetingAt) {

        this.title =
                Objects.requireNonNull(
                        title);

        this.meetingType =
                Objects.requireNonNull(
                        meetingType);

        this.scheduledAt =
                Objects.requireNonNull(
                        scheduledAt);

        this.status =
                Objects.requireNonNull(
                        status);

        this.chairName =
                chairName;

        this.minutes =
                minutes;

        this.nextMeetingAt =
                nextMeetingAt;

        if (status == GovernanceMeetingStatus.HELD) {

            this.heldAt =
                    heldAt != null
                            ? heldAt
                            : scheduledAt;

        } else {

            this.heldAt =
                    null;
        }
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

    public String getMeetingNumber() {
        return meetingNumber;
    }

    public String getTitle() {
        return title;
    }

    public GovernanceMeetingType getMeetingType() {
        return meetingType;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Instant getHeldAt() {
        return heldAt;
    }

    public GovernanceMeetingStatus getStatus() {
        return status;
    }

    public String getChairName() {
        return chairName;
    }

    public String getMinutes() {
        return minutes;
    }

    public Instant getNextMeetingAt() {
        return nextMeetingAt;
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
