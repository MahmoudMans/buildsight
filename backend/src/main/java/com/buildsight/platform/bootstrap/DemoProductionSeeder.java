package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.production.domain.ProjectSiteReport;
import com.buildsight.platform.production.domain.ProjectWorkPackage;
import com.buildsight.platform.production.domain.SiteReportProductionEntry;
import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WeatherCondition;
import com.buildsight.platform.production.domain.WorkPackageStatus;
import com.buildsight.platform.production.repository.ProjectSiteReportRepository;
import com.buildsight.platform.production.repository.ProjectWorkPackageRepository;
import com.buildsight.platform.production.repository.SiteReportProductionEntryRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(50)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoProductionSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectWorkPackageRepository
            workPackageRepository;

    private final ProjectSiteReportRepository
            siteReportRepository;

    private final SiteReportProductionEntryRepository
            entryRepository;

    public DemoProductionSeeder(
            ProjectRepository projectRepository,
            ProjectWorkPackageRepository workPackageRepository,
            ProjectSiteReportRepository siteReportRepository,
            SiteReportProductionEntryRepository entryRepository) {

        this.projectRepository =
                projectRepository;

        this.workPackageRepository =
                workPackageRepository;

        this.siteReportRepository =
                siteReportRepository;

        this.entryRepository =
                entryRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seedProject(
                    project);
        }
    }

    private void seedProject(
            Project project) {

        if (workPackageRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        List<ProjectWorkPackage> packages =
                createPackages(
                        project);

        workPackageRepository.saveAll(
                packages);

        if (project.getStatus()
                        == ProjectStatus.PLANNING
                || project
                        .getPhysicalProgressPercentage()
                        .signum()
                        <= 0) {

            System.out.println(
                    "[BuildSight] Production baseline created for "
                            + project.getCode());

            return;
        }

        createReportsAndEntries(
                project,
                packages);

        System.out.println(
                "[BuildSight] Production demo data created for "
                        + project.getCode());
    }

    private List<ProjectWorkPackage> createPackages(
            Project project) {

        LocalDate start =
                project.getPlannedStartDate();

        LocalDate end =
                project.getPlannedEndDate();

        LocalDate p1Start =
                start;

        LocalDate p1End =
                dateAt(
                        start,
                        end,
                        0.45);

        LocalDate p2Start =
                dateAt(
                        start,
                        end,
                        0.25);

        LocalDate p2End =
                dateAt(
                        start,
                        end,
                        0.75);

        LocalDate p3Start =
                dateAt(
                        start,
                        end,
                        0.45);

        LocalDate p3End =
                end;

        ProjectWorkPackage structure =
                ProjectWorkPackage.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "WP-STRUCT",
                        "Structural & Builder Works",
                        "Primary structural and builders-work production package.",
                        "m2",
                        new BigDecimal(
                                "1200.000"),
                        new BigDecimal(
                                "4200.00"),
                        p1Start,
                        p1End);

        ProjectWorkPackage mep =
                ProjectWorkPackage.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "WP-MEP",
                        "MEP Installation",
                        "Mechanical, electrical and plumbing installation production package.",
                        "points",
                        new BigDecimal(
                                "900.000"),
                        new BigDecimal(
                                "3600.00"),
                        p2Start,
                        p2End);

        ProjectWorkPackage finishes =
                ProjectWorkPackage.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "WP-FINISH",
                        "Architectural Finishes",
                        "Internal finishes and fit-out production package.",
                        "m2",
                        new BigDecimal(
                                "2400.000"),
                        new BigDecimal(
                                "5600.00"),
                        p3Start,
                        p3End);

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        LocalDate effective =
                project.getActualStartDate()
                                == null
                        ? LocalDate.now()
                                .minusDays(60)
                        : project.getActualStartDate();

        structure.update(
                structure.getName(),
                structure.getDescription(),
                structure.getUnit(),
                structure.getPlannedQuantity(),
                structure.getPlannedLaborHours(),
                structure.getPlannedStartDate(),
                structure.getPlannedEndDate(),
                WorkPackageStatus.IN_PROGRESS,
                null,
                effective);

        mep.update(
                mep.getName(),
                mep.getDescription(),
                mep.getUnit(),
                mep.getPlannedQuantity(),
                mep.getPlannedLaborHours(),
                mep.getPlannedStartDate(),
                mep.getPlannedEndDate(),
                stressed
                        ? WorkPackageStatus.BLOCKED
                        : WorkPackageStatus.IN_PROGRESS,
                stressed
                        ? "Design information and access constraints are preventing full production."
                        : null,
                effective);

        finishes.update(
                finishes.getName(),
                finishes.getDescription(),
                finishes.getUnit(),
                finishes.getPlannedQuantity(),
                finishes.getPlannedLaborHours(),
                finishes.getPlannedStartDate(),
                finishes.getPlannedEndDate(),
                WorkPackageStatus.IN_PROGRESS,
                null,
                effective);

        return List.of(
                structure,
                mep,
                finishes);
    }

    private void createReportsAndEntries(
            Project project,
            List<ProjectWorkPackage> packages) {

        LocalDate today =
                LocalDate.now();

        int[] dayOffsets =
                {
                        12,
                        8,
                        4,
                        1
                };

        BigDecimal[] healthySplits =
                {
                        new BigDecimal("0.18"),
                        new BigDecimal("0.22"),
                        new BigDecimal("0.25"),
                        new BigDecimal("0.35")
                };

        BigDecimal[] stressedSplits =
                {
                        new BigDecimal("0.30"),
                        new BigDecimal("0.30"),
                        new BigDecimal("0.20"),
                        new BigDecimal("0.20")
                };

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        BigDecimal[] splits =
                stressed
                        ? stressedSplits
                        : healthySplits;

        BigDecimal completionRatio =
                project
                        .getPhysicalProgressPercentage()
                        .divide(
                                new BigDecimal("100"),
                                6,
                                RoundingMode.HALF_UP);

        BigDecimal efficiencyFactor =
                stressed
                        ? new BigDecimal("1.35")
                        : new BigDecimal("0.98");

        for (int index = 0;
                index < dayOffsets.length;
                index++) {

            LocalDate reportDate =
                    today.minusDays(
                            dayOffsets[index]);

            ProjectSiteReport report =
                    ProjectSiteReport.create(
                            UUID.randomUUID(),
                            project.getId(),
                            siteReportReference(
                                    project,
                                    index + 1),
                            reportDate,
                            index == 2
                                    ? WeatherCondition.CLOUDY
                                    : WeatherCondition.CLEAR,
                            stressed && index >= 2
                                    ? "Production affected by an unresolved work-front constraint."
                                    : "Daily site production recorded and reviewed.");

            siteReportRepository.save(
                    report);

            for (ProjectWorkPackage packageItem :
                    packages) {

                BigDecimal totalProduced =
                        packageItem
                                .getPlannedQuantity()
                                .multiply(
                                        completionRatio);

                BigDecimal dailyQuantity =
                        totalProduced
                                .multiply(
                                        splits[index])
                                .setScale(
                                        3,
                                        RoundingMode.HALF_UP);

                BigDecimal plannedHoursForQuantity =
                        packageItem
                                .getPlannedLaborHours()
                                .multiply(
                                        dailyQuantity)
                                .divide(
                                        packageItem.getPlannedQuantity(),
                                        2,
                                        RoundingMode.HALF_UP);

                BigDecimal labor =
                        plannedHoursForQuantity
                                .multiply(
                                        efficiencyFactor)
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP);

                BigDecimal equipment =
                        labor
                                .multiply(
                                        new BigDecimal("0.18"))
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP);

                entryRepository.save(
                        SiteReportProductionEntry.create(
                                UUID.randomUUID(),
                                report.getId(),
                                packageItem.getId(),
                                dailyQuantity,
                                labor,
                                equipment,
                                stressed
                                        ? 8
                                        : 12,
                                "Recorded production for "
                                        + packageItem.getCode()
                                        + "."));
            }

            report.update(
                    report.getReportDate(),
                    report.getWeatherCondition(),
                    report.getGeneralNotes(),
                    SiteReportStatus.SUBMITTED);

            siteReportRepository.save(
                    report);

            report.update(
                    report.getReportDate(),
                    report.getWeatherCondition(),
                    report.getGeneralNotes(),
                    SiteReportStatus.APPROVED);

            siteReportRepository.save(
                    report);
        }
    }

    private LocalDate dateAt(
            LocalDate start,
            LocalDate end,
            double fraction) {

        long days =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                start,
                                end));

        return start.plusDays(
                Math.round(
                        days
                                * fraction));
    }

    private String siteReportReference(
            Project project,
            int number) {

        return "SR-"
                + project.getCode()
                        .replace(
                                "BS-",
                                "")
                + "-"
                + String.format(
                        "%02d",
                        number);
    }
}
