CREATE TABLE project_schedule_baselines (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    name VARCHAR(180) NOT NULL,

    data_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    approved_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_schedule_baseline_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_schedule_baseline_name
        UNIQUE (
            project_id,
            name
        ),

    CONSTRAINT ck_schedule_baseline_status
        CHECK (
            status IN (
                'DRAFT',
                'APPROVED',
                'SUPERSEDED'
            )
        )
);

CREATE INDEX idx_schedule_baseline_project
    ON project_schedule_baselines(project_id);

CREATE INDEX idx_schedule_baseline_status
    ON project_schedule_baselines(
        project_id,
        status
    );


CREATE TABLE project_schedule_activities (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    activity_code VARCHAR(64) NOT NULL,

    name VARCHAR(220) NOT NULL,

    discipline VARCHAR(100),

    work_package_id UUID,

    current_start DATE NOT NULL,

    current_finish DATE NOT NULL,

    original_duration_days INTEGER NOT NULL,

    remaining_duration_days INTEGER NOT NULL,

    actual_start DATE,

    actual_finish DATE,

    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_schedule_activity_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_activity_package
        FOREIGN KEY (work_package_id)
        REFERENCES project_work_packages(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_schedule_activity_code
        UNIQUE (
            project_id,
            activity_code
        ),

    CONSTRAINT ck_schedule_activity_dates
        CHECK (
            current_finish >= current_start
        ),

    CONSTRAINT ck_schedule_activity_durations
        CHECK (
            original_duration_days >= 0
            AND remaining_duration_days >= 0
        ),

    CONSTRAINT ck_schedule_activity_progress
        CHECK (
            progress_percentage >= 0
            AND progress_percentage <= 100
        ),

    CONSTRAINT ck_schedule_activity_status
        CHECK (
            status IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'ON_HOLD',
                'COMPLETED'
            )
        )
);

CREATE INDEX idx_schedule_activity_project
    ON project_schedule_activities(project_id);

CREATE INDEX idx_schedule_activity_dates
    ON project_schedule_activities(
        project_id,
        current_start,
        current_finish
    );


CREATE TABLE project_schedule_dependencies (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    predecessor_activity_id UUID NOT NULL,

    successor_activity_id UUID NOT NULL,

    dependency_type VARCHAR(8) NOT NULL,

    lag_days INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_schedule_dependency_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_dependency_predecessor
        FOREIGN KEY (predecessor_activity_id)
        REFERENCES project_schedule_activities(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_dependency_successor
        FOREIGN KEY (successor_activity_id)
        REFERENCES project_schedule_activities(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_schedule_dependency_not_self
        CHECK (
            predecessor_activity_id
            <> successor_activity_id
        ),

    CONSTRAINT ck_schedule_dependency_type
        CHECK (
            dependency_type IN (
                'FS',
                'SS',
                'FF',
                'SF'
            )
        ),

    CONSTRAINT uk_schedule_dependency
        UNIQUE (
            project_id,
            predecessor_activity_id,
            successor_activity_id,
            dependency_type
        )
);

CREATE INDEX idx_schedule_dependency_project
    ON project_schedule_dependencies(project_id);

CREATE INDEX idx_schedule_dependency_predecessor
    ON project_schedule_dependencies(
        predecessor_activity_id
    );

CREATE INDEX idx_schedule_dependency_successor
    ON project_schedule_dependencies(
        successor_activity_id
    );


CREATE TABLE project_schedule_constraints (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    activity_id UUID NOT NULL,

    constraint_type VARCHAR(40) NOT NULL,

    title VARCHAR(220) NOT NULL,

    owner_name VARCHAR(160),

    due_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    resolution_notes TEXT,

    resolved_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_schedule_constraint_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_constraint_activity
        FOREIGN KEY (activity_id)
        REFERENCES project_schedule_activities(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_schedule_constraint_type
        CHECK (
            constraint_type IN (
                'DESIGN_INFORMATION',
                'MATERIAL',
                'ACCESS',
                'LABOR',
                'EQUIPMENT',
                'APPROVAL',
                'PERMIT',
                'PREDECESSOR',
                'OTHER'
            )
        ),

    CONSTRAINT ck_schedule_constraint_status
        CHECK (
            status IN (
                'OPEN',
                'RESOLVED',
                'WAIVED'
            )
        )
);

CREATE INDEX idx_schedule_constraint_project
    ON project_schedule_constraints(project_id);

CREATE INDEX idx_schedule_constraint_activity
    ON project_schedule_constraints(activity_id);

CREATE INDEX idx_schedule_constraint_due
    ON project_schedule_constraints(
        project_id,
        due_date
    );


CREATE TABLE project_schedule_baseline_activities (
    id UUID PRIMARY KEY,

    baseline_id UUID NOT NULL,

    activity_code VARCHAR(64) NOT NULL,

    name VARCHAR(220) NOT NULL,

    planned_start DATE NOT NULL,

    planned_finish DATE NOT NULL,

    duration_days INTEGER NOT NULL,

    critical BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_baseline_activity_baseline
        FOREIGN KEY (baseline_id)
        REFERENCES project_schedule_baselines(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_baseline_activity_code
        UNIQUE (
            baseline_id,
            activity_code
        ),

    CONSTRAINT ck_baseline_activity_dates
        CHECK (
            planned_finish >= planned_start
        ),

    CONSTRAINT ck_baseline_activity_duration
        CHECK (
            duration_days >= 0
        )
);

CREATE INDEX idx_baseline_activity_baseline
    ON project_schedule_baseline_activities(
        baseline_id
    );
