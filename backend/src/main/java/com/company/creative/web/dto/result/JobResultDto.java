package com.company.creative.web.dto.result;

import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
public class JobResultDto {
    private Long id;
    private Long jobExecutionId;
    private Long jobId;
    private String languageCode;
    private String aspectRatio;
    private String outputVideoPath;
    private String thumbnailPath;
    private Map<String, Object> metadataJson;
    private Instant createdAt;
    // Populated on-demand from storage service
    private String downloadUrl;
}
