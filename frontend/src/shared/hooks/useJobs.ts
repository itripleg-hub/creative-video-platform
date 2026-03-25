import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { jobsApi, JobListParams } from '@/shared/api/jobs';
import { useToastStore } from '@/shared/stores/toastStore';
import { useNavigate } from 'react-router-dom';

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (params: JobListParams) => [...jobKeys.lists(), params] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  executions: (id: string) => [...jobKeys.detail(id), 'executions'] as const,
  execution: (jobId: string, execId: string) =>
    [...jobKeys.executions(jobId), execId] as const,
  steps: (jobId: string, execId: string) =>
    [...jobKeys.execution(jobId, execId), 'steps'] as const,
};

export function useJobs(params: JobListParams = {}) {
  return useQuery({
    queryKey: jobKeys.list(params),
    queryFn: () => jobsApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: 10000, // poll every 10s for active jobs
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => jobsApi.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 5000 : false;
    },
  });
}

export function useJobExecutions(jobId: string) {
  return useQuery({
    queryKey: jobKeys.executions(jobId),
    queryFn: () => jobsApi.getExecutions(jobId),
    enabled: Boolean(jobId),
    refetchInterval: 5000,
  });
}

export function useExecutionSteps(jobId: string, executionId: string) {
  return useQuery({
    queryKey: jobKeys.steps(jobId, executionId),
    queryFn: () => jobsApi.getSteps(jobId, executionId),
    enabled: Boolean(jobId) && Boolean(executionId),
    refetchInterval: 3000,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  const toast = useToastStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: jobsApi.create,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: jobKeys.lists() });
      toast.success('Job submitted successfully');
      navigate(`/jobs/${job.id}`);
    },
    onError: (err: Error) => toast.error('Failed to submit job', err.message),
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: jobsApi.cancel,
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success('Job cancelled');
    },
    onError: (err: Error) => toast.error('Failed to cancel job', err.message),
  });
}

export function useRetryJob() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: jobsApi.retry,
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      toast.success('Job retrying...');
    },
    onError: (err: Error) => toast.error('Failed to retry job', err.message),
  });
}
