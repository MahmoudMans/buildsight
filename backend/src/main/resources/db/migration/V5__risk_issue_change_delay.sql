CREATE TABLE project_risks (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(180) NOT NULL,

    description VARCHAR(1500),

    category VARCHAR(32) NOT NULL,

    owner_name VARCHAR(160),

    probability INTEGER NOT NULL,

    impact INTEGER NOT NULL,

    residual_probability INTEGER NOT NULL,

    residual_impact INTEGER NOT NULL,

    mitigation_plan VARCHAR(2000),

    mitigation_due_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_risks_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_risk_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_risk_probability
        CHECK (
            probability >= 1
            AND probability <= 5
        ),

    CONSTRAINT ck_project_risk_impact
        CHECK (
            impact >= 1
            AND impact <= 5
        ),

    CONSTRAINT ck_project_risk_residual_probability
        CHECK (
            residual_probability >= 1
            AND residual_probability <= 5
        ),

    CONSTRAINT ck_project_risk_residual_impact
        CHECK (
            residual_impact >= 1
            AND residual_impact <= 5
        ),

    CONSTRAINT ck_project_risk_category
        CHECK (
            category IN (
                'COST',
                'SCHEDULE',
                'TECHNICAL',
                'COMMERCIAL',
                'PROCUREMENT',
                'SAFETY',
                'QUALITY',
                'OTHER'
            )
        ),

    CONSTRAINT ck_project_risk_status
        CHECK (
            status IN (
                'OPEN',
                'MITIGATING',
                'ACCEPTED',
                'CLOSED'
            )
        )
);

CREATE INDEX idx_project_risks_project
    ON project_risks(project_id);

CREATE INDEX idx_project_risks_status
    ON project_risks(project_id, status);

CREATE INDEX idx_project_risks_mitigation_due
    ON project_risks(project_id, mitigation_due_date);


CREATE TABLE project_issues (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    source_risk_id UUID,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(180) NOT NULL,

    description VARCHAR(1500),

    severity VARCHAR(32) NOT NULL,

    owner_name VARCHAR(160),

    target_resolution_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_issues_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_project_issues_risk
        FOREIGN KEY (source_risk_id)
        REFERENCES project_risks(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_project_issue_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_issue_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_project_issue_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'RESOLVED',
                'CLOSED'
            )
        )
);

CREATE INDEX idx_project_issues_project
    ON project_issues(project_id);

CREATE INDEX idx_project_issues_status
    ON project_issues(project_id, status);

CREATE INDEX idx_project_issues_resolution
    ON project_issues(
        project_id,
        target_resolution_date
    );


CREATE TABLE project_change_events (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(180) NOT NULL,

    description VARCHAR(1800),

    originator VARCHAR(160),

    requested_date DATE NOT NULL,

    decision_date DATE,

    cost_impact NUMERIC(19, 2) NOT NULL DEFAULT 0,

    schedule_impact_days INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_change_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_change_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_change_status
        CHECK (
            status IN (
                'DRAFT',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'IMPLEMENTED'
            )
        )
);

CREATE INDEX idx_project_changes_project
    ON project_change_events(project_id);

CREATE INDEX idx_project_changes_status
    ON project_change_events(project_id, status);


CREATE TABLE project_delay_events (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(180) NOT NULL,

    description VARCHAR(1800),

    cause VARCHAR(40) NOT NULL,

    owner_name VARCHAR(160),

    start_date DATE NOT NULL,

    end_date DATE,

    forecast_delay_days INTEGER NOT NULL,

    excusable BOOLEAN NOT NULL DEFAULT FALSE,

    compensable BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_delay_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_delay_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_delay_days
        CHECK (
            forecast_delay_days >= 0
        ),

    CONSTRAINT ck_project_delay_dates
        CHECK (
            end_date IS NULL
            OR end_date >= start_date
        ),

    CONSTRAINT ck_project_delay_cause
        CHECK (
            cause IN (
                'CLIENT',
                'DESIGN',
                'PROCUREMENT',
                'SUBCONTRACTOR',
                'WEATHER',
                'SITE_CONDITION',
                'REGULATORY',
                'OTHER'
            )
        ),

    CONSTRAINT ck_project_delay_status
        CHECK (
            status IN (
                'OPEN',
                'MITIGATING',
                'RESOLVED'
            )
        )
);

CREATE INDEX idx_project_delays_project
    ON project_delay_events(project_id);

CREATE INDEX idx_project_delays_status
    ON project_delay_events(project_id, status);
