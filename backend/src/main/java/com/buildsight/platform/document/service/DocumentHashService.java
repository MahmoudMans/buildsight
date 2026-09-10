package com.buildsight.platform.document.service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.stereotype.Service;

@Service
public class DocumentHashService {

    public String sha256(
            byte[] content) {

        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256");

            return HexFormat.of()
                    .formatHex(
                            digest.digest(
                                    content));

        } catch (NoSuchAlgorithmException exception) {

            throw new IllegalStateException(
                    "SHA-256 digest is unavailable.",
                    exception);
        }
    }
}
