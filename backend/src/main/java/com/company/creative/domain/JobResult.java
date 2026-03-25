package com.company.creative.domain;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "job_results")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_execution_id", nullable = false)
    private JobExecution jobExecution;

    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "aspect_ratio", nullable = false, length = 20)
    private String aspectRatio;

    @Column(name = "output_video_path", length = 2048)
    private String outputVideoPath;

    @Column(name = "thumbnail_path", length = 2048)
    private String thumbnailPath;

    /**
     * Output metadata: duration, resolution, file size, render time, etc.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "metadata_json", columnDefinition = "jsonb")
    private Map<String, Object> metadataJson;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
