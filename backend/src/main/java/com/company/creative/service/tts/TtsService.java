package com.company.creative.service.tts;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Stub service for Text-to-Speech provider integration.
 * Implement generateSpeech() to call ElevenLabs, Azure TTS, etc.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TtsService {

    /**
     * Generate audio from text using the specified voice.
     *
     * @param text     text content to synthesize
     * @param voiceId  provider-specific voice identifier
     * @param provider TTS provider name (e.g. "elevenlabs", "azure")
     * @return storage path of the generated audio file, or null on failure
     */
    public String generateSpeech(String text, String voiceId, String provider) {
        log.info("TTS request: provider={}, voiceId={}, textLength={}", provider, voiceId, text.length());
        // TODO: implement provider-specific HTTP calls
        return "temp/tts/" + UUID.randomUUID() + ".mp3";
    }

    /**
     * List available voices from the configured provider.
     * Returns a list of voice metadata maps with at minimum "id" and "name" keys.
     */
    public List<Map<String, Object>> listVoices(String provider) {
        log.debug("Listing voices for provider: {}", provider);
        // TODO: call provider API
        return List.of(
            Map.of("id", "default", "name", "Default Voice", "provider", provider)
        );
    }
}
