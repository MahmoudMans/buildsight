CREATE TABLE projects (
    id UUID PRIMARY KEY,

    code VARCHAR(32) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(2000),

    client_name VARCHAR(160) NOT NULL,
    location VARCHAR(200) NOT NULL,

    contract_value NUMERIC(19, 2) NOT NULL,
    approved_budget NUMERIC(19, 2) NOT NULL,

    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,

    actual_start_date DATE,
    actual_end_date DATE,

    status VARCHAR(32) NOT NULL,

    physical_progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_projects_code
        UNIQUE (code),

    CONSTRAINT ck_projects_contract_value
        CHECK (contract_value >= 0),

    CONSTRAINT ck_projects_approved_budget
        CHECK (approved_budget >= 0),

    CONSTRAINT ck_projects_progress
        CHECK (
            physical_progress_percentage >= 0
            AND physical_progress_percentage <= 100
        ),

    CONSTRAINT ck_projects_planned_dates
        CHECK (planned_end_date >= planned_start_date),

    CONSTRAINT ck_projects_status
        CHECK (
            status IN (
                'PLANNING',
                'ACTIVE',
                'ON_HOLD',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_projects_status
    ON projects(status);

CREATE INDEX idx_projects_planned_end_date
    ON projects(planned_end_date);

CREATE INDEX idx_projects_updated_at
    ON projects(updated_at DESC);
