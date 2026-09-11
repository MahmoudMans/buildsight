package com.buildsight.platform.recovery.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.recovery.domain.ProjectRecoveryOption;
import com.buildsight.platform.recovery.domain.RecoveryOptionStatus;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRecoveryOptionRepository
        extends JpaRepository<ProjectRecoveryOption, UUID> {

    List<ProjectRecoveryOption>
    findBySimulationIdOrderByCreatedAtAscOptionNumberAsc(
            UUID simulationId);

    Optional<ProjectRecoveryOption>
    findByIdAndSimulationId(
            UUID id,
            UUID simulationId);

    Optional<ProjectRecoveryOption>
    findFirstBySimulationIdAndStatus(
            UUID simulationId,
            RecoveryOptionStatus status);

    boolean existsBySimulationIdAndOptionNumberIgnoreCase(
            UUID simulationId,
            String optionNumber);
}
