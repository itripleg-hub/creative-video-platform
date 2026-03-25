package com.company.creative.web.dto.asset;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UploadUrlResponse {
    private String uploadUrl;
    private String storagePath;
    private long expiresInSeconds;
}
