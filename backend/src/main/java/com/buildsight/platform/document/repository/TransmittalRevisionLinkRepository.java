package com.buildsight.platform.document.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.document.domain.TransmittalRevisionLink;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TransmittalRevisionLinkRepository
        extends JpaRepository<TransmittalRevisionLink, UUID> {

    List<TransmittalRevisionLink>
    findByTransmittalIdIn(
            Collection<UUID> transmittalIds);
}
