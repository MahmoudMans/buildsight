CREATE TABLE project_commercial_change_orders (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    source_change_reference VARCHAR(64),

    title VARCHAR(220) NOT NULL,

    description TEXT NOT NULL,

    submitted_amount NUMERIC(19,2) NOT NULL DEFAULT 0,

    assessed_amount NUMERIC(19,2),

    approved_amount NUMERIC(19,2),

    submitted_date DATE,

    decision_due_date DATE,

    decision_date DATE,

    status VARCHAR(40) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_commercial_change_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_commercial_change_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_commercial_change_amounts
        CHECK (
            submitted_amount >= 0
            AND (
                assessed_amount IS NULL
                OR assessed_amount >= 0
            )
            AND (
                approved_amount IS NULL
                OR approved_amount >= 0
            )
        ),

    CONSTRAINT ck_commercial_change_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'VOID'
            )
        )
);

CREATE INDEX idx_commercial_change_project
    ON project_commercial_change_orders(project_id);

CREATE INDEX idx_commercial_change_due
    ON project_commercial_change_orders(
        project_id,
        decision_due_date
    );


CREATE TABLE project_commercial_claims (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    claim_type VARCHAR(40) NOT NULL,

    title VARCHAR(220) NOT NULL,

    basis TEXT NOT NULL,

    claimed_amount NUMERIC(19,2) NOT NULL DEFAULT 0,

    assessed_amount NUMERIC(19,2),

    awarded_amount NUMERIC(19,2),

    claimed_days INTEGER NOT NULL DEFAULT 0,

    awarded_days INTEGER NOT NULL DEFAULT 0,

    submitted_date DATE,

    response_due_date DATE,

    decision_date DATE,

    status VARCHAR(40) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_commercial_claim_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_commercial_claim_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_commercial_claim_amounts
        CHECK (
            claimed_amount >= 0
            AND (
                assessed_amount IS NULL
                OR assessed_amount >= 0
            )
            AND (
                awarded_amount IS NULL
                OR awarded_amount >= 0
            )
            AND claimed_days >= 0
            AND awarded_days >= 0
        ),

    CONSTRAINT ck_commercial_claim_type
        CHECK (
            claim_type IN (
                'EXTENSION_OF_TIME',
                'LOSS_AND_EXPENSE',
                'VARIATION',
                'DISRUPTION',
                'DELAY',
                'OTHER'
            )
        ),

    CONSTRAINT ck_commercial_claim_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'UNDER_REVIEW',
                'PARTIALLY_APPROVED',
                'APPROVED',
                'REJECTED',
                'SETTLED',
                'VOID'
            )
        )
);

CREATE INDEX idx_commercial_claim_project
    ON project_commercial_claims(project_id);

CREATE INDEX idx_commercial_claim_response_due
    ON project_commercial_claims(
        project_id,
        response_due_date
    );


CREATE TABLE project_payment_certificates (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    period_start DATE NOT NULL,

    period_end DATE NOT NULL,

    application_date DATE NOT NULL,

    certification_due_date DATE NOT NULL,

    application_amount NUMERIC(19,2) NOT NULL,

    certified_amount NUMERIC(19,2),

    retention_amount NUMERIC(19,2),

    certified_date DATE,

    payment_due_date DATE,

    amount_paid NUMERIC(19,2) NOT NULL DEFAULT 0,

    last_payment_date DATE,

    status VARCHAR(40) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_payment_certificate_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_payment_certificate_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_payment_certificate_period
        CHECK (period_end >= period_start),

    CONSTRAINT ck_payment_certificate_amounts
        CHECK (
            application_amount >= 0
            AND (
                certified_amount IS NULL
                OR certified_amount >= 0
            )
            AND (
                retention_amount IS NULL
                OR retention_amount >= 0
            )
            AND amount_paid >= 0
        ),

    CONSTRAINT ck_payment_certificate_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'CERTIFIED',
                'PARTIALLY_PAID',
                'PAID',
                'REJECTED',
                'VOID'
            )
        )
);

CREATE INDEX idx_payment_certificate_project
    ON project_payment_certificates(project_id);

CREATE INDEX idx_payment_certificate_cert_due
    ON project_payment_certificates(
        project_id,
        certification_due_date
    );

CREATE INDEX idx_payment_certificate_payment_due
    ON project_payment_certificates(
        project_id,
        payment_due_date
    );


CREATE TABLE project_cashflow_periods (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    period_start DATE NOT NULL,

    period_end DATE NOT NULL,

    planned_inflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    forecast_inflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    actual_inflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    planned_outflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    forecast_outflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    actual_outflow NUMERIC(19,2) NOT NULL DEFAULT 0,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_cashflow_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_cashflow_project_period
        UNIQUE (
            project_id,
            period_start
        ),

    CONSTRAINT ck_cashflow_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_cashflow_amounts
        CHECK (
            planned_inflow >= 0
            AND forecast_inflow >= 0
            AND actual_inflow >= 0
            AND planned_outflow >= 0
            AND forecast_outflow >= 0
            AND actual_outflow >= 0
        ),

    CONSTRAINT ck_cashflow_status
        CHECK (
            status IN (
                'OPEN',
                'CLOSED'
            )
        )
);

CREATE INDEX idx_cashflow_project
    ON project_cashflow_periods(project_id);

CREATE INDEX idx_cashflow_period
    ON project_cashflow_periods(
        project_id,
        period_start
    );
