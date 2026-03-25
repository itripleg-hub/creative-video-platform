package com.company.creative.web.controller;

import com.company.creative.security.UserPrincipal;
import com.company.creative.service.event.EventService;
import com.company.creative.service.job.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/jobs/{jobId}/events")
@RequiredArgsConstructor
public class SseController {

    private final EventService eventService;
    private final JobService jobService;

    @GetMapping(produces = "text/event-stream")
    public SseEmitter subscribe(
        @PathVariable Long jobId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        // Verify access
        jobService.getJob(jobId, principal.getId(), isAdmin);
        return eventService.subscribe(jobId);
    }
}
