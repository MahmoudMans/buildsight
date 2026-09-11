CREATE TABLE project_governance_meetings (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    meeting_number VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    meeting_type VARCHAR(40) NOT NULL,

    scheduled_at TIMESTAMPTZ NOT NULL,

    held_at TIMESTAMPTZ,

    status VARCHAR(32) NOT NULL,

    chair_name VARCHAR(160),

    minutes TEXT,

    next_meeting_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_governance_meeting_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_governance_meeting_number
        UNIQUE (
            project_id,
            meeting_number
        ),

    CONSTRAINT ck_governance_meeting_type
        CHECK (
            meeting_type IN (
                'PROGRESS',
                'COORDINATION',
                'DESIGN',
                'COMMERCIAL',
                'HSE',
                'QUALITY',
                'EXECUTIVE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_governance_meeting_status
        CHECK (
            status IN (
                'PLANNED',
                'HELD',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_governance_meeting_project
    ON project_governance_meetings(project_id);

CREATE INDEX idx_governance_meeting_schedule
    ON project_governance_meetings(
        project_id,
        scheduled_at
    );


CREATE TABLE project_governance_decisions (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    meeting_id UUID,

    decision_number VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description TEXT,

    decision_date DATE NOT NULL,

    owner_name VARCHAR(160),

    due_date DATE,

    impact_area VARCHAR(40) NOT NULL,

    rationale TEXT,

    status VARCHAR(32) NOT NULL,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_governance_decision_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_governance_decision_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES project_governance_meetings(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_governance_decision_number
        UNIQUE (
            project_id,
            decision_number
        ),

    CONSTRAINT ck_governance_decision_impact
        CHECK (
            impact_area IN (
                'SCHEDULE',
                'COST',
                'QUALITY',
                'HSE',
                'COMMERCIAL',
                'TECHNICAL',
                'PROCUREMENT',
                'RESOURCE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_governance_decision_status
        CHECK (
            status IN (
                'PROPOSED',
                'APPROVED',
                'REJECTED',
                'IMPLEMENTED',
                'SUPERSEDED'
            )
        )
);

CREATE INDEX idx_governance_decision_project
    ON project_governance_decisions(project_id);

CREATE INDEX idx_governance_decision_due
    ON project_governance_decisions(
        project_id,
        due_date
    );


CREATE TABLE project_governance_actions (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    meeting_id UUID,

    decision_id UUID,

    action_number VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description TEXT,

    owner_name VARCHAR(160),

    priority VARCHAR(32) NOT NULL,

    due_date DATE NOT NULL,

    status VARCHAR(32) NOT NULL,

    blocker_reason TEXT,

    completed_at TIMESTAMPTZ,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_governance_action_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_governance_action_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES project_governance_meetings(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_governance_action_decision
        FOREIGN KEY (decision_id)
        REFERENCES project_governance_decisions(id)
        ON DELETE SET NULL,

    CONSTRAINT uk_governance_action_number
        UNIQUE (
            project_id,
            action_number
        ),

    CONSTRAINT ck_governance_action_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_governance_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'BLOCKED',
                'DONE',
                'VOID'
            )
        )
);

CREATE INDEX idx_governance_action_project
    ON project_governance_actions(project_id);

CREATE INDEX idx_governance_action_due
    ON project_governance_actions(
        project_id,
        due_date
    );

CREATE INDEX idx_governance_action_status
    ON project_governance_actions(
        project_id,
        status
    );


CREATE TABLE project_executive_report_snapshots (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    report_date DATE NOT NULL,

    physical_progress_percentage NUMERIC(7,2) NOT NULL,

    schedule_score NUMERIC(7,2) NOT NULL,
    schedule_risk VARCHAR(32) NOT NULL,

    predictive_score NUMERIC(7,2) NOT NULL,
    predictive_risk VARCHAR(32) NOT NULL,

    governance_score NUMERIC(7,2) NOT NULL,
    governance_risk VARCHAR(32) NOT NULL,

    cpi NUMERIC(12,4) NOT NULL,
    spi NUMERIC(12,4) NOT NULL,

    expected_forecast_cost NUMERIC(19,2) NOT NULL,
    expected_forecast_finish_date DATE NOT NULL,

    open_actions BIGINT NOT NULL,
    overdue_actions BIGINT NOT NULL,
    blocked_actions BIGINT NOT NULL,
    pending_decisions BIGINT NOT NULL,
    overdue_decisions BIGINT NOT NULL,
    meetings_without_minutes BIGINT NOT NULL,

    executive_summary TEXT NOT NULL,

    attention_items TEXT,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_executive_report_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_executive_report_project_date
        UNIQUE (
            project_id,
            report_date
        )
);

CREATE INDEX idx_executive_report_project_date
    ON project_executive_report_snapshots(
        project_id,
        report_date DESC
    );
