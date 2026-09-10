package com.buildsight.platform.ai.service;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

@Service
public class AiCitationGuard {

    private static final Pattern CITATION_PATTERN =
            Pattern.compile(
                    "\\[S\\d+\\]");

    public boolean isGrounded(
            String answer,
            Set<String> allowedCitations) {

        if (answer == null
                || answer.isBlank()
                || allowedCitations.isEmpty()) {

            return false;
        }

        Matcher matcher =
                CITATION_PATTERN.matcher(
                        answer);

        Set<String> found =
                new HashSet<>();

        while (matcher.find()) {

            String citation =
                    matcher.group();

            if (!allowedCitations.contains(
                    citation)) {

                return false;
            }

            found.add(
                    citation);
        }

        return !found.isEmpty();
    }
}
