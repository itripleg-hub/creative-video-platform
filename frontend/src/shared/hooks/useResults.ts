import { useQuery } from '@tanstack/react-query';
import { resultsApi } from '@/shared/api/results';

export const resultKeys = {
  all: ['results'] as const,
  byJob: (jobId: string) => [...resultKeys.all, 'job', jobId] as const,
  detail: (jobId: string, resultId: string) =>
    [...resultKeys.byJob(jobId), resultId] as const,
};

export function useJobResults(jobId: string) {
  return useQuery({
    queryKey: resultKeys.byJob(jobId),
    queryFn: () => resultsApi.list(jobId),
    enabled: Boolean(jobId),
    staleTime: 60 * 1000,
  });
}

export function useResult(jobId: string, resultId: string) {
  return useQuery({
    queryKey: resultKeys.detail(jobId, resultId),
    queryFn: () => resultsApi.get(jobId, resultId),
    enabled: Boolean(jobId) && Boolean(resultId),
  });
}
