package com.company.creative.domain;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "template_versions")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    @Column(nullable = false)
    private Integer version;

    /**
     * JSON array of aspect ratio configs:
     * [{"value":"16:9","width":1920,"height":1080}, ...]
     */
    @Type(JsonBinaryType.class)
    @Column(name = "aspect_ratio_configs", columnDefinition = "jsonb", nullable = false)
    private List<Map<String, Object>> aspectRatioConfigs;

    /**
     * Editor-level settings (grid, snap, reference resolution, etc.)
     */
    @Type(JsonBinaryType.class)
    @Column(name = "editor_settings", columnDefinition = "jsonb")
    private Map<String, Object> editorSettings;

    @OneToMany(mappedBy = "templateVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LayerDefinition> layerDefinitions = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
