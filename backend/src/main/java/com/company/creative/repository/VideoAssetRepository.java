package com.company.creative.repository;

import com.company.creative.domain.VideoAsset;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VideoAssetRepository extends JpaRepository<VideoAsset, Long> {

    Page<VideoAsset> findByOwnerId(Long ownerId, Pageable pageable);
}
