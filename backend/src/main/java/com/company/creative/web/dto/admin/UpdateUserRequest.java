package com.company.creative.web.dto.admin;

import lombok.Data;

@Data
public class UpdateUserRequest {
    private String role;
    private Boolean activated;
}
