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
@Table(name = "job_executions")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "execution_number", nullable = false)
    private Integer executionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ExecutionStatus status;

    /**
     * Immutable snapshot of everything needed to reproduce this render:
     * template config, resolved layer values, per-language text, voice/subtitle settings, etc.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "submitted_config_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> submittedConfigJson;

    @OneToMany(mappedBy = "jobExecution", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<ExecutionStep> steps = new ArrayList<>();

    @OneToMany(mappedBy = "jobExecution", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<JobResult> results = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
