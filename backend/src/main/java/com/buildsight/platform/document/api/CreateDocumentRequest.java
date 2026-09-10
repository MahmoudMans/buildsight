package com.buildsight.platform.document.api;

import com.buildsight.platform.document.domain.DocumentDiscipline;
import com.buildsight.platform.document.domain.DocumentType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateDocumentRequest(

        @NotBlank
        @Size(max = 80)
        String documentNumber,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        DocumentType documentType,

        @NotNull
        DocumentDiscipline discipline,

        @Size(max = 160)
        String ownerName) {
}
