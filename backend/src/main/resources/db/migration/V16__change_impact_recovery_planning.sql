CREATE TABLE project_change_impact_simulations (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    simulation_number VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    source_change_reference VARCHAR(120) NOT NULL,

    description TEXT,

    status VARCHAR(32) NOT NULL,

    direct_cost_impact NUMERIC(19,2) NOT NULL DEFAULT 0,

    delay_days INTEGER NOT NULL DEFAULT 0,

    productivity_change_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    procurement_delay_days INTEGER NOT NULL DEFAULT 0,

    resource_capacity_change_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    risk_contingency_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    notes TEXT,

    approved_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_change_impact_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_change_impact_number
        UNIQUE (
            project_id,
            simulation_number
        ),

    CONSTRAINT ck_change_impact_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_change_delay_days
        CHECK (
            delay_days >= 0
            AND delay_days <= 730
        ),

    CONSTRAINT ck_change_productivity
        CHECK (
            productivity_change_percentage >= -50
            AND productivity_change_percentage <= 50
        ),

    CONSTRAINT ck_change_procurement_delay
        CHECK (
            procurement_delay_days >= 0
            AND procurement_delay_days <= 730
        ),

    CONSTRAINT ck_change_resource_capacity
        CHECK (
            resource_capacity_change_percentage >= -50
            AND resource_capacity_change_percentage <= 50
        ),

    CONSTRAINT ck_change_risk_contingency
        CHECK (
            risk_contingency_percentage >= 0
            AND risk_contingency_percentage <= 50
        )
);

CREATE INDEX idx_change_impact_project
    ON project_change_impact_simulations(
        project_id,
        updated_at DESC
    );

CREATE INDEX idx_change_impact_status
    ON project_change_impact_simulations(
        project_id,
        status
    );


CREATE TABLE project_recovery_options (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    simulation_id UUID NOT NULL,

    option_number VARCHAR(64) NOT NULL,

    name VARCHAR(220) NOT NULL,

    strategy_type VARCHAR(40) NOT NULL,

    status VARCHAR(32) NOT NULL,

    schedule_recovery_days INTEGER NOT NULL DEFAULT 0,

    incremental_cost NUMERIC(19,2) NOT NULL DEFAULT 0,

    productivity_improvement_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    procurement_recovery_days INTEGER NOT NULL DEFAULT 0,

    resource_capacity_improvement_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    residual_risk_percentage NUMERIC(8,3) NOT NULL DEFAULT 0,

    notes TEXT,

    selected_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_recovery_option_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_recovery_option_simulation
        FOREIGN KEY (simulation_id)
        REFERENCES project_change_impact_simulations(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_recovery_option_number
        UNIQUE (
            simulation_id,
            option_number
        ),

    CONSTRAINT ck_recovery_strategy_type
        CHECK (
            strategy_type IN (
                'ACCELERATION',
                'RESEQUENCING',
                'OVERTIME',
                'ADDITIONAL_RESOURCES',
                'ALTERNATE_SUPPLIER',
                'SCOPE_OPTIMIZATION',
                'COMBINED'
            )
        ),

    CONSTRAINT ck_recovery_option_status
        CHECK (
            status IN (
                'DRAFT',
                'SELECTED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_recovery_schedule_days
        CHECK (
            schedule_recovery_days >= 0
            AND schedule_recovery_days <= 730
        ),

    CONSTRAINT ck_recovery_incremental_cost
        CHECK (
            incremental_cost >= 0
        ),

    CONSTRAINT ck_recovery_productivity
        CHECK (
            productivity_improvement_percentage >= 0
            AND productivity_improvement_percentage <= 50
        ),

    CONSTRAINT ck_recovery_procurement_days
        CHECK (
            procurement_recovery_days >= 0
            AND procurement_recovery_days <= 730
        ),

    CONSTRAINT ck_recovery_resource_capacity
        CHECK (
            resource_capacity_improvement_percentage >= 0
            AND resource_capacity_improvement_percentage <= 50
        ),

    CONSTRAINT ck_recovery_residual_risk
        CHECK (
            residual_risk_percentage >= 0
            AND residual_risk_percentage <= 100
        )
);

CREATE INDEX idx_recovery_option_simulation
    ON project_recovery_options(
        simulation_id,
        created_at
    );

CREATE INDEX idx_recovery_option_status
    ON project_recovery_options(
        simulation_id,
        status
    );


CREATE TABLE project_recovery_plan_snapshots (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    simulation_id UUID NOT NULL,

    recovery_option_id UUID NOT NULL,

    selected_at TIMESTAMPTZ NOT NULL,

    baseline_forecast_cost NUMERIC(19,2) NOT NULL,

    impacted_forecast_cost NUMERIC(19,2) NOT NULL,

    recovered_forecast_cost NUMERIC(19,2) NOT NULL,

    baseline_forecast_finish_date DATE NOT NULL,

    impacted_forecast_finish_date DATE NOT NULL,

    recovered_forecast_finish_date DATE NOT NULL,

    change_cost_exposure NUMERIC(19,2) NOT NULL,

    recovery_cost NUMERIC(19,2) NOT NULL,

    impact_delay_days BIGINT NOT NULL,

    recovered_days BIGINT NOT NULL,

    residual_delay_days BIGINT NOT NULL,

    cost_per_day_recovered NUMERIC(19,2) NOT NULL,

    recovery_score NUMERIC(7,2) NOT NULL,

    recovery_risk VARCHAR(32) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_recovery_snapshot_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_recovery_snapshot_simulation
        FOREIGN KEY (simulation_id)
        REFERENCES project_change_impact_simulations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_recovery_snapshot_option
        FOREIGN KEY (recovery_option_id)
        REFERENCES project_recovery_options(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_recovery_snapshot_simulation
        UNIQUE (simulation_id),

    CONSTRAINT ck_recovery_snapshot_risk
        CHECK (
            recovery_risk IN (
                'ON_TRACK',
                'WATCH',
                'AT_RISK'
            )
        )
);

CREATE INDEX idx_recovery_snapshot_project
    ON project_recovery_plan_snapshots(
        project_id,
        selected_at DESC
    );
