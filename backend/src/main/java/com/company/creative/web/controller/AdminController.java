package com.company.creative.web.controller;

import com.company.creative.mapper.UserMapper;
import com.company.creative.service.admin.AdminService;
import com.company.creative.web.dto.admin.CreateUserRequest;
import com.company.creative.web.dto.admin.UpdateUserRequest;
import com.company.creative.web.dto.admin.UserAdminDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final UserMapper userMapper;

    @GetMapping
    public ResponseEntity<Page<UserAdminDto>> listUsers(
        @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(adminService.listUsers(pageable).map(userMapper::toAdminDto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserAdminDto> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userMapper.toAdminDto(adminService.getUser(id)));
    }

    @PostMapping
    public ResponseEntity<UserAdminDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        var user = adminService.createUser(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(user.getId()).toUri();
        return ResponseEntity.created(location).body(userMapper.toAdminDto(user));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserAdminDto> updateUser(
        @PathVariable Long id,
        @RequestBody UpdateUserRequest request
    ) {
        return ResponseEntity.ok(userMapper.toAdminDto(adminService.updateUser(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
