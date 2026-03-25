package com.company.creative.web.controller;

import com.company.creative.security.UserPrincipal;
import com.company.creative.service.auth.AuthService;
import com.company.creative.web.dto.auth.AuthResponse;
import com.company.creative.web.dto.auth.ChangePasswordRequest;
import com.company.creative.web.dto.auth.LoginRequest;
import com.company.creative.web.dto.auth.RefreshRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal UserPrincipal principal) {
        authService.logout(principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/account")
    public ResponseEntity<AuthResponse.UserDto> getAccount(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(AuthResponse.UserDto.builder()
            .id(principal.getId())
            .email(principal.getEmail())
            .role(principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", ""))
            .build());
    }

    @PostMapping("/account/change-password")
    public ResponseEntity<Void> changePassword(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changePassword(principal, request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.noContent().build();
    }
}
