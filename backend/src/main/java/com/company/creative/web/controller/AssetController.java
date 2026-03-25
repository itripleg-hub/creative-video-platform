package com.company.creative.web.controller;

import com.company.creative.mapper.AssetMapper;
import com.company.creative.security.UserPrincipal;
import com.company.creative.service.asset.AssetService;
import com.company.creative.web.dto.asset.AssetDto;
import com.company.creative.web.dto.asset.RegisterAssetRequest;
import com.company.creative.web.dto.asset.UploadUrlRequest;
import com.company.creative.web.dto.asset.UploadUrlResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;
    private final AssetMapper assetMapper;

    @PostMapping("/upload-url")
    public ResponseEntity<UploadUrlResponse> generateUploadUrl(
        @Valid @RequestBody UploadUrlRequest request
    ) {
        return ResponseEntity.ok(assetService.generateUploadUrl(request));
    }

    @PostMapping
    public ResponseEntity<AssetDto> registerAsset(
        @Valid @RequestBody RegisterAssetRequest request,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        var asset = assetService.registerAsset(request, principal.getId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(asset.getId()).toUri();
        return ResponseEntity.created(location).body(assetMapper.toDto(asset));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetDto> getAsset(
        @PathVariable Long id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return ResponseEntity.ok(assetMapper.toDto(assetService.getAsset(id, principal.getId(), isAdmin)));
    }
}
