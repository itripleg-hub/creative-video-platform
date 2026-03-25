package com.company.creative.web.dto.asset;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RegisterAssetRequest {

    @NotBlank(message = "Storage path is required")
    private String storagePath;

    private String originalFilename;
    private String mimeType;
    private Long sizeBytes;
    private Long durationMs;
    private Integer width;
    private Integer height;
}
