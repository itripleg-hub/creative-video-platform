package com.company.creative.web.dto.asset;

import lombok.Data;

import java.time.Instant;

@Data
public class AssetDto {
    private Long id;
    private Long ownerId;
    private String storagePath;
    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;
    private Long durationMs;
    private Integer width;
    private Integer height;
    private Instant createdAt;
}
