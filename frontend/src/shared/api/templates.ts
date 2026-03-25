import apiClient from './client';
import type {
  Template,
  TemplateSummary,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  PaginatedResponse,
} from '@/shared/types';

export interface TemplateListParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const templatesApi = {
  list: async (params: TemplateListParams = {}): Promise<PaginatedResponse<TemplateSummary>> => {
    const res = await apiClient.get<PaginatedResponse<TemplateSummary>>('/templates', { params });
    return res.data;
  },

  get: async (id: string): Promise<Template> => {
    const res = await apiClient.get<Template>(`/templates/${id}`);
    return res.data;
  },

  getVersion: async (id: string, version: number): Promise<Template> => {
    const res = await apiClient.get<Template>(`/templates/${id}/versions/${version}`);
    return res.data;
  },

  create: async (data: TemplateCreateRequest): Promise<Template> => {
    const res = await apiClient.post<Template>('/templates', data);
    return res.data;
  },

  update: async (id: string, data: TemplateUpdateRequest): Promise<Template> => {
    const res = await apiClient.put<Template>(`/templates/${id}`, data);
    return res.data;
  },

  clone: async (id: string, name?: string): Promise<Template> => {
    const res = await apiClient.post<Template>(`/templates/${id}/clone`, { name });
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
  },
};
