// ─── Layer Model ──────────────────────────────────────────────────────────────

export type LayerType = 'TEXT' | 'IMAGE' | 'SUBTITLE' | 'SHAPE' | 'VIDEO_REGION';

export type AnchorPoint =
  | 'TOP_LEFT'
  | 'TOP_CENTER'
  | 'TOP_RIGHT'
  | 'CENTER_LEFT'
  | 'CENTER'
  | 'CENTER_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT';

export type OverflowBehavior = 'WRAP' | 'SHRINK' | 'CLIP' | 'ELLIPSIS';

export interface LayerLayout {
  x: number;          // 0.0–1.0 normalized
  y: number;
  width: number;
  height: number;
  rotation: number;   // degrees
  anchorPoint: AnchorPoint;
}

export interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  textColor: string;
  backgroundColor?: string;
  padding?: [number, number, number, number];
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: ShadowConfig;
  strokeColor?: string;
  strokeWidth?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

export interface ImageStyle {
  objectFit?: 'cover' | 'contain' | 'fill';
  opacity?: number;
  borderRadius?: number;
}

export interface ShapeStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
}

export type LayerStyle = TextStyle | ImageStyle | ShapeStyle | Record<string, unknown>;

export interface TextContent {
  text: string;
}

export interface ImageContent {
  src?: string;
  assetId?: string;
}

export type LayerContent = TextContent | ImageContent | Record<string, unknown>;

export interface LayerConstraints {
  maxLines?: number;
  overflowBehavior: OverflowBehavior;
  autoFit: boolean;
  safeArea: boolean;
}

export interface Layer {
  layerId: string;
  type: LayerType;
  name: string;
  editable: boolean;
  translatable: boolean;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  opacity: number;
  layout: LayerLayout;
  style: LayerStyle;
  content: LayerContent;
  constraints: LayerConstraints;
  aspectRatioOverrides?: Record<string, Partial<LayerLayout & LayerStyle>>;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface AspectRatioConfig {
  ratio: string;        // e.g. "16:9", "9:16", "1:1"
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface EditorSettings {
  backgroundColor?: string;
  backgroundImageUrl?: string;
  gridEnabled?: boolean;
  snapEnabled?: boolean;
  safeAreaEnabled?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  status: TemplateStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  thumbnailUrl?: string;
  aspectRatioConfigs: AspectRatioConfig[];
  layers: Layer[];
  editorSettings?: EditorSettings;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  status: TemplateStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  thumbnailUrl?: string;
  layerCount: number;
  aspectRatios: string[];
}

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  aspectRatioConfigs: AspectRatioConfig[];
  layers?: Layer[];
  editorSettings?: EditorSettings;
}

export interface TemplateUpdateRequest extends Partial<TemplateCreateRequest> {
  status?: TemplateStatus;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepType =
  | 'INPUT_VALIDATION'
  | 'ASSET_PREPARATION'
  | 'TRANSLATION'
  | 'VOICE_GENERATION'
  | 'SUBTITLE_GENERATION'
  | 'RENDER_COMPOSITION'
  | 'FINALIZATION';

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface VoiceSettings {
  enabled: boolean;
  voiceId?: string;
  speechRate?: number;
  cloneSource?: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  position?: 'bottom' | 'top' | 'custom';
  customY?: number;
}

export interface OutputPreferences {
  videoCodec?: string;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  outputFormat?: string;
}

export interface LayerOverride {
  layerId: string;
  content?: Partial<TextContent>;
  style?: Partial<LayerStyle>;
  layout?: Partial<LayerLayout>;
  visible?: boolean;
}

export interface JobCreateRequest {
  templateId: string;
  templateVersion: number;
  sourceVideoId: string;
  projectName?: string;
  languages: string[];
  aspectRatios: string[];
  layerOverrides: LayerOverride[];
  voiceSettings?: VoiceSettings;
  subtitleSettings?: SubtitleSettings;
  outputPreferences?: OutputPreferences;
}

export interface Job {
  id: string;
  ownerId: string;
  templateId: string;
  templateVersionId: string;
  sourceVideoId: string;
  status: JobStatus;
  projectName?: string;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
  latestExecution?: JobExecution;
}

export interface JobExecution {
  id: string;
  jobId: string;
  executionNumber: number;
  status: JobStatus;
  submittedConfigJson?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  steps?: ExecutionStep[];
}

export interface ExecutionStep {
  id: string;
  jobExecutionId: string;
  stepType: StepType;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  detailsJson?: string;
  errorMessage?: string;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface JobResult {
  id: string;
  jobExecutionId: string;
  languageCode: string;
  aspectRatio: string;
  outputVideoPath: string;
  thumbnailPath?: string;
  metadataJson?: string;
  createdAt: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  durationMs?: number;
  fileSizeBytes?: number;
}

// ─── Video Asset ──────────────────────────────────────────────────────────────

export interface VideoAsset {
  id: string;
  ownerId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  createdAt: string;
  uploadUrl?: string;
}

export interface UploadUrlRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  assetId: string;
  expiresAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  activated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface Voice {
  id: string;
  name: string;
  languageCode: string;
  gender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
  provider: string;
  previewUrl?: string;
}

export interface FontOption {
  family: string;
  weights: number[];
  styles: string[];
  category: 'sans-serif' | 'serif' | 'monospace' | 'display' | 'handwriting';
}

export interface AspectRatio {
  ratio: string;
  label: string;
  width: number;
  height: number;
}

// ─── Pagination & API ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  status?: number;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SseEventType =
  | 'EXECUTION_STARTED'
  | 'STEP_STARTED'
  | 'STEP_PROGRESSED'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_CANCELLED'
  | 'RESULT_AVAILABLE';

export interface SseEvent {
  type: SseEventType;
  jobId: string;
  executionId: string;
  stepId?: string;
  stepType?: StepType;
  status?: StepStatus;
  progress?: number;
  message?: string;
  timestamp: string;
}

// ─── Editor State ─────────────────────────────────────────────────────────────

export interface EditorHistoryEntry {
  layers: Layer[];
  timestamp: number;
}

export interface ValidationIssue {
  layerId: string;
  severity: 'error' | 'warning';
  message: string;
}
