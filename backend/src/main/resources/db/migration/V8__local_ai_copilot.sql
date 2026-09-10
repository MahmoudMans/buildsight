CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE ai_project_chunks (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    source_type VARCHAR(40) NOT NULL,

    source_id UUID NOT NULL,

    source_parent_id UUID,

    source_reference VARCHAR(180) NOT NULL,

    source_title VARCHAR(300) NOT NULL,

    chunk_index INTEGER NOT NULL,

    content TEXT NOT NULL,

    content_hash VARCHAR(64) NOT NULL,

    embedding_model VARCHAR(160) NOT NULL,

    embedding vector(1024) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ai_chunks_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_ai_chunks_source_type
        CHECK (
            source_type IN (
                'PROJECT_FACT',
                'DOCUMENT_REVISION',
                'RFI'
            )
        ),

    CONSTRAINT ck_ai_chunks_index
        CHECK (chunk_index >= 0),

    CONSTRAINT uk_ai_source_chunk
        UNIQUE (
            project_id,
            source_type,
            source_id,
            chunk_index
        )
);

CREATE INDEX idx_ai_project_chunks_project
    ON ai_project_chunks(project_id);

CREATE INDEX idx_ai_project_chunks_source
    ON ai_project_chunks(
        project_id,
        source_type,
        source_id
    );

CREATE INDEX idx_ai_project_chunks_embedding
    ON ai_project_chunks
    USING hnsw (
        embedding vector_cosine_ops
    );


CREATE TABLE ai_copilot_interactions (
    id UUID PRIMARY KEY,

    project_id UUID NOT NULL,

    question TEXT NOT NULL,

    answer TEXT NOT NULL,

    grounded BOOLEAN NOT NULL,

    chat_model VARCHAR(160) NOT NULL,

    embedding_model VARCHAR(160) NOT NULL,

    citation_references TEXT NOT NULL,

    source_count INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_ai_interactions_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_ai_interaction_source_count
        CHECK (source_count >= 0)
);

CREATE INDEX idx_ai_interactions_project
    ON ai_copilot_interactions(
        project_id,
        created_at DESC
    );
