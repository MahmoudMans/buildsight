ALTER TABLE projects
    ADD COLUMN forecast_end_date DATE;

UPDATE projects
SET forecast_end_date = planned_end_date
WHERE forecast_end_date IS NULL;

ALTER TABLE projects
    ALTER COLUMN forecast_end_date SET NOT NULL;


CREATE TABLE project_milestones (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    name VARCHAR(180) NOT NULL,
    description VARCHAR(1200),

    planned_date DATE NOT NULL,
    forecast_date DATE NOT NULL,
    actual_date DATE,

    status VARCHAR(32) NOT NULL,

    weight_percentage NUMERIC(5, 2) NOT NULL,

    sort_order INTEGER NOT NULL DEFAULT 0,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_milestones_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_project_milestones_status
        CHECK (
            status IN (
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'BLOCKED'
            )
        ),

    CONSTRAINT ck_project_milestones_weight
        CHECK (
            weight_percentage > 0
            AND weight_percentage <= 100
        ),

    CONSTRAINT ck_project_milestones_sort_order
        CHECK (sort_order >= 0)
);

CREATE INDEX idx_project_milestones_project
    ON project_milestones(project_id);

CREATE INDEX idx_project_milestones_project_status
    ON project_milestones(project_id, status);

CREATE INDEX idx_project_milestones_forecast
    ON project_milestones(project_id, forecast_date);


CREATE TABLE project_progress_updates (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    progress_percentage NUMERIC(5, 2) NOT NULL,

    update_date DATE NOT NULL,

    note VARCHAR(1000),

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_project_progress_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_project_progress_percentage
        CHECK (
            progress_percentage >= 0
            AND progress_percentage <= 100
        )
);

CREATE INDEX idx_project_progress_project
    ON project_progress_updates(project_id);

CREATE INDEX idx_project_progress_date
    ON project_progress_updates(
        project_id,
        update_date DESC,
        created_at DESC
    );
