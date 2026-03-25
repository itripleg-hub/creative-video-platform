import { useQuery } from '@tanstack/react-query';
import { metadataApi } from '@/shared/api/metadata';

export const metaKeys = {
  languages: ['meta', 'languages'] as const,
  voices: (languageCode?: string) => ['meta', 'voices', languageCode] as const,
  fonts: ['meta', 'fonts'] as const,
  aspectRatios: ['meta', 'aspect-ratios'] as const,
};

export function useLanguages() {
  return useQuery({
    queryKey: metaKeys.languages,
    queryFn: metadataApi.getLanguages,
    staleTime: Infinity,
  });
}

export function useVoices(languageCode?: string) {
  return useQuery({
    queryKey: metaKeys.voices(languageCode),
    queryFn: () => metadataApi.getVoices(languageCode),
    staleTime: Infinity,
  });
}

export function useFonts() {
  return useQuery({
    queryKey: metaKeys.fonts,
    queryFn: metadataApi.getFonts,
    staleTime: Infinity,
  });
}

export function useAspectRatios() {
  return useQuery({
    queryKey: metaKeys.aspectRatios,
    queryFn: metadataApi.getAspectRatios,
    staleTime: Infinity,
  });
}
