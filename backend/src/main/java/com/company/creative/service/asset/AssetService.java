package com.company.creative.service.asset;

import com.company.creative.domain.User;
import com.company.creative.domain.VideoAsset;
import com.company.creative.repository.UserRepository;
import com.company.creative.repository.VideoAssetRepository;
import com.company.creative.service.storage.StorageService;
import com.company.creative.web.dto.asset.RegisterAssetRequest;
import com.company.creative.web.dto.asset.UploadUrlRequest;
import com.company.creative.web.dto.asset.UploadUrlResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final VideoAssetRepository videoAssetRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    public UploadUrlResponse generateUploadUrl(UploadUrlRequest request) {
        return storageService.generateUploadUrl(
            request.getFilename(),
            request.getContentType(),
            storageService.getInputBucket()
        );
    }

    @Transactional
    public VideoAsset registerAsset(RegisterAssetRequest request, Long userId) {
        User owner = userRepository.getReferenceById(userId);
        VideoAsset asset = VideoAsset.builder()
            .owner(owner)
            .storagePath(request.getStoragePath())
            .originalFilename(request.getOriginalFilename())
            .mimeType(request.getMimeType())
            .sizeBytes(request.getSizeBytes())
            .durationMs(request.getDurationMs())
            .width(request.getWidth())
            .height(request.getHeight())
            .build();
        asset = videoAssetRepository.save(asset);
        log.info("Registered asset {} for user {}", asset.getId(), userId);
        return asset;
    }

    @Transactional(readOnly = true)
    public VideoAsset getAsset(Long assetId, Long userId, boolean isAdmin) {
        VideoAsset asset = videoAssetRepository.findById(assetId)
            .orElseThrow(() -> new EntityNotFoundException("Asset not found: " + assetId));
        if (!isAdmin && !asset.getOwner().getId().equals(userId)) {
            throw new AccessDeniedException("Access denied to asset: " + assetId);
        }
        return asset;
    }
}
