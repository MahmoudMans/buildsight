package com.buildsight.platform.governance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectGovernanceMeetingRepository
        extends JpaRepository<ProjectGovernanceMeeting, UUID> {

    List<ProjectGovernanceMeeting>
    findByProjectIdOrderByScheduledAtDescMeetingNumberAsc(
            UUID projectId);

    Optional<ProjectGovernanceMeeting>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndMeetingNumberIgnoreCase(
            UUID projectId,
            String meetingNumber);

    boolean existsByProjectId(
            UUID projectId);
}
