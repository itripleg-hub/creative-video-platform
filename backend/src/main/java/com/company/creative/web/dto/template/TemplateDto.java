package com.company.creative.web.dto.template;

import lombok.Data;

import java.time.Instant;

@Data
public class TemplateDto {
    private Long id;
    private String name;
    private String description;
    private String status;
    private Long createdById;
    private Integer currentVersion;
    private Instant createdAt;
    private Instant updatedAt;
}
