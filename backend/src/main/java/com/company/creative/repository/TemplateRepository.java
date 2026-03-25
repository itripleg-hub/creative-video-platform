package com.company.creative.repository;

import com.company.creative.domain.Template;
import com.company.creative.domain.TemplateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TemplateRepository extends JpaRepository<Template, Long> {

    Page<Template> findByStatus(TemplateStatus status, Pageable pageable);

    @Query("SELECT t FROM Template t WHERE " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:search IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Template> search(
        @Param("status") TemplateStatus status,
        @Param("search") String search,
        Pageable pageable
    );
}
