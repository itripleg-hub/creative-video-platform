package com.company.creative.service.job;

import com.company.creative.domain.*;
import com.company.creative.repository.*;
import com.company.creative.service.event.EventService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobExecutionService {

    private final JobRepository jobRepository;
    private final JobExecutionRepository jobExecutionRepository;
    private final ExecutionStepRepository executionStepRepository;
    private final EventService eventService;

    @Transactional
    public JobExecution createAndRunExecution(Long jobId, Map<String, Object> configSnapshot) {
        Job job = jobRepository.findById(jobId)
            .orElseThrow(() -> new EntityNotFoundException("Job not found: " + jobId));

        int nextNumber = jobExecutionRepository.findMaxExecutionNumberByJobId(jobId)
            .map(n -> n + 1)
            .orElse(1);

        JobExecution execution = JobExecution.builder()
            .job(job)
            .executionNumber(nextNumber)
            .status(ExecutionStatus.PENDING)
            .submittedConfigJson(configSnapshot)
            .build();
        execution = jobExecutionRepository.save(execution);

        // Create steps
        List<StepType> stepTypes = Arrays.asList(StepType.values());
        for (StepType stepType : stepTypes) {
            ExecutionStep step = ExecutionStep.builder()
                .jobExecution(execution)
                .stepType(stepType)
                .status(StepStatus.PENDING)
                .build();
            execution.getSteps().add(step);
        }
        execution = jobExecutionRepository.save(execution);

        // Update job status
        job.setStatus(JobStatus.RUNNING);
        jobRepository.save(job);

        eventService.publish(jobId, "execution.created", Map.of(
            "executionId", execution.getId(),
            "executionNumber", execution.getExecutionNumber(),
            "status", execution.getStatus().name()
        ));

        log.info("Created execution {} for job {}", execution.getId(), jobId);
        return execution;
    }

    @Transactional
    public JobExecution updateExecutionStatus(Long executionId, ExecutionStatus status, String errorMessage) {
        JobExecution execution = jobExecutionRepository.findById(executionId)
            .orElseThrow(() -> new EntityNotFoundException("Execution not found: " + executionId));

        execution.setStatus(status);
        if (errorMessage != null) {
            execution.setErrorMessage(errorMessage);
        }
        if (status == ExecutionStatus.RUNNING && execution.getStartedAt() == null) {
            execution.setStartedAt(Instant.now());
        }
        if (status == ExecutionStatus.COMPLETED || status == ExecutionStatus.FAILED
                || status == ExecutionStatus.CANCELLED) {
            execution.setFinishedAt(Instant.now());
            // Update parent job status
            Job job = execution.getJob();
            job.setStatus(mapExecutionStatusToJobStatus(status));
            jobRepository.save(job);
        }

        execution = jobExecutionRepository.save(execution);

        eventService.publish(execution.getJob().getId(), "execution.status", Map.of(
            "executionId", executionId,
            "status", status.name()
        ));

        return execution;
    }

    @Transactional
    public ExecutionStep updateStepStatus(Long stepId, StepStatus status,
                                          Map<String, Object> details, String errorMessage) {
        ExecutionStep step = executionStepRepository.findById(stepId)
            .orElseThrow(() -> new EntityNotFoundException("Step not found: " + stepId));

        step.setStatus(status);
        if (details != null) {
            step.setDetailsJson(details);
        }
        if (errorMessage != null) {
            step.setErrorMessage(errorMessage);
        }
        if (status == StepStatus.RUNNING && step.getStartedAt() == null) {
            step.setStartedAt(Instant.now());
        }
        if (status == StepStatus.COMPLETED || status == StepStatus.FAILED || status == StepStatus.SKIPPED) {
            step.setFinishedAt(Instant.now());
        }

        step = executionStepRepository.save(step);

        Long jobId = step.getJobExecution().getJob().getId();
        eventService.publish(jobId, "step.status", Map.of(
            "stepId", stepId,
            "stepType", step.getStepType().name(),
            "status", status.name()
        ));

        return step;
    }

    @Transactional(readOnly = true)
    public List<JobExecution> listExecutions(Long jobId, Long userId, boolean isAdmin) {
        // verify access
        Job job = jobRepository.findById(jobId)
            .orElseThrow(() -> new EntityNotFoundException("Job not found: " + jobId));
        if (!isAdmin && !job.getOwner().getId().equals(userId)) {
            throw new AccessDeniedException("Access denied to job: " + jobId);
        }
        return jobExecutionRepository.findByJobIdOrderByExecutionNumberDesc(jobId);
    }

    @Transactional(readOnly = true)
    public JobExecution getExecution(Long jobId, Long executionId) {
        return jobExecutionRepository.findByJobIdAndId(jobId, executionId)
            .orElseThrow(() -> new EntityNotFoundException("Execution not found: " + executionId));
    }

    @Transactional(readOnly = true)
    public List<ExecutionStep> listSteps(Long executionId) {
        return executionStepRepository.findByJobExecutionIdOrderByIdAsc(executionId);
    }

    @Transactional
    public ExecutionStep retryStep(Long jobId, Long executionId, Long stepId) {
        ExecutionStep step = executionStepRepository.findById(stepId)
            .orElseThrow(() -> new EntityNotFoundException("Step not found: " + stepId));
        if (step.getStatus() != StepStatus.FAILED) {
            throw new IllegalStateException("Can only retry failed steps");
        }
        step.setStatus(StepStatus.PENDING);
        step.setStartedAt(null);
        step.setFinishedAt(null);
        step.setErrorMessage(null);
        return executionStepRepository.save(step);
    }

    private JobStatus mapExecutionStatusToJobStatus(ExecutionStatus status) {
        return switch (status) {
            case COMPLETED -> JobStatus.COMPLETED;
            case FAILED -> JobStatus.FAILED;
            case CANCELLED -> JobStatus.CANCELLED;
            default -> JobStatus.RUNNING;
        };
    }
}
