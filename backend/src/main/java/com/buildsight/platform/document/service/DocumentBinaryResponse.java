package com.buildsight.platform.document.service;

public record DocumentBinaryResponse(
        String fileName,
        String contentType,
        byte[] content) {
}
