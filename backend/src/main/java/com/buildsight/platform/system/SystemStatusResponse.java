package com.buildsight.platform.system;

import java.time.Instant;

public record SystemStatusResponse(
        String service,
        String status,
        String version,
        Instant timestamp) {
}
