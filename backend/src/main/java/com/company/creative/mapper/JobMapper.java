package com.company.creative.mapper;

import com.company.creative.domain.ExecutionStep;
import com.company.creative.domain.Job;
import com.company.creative.domain.JobExecution;
import com.company.creative.domain.JobResult;
import com.company.creative.web.dto.job.ExecutionStepDto;
import com.company.creative.web.dto.job.JobDto;
import com.company.creative.web.dto.job.JobExecutionDto;
import com.company.creative.web.dto.result.JobResultDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface JobMapper {

    @Mapping(target = "ownerId", source = "owner.id")
    @Mapping(target = "templateId", source = "template.id")
    @Mapping(target = "templateName", source = "template.name")
    @Mapping(target = "templateVersion", source = "templateVersion.version")
    @Mapping(target = "sourceVideoId", source = "sourceVideo.id")
    JobDto toDto(Job job);

    @Mapping(target = "jobId", source = "job.id")
    @Mapping(target = "steps", source = "steps")
    JobExecutionDto toExecutionDto(JobExecution execution);

    @Mapping(target = "jobExecutionId", source = "jobExecution.id")
    ExecutionStepDto toStepDto(ExecutionStep step);

    @Mapping(target = "jobExecutionId", source = "jobExecution.id")
    @Mapping(target = "jobId", source = "jobExecution.job.id")
    @Mapping(target = "downloadUrl", ignore = true)
    JobResultDto toResultDto(JobResult result);

    List<JobDto> toDtoList(List<Job> jobs);
    List<JobExecutionDto> toExecutionDtoList(List<JobExecution> executions);
    List<ExecutionStepDto> toStepDtoList(List<ExecutionStep> steps);
    List<JobResultDto> toResultDtoList(List<JobResult> results);
}
