CREATE TABLE project_evm_snapshots (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    data_date DATE NOT NULL,

    bac NUMERIC(19,2) NOT NULL,
    planned_value NUMERIC(19,2) NOT NULL,
    earned_value NUMERIC(19,2) NOT NULL,
    actual_cost NUMERIC(19,2) NOT NULL,

    cost_variance NUMERIC(19,2) NOT NULL,
    schedule_variance NUMERIC(19,2) NOT NULL,

    cpi NUMERIC(12,4) NOT NULL,
    spi NUMERIC(12,4) NOT NULL,

    estimate_at_completion NUMERIC(19,2) NOT NULL,
    estimate_to_complete NUMERIC(19,2) NOT NULL,
    variance_at_completion NUMERIC(19,2) NOT NULL,
    tcpi NUMERIC(12,4) NOT NULL,

    forecast_finish_date DATE NOT NULL,
    schedule_variance_days BIGINT NOT NULL,

    predictive_score NUMERIC(7,2) NOT NULL,
    predictive_risk VARCHAR(32) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_evm_snapshot_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_evm_snapshot_project_date
        UNIQUE (
            project_id,
            data_date
        ),

    CONSTRAINT ck_evm_snapshot_risk
        CHECK (
            predictive_risk IN (
                'ON_TRACK',
                'WATCH',
                'AT_RISK'
            )
        )
);

CREATE INDEX idx_evm_snapshot_project_date
    ON project_evm_snapshots(
        project_id,
        data_date DESC
    );


CREATE TABLE project_forecast_scenarios (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    name VARCHAR(180) NOT NULL,

    scenario_type VARCHAR(32) NOT NULL,

    status VARCHAR(32) NOT NULL,

    cost_adjustment_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    schedule_adjustment_days INTEGER NOT NULL DEFAULT 0,

    productivity_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1,

    procurement_delay_days INTEGER NOT NULL DEFAULT 0,

    commercial_exposure_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    risk_contingency_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    resource_capacity_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1,

    notes TEXT,

    approved_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_forecast_scenario_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_forecast_scenario_name
        UNIQUE (
            project_id,
            name
        ),

    CONSTRAINT ck_forecast_scenario_type
        CHECK (
            scenario_type IN (
                'BASE',
                'OPTIMISTIC',
                'PESSIMISTIC',
                'CUSTOM'
            )
        ),

    CONSTRAINT ck_forecast_scenario_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_forecast_productivity_multiplier
        CHECK (
            productivity_multiplier >= 0.50
            AND productivity_multiplier <= 1.50
        ),

    CONSTRAINT ck_forecast_resource_multiplier
        CHECK (
            resource_capacity_multiplier >= 0.50
            AND resource_capacity_multiplier <= 1.50
        )
);

CREATE INDEX idx_forecast_scenario_project
    ON project_forecast_scenarios(
        project_id
    );

CREATE INDEX idx_forecast_scenario_status
    ON project_forecast_scenarios(
        project_id,
        status
    );
