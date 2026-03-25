package com.company.creative.service.storage;

import com.company.creative.config.AppProperties;
import com.company.creative.web.dto.asset.UploadUrlResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
public class StorageService {

    private final S3Presigner s3Presigner;
    private final AppProperties appProperties;

    public StorageService(AppProperties appProperties) {
        this.appProperties = appProperties;
        AppProperties.StorageProperties storage = appProperties.getStorage();

        S3Presigner.Builder builder = S3Presigner.builder()
            .region(software.amazon.awssdk.regions.Region.of(storage.getRegion()));

        // Support custom endpoint (MinIO for local dev)
        if (storage.getEndpoint() != null && !storage.getEndpoint().isBlank()) {
            builder.endpointOverride(java.net.URI.create(storage.getEndpoint()));
        }

        this.s3Presigner = builder.build();
    }

    /**
     * Generate a presigned PUT URL for direct upload from client to S3.
     */
    public UploadUrlResponse generateUploadUrl(String filename, String contentType, String bucket) {
        String key = "uploads/" + UUID.randomUUID() + "/" + sanitize(filename);

        PutObjectRequest objectRequest = PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(contentType)
            .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofSeconds(appProperties.getStorage().getPresignedUrlExpirySeconds()))
            .putObjectRequest(objectRequest)
            .build();

        String presignedUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

        return UploadUrlResponse.builder()
            .uploadUrl(presignedUrl)
            .storagePath(bucket + "/" + key)
            .expiresInSeconds(appProperties.getStorage().getPresignedUrlExpirySeconds())
            .build();
    }

    /**
     * Generate a presigned GET URL for downloading a result.
     */
    public String generateDownloadUrl(String storagePath) {
        // storagePath format: "bucket/key/path"
        String[] parts = storagePath.split("/", 2);
        if (parts.length < 2) {
            throw new IllegalArgumentException("Invalid storage path: " + storagePath);
        }
        String bucket = parts[0];
        String key = parts[1];

        GetObjectRequest getRequest = GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofSeconds(appProperties.getStorage().getPresignedUrlExpirySeconds()))
            .getObjectRequest(getRequest)
            .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public String getInputBucket() {
        return appProperties.getStorage().getBucket().getInput();
    }

    public String getOutputBucket() {
        return appProperties.getStorage().getBucket().getOutput();
    }

    private String sanitize(String filename) {
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
