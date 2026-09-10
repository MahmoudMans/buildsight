package com.buildsight.platform.schedule.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleBaselineActivity;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectScheduleBaselineActivityRepository
        extends JpaRepository<ProjectScheduleBaselineActivity, UUID> {

    List<ProjectScheduleBaselineActivity>
    findByBaselineIdOrderByPlannedStartAscActivityCodeAsc(
            UUID baselineId);

    long countByBaselineId(
            UUID baselineId);
}
