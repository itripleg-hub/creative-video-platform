package com.company.creative.repository;

import com.company.creative.domain.LayerDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LayerDefinitionRepository extends JpaRepository<LayerDefinition, Long> {

    List<LayerDefinition> findByTemplateVersionIdOrderByZIndexAsc(Long templateVersionId);

    void deleteByTemplateVersionId(Long templateVersionId);
}
