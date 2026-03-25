package com.company.creative.service.job;

import com.company.creative.domain.*;
import com.company.creative.repository.*;
import com.company.creative.web.dto.job.CreateJobRequest;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final JobExecutionRepository jobExecutionRepository;
    private final UserRepository userRepository;
    private final TemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final VideoAssetRepository videoAssetRepository;
    private final JobExecutionService jobExecutionService;

    @Transactional
    public Job createJob(CreateJobRequest request, Long userId) {
        User owner = userRepository.getReferenceById(userId);
        Template template = templateRepository.findById(request.getTemplateId())
            .orElseThrow(() -> new EntityNotFoundException("Template not found: " + request.getTemplateId()));
        TemplateVersion version = templateVersionRepository
            .findWithLayersByTemplateIdAndVersion(request.getTemplateId(), request.getTemplateVersion())
            .orElseThrow(() -> new EntityNotFoundException("Template version not found"));
        VideoAsset sourceVideo = videoAssetRepository.findById(request.getSourceVideoId())
            .orElseThrow(() -> new EntityNotFoundException("Video asset not found: " + request.getSourceVideoId()));

        Job job = Job.builder()
            .owner(owner)
            .template(template)
            .templateVersion(version)
            .sourceVideo(sourceVideo)
            .projectName(request.getProjectName())
            .status(JobStatus.PENDING)
            .build();
        job = jobRepository.save(job);

        Map<String, Object> configSnapshot = buildConfigSnapshot(request, template, version, sourceVideo);

        log.info("Created job {} for user {}", job.getId(), userId);
        dispatchExecution(job.getId(), configSnapshot);
        return job;
    }

    @Transactional(readOnly = true)
    public Page<Job> listJobs(Long userId, JobStatus status, Pageable pageable) {
        return jobRepository.findByOwnerAndStatus(userId, status, pageable);
    }

    @Transactional(readOnly = true)
    public Job getJob(Long jobId, Long userId, boolean isAdmin) {
        Job job = jobRepository.findById(jobId)
            .orElseThrow(() -> new EntityNotFoundException("Job not found: " + jobId));
        if (!isAdmin && !job.getOwner().getId().equals(userId)) {
            throw new AccessDeniedException("Access denied to job: " + jobId);
        }
        return job;
    }

    @Transactional
    public void deleteJob(Long jobId, Long userId, boolean isAdmin) {
        Job job = getJob(jobId, userId, isAdmin);
        if (job.getStatus() == JobStatus.RUNNING) {
            throw new IllegalStateException("Cannot delete a running job");
        }
        jobRepository.delete(job);
        log.info("Deleted job {}", jobId);
    }

    @Transactional
    public Job cancelJob(Long jobId, Long userId, boolean isAdmin) {
        Job job = getJob(jobId, userId, isAdmin);
        if (job.getStatus() != JobStatus.RUNNING && job.getStatus() != JobStatus.PENDING) {
            throw new IllegalStateException("Job cannot be cancelled in status: " + job.getStatus());
        }
        job.setStatus(JobStatus.CANCELLED);
        job = jobRepository.save(job);
        log.info("Cancelled job {}", jobId);
        return job;
    }

    @Transactional
    public Job retryJob(Long jobId, Long userId, boolean isAdmin) {
        Job job = getJob(jobId, userId, isAdmin);
        if (job.getStatus() != JobStatus.FAILED && job.getStatus() != JobStatus.CANCELLED) {
            throw new IllegalStateException("Job cannot be retried in status: " + job.getStatus());
        }
        job.setStatus(JobStatus.PENDING);
        job = jobRepository.save(job);

        JobExecution latestExecution = jobExecutionRepository
            .findByJobIdOrderByExecutionNumberDesc(jobId)
            .stream().findFirst()
            .orElseThrow(() -> new IllegalStateException("No execution found for retry"));

        dispatchExecution(job.getId(), latestExecution.getSubmittedConfigJson());
        log.info("Retrying job {}", jobId);
        return job;
    }

    @Async
    public void dispatchExecution(Long jobId, Map<String, Object> configSnapshot) {
        try {
            jobExecutionService.createAndRunExecution(jobId, configSnapshot);
        } catch (Exception e) {
            log.error("Failed to dispatch execution for job {}", jobId, e);
        }
    }

    private Map<String, Object> buildConfigSnapshot(
        CreateJobRequest request,
        Template template,
        TemplateVersion version,
        VideoAsset sourceVideo
    ) {
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("templateId", template.getId());
        snapshot.put("templateName", template.getName());
        snapshot.put("templateVersionNumber", version.getVersion());
        snapshot.put("sourceVideoId", sourceVideo.getId());
        snapshot.put("sourceVideoPath", sourceVideo.getStoragePath());
        snapshot.put("languages", request.getLanguages());
        snapshot.put("aspectRatios", request.getAspectRatios());
        snapshot.put("layerValues", request.getLayerValues());
        if (request.getVoiceSettings() != null) {
            snapshot.put("voiceSettings", request.getVoiceSettings());
        }
        if (request.getSubtitleSettings() != null) {
            snapshot.put("subtitleSettings", request.getSubtitleSettings());
        }
        if (request.getRenderOptions() != null) {
            snapshot.put("renderOptions", request.getRenderOptions());
        }
        return snapshot;
    }
}
