package com.company.creative.web.controller;

import com.company.creative.domain.JobResult;
import com.company.creative.mapper.JobMapper;
import com.company.creative.repository.JobResultRepository;
import com.company.creative.security.UserPrincipal;
import com.company.creative.service.job.JobService;
import com.company.creative.service.storage.StorageService;
import com.company.creative.web.dto.result.JobResultDto;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs/{jobId}/results")
@RequiredArgsConstructor
public class ResultController {

    private final JobResultRepository jobResultRepository;
    private final JobService jobService;
    private final JobMapper jobMapper;
    private final StorageService storageService;

    @GetMapping
    public ResponseEntity<List<JobResultDto>> listResults(
        @PathVariable Long jobId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        jobService.getJob(jobId, principal.getId(), isAdmin);
        List<JobResult> results = jobResultRepository.findByJobId(jobId);
        return ResponseEntity.ok(jobMapper.toResultDtoList(results));
    }

    @GetMapping("/{resultId}")
    public ResponseEntity<JobResultDto> getResult(
        @PathVariable Long jobId,
        @PathVariable Long resultId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        jobService.getJob(jobId, principal.getId(), isAdmin);
        JobResult result = jobResultRepository.findByIdAndJobExecutionJobId(resultId, jobId)
            .orElseThrow(() -> new EntityNotFoundException("Result not found: " + resultId));
        return ResponseEntity.ok(jobMapper.toResultDto(result));
    }

    @GetMapping("/{resultId}/download")
    public ResponseEntity<JobResultDto> downloadResult(
        @PathVariable Long jobId,
        @PathVariable Long resultId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        jobService.getJob(jobId, principal.getId(), isAdmin);
        JobResult result = jobResultRepository.findByIdAndJobExecutionJobId(resultId, jobId)
            .orElseThrow(() -> new EntityNotFoundException("Result not found: " + resultId));

        JobResultDto dto = jobMapper.toResultDto(result);
        if (result.getOutputVideoPath() != null) {
            dto.setDownloadUrl(storageService.generateDownloadUrl(result.getOutputVideoPath()));
        }
        return ResponseEntity.ok(dto);
    }
}
