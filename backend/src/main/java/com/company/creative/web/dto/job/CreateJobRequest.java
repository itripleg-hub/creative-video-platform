package com.company.creative.web.dto.job;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateJobRequest {

    private String projectName;

    @NotNull(message = "templateId is required")
    private Long templateId;

    @NotNull(message = "templateVersion is required")
    private Integer templateVersion;

    @NotNull(message = "sourceVideoId is required")
    private Long sourceVideoId;

    @NotEmpty(message = "At least one language is required")
    private List<String> languages;

    @NotEmpty(message = "At least one aspect ratio is required")
    private List<String> aspectRatios;

    /**
     * Final layer values from the editor — key: layerId
     * Each entry contains: content, styleOverrides, visible
     */
    @NotEmpty(message = "layerValues is required")
    private Map<String, LayerValueDto> layerValues;

    private VoiceSettingsDto voiceSettings;
    private SubtitleSettingsDto subtitleSettings;
    private RenderOptionsDto renderOptions;

    @Data
    public static class LayerValueDto {
        private String text;
        private Boolean visible;
        private Boolean locked;
        private Map<String, Object> styleOverrides;
        private Map<String, Object> layoutOverrides;
        private Boolean translatable;
    }

    @Data
    public static class VoiceSettingsDto {
        private boolean enabled;
        private String voiceId;
        private String provider;
        private Float speechRate;
    }

    @Data
    public static class SubtitleSettingsDto {
        private boolean enabled;
        private Map<String, Object> style;
    }

    @Data
    public static class RenderOptionsDto {
        private String outputFormat;
        private Integer videoBitrate;
        private Integer audioBitrate;
        private Map<String, Object> extra;
    }
}
