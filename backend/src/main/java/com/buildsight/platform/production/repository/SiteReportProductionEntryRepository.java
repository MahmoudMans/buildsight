package com.buildsight.platform.production.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.production.domain.SiteReportProductionEntry;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteReportProductionEntryRepository
        extends JpaRepository<SiteReportProductionEntry, UUID> {

    List<SiteReportProductionEntry>
    findBySiteReportIdInOrderByCreatedAtAsc(
            Collection<UUID> siteReportIds);

    Optional<SiteReportProductionEntry>
    findByIdAndSiteReportId(
            UUID id,
            UUID siteReportId);

    boolean existsBySiteReportIdAndWorkPackageId(
            UUID siteReportId,
            UUID workPackageId);

    boolean existsBySiteReportId(
            UUID siteReportId);
}
