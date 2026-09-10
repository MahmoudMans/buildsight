CREATE TABLE suppliers (
    id UUID PRIMARY KEY,

    code VARCHAR(40) NOT NULL,
    name VARCHAR(180) NOT NULL,

    supplier_type VARCHAR(32) NOT NULL,

    trade VARCHAR(160),

    country VARCHAR(100),

    contact_person VARCHAR(160),

    email VARCHAR(254),

    qualification_status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_suppliers_code
        UNIQUE (code),

    CONSTRAINT ck_suppliers_type
        CHECK (
            supplier_type IN (
                'SUPPLIER',
                'SUBCONTRACTOR',
                'CONSULTANT'
            )
        ),

    CONSTRAINT ck_suppliers_qualification
        CHECK (
            qualification_status IN (
                'PENDING',
                'QUALIFIED',
                'CONDITIONAL',
                'SUSPENDED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_suppliers_name
    ON suppliers(name);

CREATE INDEX idx_suppliers_qualification
    ON suppliers(qualification_status);


CREATE TABLE procurement_packages (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    cost_code_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(180) NOT NULL,

    description VARCHAR(1500),

    estimated_value NUMERIC(19, 2) NOT NULL,

    planned_issue_date DATE NOT NULL,

    actual_issue_date DATE,

    bid_due_date DATE NOT NULL,

    award_due_date DATE NOT NULL,

    forecast_award_date DATE NOT NULL,

    required_on_site_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    awarded_supplier_id UUID,

    awarded_value NUMERIC(19, 2),

    award_date DATE,

    commitment_id UUID,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_procurement_packages_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_procurement_packages_cost_code
        FOREIGN KEY (cost_code_id)
        REFERENCES project_cost_codes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_procurement_packages_supplier
        FOREIGN KEY (awarded_supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_procurement_packages_commitment
        FOREIGN KEY (commitment_id)
        REFERENCES project_commitments(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_procurement_package_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_procurement_package_value
        CHECK (estimated_value > 0),

    CONSTRAINT ck_procurement_package_award_value
        CHECK (
            awarded_value IS NULL
            OR awarded_value > 0
        ),

    CONSTRAINT ck_procurement_package_status
        CHECK (
            status IN (
                'PLANNING',
                'TENDERING',
                'EVALUATION',
                'AWARDED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_procurement_package_dates
        CHECK (
            planned_issue_date <= bid_due_date
            AND bid_due_date <= award_due_date
            AND award_due_date <= required_on_site_date
        )
);

CREATE INDEX idx_procurement_packages_project
    ON procurement_packages(project_id);

CREATE INDEX idx_procurement_packages_status
    ON procurement_packages(project_id, status);

CREATE INDEX idx_procurement_packages_award_due
    ON procurement_packages(project_id, award_due_date);


CREATE TABLE procurement_bids (
    id UUID PRIMARY KEY,

    procurement_package_id UUID NOT NULL,

    supplier_id UUID NOT NULL,

    bid_amount NUMERIC(19, 2) NOT NULL,

    submitted_date DATE NOT NULL,

    technical_score NUMERIC(5, 2) NOT NULL,

    commercial_score NUMERIC(5, 2) NOT NULL,

    delivery_days INTEGER NOT NULL,

    status VARCHAR(32) NOT NULL,

    notes VARCHAR(1200),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_procurement_bids_package
        FOREIGN KEY (procurement_package_id)
        REFERENCES procurement_packages(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_procurement_bids_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_procurement_bid_supplier
        UNIQUE (
            procurement_package_id,
            supplier_id
        ),

    CONSTRAINT ck_procurement_bid_amount
        CHECK (bid_amount > 0),

    CONSTRAINT ck_procurement_bid_technical_score
        CHECK (
            technical_score >= 0
            AND technical_score <= 100
        ),

    CONSTRAINT ck_procurement_bid_commercial_score
        CHECK (
            commercial_score >= 0
            AND commercial_score <= 100
        ),

    CONSTRAINT ck_procurement_bid_delivery_days
        CHECK (delivery_days >= 0),

    CONSTRAINT ck_procurement_bid_status
        CHECK (
            status IN (
                'RECEIVED',
                'SHORTLISTED',
                'REJECTED',
                'SELECTED'
            )
        )
);

CREATE INDEX idx_procurement_bids_package
    ON procurement_bids(procurement_package_id);

CREATE INDEX idx_procurement_bids_supplier
    ON procurement_bids(supplier_id);


CREATE TABLE supplier_performance_evaluations (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    supplier_id UUID NOT NULL,

    procurement_package_id UUID,

    evaluation_date DATE NOT NULL,

    quality_score NUMERIC(5, 2) NOT NULL,

    delivery_score NUMERIC(5, 2) NOT NULL,

    safety_score NUMERIC(5, 2) NOT NULL,

    commercial_score NUMERIC(5, 2) NOT NULL,

    comments VARCHAR(1500),

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_supplier_eval_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_supplier_eval_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_eval_package
        FOREIGN KEY (procurement_package_id)
        REFERENCES procurement_packages(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_supplier_eval_quality
        CHECK (
            quality_score >= 0
            AND quality_score <= 100
        ),

    CONSTRAINT ck_supplier_eval_delivery
        CHECK (
            delivery_score >= 0
            AND delivery_score <= 100
        ),

    CONSTRAINT ck_supplier_eval_safety
        CHECK (
            safety_score >= 0
            AND safety_score <= 100
        ),

    CONSTRAINT ck_supplier_eval_commercial
        CHECK (
            commercial_score >= 0
            AND commercial_score <= 100
        )
);

CREATE INDEX idx_supplier_eval_project
    ON supplier_performance_evaluations(project_id);

CREATE INDEX idx_supplier_eval_supplier
    ON supplier_performance_evaluations(supplier_id);
