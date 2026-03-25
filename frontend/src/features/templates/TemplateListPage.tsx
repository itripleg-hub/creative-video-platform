import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Copy, Edit2, Trash2, Play, MoreVertical } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { TemplateStatusBadge } from '@/shared/components/ui/Badge';
import { ConfirmModal } from '@/shared/components/ui/Modal';
import { DataTable, Column } from '@/shared/components/DataTable';
import {
  useTemplates,
  useDeleteTemplate,
  useCloneTemplate,
} from '@/shared/hooks/useTemplates';
import type { TemplateSummary } from '@/shared/types';
import { useRef, useState as useLocalState } from 'react';

export function TemplateListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);
  const [openMenuId, setOpenMenuId] = useLocalState<string | null>(null);

  const { data, isLoading } = useTemplates({
    page,
    size: 20,
    search: search || undefined,
    status: status || undefined,
  });

  const { mutate: deleteTemplate, isPending: deleting } = useDeleteTemplate();
  const { mutate: cloneTemplate } = useCloneTemplate();

  const columns: Column<TemplateSummary>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.description && (
            <p className="text-xs text-gray-500 truncate max-w-xs">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row) => <TemplateStatusBadge status={row.status} />,
    },
    {
      key: 'ratios',
      header: 'Aspect Ratios',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.aspectRatios.map((r) => (
            <span key={r} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {r}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'layers',
      header: 'Layers',
      width: '80px',
      align: 'center',
      render: (row) => <span className="text-gray-600">{row.layerCount}</span>,
    },
    {
      key: 'version',
      header: 'Version',
      width: '80px',
      align: 'center',
      render: (row) => <span className="text-gray-500">v{row.currentVersion}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="xs"
            icon={<Play className="h-3.5 w-3.5" />}
            onClick={() => navigate(`/jobs/new?templateId=${row.id}`)}
            title="Use template"
          />
          <Button
            variant="ghost"
            size="xs"
            icon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={() => navigate(`/templates/${row.id}/edit`)}
            title="Edit template"
          />
          <Button
            variant="ghost"
            size="xs"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => cloneTemplate({ id: row.id })}
            title="Clone template"
          />
          <Button
            variant="ghost"
            size="xs"
            icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
            onClick={() => setDeleteTarget(row)}
            title="Delete template"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500">Manage your video creative templates</p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/templates/new')}
        >
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search templates..."
            icon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="w-36"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.content ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        page={page}
        totalPages={data?.totalPages}
        totalElements={data?.totalElements}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/templates/${row.id}`)}
        emptyMessage="No templates found. Create your first template to get started."
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTemplate(deleteTarget.id, {
              onSettled: () => setDeleteTarget(null),
            });
          }
        }}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
