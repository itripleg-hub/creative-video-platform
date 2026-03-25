package com.company.creative.web.dto.job;

import lombok.Data;

import java.time.Instant;

@Data
public class JobDto {
    private Long id;
    private String projectName;
    private Long ownerId;
    private Long templateId;
    private String templateName;
    private Integer templateVersion;
    private Long sourceVideoId;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
