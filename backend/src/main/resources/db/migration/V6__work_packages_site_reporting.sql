CREATE TABLE project_work_packages (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    code VARCHAR(40) NOT NULL,

    name VARCHAR(180) NOT NULL,

    description VARCHAR(1500),

    unit VARCHAR(32) NOT NULL,

    planned_quantity NUMERIC(19, 3) NOT NULL,

    planned_labor_hours NUMERIC(19, 2) NOT NULL,

    planned_start_date DATE NOT NULL,

    planned_end_date DATE NOT NULL,

    actual_start_date DATE,

    actual_end_date DATE,

    status VARCHAR(32) NOT NULL,

    block_reason VARCHAR(1200),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_work_packages_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_work_package_code
        UNIQUE (project_id, code),

    CONSTRAINT ck_work_package_quantity
        CHECK (planned_quantity > 0),

    CONSTRAINT ck_work_package_labor
        CHECK (planned_labor_hours >= 0),

    CONSTRAINT ck_work_package_dates
        CHECK (
            planned_end_date >= planned_start_date
        ),

    CONSTRAINT ck_work_package_actual_dates
        CHECK (
            actual_end_date IS NULL
            OR actual_start_date IS NULL
            OR actual_end_date >= actual_start_date
        ),

    CONSTRAINT ck_work_package_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'BLOCKED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_work_packages_project
    ON project_work_packages(project_id);

CREATE INDEX idx_work_packages_status
    ON project_work_packages(project_id, status);


CREATE TABLE project_site_reports (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    report_date DATE NOT NULL,

    weather_condition VARCHAR(32) NOT NULL,

    general_notes VARCHAR(2500),

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_site_reports_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_site_report_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_site_report_weather
        CHECK (
            weather_condition IN (
                'CLEAR',
                'CLOUDY',
                'RAIN',
                'WIND',
                'EXTREME_HEAT',
                'EXTREME_COLD',
                'OTHER'
            )
        ),

    CONSTRAINT ck_site_report_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED'
            )
        )
);

CREATE INDEX idx_site_reports_project
    ON project_site_reports(project_id);

CREATE INDEX idx_site_reports_date
    ON project_site_reports(
        project_id,
        report_date DESC
    );

CREATE INDEX idx_site_reports_status
    ON project_site_reports(project_id, status);


CREATE TABLE site_report_production_entries (
    id UUID PRIMARY KEY,

    site_report_id UUID NOT NULL,

    work_package_id UUID NOT NULL,

    quantity_completed NUMERIC(19, 3) NOT NULL,

    labor_hours NUMERIC(19, 2) NOT NULL,

    equipment_hours NUMERIC(19, 2) NOT NULL,

    crew_size INTEGER NOT NULL,

    notes VARCHAR(1500),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_production_entry_report
        FOREIGN KEY (site_report_id)
        REFERENCES project_site_reports(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_production_entry_package
        FOREIGN KEY (work_package_id)
        REFERENCES project_work_packages(id)
        ON DELETE RESTRICT,

    CONSTRAINT uk_report_work_package_entry
        UNIQUE (
            site_report_id,
            work_package_id
        ),

    CONSTRAINT ck_production_entry_quantity
        CHECK (quantity_completed >= 0),

    CONSTRAINT ck_production_entry_labor
        CHECK (labor_hours >= 0),

    CONSTRAINT ck_production_entry_equipment
        CHECK (equipment_hours >= 0),

    CONSTRAINT ck_production_entry_crew
        CHECK (crew_size >= 0)
);

CREATE INDEX idx_production_entries_report
    ON site_report_production_entries(site_report_id);

CREATE INDEX idx_production_entries_package
    ON site_report_production_entries(work_package_id);
