package com.company.creative.web.dto.job;

import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
public class JobExecutionDto {
    private Long id;
    private Long jobId;
    private Integer executionNumber;
    private String status;
    private Map<String, Object> submittedConfigJson;
    private List<ExecutionStepDto> steps;
    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;
    private String errorMessage;
}
