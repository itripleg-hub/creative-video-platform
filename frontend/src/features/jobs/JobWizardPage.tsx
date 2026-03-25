import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Search,
  X,
  Play,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { Spinner } from '@/shared/components/ui/Spinner';
import { TemplateStatusBadge } from '@/shared/components/ui/Badge';
import { useTemplates } from '@/shared/hooks/useTemplates';
import { useLanguages, useVoices } from '@/shared/hooks/useMetadata';
import { useCreateJob } from '@/shared/hooks/useJobs';
import { useToastStore } from '@/shared/stores/toastStore';
import { assetsApi } from '@/shared/api/assets';
import type { TemplateSummary, JobCreateRequest } from '@/shared/types';

type WizardStep = 'template' | 'video' | 'languages' | 'confirm';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'template', label: 'Select Template' },
  { key: 'video', label: 'Upload Video' },
  { key: 'languages', label: 'Languages & Voices' },
  { key: 'confirm', label: 'Confirm & Submit' },
];

interface WizardState {
  templateId: string | null;
  templateVersion: number;
  templateName: string;
  aspectRatios: string[];
  sourceVideoId: string | null;
  uploadedFilename: string | null;
  projectName: string;
  languages: string[];
  voiceSettings: { enabled: boolean; voiceId?: string };
  subtitleSettings: { enabled: boolean };
}

