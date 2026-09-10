package com.buildsight.platform.resource.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.buildsight.platform.resource.api.ResourceModels.ResourceIntelligenceResponse;
import com.buildsight.platform.resource.api.ResourceRiskLevel;
import com.buildsight.platform.resource.domain.EquipmentStatus;
import com.buildsight.platform.resource.domain.ProjectEquipment;
import com.buildsight.platform.resource.domain.ProjectEquipmentUsageLog;
import com.buildsight.platform.resource.domain.ProjectResourceDemandForecast;
import com.buildsight.platform.resource.domain.ProjectWorkforceDeployment;
import com.buildsight.platform.resource.domain.ProjectWorkforcePlan;
import com.buildsight.platform.resource.domain.ResourceDemandType;
import com.buildsight.platform.resource.domain.ResourceForecastStatus;
import com.buildsight.platform.resource.domain.WorkforcePlanStatus;

import org.springframework.stereotype.Service;

@Service
public class ResourceIntelligenceService {

    private final Clock clock;

    public ResourceIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public ResourceIntelligenceResponse calculate(
            List<ProjectWorkforcePlan> plans,
            List<ProjectWorkforceDeployment> deployments,
            List<ProjectEquipment> equipment,
            List<ProjectEquipmentUsageLog> usage,
            List<ProjectResourceDemandForecast> forecasts) {

        if (plans.isEmpty()
                && deployments.isEmpty()
                && equipment.isEmpty()
                && usage.isEmpty()
                && forecasts.isEmpty()) {

            return new ResourceIntelligenceResponse(
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    money(BigDecimal.ZERO),
                    0,
                    0,
                    0,
                    0,
                    75,
                    ResourceRiskLevel.NO_DATA,
                    "No workforce, equipment or resource-demand data exists yet. BuildSight applies a neutral resource score until resource controls are established.");
        }

        LocalDate today =
                LocalDate.now(clock);

        BigDecimal plannedLaborHours =
                plans.stream()
                        .filter(
                                plan ->
                                        plan.getStatus()
                                                != WorkforcePlanStatus.DRAFT)
                        .map(
                                ProjectWorkforcePlan::getPlannedRegularHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal regularHours =
                deployments.stream()
                        .map(
                                ProjectWorkforceDeployment::getRegularHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal overtimeHours =
                deployments.stream()
                        .map(
                                ProjectWorkforceDeployment::getOvertimeHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal actualLaborHours =
                regularHours.add(
                        overtimeHours);

        BigDecimal productiveLaborHours =
                deployments.stream()
                        .map(
                                ProjectWorkforceDeployment::getProductiveHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        double overtimePercentage =
                percentage(
                        overtimeHours,
                        actualLaborHours);

        double laborUtilization =
                percentage(
                        productiveLaborHours,
                        actualLaborHours);

        List<ProjectWorkforceDeployment> productivitySamples =
                deployments.stream()
                        .filter(
                                deployment ->
                                        deployment.getPlannedProductivityRate()
                                                != null)
                        .filter(
                                deployment ->
                                        deployment.getPlannedProductivityRate()
                                                .signum() > 0)
                        .filter(
                                deployment ->
                                        deployment.getProductiveHours()
                                                .signum() > 0)
                        .toList();

        double averageProductivityIndex =
                productivitySamples.stream()
                        .mapToDouble(
                                deployment ->
                                        deployment.productivityIndex()
                                                .doubleValue())
                        .average()
                        .orElse(1.0);

        Map<UUID, ProductivityAggregate> packageProductivity =
                new HashMap<>();

        for (ProjectWorkforceDeployment deployment :
                productivitySamples) {

            if (deployment.getWorkPackageId() == null) {
                continue;
            }

            packageProductivity
                    .computeIfAbsent(
                            deployment.getWorkPackageId(),
                            ignored ->
                                    new ProductivityAggregate())
                    .add(
                            deployment.productivityIndex()
                                    .doubleValue());
        }

        long lowProductivityWorkPackages =
                packageProductivity.values()
                        .stream()
                        .filter(
                                aggregate ->
                                        aggregate.average()
                                                < 0.85)
                        .count();

        BigDecimal equipmentAvailableHours =
                usage.stream()
                        .map(
                                ProjectEquipmentUsageLog::getAvailableHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal equipmentOperatingHours =
                usage.stream()
                        .map(
                                ProjectEquipmentUsageLog::getOperatingHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal equipmentDowntimeHours =
                usage.stream()
                        .map(
                                ProjectEquipmentUsageLog::getDowntimeHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        double equipmentUtilization =
                percentage(
                        equipmentOperatingHours,
                        equipmentAvailableHours);

        Set<UUID> idleEquipmentIds =
                new HashSet<>();

        equipment.stream()
                .filter(
                        item ->
                                item.getStatus()
                                        == EquipmentStatus.IDLE)
                .map(
                        ProjectEquipment::getId)
                .forEach(
                        idleEquipmentIds::add);

        Map<UUID, EquipmentAggregate> recentUsage =
                new HashMap<>();

        for (ProjectEquipmentUsageLog log :
                usage) {

            if (log.getWorkDate()
                    .isBefore(
                            today.minusDays(30))) {
                continue;
            }

            recentUsage
                    .computeIfAbsent(
                            log.getEquipmentId(),
                            ignored ->
                                    new EquipmentAggregate())
                    .add(
                            log.getAvailableHours(),
                            log.getOperatingHours());
        }

        recentUsage.forEach(
                (
                        equipmentId,
                        aggregate) -> {

                    if (aggregate.available()
                                    .signum() > 0
                            && aggregate.utilization()
                                    < 25) {

                        idleEquipmentIds.add(
                                equipmentId);
                    }
                });

        List<ProjectResourceDemandForecast> openFutureForecasts =
                forecasts.stream()
                        .filter(
                                forecast ->
                                        forecast.getStatus()
                                                == ResourceForecastStatus.OPEN)
                        .filter(
                                forecast ->
                                        !forecast.getPeriodEnd()
                                                .isBefore(today))
                        .toList();

        double workerDemandGap =
                openFutureForecasts.stream()
                        .filter(
                                forecast ->
                                        forecast.getResourceType()
                                                == ResourceDemandType.LABOR)
                        .map(
                                ProjectResourceDemandForecast::shortage)
                        .mapToDouble(
                                BigDecimal::doubleValue)
                        .sum();

        double equipmentDemandGap =
                openFutureForecasts.stream()
                        .filter(
                                forecast ->
                                        forecast.getResourceType()
                                                == ResourceDemandType.EQUIPMENT)
                        .map(
                                ProjectResourceDemandForecast::shortage)
                        .mapToDouble(
                                BigDecimal::doubleValue)
                        .sum();

        double score =
                100;

        if (actualLaborHours.signum() > 0
                && laborUtilization < 75) {

            score -=
                    Math.min(
                            25,
                            (75 - laborUtilization)
                                    * 0.8);
        }

        if (overtimePercentage > 15) {

            score -=
                    Math.min(
                            15,
                            (overtimePercentage - 15)
                                    * 0.75);
        }

        if (!productivitySamples.isEmpty()
                && averageProductivityIndex < 0.85) {

            score -=
                    Math.min(
                            25,
                            (0.85 - averageProductivityIndex)
                                    * 100);
        }

        if (equipmentAvailableHours.signum() > 0
                && equipmentUtilization < 55) {

            score -=
                    Math.min(
                            20,
                            (55 - equipmentUtilization)
                                    * 0.5);
        }

        score -=
                Math.min(
                        16,
                        idleEquipmentIds.size()
                                * 4.0);

        score -=
                Math.min(
                        18,
                        workerDemandGap
                                * 1.5);

        score -=
                Math.min(
                        16,
                        equipmentDemandGap
                                * 4.0);

        score =
                clamp(
                        score,
                        0,
                        100);

        ResourceRiskLevel risk =
                score >= 80
                        ? ResourceRiskLevel.ON_TRACK
                        : score >= 60
                                ? ResourceRiskLevel.WATCH
                                : ResourceRiskLevel.AT_RISK;

        return new ResourceIntelligenceResponse(
                plans.size(),
                deployments.size(),
                money(plannedLaborHours),
                money(actualLaborHours),
                money(productiveLaborHours),
                money(overtimeHours),
                roundOne(overtimePercentage),
                roundOne(laborUtilization),
                roundTwo(averageProductivityIndex),
                lowProductivityWorkPackages,
                equipment.size(),
                idleEquipmentIds.size(),
                money(equipmentAvailableHours),
                money(equipmentOperatingHours),
                money(equipmentDowntimeHours),
                roundOne(equipmentUtilization),
                openFutureForecasts.size(),
                roundOne(workerDemandGap),
                roundOne(equipmentDemandGap),
                roundOne(score),
                risk,
                "Resource Intelligence combines labor utilization, overtime pressure, work-package productivity, equipment utilization, idle-resource exposure and forward labor/equipment shortages. High staffing levels are not penalized by themselves; BuildSight penalizes ineffective utilization and unresolved demand gaps.");
    }

    private double percentage(
            BigDecimal numerator,
            BigDecimal denominator) {

        if (denominator.signum() <= 0) {
            return 0;
        }

        return numerator
                .multiply(
                        BigDecimal.valueOf(100))
                .divide(
                        denominator,
                        6,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private double clamp(
            double value,
            double minimum,
            double maximum) {

        return Math.max(
                minimum,
                Math.min(
                        maximum,
                        value));
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100.0)
                / 100.0;
    }

    private static final class ProductivityAggregate {

        private double total;
        private int count;

        void add(
                double value) {

            total += value;
            count++;
        }

        double average() {

            return count == 0
                    ? 1
                    : total / count;
        }
    }

    private static final class EquipmentAggregate {

        private BigDecimal available =
                BigDecimal.ZERO;

        private BigDecimal operating =
                BigDecimal.ZERO;

        void add(
                BigDecimal availableHours,
                BigDecimal operatingHours) {

            available =
                    available.add(
                            availableHours);

            operating =
                    operating.add(
                            operatingHours);
        }

        BigDecimal available() {
            return available;
        }

        double utilization() {

            if (available.signum() <= 0) {
                return 0;
            }

            return operating
                    .multiply(
                            BigDecimal.valueOf(100))
                    .divide(
                            available,
                            6,
                            RoundingMode.HALF_UP)
                    .doubleValue();
        }
    }
}
