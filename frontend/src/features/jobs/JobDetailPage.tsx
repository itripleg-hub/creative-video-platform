import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
  SkipForward,
  ChevronRight,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { JobStatusBadge, StepStatusBadge } from '@/shared/components/ui/Badge';
import { Spinner } from '@/shared/components/ui/Spinner';
import { ConfirmModal } from '@/shared/components/ui/Modal';
import { useJob, useCancelJob, useRetryJob, useJobExecutions, jobKeys } from '@/shared/hooks/useJobs';
import { useJobSse } from '@/shared/hooks/useSse';
import { useJobResults } from '@/shared/hooks/useResults';
import type { ExecutionStep, JobExecution, StepStatus, StepType, SseEvent } from '@/shared/types';
import { useState } from 'react';

const STEP_LABELS: Record<StepType, string> = {
  INPUT_VALIDATION: 'Input Validation',
  ASSET_PREPARATION: 'Asset Preparation',
  TRANSLATION: 'Translation',
  VOICE_GENERATION: 'Voice Generation',
  SUBTITLE_GENERATION: 'Subtitle Generation',
  RENDER_COMPOSITION: 'Render & Composition',
  FINALIZATION: 'Finalization',
};

const StepIcon = ({ status }: { status: StepStatus }) => {
  const cls = 'h-5 w-5';
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className={clsx(cls, 'text-green-500')} />;
    case 'RUNNING':
      return <Loader2 className={clsx(cls, 'text-blue-500 animate-spin')} />;
    case 'FAILED':
      return <AlertCircle className={clsx(cls, 'text-red-500')} />;
    case 'SKIPPED':
      return <SkipForward className={clsx(cls, 'text-gray-400')} />;
    default:
      return <Clock className={clsx(cls, 'text-gray-400')} />;
  }
};

function ExecutionTimeline({ execution }: { execution: JobExecution }) {
  const steps = execution.steps || [];

  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div key={step.id} className="flex gap-3">
          {/* Step connector */}
          <div className="flex flex-col items-center">
            <StepIcon status={step.status} />
            {i < steps.length - 1 && (
              <div
                className={clsx(
                  'mt-1 w-0.5 flex-1 min-h-[16px]',
                  step.status === 'COMPLETED' ? 'bg-green-200' : 'bg-gray-200'
                )}
              />
            )}
          </div>

          {/* Step info */}
          <div className="pb-3 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {STEP_LABELS[step.stepType] || step.stepType}
                </p>
                {step.startedAt && (
                  <p className="text-xs text-gray-500">
                    {step.finishedAt
                      ? `${new Date(step.startedAt).toLocaleTimeString()} → ${new Date(step.finishedAt).toLocaleTimeString()} (${Math.round((new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)}s)`
                      : `Started ${new Date(step.startedAt).toLocaleTimeString()}`}
                  </p>
                )}
                {step.errorMessage && (
                  <p className="mt-0.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    {step.errorMessage}
                  </p>
                )}
              </div>
              <StepStatusBadge status={step.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);

  const { data: job, isLoading } = useJob(id || '');
  const { data: executions = [] } = useJobExecutions(id || '');
  const { data: results = [] } = useJobResults(id || '');
  const { mutate: cancelJob, isPending: cancelling } = useCancelJob();
  const { mutate: retryJob, isPending: retrying } = useRetryJob();

  // SSE for real-time updates
  useJobSse(id || '', {
    enabled: Boolean(id) && (job?.status === 'PROCESSING' || job?.status === 'PENDING'),
    onEvent: (event: SseEvent) => {
      qc.invalidateQueries({ queryKey: jobKeys.detail(id || '') });
      qc.invalidateQueries({ queryKey: jobKeys.executions(id || '') });
    },
  });

  const latestExecution =
    executions.find((e) => e.id === selectedExecId) ||
    executions[0] ||
    job?.latestExecution;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Job not found</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate('/jobs')}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </button>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {job.projectName || 'Untitled Job'}
            </h1>
            <p className="text-sm text-gray-500">
              {job.templateName} · ID: {job.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <JobStatusBadge status={job.status} />

          {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="h-4 w-4" />}
              loading={retrying}
              onClick={() => retryJob(job.id)}
            >
              Retry
            </Button>
          )}

          {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
            <Button
              variant="danger"
              size="sm"
              icon={<XCircle className="h-4 w-4" />}
              onClick={() => setShowCancel(true)}
            >
              Cancel
            </Button>
          )}

          {job.status === 'COMPLETED' && results.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => navigate(`/jobs/${job.id}/results`)}
            >
              View Results
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="Template" value={job.templateName || job.templateId} />
        <InfoCard label="Created" value={new Date(job.createdAt).toLocaleString()} />
        <InfoCard label="Updated" value={new Date(job.updatedAt).toLocaleString()} />
        <InfoCard label="Executions" value={String(executions.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Execution selector */}
          {executions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Execution:</span>
              <div className="flex gap-1">
                {executions.map((exec) => (
                  <button
                    key={exec.id}
                    onClick={() => setSelectedExecId(exec.id)}
                    className={clsx(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      (selectedExecId === exec.id ||
                        (!selectedExecId && exec.id === executions[0].id))
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    #{exec.executionNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Execution Timeline
            </h2>

            {latestExecution ? (
              <>
                {/* Execution meta */}
                <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-500">
                  {latestExecution.startedAt && (
                    <span>
                      Started: {new Date(latestExecution.startedAt).toLocaleString()}
                    </span>
                  )}
                  {latestExecution.finishedAt && (
                    <span>
                      Finished: {new Date(latestExecution.finishedAt).toLocaleString()}
                    </span>
                  )}
                  {latestExecution.errorMessage && (
                    <span className="text-red-500">
                      Error: {latestExecution.errorMessage}
                    </span>
                  )}
                </div>

                {latestExecution.steps && latestExecution.steps.length > 0 ? (
                  <ExecutionTimeline execution={latestExecution} />
                ) : (
                  <p className="text-sm text-gray-500">
                    {job.status === 'PENDING'
                      ? 'Job is queued, waiting to start...'
                      : 'No step details available.'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No execution history available.</p>
            )}
          </div>
        </div>

        {/* Sidebar: results preview */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Results</h2>

            {results.length === 0 ? (
              <p className="text-sm text-gray-500">
                {job.status === 'COMPLETED'
                  ? 'No results yet.'
                  : 'Results will appear when the job completes.'}
              </p>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 4).map((result) => (
                  <div key={result.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {result.languageCode} · {result.aspectRatio}
                      </span>
                      {result.downloadUrl && (
                        <a
                          href={result.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      )}
                    </div>
                    {result.thumbnailUrl && (
                      <img
                        src={result.thumbnailUrl}
                        alt={`${result.languageCode} ${result.aspectRatio}`}
                        className="w-full rounded object-cover aspect-video"
                      />
                    )}
                  </div>
                ))}

                {results.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/jobs/${job.id}/results`)}
                  >
                    View all {results.length} results
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      <ConfirmModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelJob(job.id, { onSettled: () => setShowCancel(false) })}
        title="Cancel Job"
        message="Are you sure you want to cancel this job? It cannot be restarted automatically."
        confirmLabel="Cancel Job"
        loading={cancelling}
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}
