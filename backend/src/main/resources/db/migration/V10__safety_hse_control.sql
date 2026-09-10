CREATE TABLE project_safety_incidents (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    incident_type VARCHAR(40) NOT NULL,

    severity VARCHAR(32) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description TEXT NOT NULL,

    location VARCHAR(220),

    occurred_date DATE NOT NULL,

    reported_date DATE NOT NULL,

    people_affected INTEGER NOT NULL DEFAULT 0,

    lost_time_days INTEGER NOT NULL DEFAULT 0,

    immediate_action TEXT,

    root_cause TEXT,

    investigation_notes TEXT,

    status VARCHAR(40) NOT NULL,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_safety_incident_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_safety_incident_reference
        UNIQUE (project_id, reference),

    CONSTRAINT ck_safety_incident_type
        CHECK (
            incident_type IN (
                'NEAR_MISS',
                'FIRST_AID',
                'MEDICAL_TREATMENT',
                'LOST_TIME_INJURY',
                'PROPERTY_DAMAGE',
                'ENVIRONMENTAL',
                'OTHER'
            )
        ),

    CONSTRAINT ck_safety_incident_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_safety_incident_status
        CHECK (
            status IN (
                'REPORTED',
                'UNDER_INVESTIGATION',
                'ACTION_IN_PROGRESS',
                'CLOSED',
                'VOID'
            )
        ),

    CONSTRAINT ck_safety_incident_reported_date
        CHECK (
            reported_date >= occurred_date
        ),

    CONSTRAINT ck_safety_people_affected
        CHECK (
            people_affected >= 0
        ),

    CONSTRAINT ck_safety_lost_time_days
        CHECK (
            lost_time_days >= 0
        )
);

CREATE INDEX idx_safety_incident_project
    ON project_safety_incidents(project_id);

CREATE INDEX idx_safety_incident_status
    ON project_safety_incidents(
        project_id,
        status
    );

CREATE INDEX idx_safety_incident_occurred
    ON project_safety_incidents(
        project_id,
        occurred_date DESC
    );


CREATE TABLE project_safety_observations (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    observation_type VARCHAR(40) NOT NULL,

    hazard_category VARCHAR(40) NOT NULL,

    severity VARCHAR(32) NOT NULL,

    title VARCHAR(220) NOT NULL,

    description TEXT NOT NULL,

    location VARCHAR(220),

    observed_date DATE NOT NULL,

    observer_name VARCHAR(160),

    owner_name VARCHAR(160),

    due_date DATE,

    status VARCHAR(40) NOT NULL,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_safety_observation_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_safety_observation_reference
        UNIQUE (
            project_id,
            reference
        ),

    CONSTRAINT ck_safety_observation_type
        CHECK (
            observation_type IN (
                'SAFE_ACT',
                'UNSAFE_ACT',
                'UNSAFE_CONDITION',
                'GOOD_PRACTICE'
            )
        ),

    CONSTRAINT ck_safety_observation_severity
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_safety_hazard_category
        CHECK (
            hazard_category IN (
                'PPE',
                'HOUSEKEEPING',
                'WORK_AT_HEIGHT',
                'ELECTRICAL',
                'LIFTING',
                'EXCAVATION',
                'ACCESS_EGRESS',
                'TOOLS_EQUIPMENT',
                'FIRE',
                'ENVIRONMENTAL',
                'TRAFFIC',
                'OTHER'
            )
        ),

    CONSTRAINT ck_safety_observation_status
        CHECK (
            status IN (
                'OPEN',
                'ACTION_IN_PROGRESS',
                'CLOSED',
                'VOID'
            )
        )
);

CREATE INDEX idx_safety_observation_project
    ON project_safety_observations(project_id);

CREATE INDEX idx_safety_observation_category
    ON project_safety_observations(
        project_id,
        hazard_category
    );


CREATE TABLE project_safety_actions (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    incident_id UUID,

    observation_id UUID,

    reference VARCHAR(64) NOT NULL,

    title VARCHAR(220) NOT NULL,

    action_description TEXT NOT NULL,

    owner_name VARCHAR(160),

    due_date DATE NOT NULL,

    status VARCHAR(40) NOT NULL,

    verification_notes TEXT,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_safety_action_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_safety_action_incident
        FOREIGN KEY (incident_id)
        REFERENCES project_safety_incidents(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_safety_action_observation
        FOREIGN KEY (observation_id)
        REFERENCES project_safety_observations(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_safety_action_reference
        UNIQUE (
            project_id,
            reference
        ),

    CONSTRAINT ck_safety_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'READY_FOR_VERIFICATION',
                'CLOSED',
                'VOID'
            )
        ),

    CONSTRAINT ck_safety_action_single_source
        CHECK (
            NOT (
                incident_id IS NOT NULL
                AND observation_id IS NOT NULL
            )
        )
);

CREATE INDEX idx_safety_action_project
    ON project_safety_actions(project_id);

CREATE INDEX idx_safety_action_due
    ON project_safety_actions(
        project_id,
        due_date
    );

CREATE INDEX idx_safety_action_incident
    ON project_safety_actions(incident_id);

CREATE INDEX idx_safety_action_observation
    ON project_safety_actions(observation_id);


CREATE TABLE project_work_permits (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    reference VARCHAR(64) NOT NULL,

    permit_type VARCHAR(40) NOT NULL,

    title VARCHAR(220) NOT NULL,

    location VARCHAR(220),

    issuer_name VARCHAR(160),

    receiver_name VARCHAR(160),

    valid_from DATE NOT NULL,

    valid_until DATE NOT NULL,

    controls TEXT,

    status VARCHAR(32) NOT NULL,

    closed_date DATE,

    version BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_work_permit_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_work_permit_reference
        UNIQUE (
            project_id,
            reference
        ),

    CONSTRAINT ck_work_permit_dates
        CHECK (
            valid_until >= valid_from
        ),

    CONSTRAINT ck_work_permit_type
        CHECK (
            permit_type IN (
                'HOT_WORK',
                'WORK_AT_HEIGHT',
                'CONFINED_SPACE',
                'EXCAVATION',
                'ELECTRICAL_ISOLATION',
                'LIFTING',
                'GENERAL'
            )
        ),

    CONSTRAINT ck_work_permit_status
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'SUSPENDED',
                'CLOSED',
                'CANCELLED'
            )
        )
);

CREATE INDEX idx_work_permit_project
    ON project_work_permits(project_id);

CREATE INDEX idx_work_permit_validity
    ON project_work_permits(
        project_id,
        valid_until
    );
