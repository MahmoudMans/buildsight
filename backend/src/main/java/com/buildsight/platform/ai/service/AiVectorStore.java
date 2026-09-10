package com.buildsight.platform.ai.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.buildsight.platform.ai.domain.AiSourceType;
import com.buildsight.platform.common.exception.InvalidRequestException;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class AiVectorStore {

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    public AiVectorStore(
            NamedParameterJdbcTemplate jdbcTemplate) {

        this.jdbcTemplate =
                jdbcTemplate;
    }

    @Transactional
    public void replaceProject(
            UUID projectId,
            List<EmbeddedAiChunk> chunks) {

        jdbcTemplate.update(
                """
                DELETE FROM ai_project_chunks
                WHERE project_id = :projectId
                """,
                Map.of(
                        "projectId",
                        projectId));

        String sql = """
                INSERT INTO ai_project_chunks (
                    id,
                    project_id,
                    source_type,
                    source_id,
                    source_parent_id,
                    source_reference,
                    source_title,
                    chunk_index,
                    content,
                    content_hash,
                    embedding_model,
                    embedding,
                    created_at
                )
                VALUES (
                    :id,
                    :projectId,
                    :sourceType,
                    :sourceId,
                    :sourceParentId,
                    :reference,
                    :title,
                    :chunkIndex,
                    :content,
                    :contentHash,
                    :embeddingModel,
                    CAST(:embedding AS vector),
                    CURRENT_TIMESTAMP
                )
                """;

        for (EmbeddedAiChunk embedded :
                chunks) {

            AiChunkDraft chunk =
                    embedded.chunk();

            MapSqlParameterSource parameters =
                    new MapSqlParameterSource()
                            .addValue(
                                    "id",
                                    chunk.id())
                            .addValue(
                                    "projectId",
                                    chunk.projectId())
                            .addValue(
                                    "sourceType",
                                    chunk.sourceType()
                                            .name())
                            .addValue(
                                    "sourceId",
                                    chunk.sourceId())
                            .addValue(
                                    "sourceParentId",
                                    chunk.sourceParentId())
                            .addValue(
                                    "reference",
                                    chunk.reference())
                            .addValue(
                                    "title",
                                    chunk.title())
                            .addValue(
                                    "chunkIndex",
                                    chunk.chunkIndex())
                            .addValue(
                                    "content",
                                    chunk.content())
                            .addValue(
                                    "contentHash",
                                    chunk.contentHash())
                            .addValue(
                                    "embeddingModel",
                                    embedded.embeddingModel())
                            .addValue(
                                    "embedding",
                                    vectorLiteral(
                                            embedded.embedding()));

            jdbcTemplate.update(
                    sql,
                    parameters);
        }
    }

    public long count(
            UUID projectId) {

        Long result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM ai_project_chunks
                        WHERE project_id = :projectId
                        """,
                        Map.of(
                                "projectId",
                                projectId),
                        Long.class);

        return result == null
                ? 0
                : result;
    }

    public Instant latestIndexedAt(
            UUID projectId) {

        List<Instant> result =
                jdbcTemplate.query(
                        """
                        SELECT MAX(created_at) AS indexed_at
                        FROM ai_project_chunks
                        WHERE project_id = :projectId
                        """,
                        Map.of(
                                "projectId",
                                projectId),
                        (
                                resultSet,
                                rowNumber) -> {

                            Timestamp timestamp =
                                    resultSet.getTimestamp(
                                            "indexed_at");

                            return timestamp == null
                                    ? null
                                    : timestamp.toInstant();
                        });

        if (result.isEmpty()) {
            return null;
        }

        return result.get(0);
    }

    public List<AiRetrievedChunk> nearest(
            UUID projectId,
            List<Double> embedding,
            int limit) {

        if (embedding == null
                || embedding.isEmpty()) {

            return List.of();
        }

        String sql = """
                SELECT
                    id,
                    source_type,
                    source_id,
                    source_parent_id,
                    source_reference,
                    source_title,
                    content,
                    1 - (
                        embedding
                        <=>
                        CAST(:embedding AS vector)
                    ) AS similarity
                FROM ai_project_chunks
                WHERE project_id = :projectId
                ORDER BY
                    embedding
                    <=>
                    CAST(:embedding AS vector)
                LIMIT :limit
                """;

        return jdbcTemplate.query(
                sql,
                new MapSqlParameterSource()
                        .addValue(
                                "embedding",
                                vectorLiteral(
                                        embedding))
                        .addValue(
                                "projectId",
                                projectId)
                        .addValue(
                                "limit",
                                limit),
                (
                        resultSet,
                        rowNumber) ->
                        new AiRetrievedChunk(
                                resultSet.getObject(
                                        "id",
                                        UUID.class),
                                AiSourceType.valueOf(
                                        resultSet.getString(
                                                "source_type")),
                                resultSet.getObject(
                                        "source_id",
                                        UUID.class),
                                resultSet.getObject(
                                        "source_parent_id",
                                        UUID.class),
                                resultSet.getString(
                                        "source_reference"),
                                resultSet.getString(
                                        "source_title"),
                                resultSet.getString(
                                        "content"),
                                resultSet.getDouble(
                                        "similarity")));
    }

    private String vectorLiteral(
            List<Double> values) {

        List<String> serialized =
                new ArrayList<>(
                        values.size());

        for (Double value :
                values) {

            if (value == null
                    || !Double.isFinite(
                            value)) {

                throw new InvalidRequestException(
                        "Embedding contains an invalid vector value.");
            }

            serialized.add(
                    Double.toString(
                            value));
        }

        return "["
                + String.join(
                        ",",
                        serialized)
                + "]";
    }
}
