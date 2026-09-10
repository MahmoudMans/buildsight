package com.buildsight.platform.ai.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiAskRequest(

        @NotBlank(
                message = "Question is required.")
        @Size(
                min = 3,
                max = 2000,
                message = "Question must contain between 3 and 2000 characters.")
        String question) {
}
