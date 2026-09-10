package com.buildsight.platform.project.api;

import java.util.List;

public record ProjectCommandCenterResponse(
        ProjectResponse project,
        ProjectHealthScoreResponse health,
        List<MilestoneResponse> milestones,
        List<ProgressUpdateResponse> progressUpdates) {
}
