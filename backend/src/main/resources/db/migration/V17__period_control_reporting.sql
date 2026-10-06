CREATE TABLE project_control_baseline_versions (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    version_code VARCHAR(64) NOT NULL,
    title VARCHAR(220) NOT NULL,

    reason TEXT,
    change_reference VARCHAR(120),

    status VARCHAR(32) NOT NULL,

    source_data_date DATE NOT NULL,

    budget_at_completion NUMERIC(19,2) NOT NULL,

    cost_target NUMERIC(19,2) NOT NULL,

    finish_target DATE NOT NULL,

    captured_predictive_score NUMERIC(7,2) NOT NULL,

    approved_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_control_baseline_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_control_baseline_version
        UNIQUE (
            project_id,
            version_code
        ),

    CONSTRAINT ck_control_baseline_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'SUPERSEDED'
            )
        ),

    CONSTRAINT ck_control_baseline_bac
        CHECK (
            budget_at_completion >= 0
        ),

    CONSTRAINT ck_control_baseline_cost_target
        CHECK (
            cost_target >= 0
        ),

    CONSTRAINT ck_control_baseline_predictive_score
        CHECK (
            captured_predictive_score >= 0
            AND captured_predictive_score <= 100
        )
);

CREATE INDEX idx_control_baseline_project
    ON project_control_baseline_versions(
        project_id,
        created_at DESC
    );

CREATE INDEX idx_control_baseline_status
    ON project_control_baseline_versions(
        project_id,
        status
    );


CREATE TABLE project_progress_periods (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    baseline_version_id UUID NOT NULL,

    period_code VARCHAR(64) NOT NULL,
    title VARCHAR(220) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    closed_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_progress_period_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_progress_period_baseline
        FOREIGN KEY (baseline_version_id)
        REFERENCES project_control_baseline_versions(id),

    CONSTRAINT uk_progress_period_code
        UNIQUE (
            project_id,
            period_code
        ),

    CONSTRAINT ck_progress_period_status
        CHECK (
            status IN (
                'OPEN',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_progress_period_dates
        CHECK (
            end_date >= start_date
        )
);

CREATE INDEX idx_progress_period_project
    ON project_progress_periods(
        project_id,
        end_date DESC
    );

CREATE INDEX idx_progress_period_status
    ON project_progress_periods(
        project_id,
        status
    );


CREATE TABLE project_period_end_snapshots (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,
    period_id UUID NOT NULL,
    baseline_version_id UUID NOT NULL,

    period_code VARCHAR(64) NOT NULL,

    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    source_data_date DATE NOT NULL,

    baseline_cost_target NUMERIC(19,2) NOT NULL,
    baseline_finish_target DATE NOT NULL,

    budget_at_completion NUMERIC(19,2) NOT NULL,
    planned_value NUMERIC(19,2) NOT NULL,
    earned_value NUMERIC(19,2) NOT NULL,
    actual_cost NUMERIC(19,2) NOT NULL,

    expected_forecast_cost NUMERIC(19,2) NOT NULL,
    expected_forecast_finish_date DATE NOT NULL,

    planned_progress_percentage NUMERIC(7,2) NOT NULL,
    earned_progress_percentage NUMERIC(7,2) NOT NULL,

    cost_performance_index NUMERIC(12,4) NOT NULL,
    schedule_performance_index NUMERIC(12,4) NOT NULL,

    cost_variance_to_baseline NUMERIC(19,2) NOT NULL,
    finish_variance_days BIGINT NOT NULL,

    predictive_score NUMERIC(7,2) NOT NULL,
    predictive_risk VARCHAR(32) NOT NULL,

    governance_score NUMERIC(7,2) NOT NULL,
    governance_risk VARCHAR(32) NOT NULL,

    recovery_score NUMERIC(7,2) NOT NULL,
    recovery_risk VARCHAR(32) NOT NULL,

    change_cost_exposure NUMERIC(19,2) NOT NULL,
    recovery_residual_delay_days BIGINT NOT NULL,

    open_actions BIGINT NOT NULL,
    overdue_actions BIGINT NOT NULL,
    critical_open_actions BIGINT NOT NULL,
    blocked_actions BIGINT NOT NULL,

    period_control_score NUMERIC(7,2) NOT NULL,
    period_control_risk VARCHAR(32) NOT NULL,

    closed_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_period_snapshot_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_period_snapshot_period
        FOREIGN KEY (period_id)
        REFERENCES project_progress_periods(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_period_snapshot_baseline
        FOREIGN KEY (baseline_version_id)
        REFERENCES project_control_baseline_versions(id),

    CONSTRAINT uk_period_end_snapshot
        UNIQUE (period_id),

    CONSTRAINT ck_period_snapshot_control_score
        CHECK (
            period_control_score >= 0
            AND period_control_score <= 100
        ),

    CONSTRAINT ck_period_snapshot_risk
        CHECK (
            period_control_risk IN (
                'ON_TRACK',
                'WATCH',
                'AT_RISK'
            )
        )
);

CREATE INDEX idx_period_snapshot_project
    ON project_period_end_snapshots(
        project_id,
        closed_at DESC
    );
