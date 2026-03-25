import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, Eye, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { JobStatusBadge } from '@/shared/components/ui/Badge';
import { DataTable, Column } from '@/shared/components/DataTable';
import { ConfirmModal } from '@/shared/components/ui/Modal';
import { useJobs, useCancelJob, useRetryJob } from '@/shared/hooks/useJobs';
import type { Job, JobStatus } from '@/shared/types';

export function JobListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Job | null>(null);

  const { data, isLoading, refetch, isFetching } = useJobs({
    page,
    size: 20,
    status: status || undefined,
  });

  const { mutate: cancelJob, isPending: cancelling } = useCancelJob();
  const { mutate: retryJob } = useRetryJob();

  const filtered = data?.content.filter((job) =>
    search
      ? job.projectName?.toLowerCase().includes(search.toLowerCase()) ||
        job.templateName?.toLowerCase().includes(search.toLowerCase()) ||
        job.id.includes(search)
      : true
  );

  const columns: Column<Job>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.projectName || 'Untitled'}</p>
          <p className="text-xs text-gray-500">{row.templateName || row.templateId}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) => <JobStatusBadge status={row.status} />,
    },
    {
      key: 'created',
      header: 'Created',
      width: '150px',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      width: '150px',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      align: 'right',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="xs"
            icon={<Eye className="h-3.5 w-3.5" />}
            onClick={() => navigate(`/jobs/${row.id}`)}
            title="View details"
          />
          {(row.status === 'FAILED' || row.status === 'CANCELLED') && (
            <Button
              variant="ghost"
              size="xs"
              icon={<RotateCcw className="h-3.5 w-3.5 text-blue-500" />}
              onClick={() => retryJob(row.id)}
              title="Retry job"
            />
          )}
          {(row.status === 'PENDING' || row.status === 'PROCESSING') && (
            <Button
              variant="ghost"
              size="xs"
              icon={<XCircle className="h-3.5 w-3.5 text-red-400" />}
              onClick={() => setCancelTarget(row)}
              title="Cancel job"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500">Track your video processing jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
            loading={isFetching}
          >
            Refresh
          </Button>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/jobs/new')}
          >
            New Job
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search jobs..."
            icon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        page={page}
        totalPages={data?.totalPages}
        totalElements={data?.totalElements}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/jobs/${row.id}`)}
        emptyMessage="No jobs found. Submit a new job to get started."
      />

      {/* Cancel confirmation */}
      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            cancelJob(cancelTarget.id, {
              onSettled: () => setCancelTarget(null),
            });
          }
        }}
        title="Cancel Job"
        message={`Cancel job "${cancelTarget?.projectName || cancelTarget?.id}"? This cannot be undone.`}
        confirmLabel="Cancel Job"
        loading={cancelling}
      />
    </div>
  );
}
