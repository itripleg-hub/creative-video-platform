package com.company.creative.repository;

import com.company.creative.domain.ExecutionStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecutionStepRepository extends JpaRepository<ExecutionStep, Long> {

    List<ExecutionStep> findByJobExecutionIdOrderByIdAsc(Long jobExecutionId);
}
