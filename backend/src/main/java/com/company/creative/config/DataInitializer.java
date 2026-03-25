package com.company.creative.config;

import com.company.creative.domain.User;
import com.company.creative.domain.UserRole;
import com.company.creative.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    CommandLineRunner initData(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByEmail("admin@localhost.com").isEmpty()) {
                User admin = new User();
                admin.setEmail("admin@localhost.com");
                admin.setPasswordHash(passwordEncoder.encode("admin!"));
                admin.setRole(UserRole.ADMIN);
                admin.setActivated(true);
                userRepository.save(admin);
                log.info("Created default admin user: admin@localhost.com");
            } else {
                log.info("Admin user already exists, skipping seed");
            }
        };
    }
}
