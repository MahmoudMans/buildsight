CREATE TABLE project_workforce_plans (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    trade VARCHAR(100) NOT NULL,

    work_package_id UUID,

    planned_workers INTEGER NOT NULL,

    planned_regular_hours NUMERIC(12,2) NOT NULL,

    planned_productive_hours NUMERIC(12,2) NOT NULL,

    planned_productivity_rate NUMERIC(18,6),

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_workforce_plan_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_workforce_plan_package
        FOREIGN KEY (work_package_id)
        REFERENCES project_work_packages(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_workforce_plan_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_workforce_plan_values
        CHECK (
            planned_workers >= 0
            AND planned_regular_hours >= 0
            AND planned_productive_hours >= 0
            AND planned_productive_hours <= planned_regular_hours
            AND (
                planned_productivity_rate IS NULL
                OR planned_productivity_rate >= 0
            )
        ),

    CONSTRAINT ck_workforce_plan_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'CLOSED'
            )
        )
);

CREATE INDEX idx_workforce_plan_project
    ON project_workforce_plans(project_id);

CREATE INDEX idx_workforce_plan_period
    ON project_workforce_plans(
        project_id,
        period_start,
        period_end
    );


CREATE TABLE project_workforce_deployments (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    work_date DATE NOT NULL,

    trade VARCHAR(100) NOT NULL,

    work_package_id UUID,

    workers INTEGER NOT NULL,

    regular_hours NUMERIC(12,2) NOT NULL,

    overtime_hours NUMERIC(12,2) NOT NULL,

    productive_hours NUMERIC(12,2) NOT NULL,

    quantity_completed NUMERIC(18,4) NOT NULL,

    planned_productivity_rate NUMERIC(18,6),

    notes VARCHAR(2500),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_workforce_deployment_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_workforce_deployment_package
        FOREIGN KEY (work_package_id)
        REFERENCES project_work_packages(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_workforce_deployment_values
        CHECK (
            workers >= 0
            AND regular_hours >= 0
            AND overtime_hours >= 0
            AND productive_hours >= 0
            AND productive_hours <= (
                regular_hours + overtime_hours
            )
            AND quantity_completed >= 0
            AND (
                planned_productivity_rate IS NULL
                OR planned_productivity_rate >= 0
            )
        )
);

CREATE INDEX idx_workforce_deployment_project
    ON project_workforce_deployments(project_id);

CREATE INDEX idx_workforce_deployment_date
    ON project_workforce_deployments(
        project_id,
        work_date DESC
    );

CREATE INDEX idx_workforce_deployment_package
    ON project_workforce_deployments(
        project_id,
        work_package_id
    );


CREATE TABLE project_equipment (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    code VARCHAR(64) NOT NULL,

    description VARCHAR(220) NOT NULL,

    category VARCHAR(100) NOT NULL,

    ownership VARCHAR(32) NOT NULL,

    status VARCHAR(32) NOT NULL,

    daily_cost NUMERIC(19,2) NOT NULL DEFAULT 0,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_equipment_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_project_equipment_code
        UNIQUE (
            project_id,
            code
        ),

    CONSTRAINT ck_project_equipment_ownership
        CHECK (
            ownership IN (
                'OWNED',
                'RENTED',
                'SUBCONTRACTOR'
            )
        ),

    CONSTRAINT ck_project_equipment_status
        CHECK (
            status IN (
                'AVAILABLE',
                'DEPLOYED',
                'IDLE',
                'MAINTENANCE',
                'OFF_HIRE'
            )
        ),

    CONSTRAINT ck_project_equipment_daily_cost
        CHECK (
            daily_cost >= 0
        )
);

CREATE INDEX idx_project_equipment_project
    ON project_equipment(project_id);

CREATE INDEX idx_project_equipment_status
    ON project_equipment(
        project_id,
        status
    );


CREATE TABLE project_equipment_usage_logs (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    equipment_id UUID NOT NULL,

    work_package_id UUID,

    work_date DATE NOT NULL,

    available_hours NUMERIC(12,2) NOT NULL,

    operating_hours NUMERIC(12,2) NOT NULL,

    idle_hours NUMERIC(12,2) NOT NULL,

    downtime_hours NUMERIC(12,2) NOT NULL,

    notes VARCHAR(2500),

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_equipment_usage_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_equipment_usage_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES project_equipment(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_equipment_usage_package
        FOREIGN KEY (work_package_id)
        REFERENCES project_work_packages(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_equipment_usage_date
        UNIQUE (
            equipment_id,
            work_date
        ),

    CONSTRAINT ck_equipment_usage_values
        CHECK (
            available_hours >= 0
            AND operating_hours >= 0
            AND idle_hours >= 0
            AND downtime_hours >= 0
            AND (
                operating_hours
                + idle_hours
                + downtime_hours
            ) <= available_hours
        )
);

CREATE INDEX idx_equipment_usage_project
    ON project_equipment_usage_logs(project_id);

CREATE INDEX idx_equipment_usage_date
    ON project_equipment_usage_logs(
        project_id,
        work_date DESC
    );


CREATE TABLE project_resource_demand_forecasts (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    resource_type VARCHAR(32) NOT NULL,

    resource_key VARCHAR(120) NOT NULL,

    required_quantity NUMERIC(14,2) NOT NULL,

    available_quantity NUMERIC(14,2) NOT NULL,

    notes VARCHAR(2000),

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_resource_forecast_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_resource_forecast
        UNIQUE (
            project_id,
            period_start,
            resource_type,
            resource_key
        ),

    CONSTRAINT ck_resource_forecast_period
        CHECK (
            period_end >= period_start
        ),

    CONSTRAINT ck_resource_forecast_type
        CHECK (
            resource_type IN (
                'LABOR',
                'EQUIPMENT'
            )
        ),

    CONSTRAINT ck_resource_forecast_values
        CHECK (
            required_quantity >= 0
            AND available_quantity >= 0
        ),

    CONSTRAINT ck_resource_forecast_status
        CHECK (
            status IN (
                'OPEN',
                'CLOSED'
            )
        )
);

CREATE INDEX idx_resource_forecast_project
    ON project_resource_demand_forecasts(project_id);

CREATE INDEX idx_resource_forecast_period
    ON project_resource_demand_forecasts(
        project_id,
        period_start,
        period_end
    );
