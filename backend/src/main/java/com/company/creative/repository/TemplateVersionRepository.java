package com.company.creative.repository;

import com.company.creative.domain.TemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, Long> {

    Optional<TemplateVersion> findByTemplateIdAndVersion(Long templateId, Integer version);

    List<TemplateVersion> findByTemplateIdOrderByVersionDesc(Long templateId);

    @Query("SELECT tv FROM TemplateVersion tv " +
           "JOIN FETCH tv.layerDefinitions " +
           "WHERE tv.template.id = :templateId AND tv.version = :version")
    Optional<TemplateVersion> findWithLayersByTemplateIdAndVersion(
        @Param("templateId") Long templateId,
        @Param("version") Integer version
    );
}
