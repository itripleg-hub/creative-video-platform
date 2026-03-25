import apiClient from './client';
import type { Language, Voice, FontOption, AspectRatio } from '@/shared/types';

export const metadataApi = {
  getLanguages: async (): Promise<Language[]> => {
    const res = await apiClient.get<Language[]>('/meta/languages');
    return res.data;
  },

  getVoices: async (languageCode?: string): Promise<Voice[]> => {
    const res = await apiClient.get<Voice[]>('/meta/voices', {
      params: languageCode ? { languageCode } : undefined,
    });
    return res.data;
  },

  getFonts: async (): Promise<FontOption[]> => {
    const res = await apiClient.get<FontOption[]>('/meta/fonts');
    return res.data;
  },

  getAspectRatios: async (): Promise<AspectRatio[]> => {
    const res = await apiClient.get<AspectRatio[]>('/meta/aspect-ratios');
    return res.data;
  },
};
