CREATE TABLE project_documents (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    document_number VARCHAR(80) NOT NULL,

    title VARCHAR(220) NOT NULL,

    document_type VARCHAR(40) NOT NULL,

    discipline VARCHAR(40) NOT NULL,

    owner_name VARCHAR(160),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_documents_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_document_number
        UNIQUE (project_id, document_number),

    CONSTRAINT ck_project_document_type
        CHECK (
            document_type IN (
                'DRAWING',
                'SPECIFICATION',
                'REPORT',
                'CONTRACT',
                'PROCEDURE',
                'SCHEDULE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_project_document_discipline
        CHECK (
            discipline IN (
                'ARCHITECTURAL',
                'STRUCTURAL',
                'CIVIL',
                'MEP',
                'COMMERCIAL',
                'PLANNING',
                'HSE',
                'QUALITY',
                'GENERAL'
            )
        )
);

CREATE INDEX idx_project_documents_project
    ON project_documents(project_id);

CREATE INDEX idx_project_documents_type
    ON project_documents(project_id, document_type);


CREATE TABLE document_revisions (
    id UUID PRIMARY KEY,

    document_id UUID NOT NULL,

    revision_code VARCHAR(32) NOT NULL,

    revision_status VARCHAR(32) NOT NULL,

    issued_date DATE NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    content_type VARCHAR(255),

    file_size BIGINT NOT NULL,

    sha256 VARCHAR(64) NOT NULL,

    storage_path VARCHAR(700) NOT NULL,

    extracted_text TEXT NOT NULL DEFAULT '',

    search_text TEXT NOT NULL DEFAULT '',

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_document_revisions_document
        FOREIGN KEY (document_id)
        REFERENCES project_documents(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_document_revision_code
        UNIQUE (document_id, revision_code),

    CONSTRAINT ck_document_revision_status
        CHECK (
            revision_status IN (
                'DRAFT',
                'FOR_REVIEW',
                'ISSUED',
                'APPROVED',
                'SUPERSEDED'
            )
        ),

    CONSTRAINT ck_document_revision_size
        CHECK (file_size >= 0)
);

CREATE INDEX idx_document_revisions_document
    ON document_revisions(document_id);

CREATE INDEX idx_document_revisions_status
    ON document_revisions(document_id, revision_status);

CREATE INDEX idx_document_revision_fulltext
    ON document_revisions
    USING GIN (
        to_tsvector(
            'simple',
            search_text
        )
    );


CREATE TABLE project_rfis (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    subject VARCHAR(220) NOT NULL,

    question TEXT NOT NULL,

    response TEXT,

    raised_by VARCHAR(160),

    assigned_to VARCHAR(160),

    raised_date DATE NOT NULL,

    due_date DATE NOT NULL,

    responded_date DATE,

    priority VARCHAR(32) NOT NULL,

    status VARCHAR(32) NOT NULL,

    search_text TEXT NOT NULL DEFAULT '',

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_rfis_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_rfi_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_rfi_dates
        CHECK (due_date >= raised_date),

    CONSTRAINT ck_project_rfi_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_project_rfi_status
        CHECK (
            status IN (
                'OPEN',
                'ANSWERED',
                'CLOSED',
                'VOID'
            )
        )
);

CREATE INDEX idx_project_rfis_project
    ON project_rfis(project_id);

CREATE INDEX idx_project_rfis_due
    ON project_rfis(project_id, due_date);

CREATE INDEX idx_project_rfis_status
    ON project_rfis(project_id, status);

CREATE INDEX idx_project_rfi_fulltext
    ON project_rfis
    USING GIN (
        to_tsvector(
            'simple',
            search_text
        )
    );


CREATE TABLE project_transmittals (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    recipient VARCHAR(220) NOT NULL,

    purpose VARCHAR(220) NOT NULL,

    transmittal_date DATE NOT NULL,

    issued_date DATE,

    notes VARCHAR(2000),

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_transmittals_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_transmittal_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_project_transmittal_status
        CHECK (
            status IN (
                'DRAFT',
                'ISSUED'
            )
        )
);

CREATE INDEX idx_project_transmittals_project
    ON project_transmittals(project_id);

CREATE INDEX idx_project_transmittals_status
    ON project_transmittals(project_id, status);


CREATE TABLE transmittal_revision_links (
    id UUID PRIMARY KEY,

    transmittal_id UUID NOT NULL,

    document_revision_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_transmittal_links_transmittal
        FOREIGN KEY (transmittal_id)
        REFERENCES project_transmittals(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transmittal_links_revision
        FOREIGN KEY (document_revision_id)
        REFERENCES document_revisions(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_transmittal_revision
        UNIQUE (
            transmittal_id,
            document_revision_id
        )
);

CREATE INDEX idx_transmittal_links_transmittal
    ON transmittal_revision_links(transmittal_id);

CREATE INDEX idx_transmittal_links_revision
    ON transmittal_revision_links(document_revision_id);
