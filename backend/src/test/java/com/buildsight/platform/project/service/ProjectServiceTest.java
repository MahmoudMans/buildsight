package com.buildsight.platform.project.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.project.api.CreateProjectRequest;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    private ProjectService projectService;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(
                projectRepository,
                new ProjectMapper());
    }

    @Test
    void createNormalizesProjectCodeAndPersistsProject() {
        CreateProjectRequest request =
                validRequest(" bs-2026-900 ");

        when(projectRepository.existsByCodeIgnoreCase("BS-2026-900"))
                .thenReturn(false);

        when(projectRepository.save(any(Project.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ProjectResponse response = projectService.create(request);

        assertEquals("BS-2026-900", response.code());
        assertEquals("Portfolio Test Project", response.name());
        assertEquals(new BigDecimal("1000000.00"), response.approvedBudget());

        verify(projectRepository)
                .existsByCodeIgnoreCase("BS-2026-900");

        verify(projectRepository)
                .save(any(Project.class));
    }

    @Test
    void createRejectsDuplicateProjectCode() {
        CreateProjectRequest request =
                validRequest("BS-2026-901");

        when(projectRepository.existsByCodeIgnoreCase("BS-2026-901"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> projectService.create(request));

        verify(projectRepository, never())
                .save(any(Project.class));
    }

    @Test
    void createRejectsInvalidPlannedDateRange() {
        CreateProjectRequest request =
                new CreateProjectRequest(
                        "BS-2026-902",
                        "Invalid Date Project",
                        "Test project",
                        "Test Client",
                        "Paris, France",
                        new BigDecimal("1200000.00"),
                        new BigDecimal("1000000.00"),
                        LocalDate.of(2027, 5, 1),
                        LocalDate.of(2027, 4, 1));

        assertThrows(
                InvalidRequestException.class,
                () -> projectService.create(request));

        verify(projectRepository, never())
                .existsByCodeIgnoreCase(any());

        verify(projectRepository, never())
                .save(any(Project.class));
    }

    private CreateProjectRequest validRequest(String code) {
        return new CreateProjectRequest(
                code,
                "Portfolio Test Project",
                "A construction intelligence test project.",
                "Test Client",
                "Paris, France",
                new BigDecimal("1250000.00"),
                new BigDecimal("1000000.00"),
                LocalDate.of(2026, 11, 1),
                LocalDate.of(2027, 8, 31));
    }
}
