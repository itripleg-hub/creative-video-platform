import apiClient from './client';
import type {
  LoginRequest,
  LoginResponse,
  User,
  ChangePasswordRequest,
} from '@/shared/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', data);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const res = await apiClient.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getProfile: async (): Promise<User> => {
    const res = await apiClient.get<User>('/account');
    return res.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post('/account/change-password', data);
  },
};
