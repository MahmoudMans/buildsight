package com.buildsight.platform.document.service;

import java.io.ByteArrayInputStream;

import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.springframework.stereotype.Service;

@Service
public class DocumentTextExtractionService {

    private static final int
            MAX_EXTRACTED_CHARACTERS =
            500_000;

    private final Tika tika =
            new Tika();

    public String extract(
            byte[] content,
            String fileName,
            String contentType) {

        try {
            Metadata metadata =
                    new Metadata();

            if (fileName != null) {
                metadata.set(
                        "resourceName",
                        fileName);
            }

            if (contentType != null
                    && !contentType.isBlank()) {

                metadata.set(
                        "Content-Type",
                        contentType);
            }

            String extracted =
                    tika.parseToString(
                            new ByteArrayInputStream(
                                    content),
                            metadata,
                            MAX_EXTRACTED_CHARACTERS);

            if (extracted == null) {
                return "";
            }

            return extracted
                    .replace('\u0000', ' ')
                    .trim();

        } catch (Exception exception) {

            /*
             * Unsupported/binary files remain valid controlled
             * documents. Their metadata is still searchable even
             * when textual extraction is unavailable.
             */
            return "";
        }
    }
}
