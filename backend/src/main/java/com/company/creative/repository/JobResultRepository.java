package com.company.creative.repository;

import com.company.creative.domain.JobResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobResultRepository extends JpaRepository<JobResult, Long> {

    List<JobResult> findByJobExecutionId(Long jobExecutionId);

    @Query("SELECT r FROM JobResult r WHERE r.jobExecution.job.id = :jobId ORDER BY r.createdAt DESC")
    List<JobResult> findByJobId(@Param("jobId") Long jobId);

    Optional<JobResult> findByIdAndJobExecutionJobId(Long id, Long jobId);
}
