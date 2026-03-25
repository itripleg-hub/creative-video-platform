import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/shared/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Track in-flight refresh to avoid parallel refreshes
let refreshPromise: Promise<string> | null = null;

// ─── Request Interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = doRefresh(refreshToken);
        }
        const newToken = await refreshPromise;
        refreshPromise = null;

        useAuthStore.getState().setAccessToken(newToken);
        if (original.headers) {
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(original);
      } catch (refreshError) {
        refreshPromise = null;
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

async function doRefresh(refreshToken: string): Promise<string> {
  const response = await axios.post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, {
    refreshToken,
  });
  return response.data.accessToken;
}

function normalizeError(error: AxiosError): Error & { apiError?: unknown } {
  const data = error.response?.data as Record<string, unknown> | undefined;
  const message =
    (data?.message as string) ||
    (data?.error as string) ||
    error.message ||
    'An unexpected error occurred';

  const err = new Error(message) as Error & { apiError?: unknown; status?: number };
  err.apiError = data;
  err.status = error.response?.status;
  return err;
}

export default apiClient;
