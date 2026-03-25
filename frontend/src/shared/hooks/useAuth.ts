import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/shared/api/auth';
import { useAuthStore } from '@/shared/stores/authStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { useNavigate } from 'react-router-dom';

export const authKeys = {
  profile: ['auth', 'profile'] as const,
};

export function useProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: authKeys.profile,
    queryFn: authApi.getProfile,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const toast = useToastStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      queryClient.setQueryData(authKeys.profile, data.user);
      navigate('/templates');
    },
    onError: (err: Error) => {
      toast.error('Login failed', err.message);
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate('/login');
    },
  });
}

export function useChangePassword() {
  const toast = useToastStore();
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => toast.success('Password changed successfully'),
    onError: (err: Error) => toast.error('Failed to change password', err.message),
  });
}
