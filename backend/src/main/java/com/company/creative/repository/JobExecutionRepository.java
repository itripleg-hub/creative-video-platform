package com.company.creative.repository;

import com.company.creative.domain.JobExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobExecutionRepository extends JpaRepository<JobExecution, Long> {

    List<JobExecution> findByJobIdOrderByExecutionNumberDesc(Long jobId);

    Optional<JobExecution> findByJobIdAndId(Long jobId, Long executionId);

    @Query("SELECT MAX(e.executionNumber) FROM JobExecution e WHERE e.job.id = :jobId")
    Optional<Integer> findMaxExecutionNumberByJobId(@Param("jobId") Long jobId);
}
