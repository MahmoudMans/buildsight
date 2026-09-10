CREATE TABLE project_quality_inspections (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    inspection_type VARCHAR(40) NOT NULL,

    discipline VARCHAR(40) NOT NULL,

    planned_date DATE NOT NULL,

    actual_date DATE,

    inspector_name VARCHAR(160),

    status VARCHAR(32) NOT NULL,

    result VARCHAR(40) NOT NULL,

    notes VARCHAR(2500),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_quality_inspection_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_quality_inspection_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_quality_inspection_type
        CHECK (
            inspection_type IN (
                'INTERNAL',
                'CLIENT',
                'CONSULTANT',
                'REGULATORY',
                'TEST'
            )
        ),

    CONSTRAINT ck_quality_inspection_discipline
        CHECK (
            discipline IN (
                'CIVIL',
                'STRUCTURAL',
                'ARCHITECTURAL',
                'MEP',
                'HSE',
                'QUALITY',
                'GENERAL'
            )
        ),

    CONSTRAINT ck_quality_inspection_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_quality_inspection_result
        CHECK (
            result IN (
                'NOT_ASSESSED',
                'PASS',
                'PASS_WITH_OBSERVATIONS',
                'FAIL'
            )
        )
);

CREATE INDEX idx_quality_inspections_project
    ON project_quality_inspections(project_id);

CREATE INDEX idx_quality_inspections_status
    ON project_quality_inspections(project_id, status);


CREATE TABLE project_ncrs (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    inspection_id UUID,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description TEXT NOT NULL,

    category VARCHAR(40) NOT NULL,

    severity VARCHAR(32) NOT NULL,

    raised_date DATE NOT NULL,

    due_date DATE NOT NULL,

    owner_name VARCHAR(160),

    root_cause TEXT,

    corrective_action TEXT,

    verification_notes TEXT,

    status VARCHAR(40) NOT NULL,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_ncr_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ncr_inspection
        FOREIGN KEY (inspection_id)
        REFERENCES project_quality_inspections(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_project_ncr_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_ncr_dates
        CHECK (due_date >= raised_date),

    CONSTRAINT ck_ncr_category
        CHECK (
            category IN (
                'WORKMANSHIP',
                'MATERIAL',
                'DESIGN',
                'INSTALLATION',
                'DOCUMENTATION',
                'TEST_FAILURE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_ncr_severity
        CHECK (
            severity IN (
                'MINOR',
                'MAJOR',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_ncr_status
        CHECK (
            status IN (
                'OPEN',
                'CORRECTIVE_ACTION_IN_PROGRESS',
                'READY_FOR_VERIFICATION',
                'CLOSED',
                'VOID'
            )
        )
);

CREATE INDEX idx_project_ncrs_project
    ON project_ncrs(project_id);

CREATE INDEX idx_project_ncrs_due
    ON project_ncrs(project_id, due_date);

CREATE INDEX idx_project_ncrs_status
    ON project_ncrs(project_id, status);


CREATE TABLE project_punch_items (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description VARCHAR(2500),

    location VARCHAR(220),

    trade VARCHAR(120),

    priority VARCHAR(32) NOT NULL,

    raised_date DATE NOT NULL,

    due_date DATE NOT NULL,

    owner_name VARCHAR(160),

    status VARCHAR(40) NOT NULL,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_punch_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_punch_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_punch_dates
        CHECK (due_date >= raised_date),

    CONSTRAINT ck_punch_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_punch_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'READY_FOR_INSPECTION',
                'CLOSED',
                'VOID'
            )
        )
);

CREATE INDEX idx_project_punch_project
    ON project_punch_items(project_id);

CREATE INDEX idx_project_punch_due
    ON project_punch_items(project_id, due_date);


CREATE TABLE project_handover_items (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    code VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    category VARCHAR(40) NOT NULL,

    owner_name VARCHAR(160),

    due_date DATE NOT NULL,

    received_date DATE,

    approved_date DATE,

    status VARCHAR(32) NOT NULL,

    notes VARCHAR(2000),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_handover_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_handover_code
        UNIQUE (project_id, code),

    CONSTRAINT ck_handover_category
        CHECK (
            category IN (
                'OM_MANUAL',
                'AS_BUILT',
                'CERTIFICATE',
                'WARRANTY',
                'TEST_RECORD',
                'TRAINING',
                'OTHER'
            )
        ),

    CONSTRAINT ck_handover_status
        CHECK (
            status IN (
                'NOT_STARTED',
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'NOT_REQUIRED'
            )
        )
);

CREATE INDEX idx_handover_project
    ON project_handover_items(project_id);

CREATE INDEX idx_handover_due
    ON project_handover_items(project_id, due_date);
