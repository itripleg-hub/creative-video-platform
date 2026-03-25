package com.company.creative.web.controller;

import com.company.creative.mapper.JobMapper;
import com.company.creative.security.UserPrincipal;
import com.company.creative.service.job.JobExecutionService;
import com.company.creative.web.dto.job.ExecutionStepDto;
import com.company.creative.web.dto.job.JobExecutionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs/{jobId}/executions")
@RequiredArgsConstructor
public class JobExecutionController {

    private final JobExecutionService jobExecutionService;
    private final JobMapper jobMapper;

    @GetMapping
    public ResponseEntity<List<JobExecutionDto>> listExecutions(
        @PathVariable Long jobId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        var executions = jobExecutionService.listExecutions(jobId, principal.getId(), isAdmin);
        return ResponseEntity.ok(jobMapper.toExecutionDtoList(executions));
    }

    @GetMapping("/{executionId}")
    public ResponseEntity<JobExecutionDto> getExecution(
        @PathVariable Long jobId,
        @PathVariable Long executionId
    ) {
        return ResponseEntity.ok(jobMapper.toExecutionDto(jobExecutionService.getExecution(jobId, executionId)));
    }

    @GetMapping("/{executionId}/steps")
    public ResponseEntity<List<ExecutionStepDto>> listSteps(
        @PathVariable Long jobId,
        @PathVariable Long executionId
    ) {
        var steps = jobExecutionService.listSteps(executionId);
        return ResponseEntity.ok(jobMapper.toStepDtoList(steps));
    }

    @PostMapping("/{executionId}/steps/{stepId}/retry")
    public ResponseEntity<ExecutionStepDto> retryStep(
        @PathVariable Long jobId,
        @PathVariable Long executionId,
        @PathVariable Long stepId
    ) {
        return ResponseEntity.ok(jobMapper.toStepDto(
            jobExecutionService.retryStep(jobId, executionId, stepId)
        ));
    }
}
