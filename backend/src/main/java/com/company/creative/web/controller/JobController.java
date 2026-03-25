package com.company.creative.web.controller;

import com.company.creative.domain.Job;
import com.company.creative.domain.JobStatus;
import com.company.creative.mapper.JobMapper;
import com.company.creative.security.UserPrincipal;
import com.company.creative.service.job.JobService;
import com.company.creative.web.dto.job.CreateJobRequest;
import com.company.creative.web.dto.job.JobDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;
    private final JobMapper jobMapper;

    @PostMapping
    public ResponseEntity<JobDto> createJob(
        @Valid @RequestBody CreateJobRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        Job job = jobService.createJob(request, principal.getId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(job.getId()).toUri();
        return ResponseEntity.created(location).body(jobMapper.toDto(job));
    }

    @GetMapping
    public ResponseEntity<Page<JobDto>> listJobs(
        @RequestParam(required = false) String status,
        @AuthenticationPrincipal UserPrincipal principal,
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        JobStatus jobStatus = (status != null) ? JobStatus.valueOf(status.toUpperCase()) : null;
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        Long ownerId = isAdmin ? null : principal.getId();
        Page<Job> jobs = jobService.listJobs(ownerId, jobStatus, pageable);
        return ResponseEntity.ok(jobs.map(jobMapper::toDto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobDto> getJob(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(jobMapper.toDto(jobService.getJob(id, principal.getId(), isAdmin)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteJob(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        jobService.deleteJob(id, principal.getId(), isAdmin);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<JobDto> cancelJob(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(jobMapper.toDto(jobService.cancelJob(id, principal.getId(), isAdmin)));
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<JobDto> retryJob(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(jobMapper.toDto(jobService.retryJob(id, principal.getId(), isAdmin)));
    }
}
