package com.buildsight.platform.document.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.buildsight.platform.document.api.DocumentSearchResultResponse;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DocumentSearchService {

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    public DocumentSearchService(
            NamedParameterJdbcTemplate jdbcTemplate) {

        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<DocumentSearchResultResponse> search(
            UUID projectId,
            String query) {

        String normalized =
                query == null
                        ? ""
                        : query.trim();

        if (normalized.isBlank()) {
            return List.of();
        }

        String sql = """
                WITH search_query AS (
                    SELECT plainto_tsquery(
                        'simple',
                        :query
                    ) AS query
                )
                SELECT
                    result_type,
                    entity_id,
                    parent_id,
                    reference,
                    title,
                    snippet,
                    score
                FROM (
                    SELECT
                        'DOCUMENT' AS result_type,
                        dr.id AS entity_id,
                        d.id AS parent_id,
                        d.document_number AS reference,
                        d.title || ' · Rev ' || dr.revision_code AS title,
                        LEFT(
                            REGEXP_REPLACE(
                                dr.search_text,
                                '[[:space:]]+',
                                ' ',
                                'g'
                            ),
                            320
                        ) AS snippet,
                        ts_rank(
                            to_tsvector(
                                'simple',
                                dr.search_text
                            ),
                            search_query.query
                        ) AS score
                    FROM document_revisions dr
                    JOIN project_documents d
                      ON d.id = dr.document_id
                    CROSS JOIN search_query
                    WHERE d.project_id = :projectId
                      AND to_tsvector(
                            'simple',
                            dr.search_text
                          ) @@ search_query.query

                    UNION ALL

                    SELECT
                        'RFI' AS result_type,
                        r.id AS entity_id,
                        r.id AS parent_id,
                        r.reference AS reference,
                        r.subject AS title,
                        LEFT(
                            REGEXP_REPLACE(
                                r.search_text,
                                '[[:space:]]+',
                                ' ',
                                'g'
                            ),
                            320
                        ) AS snippet,
                        ts_rank(
                            to_tsvector(
                                'simple',
                                r.search_text
                            ),
                            search_query.query
                        ) AS score
                    FROM project_rfis r
                    CROSS JOIN search_query
                    WHERE r.project_id = :projectId
                      AND to_tsvector(
                            'simple',
                            r.search_text
                          ) @@ search_query.query
                ) results
                ORDER BY
                    score DESC,
                    reference ASC
                LIMIT 50
                """;

        return jdbcTemplate.query(
                sql,
                Map.of(
                        "query",
                        normalized,
                        "projectId",
                        projectId),
                (resultSet, rowNumber) ->
                        new DocumentSearchResultResponse(
                                resultSet.getString(
                                        "result_type"),
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class),
                                resultSet.getObject(
                                        "parent_id",
                                        UUID.class),
                                resultSet.getString(
                                        "reference"),
                                resultSet.getString(
                                        "title"),
                                resultSet.getString(
                                        "snippet"),
                                resultSet.getDouble(
                                        "score")));
    }
}
