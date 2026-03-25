import apiClient from './client';
import type { VideoAsset, UploadUrlRequest, UploadUrlResponse } from '@/shared/types';

export const assetsApi = {
  getUploadUrl: async (data: UploadUrlRequest): Promise<UploadUrlResponse> => {
    const res = await apiClient.post<UploadUrlResponse>('/assets/upload-url', data);
    return res.data;
  },

  confirmUpload: async (assetId: string, data: Partial<VideoAsset>): Promise<VideoAsset> => {
    const res = await apiClient.post<VideoAsset>('/assets', { assetId, ...data });
    return res.data;
  },

  get: async (id: string): Promise<VideoAsset> => {
    const res = await apiClient.get<VideoAsset>(`/assets/${id}`);
    return res.data;
  },

  uploadToS3: async (uploadUrl: string, file: File): Promise<void> => {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
  },
};
