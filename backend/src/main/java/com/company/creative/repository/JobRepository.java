package com.company.creative.repository;

import com.company.creative.domain.Job;
import com.company.creative.domain.JobStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JobRepository extends JpaRepository<Job, Long> {

    Page<Job> findByOwnerId(Long ownerId, Pageable pageable);

    Page<Job> findByOwnerIdAndStatus(Long ownerId, JobStatus status, Pageable pageable);

    @Query("SELECT j FROM Job j WHERE " +
           "(:ownerId IS NULL OR j.owner.id = :ownerId) AND " +
           "(:status IS NULL OR j.status = :status)")
    Page<Job> findByOwnerAndStatus(
        @Param("ownerId") Long ownerId,
        @Param("status") JobStatus status,
        Pageable pageable
    );
}
