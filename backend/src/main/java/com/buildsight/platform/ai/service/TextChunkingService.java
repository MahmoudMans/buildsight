package com.buildsight.platform.ai.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class TextChunkingService {

    private static final int
            MAX_CHARS =
            1400;

    private static final int
            MIN_BREAK_POSITION =
            850;

    private static final int
            OVERLAP_CHARS =
            180;

    public List<String> chunk(
            String input) {

        if (input == null
                || input.isBlank()) {

            return List.of();
        }

        String text =
                input
                        .replace('\u0000', ' ')
                        .replaceAll(
                                "[\\t\\r\\f]+",
                                " ")
                        .replaceAll(
                                " +",
                                " ")
                        .replaceAll(
                                "\\n{3,}",
                                "\n\n")
                        .trim();

        if (text.length()
                <= MAX_CHARS) {

            return List.of(
                    text);
        }

        List<String> chunks =
                new ArrayList<>();

        int start =
                0;

        while (start
                < text.length()) {

            int hardEnd =
                    Math.min(
                            text.length(),
                            start
                                    + MAX_CHARS);

            int end =
                    hardEnd;

            if (hardEnd
                    < text.length()) {

                int breakPosition =
                        text.lastIndexOf(
                                ' ',
                                hardEnd);

                if (breakPosition
                        >= start
                        + MIN_BREAK_POSITION) {

                    end =
                            breakPosition;
                }
            }

            String chunk =
                    text.substring(
                                    start,
                                    end)
                            .trim();

            if (!chunk.isBlank()) {
                chunks.add(
                        chunk);
            }

            if (end
                    >= text.length()) {

                break;
            }

            int nextStart =
                    Math.max(
                            start + 1,
                            end
                                    - OVERLAP_CHARS);

            while (nextStart
                    < end
                    && nextStart
                            < text.length()
                    && !Character.isWhitespace(
                            text.charAt(
                                    nextStart))) {

                nextStart++;
            }

            start =
                    Math.min(
                            nextStart,
                            text.length());
        }

        return List.copyOf(
                chunks);
    }
}
