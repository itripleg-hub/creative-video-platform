import apiClient from './client';
import type { JobResult } from '@/shared/types';

export const resultsApi = {
  list: async (jobId: string): Promise<JobResult[]> => {
    const res = await apiClient.get<JobResult[]>(`/jobs/${jobId}/results`);
    return res.data;
  },

  get: async (jobId: string, resultId: string): Promise<JobResult> => {
    const res = await apiClient.get<JobResult>(`/jobs/${jobId}/results/${resultId}`);
    return res.data;
  },

  getDownloadUrl: async (jobId: string, resultId: string): Promise<{ url: string }> => {
    const res = await apiClient.get<{ url: string }>(
      `/jobs/${jobId}/results/${resultId}/download`
    );
    return res.data;
  },
};
