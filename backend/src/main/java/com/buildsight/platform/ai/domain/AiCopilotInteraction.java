package com.buildsight.platform.ai.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "ai_copilot_interactions")
public class AiCopilotInteraction {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "question",
            nullable = false,
            columnDefinition = "TEXT",
            updatable = false)
    private String question;

    @Column(
            name = "answer",
            nullable = false,
            columnDefinition = "TEXT",
            updatable = false)
    private String answer;

    @Column(
            name = "grounded",
            nullable = false,
            updatable = false)
    private boolean grounded;

    @Column(
            name = "chat_model",
            nullable = false,
            length = 160,
            updatable = false)
    private String chatModel;

    @Column(
            name = "embedding_model",
            nullable = false,
            length = 160,
            updatable = false)
    private String embeddingModel;

    @Column(
            name = "citation_references",
            nullable = false,
            columnDefinition = "TEXT",
            updatable = false)
    private String citationReferences;

    @Column(
            name = "source_count",
            nullable = false,
            updatable = false)
    private int sourceCount;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected AiCopilotInteraction() {
    }

    private AiCopilotInteraction(
            UUID id,
            UUID projectId,
            String question,
            String answer,
            boolean grounded,
            String chatModel,
            String embeddingModel,
            String citationReferences,
            int sourceCount) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.question =
                Objects.requireNonNull(question);

        this.answer =
                Objects.requireNonNull(answer);

        this.grounded =
                grounded;

        this.chatModel =
                Objects.requireNonNull(chatModel);

        this.embeddingModel =
                Objects.requireNonNull(embeddingModel);

        this.citationReferences =
                Objects.requireNonNull(citationReferences);

        this.sourceCount =
                sourceCount;
    }

    public static AiCopilotInteraction create(
            UUID id,
            UUID projectId,
            String question,
            String answer,
            boolean grounded,
            String chatModel,
            String embeddingModel,
            String citationReferences,
            int sourceCount) {

        return new AiCopilotInteraction(
                id,
                projectId,
                question,
                answer,
                grounded,
                chatModel,
                embeddingModel,
                citationReferences,
                sourceCount);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt =
                    Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getQuestion() {
        return question;
    }

    public String getAnswer() {
        return answer;
    }

    public boolean isGrounded() {
        return grounded;
    }

    public String getChatModel() {
        return chatModel;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public String getCitationReferences() {
        return citationReferences;
    }

    public int getSourceCount() {
        return sourceCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
