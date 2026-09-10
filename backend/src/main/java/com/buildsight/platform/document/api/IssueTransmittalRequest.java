package com.buildsight.platform.document.api;

import jakarta.validation.constraints.PositiveOrZero;

public record IssueTransmittalRequest(

        @PositiveOrZero
        long version) {
}
