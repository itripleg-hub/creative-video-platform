import apiClient from './client';
import type { User, PaginatedResponse } from '@/shared/types';

export interface AdminUserCreateRequest {
  email: string;
  password: string;
  role: string;
}

export interface AdminUserUpdateRequest {
  role?: string;
  activated?: boolean;
}

export const adminApi = {
  listUsers: async (params: { page?: number; size?: number } = {}): Promise<PaginatedResponse<User>> => {
    const res = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params });
    return res.data;
  },

  createUser: async (data: AdminUserCreateRequest): Promise<User> => {
    const res = await apiClient.post<User>('/admin/users', data);
    return res.data;
  },

  updateUser: async (id: string, data: AdminUserUpdateRequest): Promise<User> => {
    const res = await apiClient.patch<User>(`/admin/users/${id}`, data);
    return res.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${id}`);
  },
};
