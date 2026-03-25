package com.company.creative.web.dto.template;

import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
public class TemplateVersionDto {
    private Long id;
    private Long templateId;
    private Integer version;
    private List<Map<String, Object>> aspectRatioConfigs;
    private Map<String, Object> editorSettings;
    private List<LayerDefinitionDto> layerDefinitions;
    private Instant createdAt;
}
