package com.buildsight.platform.production.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.production.api.CreateProductionEntryRequest;
import com.buildsight.platform.production.api.CreateSiteReportRequest;
import com.buildsight.platform.production.api.CreateWorkPackageRequest;
import com.buildsight.platform.production.api.ProductionControlResponse;
import com.buildsight.platform.production.api.ProductionEntryResponse;
import com.buildsight.platform.production.api.SiteReportResponse;
import com.buildsight.platform.production.api.UpdateProductionEntryRequest;
import com.buildsight.platform.production.api.UpdateSiteReportRequest;
import com.buildsight.platform.production.api.UpdateWorkPackageRequest;
import com.buildsight.platform.production.api.WorkPackageResponse;
import com.buildsight.platform.production.domain.ProjectSiteReport;
import com.buildsight.platform.production.domain.ProjectWorkPackage;
import com.buildsight.platform.production.domain.SiteReportProductionEntry;
import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WorkPackageStatus;
import com.buildsight.platform.production.repository.ProjectSiteReportRepository;
import com.buildsight.platform.production.repository.ProjectWorkPackageRepository;
import com.buildsight.platform.production.repository.SiteReportProductionEntryRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductionControlService {

    private static final Map<
            WorkPackageStatus,
            Set<WorkPackageStatus>>
            PACKAGE_TRANSITIONS =
            workPackageTransitions();

    private static final Map<
            SiteReportStatus,
            Set<SiteReportStatus>>
            REPORT_TRANSITIONS =
            siteReportTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectWorkPackageRepository
            workPackageRepository;

    private final ProjectSiteReportRepository
            siteReportRepository;

    private final SiteReportProductionEntryRepository
            entryRepository;

    private final ProductionIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public ProductionControlService(
            ProjectRepository projectRepository,
            ProjectWorkPackageRepository workPackageRepository,
            ProjectSiteReportRepository siteReportRepository,
            SiteReportProductionEntryRepository entryRepository,
            ProductionIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.workPackageRepository =
                workPackageRepository;

        this.siteReportRepository =
                siteReportRepository;

        this.entryRepository =
                entryRepository;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ProductionControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectWorkPackage> packages =
                workPackageRepository
                        .findByProjectIdOrderByPlannedStartDateAscCodeAsc(
                                projectId);

        List<ProjectSiteReport> reports =
                siteReportRepository
                        .findByProjectIdOrderByReportDateDescCreatedAtDesc(
                                projectId);

        List<UUID> reportIds =
                reports.stream()
                        .map(
                                ProjectSiteReport::getId)
                        .toList();

        List<SiteReportProductionEntry> entries =
                reportIds.isEmpty()
                        ? List.of()
                        : entryRepository
                                .findBySiteReportIdInOrderByCreatedAtAsc(
                                        reportIds);

        List<SiteReportProductionEntry> acceptedEntries =
                intelligenceService
                        .acceptedEntries(
                                reports,
                                entries);

        Map<UUID, List<SiteReportProductionEntry>>
                acceptedByPackage =
                acceptedEntries.stream()
                        .collect(
                                Collectors.groupingBy(
                                        SiteReportProductionEntry::getWorkPackageId));

        Map<UUID, List<SiteReportProductionEntry>>
                entriesByReport =
                entries.stream()
                        .collect(
                                Collectors.groupingBy(
                                        SiteReportProductionEntry::getSiteReportId));

        Map<UUID, ProjectWorkPackage> packageMap =
                packages.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectWorkPackage::getId,
                                        Function.identity()));

        Map<UUID, ProjectSiteReport> reportMap =
                reports.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectSiteReport::getId,
                                        Function.identity()));

        LocalDate today =
                LocalDate.now(
                        clock);

        return new ProductionControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        packages,
                        reports,
                        entries),

                packages.stream()
                        .map(
                                packageItem ->
                                        toWorkPackageResponse(
                                                packageItem,
                                                intelligenceService.metricsFor(
                                                        packageItem,
                                                        acceptedByPackage.getOrDefault(
                                                                packageItem.getId(),
                                                                List.of()),
                                                        today)))
                        .toList(),

                reports.stream()
                        .map(
                                report ->
                                        toSiteReportResponse(
                                                report,
                                                entriesByReport.getOrDefault(
                                                        report.getId(),
                                                        List.of())))
                        .toList(),

                entries.stream()
                        .map(
                                entry ->
                                        toProductionEntryResponse(
                                                entry,
                                                requireReport(
                                                        reportMap,
                                                        entry.getSiteReportId()),
                                                requirePackage(
                                                        packageMap,
                                                        entry.getWorkPackageId())))
                        .toList());
    }

    @Transactional(readOnly = true)
    public com.buildsight.platform.production.api.ProductionIntelligenceResponse
    intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        List<ProjectWorkPackage> packages =
                workPackageRepository
                        .findByProjectIdOrderByPlannedStartDateAscCodeAsc(
                                projectId);

        List<ProjectSiteReport> reports =
                siteReportRepository
                        .findByProjectIdOrderByReportDateDescCreatedAtDesc(
                                projectId);

        List<UUID> reportIds =
                reports.stream()
                        .map(
                                ProjectSiteReport::getId)
                        .toList();

        List<SiteReportProductionEntry> entries =
                reportIds.isEmpty()
                        ? List.of()
                        : entryRepository
                                .findBySiteReportIdInOrderByCreatedAtAsc(
                                        reportIds);

        return intelligenceService.calculate(
                packages,
                reports,
                entries);
    }

    @Transactional
    public WorkPackageResponse createWorkPackage(
            UUID projectId,
            CreateWorkPackageRequest request) {

        requireProject(
                projectId);

        validatePackageDates(
                request.plannedStartDate(),
                request.plannedEndDate());

        String code =
                request.code()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (workPackageRepository
                .existsByProjectIdAndCodeIgnoreCase(
                        projectId,
                        code)) {

            throw new ConflictException(
                    "Work package code '%s' already exists for this project."
                            .formatted(
                                    code));
        }

        ProjectWorkPackage packageItem =
                ProjectWorkPackage.create(
                        UUID.randomUUID(),
                        projectId,
                        code,
                        request.name()
                                .trim(),
                        normalize(
                                request.description()),
                        request.unit()
                                .trim(),
                        request.plannedQuantity(),
                        request.plannedLaborHours(),
                        request.plannedStartDate(),
                        request.plannedEndDate());

        ProjectWorkPackage saved =
                workPackageRepository.save(
                        packageItem);

        return toWorkPackageResponse(
                saved,
                intelligenceService.metricsFor(
                        saved,
                        List.of(),
                        LocalDate.now(
                                clock)));
    }

    @Transactional
    public WorkPackageResponse updateWorkPackage(
            UUID projectId,
            UUID workPackageId,
            UpdateWorkPackageRequest request) {

        requireProject(
                projectId);

        ProjectWorkPackage packageItem =
                requireWorkPackage(
                        projectId,
                        workPackageId);

        verifyVersion(
                packageItem.getVersion(),
                request.version(),
                "work package");

        validatePackageDates(
                request.plannedStartDate(),
                request.plannedEndDate());

        validateTransition(
                PACKAGE_TRANSITIONS,
                packageItem.getStatus(),
                request.status(),
                "work package");

        String blockReason =
                normalize(
                        request.blockReason());

        if (request.status()
                        == WorkPackageStatus.BLOCKED
                && blockReason == null) {

            throw new InvalidRequestException(
                    "A blocked work package requires a block reason.");
        }

        List<SiteReportProductionEntry> acceptedEntries =
                acceptedEntriesForPackage(
                        projectId,
                        workPackageId);

        BigDecimal acceptedQuantity =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getQuantityCompleted)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        if (request.status()
                        == WorkPackageStatus.COMPLETED
                && acceptedQuantity.compareTo(
                                request.plannedQuantity())
                        < 0) {

            throw new InvalidRequestException(
                    "A work package cannot be completed until accepted production quantity reaches its planned quantity.");
        }

        packageItem.update(
                request.name()
                        .trim(),
                normalize(
                        request.description()),
                request.unit()
                        .trim(),
                request.plannedQuantity(),
                request.plannedLaborHours(),
                request.plannedStartDate(),
                request.plannedEndDate(),
                request.status(),
                blockReason,
                LocalDate.now(
                        clock));

        ProjectWorkPackage saved =
                workPackageRepository
                        .saveAndFlush(
                                packageItem);

        return toWorkPackageResponse(
                saved,
                intelligenceService.metricsFor(
                        saved,
                        acceptedEntries,
                        LocalDate.now(
                                clock)));
    }

    @Transactional
    public SiteReportResponse createSiteReport(
            UUID projectId,
            CreateSiteReportRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.reportDate(),
                "Site report date");

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (siteReportRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Site report reference '%s' already exists for this project."
                            .formatted(
                                    reference));
        }

        ProjectSiteReport report =
                ProjectSiteReport.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.reportDate(),
                        request.weatherCondition(),
                        normalize(
                                request.generalNotes()));

        return toSiteReportResponse(
                siteReportRepository.save(
                        report),
                List.of());
    }

    @Transactional
    public SiteReportResponse updateSiteReport(
            UUID projectId,
            UUID siteReportId,
            UpdateSiteReportRequest request) {

        requireProject(
                projectId);

        ProjectSiteReport report =
                requireSiteReport(
                        projectId,
                        siteReportId);

        verifyVersion(
                report.getVersion(),
                request.version(),
                "site report");

        validateNotFuture(
                request.reportDate(),
                "Site report date");

        validateTransition(
                REPORT_TRANSITIONS,
                report.getStatus(),
                request.status(),
                "site report");

        if (report.getStatus()
                        == SiteReportStatus.DRAFT
                && request.status()
                        == SiteReportStatus.SUBMITTED
                && !entryRepository
                        .existsBySiteReportId(
                                siteReportId)) {

            throw new InvalidRequestException(
                    "A site report must contain at least one production entry before submission.");
        }

        report.update(
                request.reportDate(),
                request.weatherCondition(),
                normalize(
                        request.generalNotes()),
                request.status());

        ProjectSiteReport saved =
                siteReportRepository
                        .saveAndFlush(
                                report);

        return toSiteReportResponse(
                saved,
                entriesForReport(
                        siteReportId));
    }

    @Transactional
    public ProductionEntryResponse createProductionEntry(
            UUID projectId,
            UUID siteReportId,
            CreateProductionEntryRequest request) {

        requireProject(
                projectId);

        ProjectSiteReport report =
                requireSiteReport(
                        projectId,
                        siteReportId);

        requireDraft(
                report);

        ProjectWorkPackage packageItem =
                requireWorkPackage(
                        projectId,
                        request.workPackageId());

        if (packageItem.getStatus()
                        != WorkPackageStatus.IN_PROGRESS
                && packageItem.getStatus()
                        != WorkPackageStatus.BLOCKED) {

            throw new InvalidRequestException(
                    "Production may only be recorded against an IN_PROGRESS or BLOCKED work package.");
        }

        if (entryRepository
                .existsBySiteReportIdAndWorkPackageId(
                        siteReportId,
                        packageItem.getId())) {

            throw new ConflictException(
                    "This site report already contains a production entry for work package '%s'."
                            .formatted(
                                    packageItem.getCode()));
        }

        SiteReportProductionEntry entry =
                SiteReportProductionEntry.create(
                        UUID.randomUUID(),
                        siteReportId,
                        packageItem.getId(),
                        request.quantityCompleted(),
                        request.laborHours(),
                        request.equipmentHours(),
                        request.crewSize(),
                        normalize(
                                request.notes()));

        return toProductionEntryResponse(
                entryRepository.save(
                        entry),
                report,
                packageItem);
    }

    @Transactional
    public ProductionEntryResponse updateProductionEntry(
            UUID projectId,
            UUID siteReportId,
            UUID entryId,
            UpdateProductionEntryRequest request) {

        requireProject(
                projectId);

        ProjectSiteReport report =
                requireSiteReport(
                        projectId,
                        siteReportId);

        requireDraft(
                report);

        SiteReportProductionEntry entry =
                entryRepository
                        .findByIdAndSiteReportId(
                                entryId,
                                siteReportId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Production entry '%s' was not found."
                                                        .formatted(
                                                                entryId)));

        verifyVersion(
                entry.getVersion(),
                request.version(),
                "production entry");

        ProjectWorkPackage packageItem =
                requireWorkPackage(
                        projectId,
                        entry.getWorkPackageId());

        entry.update(
                request.quantityCompleted(),
                request.laborHours(),
                request.equipmentHours(),
                request.crewSize(),
                normalize(
                        request.notes()));

        return toProductionEntryResponse(
                entryRepository
                        .saveAndFlush(
                                entry),
                report,
                packageItem);
    }

    private List<SiteReportProductionEntry>
    acceptedEntriesForPackage(
            UUID projectId,
            UUID workPackageId) {

        List<ProjectSiteReport> reports =
                siteReportRepository
                        .findByProjectIdOrderByReportDateDescCreatedAtDesc(
                                projectId);

        List<UUID> reportIds =
                reports.stream()
                        .map(
                                ProjectSiteReport::getId)
                        .toList();

        if (reportIds.isEmpty()) {
            return List.of();
        }

        return intelligenceService
                .acceptedEntries(
                        reports,
                        entryRepository
                                .findBySiteReportIdInOrderByCreatedAtAsc(
                                        reportIds))
                .stream()
                .filter(
                        entry ->
                                entry.getWorkPackageId()
                                        .equals(
                                                workPackageId))
                .toList();
    }

    private List<SiteReportProductionEntry>
    entriesForReport(
            UUID siteReportId) {

        return entryRepository
                .findBySiteReportIdInOrderByCreatedAtAsc(
                        List.of(
                                siteReportId));
    }

    private Project requireProject(
            UUID projectId) {

        return projectRepository
                .findById(
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Project '%s' was not found."
                                                .formatted(
                                                        projectId)));
    }

    private ProjectWorkPackage requireWorkPackage(
            UUID projectId,
            UUID workPackageId) {

        return workPackageRepository
                .findByIdAndProjectId(
                        workPackageId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Work package '%s' was not found for this project."
                                                .formatted(
                                                        workPackageId)));
    }

    private ProjectSiteReport requireSiteReport(
            UUID projectId,
            UUID siteReportId) {

        return siteReportRepository
                .findByIdAndProjectId(
                        siteReportId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Site report '%s' was not found for this project."
                                                .formatted(
                                                        siteReportId)));
    }

    private ProjectWorkPackage requirePackage(
            Map<UUID, ProjectWorkPackage> map,
            UUID id) {

        ProjectWorkPackage result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown work package: "
                            + id);
        }

        return result;
    }

    private ProjectSiteReport requireReport(
            Map<UUID, ProjectSiteReport> map,
            UUID id) {

        ProjectSiteReport result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown site report: "
                            + id);
        }

        return result;
    }

    private void requireDraft(
            ProjectSiteReport report) {

        if (report.getStatus()
                != SiteReportStatus.DRAFT) {

            throw new InvalidRequestException(
                    "Production entries can only be changed while the site report is DRAFT.");
        }
    }

    private void validatePackageDates(
            LocalDate start,
            LocalDate end) {

        if (end.isBefore(
                start)) {

            throw new InvalidRequestException(
                    "Work package end date cannot be before its start date.");
        }
    }

    private void validateNotFuture(
            LocalDate date,
            String field) {

        if (date.isAfter(
                LocalDate.now(
                        clock))) {

            throw new InvalidRequestException(
                    field
                            + " cannot be in the future.");
        }
    }

    private <T extends Enum<T>>
    void validateTransition(
            Map<T, Set<T>> transitions,
            T current,
            T target,
            String resource) {

        if (current == target) {
            return;
        }

        if (!transitions
                .getOrDefault(
                        current,
                        Set.of())
                .contains(
                        target)) {

            throw new InvalidRequestException(
                    "%s status cannot transition from '%s' to '%s'."
                            .formatted(
                                    resource,
                                    current,
                                    target));
        }
    }

    private void verifyVersion(
            long current,
            long requested,
            String resource) {

        if (current != requested) {

            throw new ConflictException(
                    "The %s was changed by another operation. Refresh before submitting your change."
                            .formatted(
                                    resource));
        }
    }

    private String normalize(
            String value) {

        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isBlank()
                ? null
                : trimmed;
    }

    private WorkPackageResponse toWorkPackageResponse(
            ProjectWorkPackage packageItem,
            WorkPackageMetrics metrics) {

        return new WorkPackageResponse(
                packageItem.getId(),
                packageItem.getProjectId(),
                packageItem.getCode(),
                packageItem.getName(),
                packageItem.getDescription(),
                packageItem.getUnit(),
                packageItem.getPlannedQuantity(),
                packageItem.getPlannedLaborHours(),
                packageItem.getPlannedStartDate(),
                packageItem.getPlannedEndDate(),
                packageItem.getActualStartDate(),
                packageItem.getActualEndDate(),
                packageItem.getStatus(),
                packageItem.getBlockReason(),
                metrics.actualQuantity(),
                metrics.completionPercentage(),
                metrics.expectedProgressPercentage(),
                metrics.expectedQuantity(),
                metrics.quantityVariance(),
                metrics.actualLaborHours(),
                metrics.actualEquipmentHours(),
                metrics.plannedProductivityRate(),
                metrics.actualProductivityRate(),
                metrics.productivityIndex(),
                packageItem.getVersion(),
                packageItem.getCreatedAt(),
                packageItem.getUpdatedAt());
    }

    private SiteReportResponse toSiteReportResponse(
            ProjectSiteReport report,
            List<SiteReportProductionEntry> entries) {

        BigDecimal labor =
                entries.stream()
                        .map(
                                SiteReportProductionEntry::getLaborHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal equipment =
                entries.stream()
                        .map(
                                SiteReportProductionEntry::getEquipmentHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        return new SiteReportResponse(
                report.getId(),
                report.getProjectId(),
                report.getReference(),
                report.getReportDate(),
                report.getWeatherCondition(),
                report.getGeneralNotes(),
                report.getStatus(),
                entries.size(),
                labor,
                equipment,
                report.getVersion(),
                report.getCreatedAt(),
                report.getUpdatedAt());
    }

    private ProductionEntryResponse
    toProductionEntryResponse(
            SiteReportProductionEntry entry,
            ProjectSiteReport report,
            ProjectWorkPackage packageItem) {

        return new ProductionEntryResponse(
                entry.getId(),
                report.getId(),
                report.getReference(),
                report.getReportDate(),
                packageItem.getId(),
                packageItem.getCode(),
                packageItem.getName(),
                packageItem.getUnit(),
                entry.getQuantityCompleted(),
                entry.getLaborHours(),
                entry.getEquipmentHours(),
                entry.getCrewSize(),
                entry.getNotes(),
                entry.getVersion(),
                entry.getCreatedAt(),
                entry.getUpdatedAt());
    }

    private static Map<
            WorkPackageStatus,
            Set<WorkPackageStatus>>
    workPackageTransitions() {

        Map<
                WorkPackageStatus,
                Set<WorkPackageStatus>>
                map =
                new EnumMap<>(
                        WorkPackageStatus.class);

        map.put(
                WorkPackageStatus.PLANNED,
                Set.of(
                        WorkPackageStatus.IN_PROGRESS,
                        WorkPackageStatus.BLOCKED,
                        WorkPackageStatus.CANCELLED));

        map.put(
                WorkPackageStatus.IN_PROGRESS,
                Set.of(
                        WorkPackageStatus.BLOCKED,
                        WorkPackageStatus.COMPLETED,
                        WorkPackageStatus.CANCELLED));

        map.put(
                WorkPackageStatus.BLOCKED,
                Set.of(
                        WorkPackageStatus.IN_PROGRESS,
                        WorkPackageStatus.CANCELLED));

        map.put(
                WorkPackageStatus.COMPLETED,
                Set.of());

        map.put(
                WorkPackageStatus.CANCELLED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            SiteReportStatus,
            Set<SiteReportStatus>>
    siteReportTransitions() {

        Map<
                SiteReportStatus,
                Set<SiteReportStatus>>
                map =
                new EnumMap<>(
                        SiteReportStatus.class);

        map.put(
                SiteReportStatus.DRAFT,
                Set.of(
                        SiteReportStatus.SUBMITTED));

        map.put(
                SiteReportStatus.SUBMITTED,
                Set.of(
                        SiteReportStatus.APPROVED));

        map.put(
                SiteReportStatus.APPROVED,
                Set.of());

        return Map.copyOf(
                map);
    }
}
