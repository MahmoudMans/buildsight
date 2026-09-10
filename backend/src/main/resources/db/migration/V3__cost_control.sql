CREATE TABLE project_cost_codes (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    code VARCHAR(32) NOT NULL,
    name VARCHAR(160) NOT NULL,

    category VARCHAR(40) NOT NULL,

    description VARCHAR(1000),

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_cost_codes_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_cost_codes_project_code
        UNIQUE (project_id, code),

    CONSTRAINT ck_cost_codes_category
        CHECK (
            category IN (
                'PRELIMINARIES',
                'STRUCTURE',
                'ARCHITECTURAL',
                'MEP',
                'EXTERNAL_WORKS',
                'PROFESSIONAL_FEES',
                'CONTINGENCY',
                'OTHER'
            )
        ),

    CONSTRAINT ck_cost_codes_sort_order
        CHECK (sort_order >= 0)
);

CREATE INDEX idx_cost_codes_project
    ON project_cost_codes(project_id);


CREATE TABLE project_budget_lines (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    cost_code_id UUID NOT NULL,

    description VARCHAR(1000),

    original_budget NUMERIC(19, 2) NOT NULL,

    approved_changes NUMERIC(19, 2) NOT NULL DEFAULT 0,

    forecast_cost NUMERIC(19, 2) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_budget_lines_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_budget_lines_cost_code
        FOREIGN KEY (cost_code_id)
        REFERENCES project_cost_codes(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_budget_lines_original
        CHECK (original_budget >= 0),

    CONSTRAINT ck_budget_lines_revised
        CHECK (
            original_budget + approved_changes >= 0
        ),

    CONSTRAINT ck_budget_lines_forecast
        CHECK (forecast_cost >= 0)
);

CREATE INDEX idx_budget_lines_project
    ON project_budget_lines(project_id);

CREATE INDEX idx_budget_lines_cost_code
    ON project_budget_lines(cost_code_id);


CREATE TABLE project_commitments (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    cost_code_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    vendor_name VARCHAR(180) NOT NULL,

    description VARCHAR(1200),

    committed_amount NUMERIC(19, 2) NOT NULL,

    status VARCHAR(32) NOT NULL,

    commitment_date DATE NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_commitments_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_commitments_cost_code
        FOREIGN KEY (cost_code_id)
        REFERENCES project_cost_codes(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_commitments_project_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_commitments_amount
        CHECK (committed_amount > 0),

    CONSTRAINT ck_commitments_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_commitments_project
    ON project_commitments(project_id);

CREATE INDEX idx_commitments_cost_code
    ON project_commitments(cost_code_id);

CREATE INDEX idx_commitments_status
    ON project_commitments(project_id, status);


CREATE TABLE project_actual_costs (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    cost_code_id UUID NOT NULL,

    commitment_id UUID,

    reference VARCHAR(64) NOT NULL,

    supplier_name VARCHAR(180) NOT NULL,

    description VARCHAR(1200),

    amount NUMERIC(19, 2) NOT NULL,

    cost_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_actual_costs_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_actual_costs_cost_code
        FOREIGN KEY (cost_code_id)
        REFERENCES project_cost_codes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_actual_costs_commitment
        FOREIGN KEY (commitment_id)
        REFERENCES project_commitments(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_actual_cost_project_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_actual_cost_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_actual_costs_project
    ON project_actual_costs(project_id);

CREATE INDEX idx_actual_costs_cost_code
    ON project_actual_costs(cost_code_id);

CREATE INDEX idx_actual_costs_commitment
    ON project_actual_costs(commitment_id);

CREATE INDEX idx_actual_costs_date
    ON project_actual_costs(
        project_id,
        cost_date DESC,
        created_at DESC
    );
