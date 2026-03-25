package com.company.creative.domain;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "execution_steps")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_execution_id", nullable = false)
    private JobExecution jobExecution;

    @Enumerated(EnumType.STRING)
    @Column(name = "step_type", nullable = false, length = 100)
    private StepType stepType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StepStatus status;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    /**
     * Step-specific details: progress percentage, intermediate artifacts, etc.
     */
    @Type(JsonBinaryType.class)
    @Column(name = "details_json", columnDefinition = "jsonb")
    private Map<String, Object> detailsJson;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
