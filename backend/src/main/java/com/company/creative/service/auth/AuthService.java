package com.company.creative.service.auth;

import com.company.creative.config.AppProperties;
import com.company.creative.domain.RefreshToken;
import com.company.creative.domain.User;
import com.company.creative.repository.RefreshTokenRepository;
import com.company.creative.repository.UserRepository;
import com.company.creative.security.JwtService;
import com.company.creative.security.UserPrincipal;
import com.company.creative.web.dto.auth.AuthResponse;
import com.company.creative.web.dto.auth.LoginRequest;
import com.company.creative.web.dto.auth.RefreshRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new RuntimeException("User not found"));

        String accessToken = generateAccessToken(user);
        String rawRefreshToken = generateAndSaveRefreshToken(user);

        return buildAuthResponse(accessToken, rawRefreshToken, user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (refreshToken.isRevoked()) {
            throw new IllegalArgumentException("Refresh token has been revoked");
        }
        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Refresh token has expired");
        }

        // Rotate refresh token
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();
        String accessToken = generateAccessToken(user);
        String rawRefreshToken = generateAndSaveRefreshToken(user);

        return buildAuthResponse(accessToken, rawRefreshToken, user);
    }

    @Transactional
    public void logout(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new RuntimeException("User not found"));
        refreshTokenRepository.revokeAllByUser(user);
        log.info("Logged out user: {}", user.getEmail());
    }

    @Transactional
    public void changePassword(UserPrincipal principal, String currentPassword, String newPassword) {
        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        // Revoke all tokens after password change
        refreshTokenRepository.revokeAllByUser(user);
    }

    private String generateAccessToken(User user) {
        return jwtService.generateAccessToken(
            user.getEmail(),
            Map.of("userId", user.getId(), "role", user.getRole().name())
        );
    }

    private String generateAndSaveRefreshToken(User user) {
        byte[] tokenBytes = new byte[64];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        RefreshToken refreshToken = RefreshToken.builder()
            .user(user)
            .tokenHash(hashToken(rawToken))
            .expiresAt(Instant.now().plusMillis(appProperties.getJwt().getRefreshTokenExpiryMs()))
            .revoked(false)
            .build();
        refreshTokenRepository.save(refreshToken);
        return rawToken;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private AuthResponse buildAuthResponse(String accessToken, String rawRefreshToken, User user) {
        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(rawRefreshToken)
            .tokenType("Bearer")
            .expiresIn(appProperties.getJwt().getAccessTokenExpiryMs() / 1000)
            .user(AuthResponse.UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build())
            .build();
    }
}
