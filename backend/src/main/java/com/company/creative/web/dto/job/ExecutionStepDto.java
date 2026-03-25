package com.company.creative.web.dto.job;

import lombok.Data;

import java.time.Instant;
import java.util.Map;

@Data
public class ExecutionStepDto {
    private Long id;
    private Long jobExecutionId;
    private String stepType;
    private String status;
    private Map<String, Object> detailsJson;
    private Instant startedAt;
    private Instant finishedAt;
    private String errorMessage;
}
