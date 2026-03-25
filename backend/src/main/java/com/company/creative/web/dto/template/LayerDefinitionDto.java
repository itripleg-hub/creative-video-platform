package com.company.creative.web.dto.template;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class LayerDefinitionDto {

    private Long id;

    @NotBlank(message = "layerId is required")
    private String layerId;

    @NotBlank(message = "layerType is required")
    private String layerType;

    @NotBlank(message = "name is required")
    private String name;

    private boolean editable = true;
    private boolean translatable = false;
    private boolean visibleByDefault = true;
    private boolean lockedByDefault = false;
    private int zIndex = 0;

    private Map<String, Object> defaultStyleJson;
    private Map<String, Object> layoutJson;
    private Map<String, Object> constraintsJson;
    private Map<String, Object> aspectRatioOverrides;
}
