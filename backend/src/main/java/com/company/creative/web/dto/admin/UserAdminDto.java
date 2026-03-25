package com.company.creative.web.dto.admin;

import lombok.Data;

import java.time.Instant;

@Data
public class UserAdminDto {
    private Long id;
    private String email;
    private String role;
    private boolean activated;
    private Instant createdAt;
    private Instant updatedAt;
}