export function JobWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastStore();

  const [currentStep, setCurrentStep] = useState<WizardStep>(() =>
    searchParams.get('templateId') ? 'video' : 'template'
  );
  const [state, setState] = useState<WizardState>({
    templateId: searchParams.get('templateId'),
    templateVersion: 1,
    templateName: '',
    aspectRatios: [],
    sourceVideoId: null,
    uploadedFilename: null,
    projectName: '',
    languages: [],
    voiceSettings: { enabled: false },
    subtitleSettings: { enabled: true },
  });

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.key);
  };

  const goPrev = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.key);
  };

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const { mutate: createJob, isPending: submitting } = useCreateJob();

  const handleSubmit = () => {
    if (!state.templateId || !state.sourceVideoId || state.languages.length === 0) {
      toast.error('Incomplete', 'Please complete all required steps');
      return;
    }

    const payload: JobCreateRequest = {
      templateId: state.templateId,
      templateVersion: state.templateVersion,
      sourceVideoId: state.sourceVideoId,
      projectName: state.projectName || undefined,
      languages: state.languages,
      aspectRatios: state.aspectRatios,
      layerOverrides: [],
      voiceSettings: state.voiceSettings,
      subtitleSettings: state.subtitleSettings,
    };

    createJob(payload);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
        <p className="text-sm text-gray-500">Process a video through a template</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1">
            <button
              onClick={() => {
                // Only allow navigating to completed steps
                if (i < stepIndex) setCurrentStep(step.key);
              }}
              className={clsx(
                'flex items-center gap-2',
                i < stepIndex && 'cursor-pointer'
              )}
            >
              <div
                className={clsx(
                  'step-dot',
                  i < stepIndex
                    ? 'step-dot-completed'
                    : i === stepIndex
                    ? 'step-dot-active'
                    : 'step-dot-inactive'
                )}
              >
                {i < stepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={clsx(
                  'hidden sm:block text-sm font-medium',
                  i === stepIndex ? 'text-brand-700' : i < stepIndex ? 'text-green-700' : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </button>

            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  'step-connector mx-2',
                  i < stepIndex ? 'bg-green-400' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {currentStep === 'template' && (
          <TemplateStep
            selectedId={state.templateId}
            onSelect={(t) => {
              updateState({
                templateId: t.id,
                templateVersion: t.currentVersion,
                templateName: t.name,
                aspectRatios: t.aspectRatios,
              });
            }}
          />
        )}

        {currentStep === 'video' && (
          <VideoStep
            uploadedFilename={state.uploadedFilename}
            onUploaded={(assetId, filename) =>
              updateState({ sourceVideoId: assetId, uploadedFilename: filename })
            }
          />
        )}

        {currentStep === 'languages' && (
          <LanguagesStep
            selectedLanguages={state.languages}
            voiceSettings={state.voiceSettings}
            subtitleSettings={state.subtitleSettings}
            onUpdate={(updates) => updateState(updates)}
          />
        )}

        {currentStep === 'confirm' && (
          <ConfirmStep
            state={state}
            projectName={state.projectName}
            onProjectNameChange={(v) => updateState({ projectName: v })}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={stepIndex === 0 ? () => navigate('/jobs') : goPrev}
          icon={<ChevronLeft className="h-4 w-4" />}
        >
          {stepIndex === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep !== 'confirm' ? (
          <Button
            onClick={goNext}
            disabled={
              (currentStep === 'template' && !state.templateId) ||
              (currentStep === 'video' && !state.sourceVideoId) ||
              (currentStep === 'languages' && state.languages.length === 0)
            }
            icon={<ChevronRight className="h-4 w-4" />}
            iconPosition="right"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            loading={submitting}
            icon={<Play className="h-4 w-4" />}
          >
            Submit Job
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Step: Template ─────────────────────────────────────────────────────────

function TemplateStep({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (t: TemplateSummary) => void;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTemplates({ size: 50, status: 'ACTIVE', search: search || undefined });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Select a Template</h2>
      <Input
        placeholder="Search templates..."
        icon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : data?.content.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No active templates found.</p>
      ) : (
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {data?.content.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={clsx(
                'flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-colors',
                selectedId === t.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {t.thumbnailUrl ? (
                <img
                  src={t.thumbnailUrl}
                  alt={t.name}
                  className="h-16 w-24 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                  <Play className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <TemplateStatusBadge status={t.status} />
                </div>
                {t.description && (
                  <p className="mt-0.5 text-sm text-gray-500 truncate">{t.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.aspectRatios.map((r) => (
                    <span
                      key={r}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              {selectedId === t.id && (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step: Video Upload ──────────────────────────────────────────────────────

function VideoStep({
  uploadedFilename,
  onUploaded,
}: {
  uploadedFilename: string | null;
  onUploaded: (assetId: string, filename: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const toast = useToastStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      // 1. Get presigned URL
      const { uploadUrl, assetId } = await assetsApi.getUploadUrl({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      // 2. Upload to S3
      setProgress(30);
      await assetsApi.uploadToS3(uploadUrl, file);
      setProgress(70);

      // 3. Confirm
      await assetsApi.confirmUpload(assetId, {
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      setProgress(100);
      onUploaded(assetId, file.name);
      toast.success('Video uploaded', file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      toast.error('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Upload Source Video</h2>
      <p className="text-sm text-gray-500">
        Upload the video file you want to process. Supported formats: MP4, MOV, AVI, MKV.
      </p>

      {uploadedFilename ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">{uploadedFilename}</p>
            <p className="text-xs text-green-600">Uploaded successfully</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-green-700 underline"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={clsx(
            'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors',
            uploading
              ? 'border-brand-300 bg-brand-50'
              : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
          )}
        >
          <UploadCloud
            className={clsx(
              'h-12 w-12',
              uploading ? 'text-brand-500 animate-pulse' : 'text-gray-400'
            )}
          />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {uploading ? `Uploading... ${progress}%` : 'Click to upload video'}
            </p>
            <p className="text-xs text-gray-500">MP4, MOV, AVI, MKV up to 5GB</p>
          </div>
          {uploading && (
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-brand-600 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </button>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <X className="h-4 w-4" />
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ─── Step: Languages ─────────────────────────────────────────────────────────

function LanguagesStep({
  selectedLanguages,
  voiceSettings,
  subtitleSettings,
  onUpdate,
}: {
  selectedLanguages: string[];
  voiceSettings: { enabled: boolean; voiceId?: string };
  subtitleSettings: { enabled: boolean };
  onUpdate: (updates: Partial<WizardState>) => void;
}) {
  const { data: languages, isLoading } = useLanguages();
  const { data: voices } = useVoices(selectedLanguages[0]);

  const toggleLanguage = (code: string) => {
    const next = selectedLanguages.includes(code)
      ? selectedLanguages.filter((l) => l !== code)
      : [...selectedLanguages, code];
    onUpdate({ languages: next });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Languages & Voices</h2>

      {/* Language selection */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          Target Languages <span className="text-red-500">*</span>
        </p>
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {languages?.map((lang) => (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors',
                  selectedLanguages.includes(lang.code)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                )}
              >
                {selectedLanguages.includes(lang.code) && (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate">{lang.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{lang.code}</span>
              </button>
            ))}
          </div>
        )}
        {selectedLanguages.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedLanguages.length} language(s) selected
          </p>
        )}
      </div>

      {/* Voice settings */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="voice-enabled"
            checked={voiceSettings.enabled}
            onChange={(e) =>
              onUpdate({ voiceSettings: { ...voiceSettings, enabled: e.target.checked } })
            }
            className="rounded border-gray-300"
          />
          <label htmlFor="voice-enabled" className="text-sm font-medium text-gray-700">
            Enable AI Voice Generation
          </label>
        </div>

        {voiceSettings.enabled && voices && voices.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-gray-500">Voice</p>
            <Select
              value={voiceSettings.voiceId || ''}
              onChange={(e) =>
                onUpdate({
                  voiceSettings: { ...voiceSettings, voiceId: e.target.value || undefined },
                })
              }
            >
              <option value="">Auto-select voice</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender || 'N/A'}) — {v.provider}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Subtitle settings */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="subtitle-enabled"
            checked={subtitleSettings.enabled}
            onChange={(e) =>
              onUpdate({ subtitleSettings: { enabled: e.target.checked } })
            }
            className="rounded border-gray-300"
          />
          <label htmlFor="subtitle-enabled" className="text-sm font-medium text-gray-700">
            Generate Subtitles
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Step: Confirm ───────────────────────────────────────────────────────────

function ConfirmStep({
  state,
  projectName,
  onProjectNameChange,
}: {
  state: WizardState;
  projectName: string;
  onProjectNameChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Confirm & Submit</h2>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Project Name (optional)
        </label>
        <Input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="My Video Project"
        />
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3 text-sm">
        <SummaryRow label="Template" value={state.templateName || state.templateId || '—'} />
        <SummaryRow label="Video" value={state.uploadedFilename || state.sourceVideoId || '—'} />
        <SummaryRow
          label="Languages"
          value={state.languages.length > 0 ? state.languages.join(', ') : 'None selected'}
        />
        <SummaryRow
          label="Aspect Ratios"
          value={state.aspectRatios.length > 0 ? state.aspectRatios.join(', ') : 'All'}
        />
        <SummaryRow
          label="Voice Generation"
          value={state.voiceSettings.enabled ? 'Enabled' : 'Disabled'}
        />
        <SummaryRow
          label="Subtitles"
          value={state.subtitleSettings.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>

      <p className="text-sm text-gray-500">
        The job will be queued and processed in the background. You can monitor progress on the
        job detail page.
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}
