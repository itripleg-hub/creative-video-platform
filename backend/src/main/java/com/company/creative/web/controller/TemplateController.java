package com.company.creative.web.controller;

import com.company.creative.domain.Template;
import com.company.creative.domain.TemplateStatus;
import com.company.creative.domain.TemplateVersion;
import com.company.creative.mapper.TemplateMapper;
import com.company.creative.security.UserPrincipal;
import com.company.creative.service.template.TemplateService;
import com.company.creative.web.dto.template.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;
    private final TemplateMapper templateMapper;

    @GetMapping
    public ResponseEntity<Page<TemplateDto>> listTemplates(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String search,
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        TemplateStatus templateStatus = (status != null) ? TemplateStatus.valueOf(status.toUpperCase()) : null;
        Page<Template> templates = templateService.findAll(templateStatus, search, pageable);
        return ResponseEntity.ok(templates.map(templateMapper::toDto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateDto> getTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateMapper.toDto(templateService.findById(id)));
    }

    @PostMapping
    public ResponseEntity<TemplateDto> createTemplate(
        @Valid @RequestBody CreateTemplateRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        Template template = templateService.create(request, principal.getId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(template.getId()).toUri();
        return ResponseEntity.created(location).body(templateMapper.toDto(template));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TemplateDto> updateTemplate(
        @PathVariable Long id,
        @Valid @RequestBody UpdateTemplateRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        Template template = templateService.update(id, request, principal.getId());
        return ResponseEntity.ok(templateMapper.toDto(template));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        templateService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<TemplateDto> cloneTemplate(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        Template cloned = templateService.clone(id, principal.getId());
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
            .path("/api/templates/{id}").buildAndExpand(cloned.getId()).toUri();
        return ResponseEntity.created(location).body(templateMapper.toDto(cloned));
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<TemplateVersionDto>> listVersions(@PathVariable Long id) {
        Template template = templateService.findById(id);
        List<TemplateVersionDto> versions = template.getVersions()
            .stream()
            .map(templateMapper::toVersionDto)
            .toList();
        return ResponseEntity.ok(versions);
    }

    @GetMapping("/{id}/versions/{version}")
    public ResponseEntity<TemplateVersionDto> getVersion(
        @PathVariable Long id,
        @PathVariable Integer version
    ) {
        TemplateVersion tv = templateService.findVersion(id, version);
        return ResponseEntity.ok(templateMapper.toVersionDto(tv));
    }
}
