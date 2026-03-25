package com.company.creative.service.admin;

import com.company.creative.domain.User;
import com.company.creative.domain.UserRole;
import com.company.creative.repository.UserRepository;
import com.company.creative.web.dto.admin.CreateUserRequest;
import com.company.creative.web.dto.admin.UpdateUserRequest;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Page<User> listUsers(Pageable pageable) {
        return userRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    @Transactional(readOnly = true)
    public User getUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
    }

    @Transactional
    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use: " + request.getEmail());
        }
        User user = User.builder()
            .email(request.getEmail())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .role(UserRole.valueOf(request.getRole().toUpperCase()))
            .activated(true)
            .build();
        user = userRepository.save(user);
        log.info("Admin created user {} ({})", user.getEmail(), user.getRole());
        return user;
    }

    @Transactional
    public User updateUser(Long userId, UpdateUserRequest request) {
        User user = getUser(userId);
        if (request.getRole() != null) {
            user.setRole(UserRole.valueOf(request.getRole().toUpperCase()));
        }
        if (request.getActivated() != null) {
            user.setActivated(request.getActivated());
        }
        user = userRepository.save(user);
        log.info("Admin updated user {}", userId);
        return user;
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = getUser(userId);
        userRepository.delete(user);
        log.info("Admin deleted user {}", userId);
    }
}
