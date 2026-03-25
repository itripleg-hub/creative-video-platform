package com.company.creative.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private JwtProperties jwt = new JwtProperties();
    private CorsProperties cors = new CorsProperties();
    private StorageProperties storage = new StorageProperties();
    private MetadataProperties metadata = new MetadataProperties();

    @Data
    public static class JwtProperties {
        private String secret;
        private long accessTokenExpiryMs = 900_000L;
        private long refreshTokenExpiryMs = 604_800_000L;
    }

    @Data
    public static class CorsProperties {
        private List<String> allowedOrigins = List.of("http://localhost:3000");
        private String allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
        private String allowedHeaders = "*";
        private long maxAge = 3600;
    }

    @Data
    public static class StorageProperties {
        private String type = "s3";
        private BucketProperties bucket = new BucketProperties();
        private long presignedUrlExpirySeconds = 3600;
        private String region = "us-east-1";
        private String endpoint;

        @Data
        public static class BucketProperties {
            private String input = "creative-input";
            private String output = "creative-output";
            private String temp = "creative-temp";
        }
    }

    @Data
    public static class MetadataProperties {
        private List<LanguageEntry> supportedLanguages = List.of();
        private List<AspectRatioEntry> supportedAspectRatios = List.of();

        @Data
        public static class LanguageEntry {
            private String code;
            private String name;
        }

        @Data
        public static class AspectRatioEntry {
            private String value;
            private int width;
            private int height;
        }
    }
}
