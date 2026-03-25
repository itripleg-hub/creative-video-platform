package com.company.creative.mapper;

import com.company.creative.domain.LayerDefinition;
import com.company.creative.domain.Template;
import com.company.creative.domain.TemplateVersion;
import com.company.creative.web.dto.template.LayerDefinitionDto;
import com.company.creative.web.dto.template.TemplateDto;
import com.company.creative.web.dto.template.TemplateVersionDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface TemplateMapper {

    @Mapping(target = "createdById", source = "createdBy.id")
    TemplateDto toDto(Template template);

    @Mapping(target = "templateId", source = "template.id")
    TemplateVersionDto toVersionDto(TemplateVersion version);

    LayerDefinitionDto toLayerDto(LayerDefinition layer);

    List<TemplateDto> toDtoList(List<Template> templates);

    List<LayerDefinitionDto> toLayerDtoList(List<LayerDefinition> layers);
}
