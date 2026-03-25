package com.company.creative.web.dto.template;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class UpdateTemplateRequest {

    @NotBlank(message = "Template name is required")
    private String name;

    private String description;

    private String status;

    @NotEmpty(message = "At least one aspect ratio config is required")
    private List<Map<String, Object>> aspectRatioConfigs;

    private Map<String, Object> editorSettings;

    @Valid
    private List<LayerDefinitionDto> layerDefinitions;
}
