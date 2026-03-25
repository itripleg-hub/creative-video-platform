package com.company.creative.domain;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.util.Map;

@Entity
@Table(name = "layer_definitions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LayerDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_version_id", nullable = false)
    private TemplateVersion templateVersion;

    /**
     * Unique identifier within a template version (e.g. "hero-title", "cta-button")
     */
    @Column(name = "layer_id", nullable = false, length = 255)
    private String layerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "layer_type", nullable = false, length = 50)
    private LayerType layerType;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    private boolean editable = true;

    @Column(nullable = false)
    private boolean translatable = false;

    @Column(name = "visible_by_default", nullable = false)
    private boolean visibleByDefault = true;

    @Column(name = "locked_by_default", nullable = false)
    private boolean lockedByDefault = false;

    @Column(name = "z_index", nullable = false)
    private int zIndex = 0;

    /**
     * Default style JSON: fontFamily, fontSize, textColor, etc.
     * See LAYER-MODEL.md for full TextStyle schema.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "default_style_json", columnDefinition = "jsonb")
    private Map<String, Object> defaultStyleJson;

    /**
     * Normalized layout JSON: {x, y, width, height, rotation, anchorPoint}
     */
    @Type(JsonBinaryType.class)
    @Column(name = "layout_json", columnDefinition = "jsonb")
    private Map<String, Object> layoutJson;

    /**
     * Constraints JSON: {maxLines, overflowBehavior, autoFit, safeArea}
     */
    @Type(JsonBinaryType.class)
    @Column(name = "constraints_json", columnDefinition = "jsonb")
    private Map<String, Object> constraintsJson;

    /**
     * Per-aspect-ratio layout/style overrides: {"16:9": {...}, "9:16": {...}}
     */
    @Type(JsonBinaryType.class)
    @Column(name = "aspect_ratio_overrides", columnDefinition = "jsonb")
    private Map<String, Object> aspectRatioOverrides;
}
