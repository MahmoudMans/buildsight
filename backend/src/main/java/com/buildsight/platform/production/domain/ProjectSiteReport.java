package com.buildsight.platform.production.domain;

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
@Table(name = "project_site_reports")
public class ProjectSiteReport {

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
            name = "report_date",
            nullable = false)
    private LocalDate reportDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "weather_condition",
            nullable = false,
            length = 32)
    private WeatherCondition weatherCondition;

    @Column(
            name = "general_notes",
            length = 2500)
    private String generalNotes;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private SiteReportStatus status;

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

    protected ProjectSiteReport() {
    }

    private ProjectSiteReport(
            UUID id,
            UUID projectId,
            String reference,
            LocalDate reportDate,
            WeatherCondition weatherCondition,
            String generalNotes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.reportDate =
                Objects.requireNonNull(reportDate);

        this.weatherCondition =
                Objects.requireNonNull(
                        weatherCondition);

        this.generalNotes =
                generalNotes;

        this.status =
                SiteReportStatus.DRAFT;
    }

    public static ProjectSiteReport create(
            UUID id,
            UUID projectId,
            String reference,
            LocalDate reportDate,
            WeatherCondition weatherCondition,
            String generalNotes) {

        return new ProjectSiteReport(
                id,
                projectId,
                reference,
                reportDate,
                weatherCondition,
                generalNotes);
    }

    public void update(
            LocalDate reportDate,
            WeatherCondition weatherCondition,
            String generalNotes,
            SiteReportStatus status) {

        this.reportDate =
                Objects.requireNonNull(
                        reportDate);

        this.weatherCondition =
                Objects.requireNonNull(
                        weatherCondition);

        this.generalNotes =
                generalNotes;

        this.status =
                Objects.requireNonNull(
                        status);
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

    public LocalDate getReportDate() {
        return reportDate;
    }

    public WeatherCondition getWeatherCondition() {
        return weatherCondition;
    }

    public String getGeneralNotes() {
        return generalNotes;
    }

    public SiteReportStatus getStatus() {
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
