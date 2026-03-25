import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { useTemplate, useCreateTemplate, useUpdateTemplate } from '@/shared/hooks/useTemplates';
import { PageLoader } from '@/shared/components/ui/Spinner';

const aspectRatioSchema = z.object({
  ratio: z.string().min(1),
  width: z.coerce.number().min(1),
  height: z.coerce.number().min(1),
  isPrimary: z.boolean(),
});

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  aspectRatioConfigs: z.array(aspectRatioSchema).min(1, 'At least one aspect ratio required'),
});

type FormValues = z.infer<typeof formSchema>;

interface TemplateFormPageProps {
  mode?: 'create' | 'edit';
}

export function TemplateFormPage({ mode = 'create' }: TemplateFormPageProps) {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: template, isLoading } = useTemplate(mode === 'edit' ? (id ?? '') : '');
  const { mutate: create, isPending: creating } = useCreateTemplate();
  const { mutate: update, isPending: updating } = useUpdateTemplate();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'DRAFT',
      aspectRatioConfigs: [
        { ratio: '16:9', width: 1920, height: 1080, isPrimary: true },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'aspectRatioConfigs',
  });

  useEffect(() => {
    if (template && mode === 'edit') {
      reset({
        name: template.name,
        description: template.description ?? '',
        status: template.status,
        aspectRatioConfigs: template.aspectRatioConfigs,
      });
    }
  }, [template, mode, reset]);

  const onSubmit = (data: FormValues) => {
    if (mode === 'create') {
      create(data, {
        onSuccess: (t) => navigate(`/templates/${t.id}/edit`),
      });
    } else if (id) {
      update({ id, data }, {
        onSuccess: () => navigate(`/templates/${id}/edit`),
      });
    }
  };

  if (isLoading && mode === 'edit') return <PageLoader />;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/templates')}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'create' ? 'New Template' : 'Edit Template'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <Input
            label="Template name"
            placeholder="e.g. Product Launch Story"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              rows={3}
              placeholder="Optional description..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              {...register('description')}
            />
          </div>
          {mode === 'edit' && (
            <Select label="Status" {...register('status')}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          )}
        </div>

        {/* Aspect ratios */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Aspect Ratios</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => append({ ratio: '9:16', width: 1080, height: 1920, isPrimary: false })}
            >
              Add ratio
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-3 items-end">
              <Input
                label={index === 0 ? 'Ratio' : undefined}
                placeholder="16:9"
                className="w-24"
                {...register(`aspectRatioConfigs.${index}.ratio`)}
              />
              <Input
                label={index === 0 ? 'Width' : undefined}
                type="number"
                className="w-24"
                {...register(`aspectRatioConfigs.${index}.width`)}
              />
              <Input
                label={index === 0 ? 'Height' : undefined}
                type="number"
                className="w-24"
                {...register(`aspectRatioConfigs.${index}.height`)}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input
                  type="checkbox"
                  className="rounded"
                  {...register(`aspectRatioConfigs.${index}.isPrimary`)}
                />
                Primary
              </label>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4 text-red-400" />}
                  onClick={() => remove(index)}
                  className="mb-0.5"
                />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          <Button type="submit" loading={creating || updating}>
            {mode === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
