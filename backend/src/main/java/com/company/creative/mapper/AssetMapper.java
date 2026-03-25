package com.company.creative.mapper;

import com.company.creative.domain.VideoAsset;
import com.company.creative.web.dto.asset.AssetDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AssetMapper {

    @Mapping(target = "ownerId", source = "owner.id")
    AssetDto toDto(VideoAsset asset);
}
