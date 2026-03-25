package com.company.creative.service.template;

import com.company.creative.domain.*;
import com.company.creative.repository.LayerDefinitionRepository;
import com.company.creative.repository.TemplateRepository;
import com.company.creative.repository.TemplateVersionRepository;
import com.company.creative.repository.UserRepository;
import com.company.creative.web.dto.template.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateRepository templateRepository;
    private final TemplateVersionRepository templateVersionRepository;
    private final LayerDefinitionRepository layerDefinitionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<Template> findAll(TemplateStatus status, String search, Pageable pageable) {
        return templateRepository.search(status, search, pageable);
    }

    @Transactional(readOnly = true)
    public Template findById(Long id) {
        return templateRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Template not found: " + id));
    }

    @Transactional(readOnly = true)
    public TemplateVersion findVersion(Long templateId, Integer version) {
        return templateVersionRepository.findWithLayersByTemplateIdAndVersion(templateId, version)
            .orElseThrow(() -> new EntityNotFoundException(
                "Template version not found: " + templateId + " v" + version
            ));
    }

    @Transactional
    public Template create(CreateTemplateRequest request, Long userId) {
        User user = userRepository.getReferenceById(userId);

        Template template = Template.builder()
            .name(request.getName())
            .description(request.getDescription())
            .status(TemplateStatus.DRAFT)
            .createdBy(user)
            .currentVersion(1)
            .build();

        template = templateRepository.save(template);

        TemplateVersion version = buildVersion(template, 1, request.getAspectRatioConfigs(),
            request.getEditorSettings(), request.getLayerDefinitions());
        template.getVersions().add(version);

        log.info("Created template {} (id={}) by user {}", template.getName(), template.getId(), userId);
        return templateRepository.save(template);
    }

    @Transactional
    public Template update(Long templateId, UpdateTemplateRequest request, Long userId) {
        Template template = findById(templateId);

        template.setName(request.getName());
        template.setDescription(request.getDescription());

        if (request.getStatus() != null) {
            template.setStatus(TemplateStatus.valueOf(request.getStatus()));
        }

        int nextVersion = template.getCurrentVersion() + 1;
        template.setCurrentVersion(nextVersion);

        TemplateVersion version = buildVersion(template, nextVersion, request.getAspectRatioConfigs(),
            request.getEditorSettings(), request.getLayerDefinitions());
        template.getVersions().add(version);

        log.info("Updated template {} to version {}", templateId, nextVersion);
        return templateRepository.save(template);
    }

    @Transactional
    public Template clone(Long templateId, Long userId) {
        Template original = findById(templateId);
        User user = userRepository.getReferenceById(userId);

        // Load latest version with layers
        TemplateVersion latestVersion = templateVersionRepository
            .findWithLayersByTemplateIdAndVersion(templateId, original.getCurrentVersion())
            .orElseThrow(() -> new EntityNotFoundException("Template version not found"));

        Template cloned = Template.builder()
            .name(original.getName() + " (copy)")
            .description(original.getDescription())
            .status(TemplateStatus.DRAFT)
            .createdBy(user)
            .currentVersion(1)
            .build();
        cloned = templateRepository.save(cloned);

        // Clone version with layers
        List<LayerDefinitionDto> layerDtos = latestVersion.getLayerDefinitions()
            .stream()
            .map(this::toLayerDto)
            .toList();

        TemplateVersion clonedVersion = buildVersion(cloned, 1,
            latestVersion.getAspectRatioConfigs(),
            latestVersion.getEditorSettings(),
            layerDtos);
        cloned.getVersions().add(clonedVersion);

        log.info("Cloned template {} to new template {}", templateId, cloned.getId());
        return templateRepository.save(cloned);
    }

    @Transactional
    public void delete(Long templateId) {
        Template template = findById(templateId);
        template.setStatus(TemplateStatus.ARCHIVED);
        templateRepository.save(template);
        log.info("Archived template {}", templateId);
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    private TemplateVersion buildVersion(
        Template template,
        int versionNumber,
        List<java.util.Map<String, Object>> aspectRatioConfigs,
        java.util.Map<String, Object> editorSettings,
        List<LayerDefinitionDto> layerDtos
    ) {
        TemplateVersion version = TemplateVersion.builder()
            .template(template)
            .version(versionNumber)
            .aspectRatioConfigs(aspectRatioConfigs)
            .editorSettings(editorSettings)
            .layerDefinitions(new ArrayList<>())
            .build();

        if (layerDtos != null) {
            for (LayerDefinitionDto dto : layerDtos) {
                LayerDefinition layer = LayerDefinition.builder()
                    .templateVersion(version)
                    .layerId(dto.getLayerId())
                    .layerType(LayerType.valueOf(dto.getLayerType()))
                    .name(dto.getName())
                    .editable(dto.isEditable())
                    .translatable(dto.isTranslatable())
                    .visibleByDefault(dto.isVisibleByDefault())
                    .lockedByDefault(dto.isLockedByDefault())
                    .zIndex(dto.getZIndex())
                    .defaultStyleJson(dto.getDefaultStyleJson())
                    .layoutJson(dto.getLayoutJson())
                    .constraintsJson(dto.getConstraintsJson())
                    .aspectRatioOverrides(dto.getAspectRatioOverrides())
                    .build();
                version.getLayerDefinitions().add(layer);
            }
        }

        return version;
    }

    private LayerDefinitionDto toLayerDto(LayerDefinition layer) {
        LayerDefinitionDto dto = new LayerDefinitionDto();
        dto.setLayerId(layer.getLayerId());
        dto.setLayerType(layer.getLayerType().name());
        dto.setName(layer.getName());
        dto.setEditable(layer.isEditable());
        dto.setTranslatable(layer.isTranslatable());
        dto.setVisibleByDefault(layer.isVisibleByDefault());
        dto.setLockedByDefault(layer.isLockedByDefault());
        dto.setZIndex(layer.getZIndex());
        dto.setDefaultStyleJson(layer.getDefaultStyleJson());
        dto.setLayoutJson(layer.getLayoutJson());
        dto.setConstraintsJson(layer.getConstraintsJson());
        dto.setAspectRatioOverrides(layer.getAspectRatioOverrides());
        return dto;
    }
}
