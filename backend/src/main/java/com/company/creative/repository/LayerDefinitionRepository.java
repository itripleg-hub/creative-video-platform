package com.company.creative.repository;

import com.company.creative.domain.LayerDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LayerDefinitionRepository extends JpaRepository<LayerDefinition, Long> {

    @Query("SELECT ld FROM LayerDefinition ld WHERE ld.templateVersion.id = :templateVersionId ORDER BY ld.zIndex ASC")
    List<LayerDefinition> findByTemplateVersionIdOrderByZIndexAsc(@Param("templateVersionId") Long templateVersionId);

    void deleteByTemplateVersionId(Long templateVersionId);
}
