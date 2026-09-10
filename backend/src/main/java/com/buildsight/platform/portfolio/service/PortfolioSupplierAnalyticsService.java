package com.buildsight.platform.portfolio.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import com.buildsight.platform.portfolio.api.SupplierConcentrationResponse;
import com.buildsight.platform.portfolio.api.SupplierConcentrationRisk;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PortfolioSupplierAnalyticsService {

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    public PortfolioSupplierAnalyticsService(
            NamedParameterJdbcTemplate jdbcTemplate) {

        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<SupplierConcentrationResponse> concentration() {

        String sql = """
                SELECT
                    s.id,
                    s.code,
                    s.name,
                    s.supplier_type,
                    COUNT(pp.id) AS awarded_packages,
                    COALESCE(
                        SUM(pp.awarded_value),
                        0
                    ) AS awarded_value
                FROM suppliers s
                JOIN procurement_packages pp
                  ON pp.awarded_supplier_id = s.id
                WHERE pp.status IN (
                    'AWARDED',
                    'CLOSED'
                )
                  AND pp.awarded_value IS NOT NULL
                GROUP BY
                    s.id,
                    s.code,
                    s.name,
                    s.supplier_type
                ORDER BY
                    awarded_value DESC,
                    s.code ASC
                """;

        List<RawSupplier> suppliers =
                jdbcTemplate.query(
                        sql,
                        Map.of(),
                        (
                                resultSet,
                                rowNumber) ->
                                new RawSupplier(
                                        resultSet.getObject(
                                                "id",
                                                java.util.UUID.class),
                                        resultSet.getString(
                                                "code"),
                                        resultSet.getString(
                                                "name"),
                                        resultSet.getString(
                                                "supplier_type"),
                                        resultSet.getLong(
                                                "awarded_packages"),
                                        resultSet.getBigDecimal(
                                                "awarded_value")));

        BigDecimal total =
                suppliers.stream()
                        .map(
                                RawSupplier::awardedValue)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        return suppliers.stream()
                .map(
                        supplier -> {

                            double share =
                                    total.signum() <= 0
                                            ? 0
                                            : supplier
                                                    .awardedValue()
                                                    .multiply(
                                                            new BigDecimal("100"))
                                                    .divide(
                                                            total,
                                                            6,
                                                            RoundingMode.HALF_UP)
                                                    .doubleValue();

                            return new SupplierConcentrationResponse(
                                    supplier.id(),
                                    supplier.code(),
                                    supplier.name(),
                                    supplier.supplierType(),
                                    supplier.awardedPackages(),
                                    supplier.awardedValue()
                                            .setScale(
                                                    2,
                                                    RoundingMode.HALF_UP),
                                    roundOne(
                                            share),
                                    risk(
                                            share));
                        })
                .toList();
    }

    private SupplierConcentrationRisk risk(
            double share) {

        if (share >= 40) {
            return SupplierConcentrationRisk.HIGH;
        }

        if (share >= 25) {
            return SupplierConcentrationRisk.MODERATE;
        }

        return SupplierConcentrationRisk.LOW;
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }

    private record RawSupplier(
            java.util.UUID id,
            String code,
            String name,
            String supplierType,
            long awardedPackages,
            BigDecimal awardedValue) {
    }
}
