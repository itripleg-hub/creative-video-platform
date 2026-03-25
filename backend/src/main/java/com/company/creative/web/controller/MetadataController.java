package com.company.creative.web.controller;

import com.company.creative.config.AppProperties;
import com.company.creative.service.tts.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/meta")
@RequiredArgsConstructor
public class MetadataController {

    private final AppProperties appProperties;
    private final TtsService ttsService;

    @GetMapping("/languages")
    public ResponseEntity<List<AppProperties.MetadataProperties.LanguageEntry>> getLanguages() {
        return ResponseEntity.ok(appProperties.getMetadata().getSupportedLanguages());
    }

    @GetMapping("/aspect-ratios")
    public ResponseEntity<List<AppProperties.MetadataProperties.AspectRatioEntry>> getAspectRatios() {
        return ResponseEntity.ok(appProperties.getMetadata().getSupportedAspectRatios());
    }

    @GetMapping("/voices")
    public ResponseEntity<List<Map<String, Object>>> getVoices(
        @RequestParam(defaultValue = "default") String provider
    ) {
        return ResponseEntity.ok(ttsService.listVoices(provider));
    }

    @GetMapping("/fonts")
    public ResponseEntity<List<Map<String, Object>>> getFonts() {
        return ResponseEntity.ok(List.of(
            Map.of("id", "inter", "name", "Inter", "category", "sans-serif"),
            Map.of("id", "roboto", "name", "Roboto", "category", "sans-serif"),
            Map.of("id", "montserrat", "name", "Montserrat", "category", "sans-serif"),
            Map.of("id", "playfair", "name", "Playfair Display", "category", "serif"),
            Map.of("id", "oswald", "name", "Oswald", "category", "sans-serif")
        ));
    }
}
