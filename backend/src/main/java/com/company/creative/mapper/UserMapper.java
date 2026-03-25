package com.company.creative.mapper;

import com.company.creative.domain.User;
import com.company.creative.web.dto.admin.UserAdminDto;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserAdminDto toAdminDto(User user);

    List<UserAdminDto> toAdminDtoList(List<User> users);
}
