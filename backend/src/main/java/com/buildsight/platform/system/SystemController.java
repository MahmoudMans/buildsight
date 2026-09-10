package com.buildsight.platform.system;

import java.time.Instant;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    @GetMapping("/status")
    public SystemStatusResponse status() {
        return new SystemStatusResponse(
                "BuildSight Backend",
                "UP",
                "0.1.0",
                Instant.now());
    }
}
