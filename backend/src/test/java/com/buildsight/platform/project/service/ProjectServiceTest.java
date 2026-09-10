package com.buildsight.platform.project.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.project.api.ChangeProjectStatusRequest;
import com.buildsight.platform.project.api.CreateProjectRequest;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.api.RecordProgressRequest;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectProgressUpdate;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectProgressUpdateRepository;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectProgressUpdateRepository
            progressUpdateRepository;

    private ProjectService projectService;

    @BeforeEach
    void setUp() {
        projectService =
                new ProjectService(
                        projectRepository,
                        new ProjectMapper(),
                        progressUpdateRepository,
                        CLOCK);
    }

    @Test
    void createNormalizesProjectCodeAndPersistsProject() {
        CreateProjectRequest request =
                validRequest(
                        " bs-2026-900 ");

        when(projectRepository
                .existsByCodeIgnoreCase(
                        "BS-2026-900"))
                .thenReturn(false);

        when(projectRepository
                .save(any(Project.class)))
                .thenAnswer(invocation ->
                        invocation.getArgument(0));

        ProjectResponse response =
                projectService.create(request);

        assertEquals(
                "BS-2026-900",
                response.code());

        assertEquals(
                "Portfolio Test Project",
                response.name());

        assertEquals(
                request.plannedEndDate(),
                response.forecastEndDate());

        verify(projectRepository)
                .save(any(Project.class));
    }

    @Test
    void createRejectsDuplicateProjectCode() {
        CreateProjectRequest request =
                validRequest(
                        "BS-2026-901");

        when(projectRepository
                .existsByCodeIgnoreCase(
                        "BS-2026-901"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () ->
                        projectService.create(
                                request));

        verify(
                projectRepository,
                never())
                .save(any(Project.class));
    }

    @Test
    void changeStatusRejectsInvalidTransition() {
        UUID id =
                UUID.randomUUID();

        Project project =
                project(
                        id,
                        ProjectStatus.PLANNING,
                        "0.00");

        when(projectRepository.findById(id))
                .thenReturn(
                        Optional.of(project));

        assertThrows(
                InvalidRequestException.class,
                () ->
                        projectService.changeStatus(
                                id,
                                new ChangeProjectStatusRequest(
                                        0,
                                        ProjectStatus.COMPLETED)));

        verify(
                projectRepository,
                never())
                .saveAndFlush(
                        any(Project.class));
    }

    @Test
    void recordProgressPersistsHistory() {
        UUID id =
                UUID.randomUUID();

        Project project =
                project(
                        id,
                        ProjectStatus.ACTIVE,
                        "35.00");

        when(projectRepository.findById(id))
                .thenReturn(
                        Optional.of(project));

        when(projectRepository
                .saveAndFlush(
                        any(Project.class)))
                .thenAnswer(invocation ->
                        invocation.getArgument(0));

        when(progressUpdateRepository
                .save(
                        any(ProjectProgressUpdate.class)))
                .thenAnswer(invocation ->
                        invocation.getArgument(0));

        ProjectResponse response =
                projectService.recordProgress(
                        id,
                        new RecordProgressRequest(
                                0,
                                new BigDecimal("47.50"),
                                LocalDate.of(
                                        2026,
                                        9,
                                        9),
                                "Weekly site update."));

        assertEquals(
                new BigDecimal("47.50"),
                response.physicalProgressPercentage());

        verify(progressUpdateRepository)
                .save(
                        any(ProjectProgressUpdate.class));

        verify(projectRepository)
                .saveAndFlush(
                        project);
    }

    @Test
    void recordProgressRejectsRegression() {
        UUID id =
                UUID.randomUUID();

        Project project =
                project(
                        id,
                        ProjectStatus.ACTIVE,
                        "50.00");

        when(projectRepository.findById(id))
                .thenReturn(
                        Optional.of(project));

        assertThrows(
                InvalidRequestException.class,
                () ->
                        projectService.recordProgress(
                                id,
                                new RecordProgressRequest(
                                        0,
                                        new BigDecimal("45.00"),
                                        LocalDate.of(
                                                2026,
                                                9,
                                                9),
                                        "Invalid regression.")));

        verify(
                progressUpdateRepository,
                never())
                .save(
                        any(ProjectProgressUpdate.class));
    }

    private CreateProjectRequest validRequest(
            String code) {

        return new CreateProjectRequest(
                code,
                "Portfolio Test Project",
                "A construction intelligence test project.",
                "Test Client",
                "Paris, France",
                new BigDecimal("1250000.00"),
                new BigDecimal("1000000.00"),
                LocalDate.of(
                        2026,
                        11,
                        1),
                LocalDate.of(
                        2027,
                        8,
                        31));
    }

    private Project project(
            UUID id,
            ProjectStatus status,
            String progress) {

        return Project.create(
                id,
                "BS-TEST-001",
                "Test Project",
                "Testing",
                "Client",
                "Paris",
                new BigDecimal("1200000.00"),
                new BigDecimal("1000000.00"),
                LocalDate.of(
                        2026,
                        1,
                        1),
                LocalDate.of(
                        2026,
                        12,
                        31),
                status,
                new BigDecimal(progress));
    }
}
