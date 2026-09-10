package com.buildsight.platform.document.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

import com.buildsight.platform.common.exception.InvalidRequestException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class LocalDocumentStorageService {

    private final HttpClient httpClient;

    private final String filerBaseUrl;

    public LocalDocumentStorageService(
            @Value(
                    "${buildsight.storage.filer-base-url:http://localhost:8888}")
            String filerBaseUrl) {

        this.filerBaseUrl =
                filerBaseUrl.replaceAll(
                        "/+$",
                        "");

        this.httpClient =
                HttpClient.newBuilder()
                        .connectTimeout(
                                Duration.ofSeconds(5))
                        .build();
    }

    public String upload(
            UUID projectId,
            UUID documentId,
            UUID revisionId,
            String originalFileName,
            String contentType,
            byte[] content) {

        String safeFileName =
                safeFileName(
                        originalFileName);

        String storagePath =
                "/buildsight/projects/"
                        + projectId
                        + "/documents/"
                        + documentId
                        + "/revisions/"
                        + revisionId
                        + "/"
                        + safeFileName;

        String boundary =
                "BuildSight"
                        + UUID.randomUUID()
                                .toString()
                                .replace(
                                        "-",
                                        "");

        try {
            ByteArrayOutputStream body =
                    new ByteArrayOutputStream();

            body.write(
                    ("--"
                            + boundary
                            + "\r\n")
                            .getBytes(
                                    StandardCharsets.UTF_8));

            body.write(
                    ("Content-Disposition: form-data; name=\"file\"; filename=\""
                            + safeFileName
                            + "\"\r\n")
                            .getBytes(
                                    StandardCharsets.UTF_8));

            body.write(
                    ("Content-Type: "
                            + normalizedContentType(
                                    contentType)
                            + "\r\n\r\n")
                            .getBytes(
                                    StandardCharsets.UTF_8));

            body.write(
                    content);

            body.write(
                    ("\r\n--"
                            + boundary
                            + "--\r\n")
                            .getBytes(
                                    StandardCharsets.UTF_8));

            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(
                                    URI.create(
                                            filerBaseUrl
                                                    + storagePath))
                            .timeout(
                                    Duration.ofSeconds(45))
                            .header(
                                    "Content-Type",
                                    "multipart/form-data; boundary="
                                            + boundary)
                            .POST(
                                    HttpRequest.BodyPublishers.ofByteArray(
                                            body.toByteArray()))
                            .build();

            HttpResponse<String> response =
                    httpClient.send(
                            request,
                            HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {

                throw new InvalidRequestException(
                        "SeaweedFS rejected the local file upload with HTTP status "
                                + response.statusCode()
                                + ".");
            }

            return storagePath;

        } catch (InterruptedException exception) {

            Thread.currentThread()
                    .interrupt();

            throw new InvalidRequestException(
                    "Local file upload was interrupted.");

        } catch (IOException exception) {

            throw new InvalidRequestException(
                    "BuildSight could not reach the local SeaweedFS filer at "
                            + filerBaseUrl
                            + ".");
        }
    }

    public byte[] download(
            String storagePath) {

        try {
            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(
                                    URI.create(
                                            filerBaseUrl
                                                    + storagePath))
                            .timeout(
                                    Duration.ofSeconds(45))
                            .GET()
                            .build();

            HttpResponse<byte[]> response =
                    httpClient.send(
                            request,
                            HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() != 200) {

                throw new InvalidRequestException(
                        "Stored document could not be retrieved from SeaweedFS.");
            }

            return response.body();

        } catch (InterruptedException exception) {

            Thread.currentThread()
                    .interrupt();

            throw new InvalidRequestException(
                    "Local file download was interrupted.");

        } catch (IOException exception) {

            throw new InvalidRequestException(
                    "BuildSight could not reach local document storage.");
        }
    }

    public void deleteQuietly(
            String storagePath) {

        try {
            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(
                                    URI.create(
                                            filerBaseUrl
                                                    + storagePath))
                            .timeout(
                                    Duration.ofSeconds(10))
                            .DELETE()
                            .build();

            httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.discarding());

        } catch (Exception ignored) {
            // Best-effort orphan cleanup.
        }
    }

    private String safeFileName(
            String fileName) {

        String candidate =
                fileName == null
                        ? "document.bin"
                        : fileName.trim();

        candidate =
                candidate.replaceAll(
                        "[^A-Za-z0-9._-]",
                        "_");

        if (candidate.isBlank()) {
            return "document.bin";
        }

        return candidate;
    }

    private String normalizedContentType(
            String contentType) {

        if (contentType == null
                || contentType.isBlank()) {

            return "application/octet-stream";
        }

        return contentType;
    }
}
