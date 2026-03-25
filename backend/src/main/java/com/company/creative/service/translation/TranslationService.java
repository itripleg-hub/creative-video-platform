package com.company.creative.service.translation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Stub service for integrating with an OpenAI-compatible translation API.
 * Replace the translate() method body with actual HTTP client calls in production.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationService {

    /**
     * Translate a batch of text strings to the target language.
     *
     * @param texts          list of texts to translate
     * @param sourceLanguage BCP-47 source language code (e.g. "en")
     * @param targetLanguage BCP-47 target language code (e.g. "es")
     * @return map of original text -> translated text
     */
    public Map<String, String> translate(List<String> texts, String sourceLanguage, String targetLanguage) {
        log.info("Translating {} texts from {} to {}", texts.size(), sourceLanguage, targetLanguage);
        // TODO: integrate with OpenAI /v1/chat/completions or a dedicated translation API
        Map<String, String> result = new LinkedHashMap<>();
        for (String text : texts) {
            result.put(text, text);
        }
        return result;
    }

    /**
     * Translate a single text string.
     */
    public String translateText(String text, String sourceLanguage, String targetLanguage) {
        return translate(List.of(text), sourceLanguage, targetLanguage).get(text);
    }
}
