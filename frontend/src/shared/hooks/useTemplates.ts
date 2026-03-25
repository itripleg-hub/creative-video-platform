import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { templatesApi, TemplateListParams } from '@/shared/api/templates';
import { useToastStore } from '@/shared/stores/toastStore';

export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (params: TemplateListParams) => [...templateKeys.lists(), params] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
  version: (id: string, version: number) => [...templateKeys.detail(id), 'v', version] as const,
};

export function useTemplates(params: TemplateListParams = {}) {
  return useQuery({
    queryKey: templateKeys.list(params),
    queryFn: () => templatesApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => templatesApi.get(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useTemplateVersion(id: string, version: number) {
  return useQuery({
    queryKey: templateKeys.version(id, version),
    queryFn: () => templatesApi.getVersion(id, version),
    enabled: Boolean(id) && version > 0,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template created');
    },
    onError: (err: Error) => toast.error('Failed to create template', err.message),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof templatesApi.update>[1] }) =>
      templatesApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.setQueryData(templateKeys.detail(updated.id), updated);
      toast.success('Template saved');
    },
    onError: (err: Error) => toast.error('Failed to save template', err.message),
  });
}

export function useCloneTemplate() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      templatesApi.clone(id, name),
    onSuccess: (cloned) => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success(`Template cloned as "${cloned.name}"`);
    },
    onError: (err: Error) => toast.error('Failed to clone template', err.message),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const toast = useToastStore();

  return useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: templateKeys.lists() });
      qc.removeQueries({ queryKey: templateKeys.detail(id) });
      toast.success('Template deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete template', err.message),
  });
}
