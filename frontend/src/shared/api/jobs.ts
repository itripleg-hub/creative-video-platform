import apiClient from './client';
import type {
  Job,
  JobCreateRequest,
  JobExecution,
  ExecutionStep,
  PaginatedResponse,
} from '@/shared/types';

export interface JobListParams {
  page?: number;
  size?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const jobsApi = {
  list: async (params: JobListParams = {}): Promise<PaginatedResponse<Job>> => {
    const res = await apiClient.get<PaginatedResponse<Job>>('/jobs', { params });
    return res.data;
  },

  get: async (id: string): Promise<Job> => {
    const res = await apiClient.get<Job>(`/jobs/${id}`);
    return res.data;
  },

  create: async (data: JobCreateRequest): Promise<Job> => {
    const res = await apiClient.post<Job>('/jobs', data);
    return res.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.post(`/jobs/${id}/cancel`);
  },

  retry: async (id: string): Promise<void> => {
    await apiClient.post(`/jobs/${id}/retry`);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/jobs/${id}`);
  },

  getExecutions: async (jobId: string): Promise<JobExecution[]> => {
    const res = await apiClient.get<JobExecution[]>(`/jobs/${jobId}/executions`);
    return res.data;
  },

  getExecution: async (jobId: string, executionId: string): Promise<JobExecution> => {
    const res = await apiClient.get<JobExecution>(`/jobs/${jobId}/executions/${executionId}`);
    return res.data;
  },

  getSteps: async (jobId: string, executionId: string): Promise<ExecutionStep[]> => {
    const res = await apiClient.get<ExecutionStep[]>(
      `/jobs/${jobId}/executions/${executionId}/steps`
    );
    return res.data;
  },

  retryStep: async (
    jobId: string,
    executionId: string,
    stepId: string
  ): Promise<void> => {
    await apiClient.post(
      `/jobs/${jobId}/executions/${executionId}/steps/${stepId}/retry`
    );
  },
};
