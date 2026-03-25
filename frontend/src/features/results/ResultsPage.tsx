import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Play, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Badge } from '@/shared/components/ui/Badge';
import { useJob } from '@/shared/hooks/useJobs';
import { useJobResults } from '@/shared/hooks/useResults';
import type { JobResult } from '@/shared/types';

/** Group results by language code */
function groupByLanguage(results: JobResult[]): Record<string, JobResult[]> {
  return results.reduce<Record<string, JobResult[]>>((acc, r) => {
    (acc[r.languageCode] = acc[r.languageCode] || []).push(r);
    return acc;
  }, {});
}

function ResultCard({ result }: { result: JobResult }) {
  const sizeKb = result.fileSizeBytes ? Math.round(result.fileSizeBytes / 1024) : null;
  const durationSec = result.durationMs ? Math.round(result.durationMs / 1000) : null;

  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-900 overflow-hidden">
        {result.thumbnailUrl ? (
          <img
            src={result.thumbnailUrl}
            alt={`${result.languageCode} ${result.aspectRatio}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-10 w-10 text-gray-600" />
          </div>
        )}

        {/* Aspect ratio badge */}
        <div className="absolute top-2 left-2">
          <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white font-mono">
            {result.aspectRatio}
          </span>
        </div>

        {/* Download overlay */}
        {result.downloadUrl && (
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
          >
            <Download className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-gray-900">
            {result.aspectRatio}
          </div>
          {result.downloadUrl && (
            <a
              href={result.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {durationSec !== null && (
            <span>{durationSec}s</span>
          )}
          {sizeKb !== null && (
            <span>{sizeKb > 1024 ? `${Math.round(sizeKb / 1024)} MB` : `${sizeKb} KB`}</span>
          )}
          <span>{new Date(result.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading: jobLoading } = useJob(jobId || '');
  const { data: results = [], isLoading: resultsLoading } = useJobResults(jobId || '');

  const isLoading = jobLoading || resultsLoading;
  const grouped = groupByLanguage(results);
  const languageCodes = Object.keys(grouped).sort();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/jobs')} className="hover:text-gray-900">
          Jobs
        </button>
        <ChevronRight className="h-4 w-4" />
        <button onClick={() => navigate(`/jobs/${jobId}`)} className="hover:text-gray-900">
          {job?.projectName || jobId}
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Results</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results</h1>
          <p className="text-sm text-gray-500">
            {results.length} output{results.length !== 1 ? 's' : ''} for{' '}
            {job?.projectName || 'this job'}
          </p>
        </div>
        <Button
          variant="outline"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(`/jobs/${jobId}`)}
        >
          Back to Job
        </Button>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No results available yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Results appear once the job completes processing.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {languageCodes.map((langCode) => (
            <section key={langCode}>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{langCode}</h2>
                <Badge variant="blue">
                  {grouped[langCode].length} variant{grouped[langCode].length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {grouped[langCode]
                  .sort((a, b) => a.aspectRatio.localeCompare(b.aspectRatio))
                  .map((result) => (
                    <ResultCard key={result.id} result={result} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
