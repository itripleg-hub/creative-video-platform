import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Grid3X3,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useTemplate, useUpdateTemplate } from '@/shared/hooks/useTemplates';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { CanvasStage } from './components/CanvasStage';
import { LayerPanel } from './components/LayerPanel';
import { PropertyPanel } from './components/PropertyPanel';
import type { AspectRatioConfig } from '@/shared/types';

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];

export function EditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/templates';

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 960, height: 540 });

  const {
    template,
    layers,
    activeAspectRatio,
    zoom,
    showGrid,
    showSafeArea,
    showLayerPanel,
    showPropertyPanel,
    validationIssues,
    setTemplate,
    setActiveAspectRatio,
    setZoom,
    toggleGrid,
    toggleSafeArea,
    toggleLayerPanel,
    togglePropertyPanel,
    reset,
  } = useEditorStore();

  // @ts-ignore — zundo's temporal store
  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState();
  const canUndo = pastStates?.length > 0;
  const canRedo = futureStates?.length > 0;

  const { data: templateData, isLoading } = useTemplate(templateId || '');
  const { mutate: updateTemplate, isPending: saving } = useUpdateTemplate();

  // Load template into editor
  useEffect(() => {
    if (templateData) {
      setTemplate(templateData);
    }
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData?.id]);

  // Track container size
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(canvasContainerRef.current);
    return () => obs.disconnect();
  }, []);

  const activeConfig: AspectRatioConfig | undefined =
    template?.aspectRatioConfigs.find((c) => c.ratio === activeAspectRatio) ||
    template?.aspectRatioConfigs[0];

  // Compute canvas dimensions that fit container
  const canvasDisplay = activeConfig
    ? (() => {
        const maxW = containerSize.width * 0.9;
        const maxH = containerSize.height * 0.9;
        const scaleW = maxW / activeConfig.width;
        const scaleH = maxH / activeConfig.height;
        const scale = Math.min(scaleW, scaleH, 1) * zoom;
        return {
          width: Math.round(activeConfig.width * scale),
          height: Math.round(activeConfig.height * scale),
        };
      })()
    : { width: 960, height: 540 };

  const handleSave = useCallback(() => {
    if (!template) return;
    updateTemplate({ id: template.id, data: { layers } });
  }, [template, layers, updateTemplate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, handleSave]);

  const handleZoomIn = () => {
    const next = ZOOM_STEPS.find((z) => z > zoom) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
    setZoom(next);
  };

  const handleZoomOut = () => {
    const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom) || ZOOM_STEPS[0];
    setZoom(prev);
  };

  const handleFitToScreen = () => {
    setZoom(1);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!template && !isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-white">
        <AlertTriangle className="h-10 w-10 text-yellow-400" />
        <p className="text-lg">Template not found</p>
        <Button onClick={() => navigate(returnTo)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top toolbar */}
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(returnTo)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <span className="text-sm font-medium text-gray-200 truncate max-w-xs">
            {template?.name}
          </span>
          {validationIssues.filter((v) => v.severity === 'error').length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {validationIssues.filter((v) => v.severity === 'error').length} error(s)
            </span>
          )}
        </div>

        {/* Center: aspect ratio switcher */}
        <div className="flex items-center gap-1">
          {template?.aspectRatioConfigs.map((config) => (
            <button
              key={config.ratio}
              onClick={() => setActiveAspectRatio(config.ratio)}
              className={clsx(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                activeAspectRatio === config.ratio
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              )}
            >
              {config.ratio}
              {config.isPrimary && (
                <span className="ml-1 text-[10px] opacity-60">★</span>
              )}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Undo/Redo */}
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-gray-700" />

          {/* View toggles */}
          <button
            onClick={toggleGrid}
            title="Toggle grid"
            className={clsx(
              'rounded p-1.5 transition-colors',
              showGrid
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={toggleSafeArea}
            title="Toggle safe area"
            className={clsx(
              'rounded p-1.5 transition-colors',
              showSafeArea
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            )}
          >
            <Eye className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-gray-700" />

          {/* Panel toggles */}
          <button
            onClick={toggleLayerPanel}
            title="Toggle layer panel"
            className={clsx(
              'rounded p-1.5 transition-colors',
              showLayerPanel
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            )}
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={togglePropertyPanel}
            title="Toggle property panel"
            className={clsx(
              'rounded p-1.5 transition-colors',
              showPropertyPanel
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-gray-700" />

          {/* Save */}
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            onClick={handleSave}
            icon={<Save className="h-3.5 w-3.5" />}
          >
            Save
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Layer panel */}
        {showLayerPanel && (
          <div className="w-52 flex-shrink-0 border-r border-gray-700 bg-gray-900 overflow-hidden">
            <LayerPanel />
          </div>
        )}

        {/* Canvas area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Canvas container */}
          <div
            ref={canvasContainerRef}
            className="flex flex-1 items-center justify-center overflow-hidden bg-gray-950"
            style={{ backgroundImage: 'radial-gradient(circle, #2a2a3a 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            {activeConfig && (
              <div
                className="relative shadow-2xl"
                style={{
                  width: canvasDisplay.width,
                  height: canvasDisplay.height,
                }}
              >
                <CanvasStage
                  width={canvasDisplay.width}
                  height={canvasDisplay.height}
                  aspectRatioConfig={activeConfig}
                />
              </div>
            )}
          </div>

          {/* Bottom zoom bar */}
          <div className="flex h-10 flex-shrink-0 items-center justify-center gap-2 border-t border-gray-700 bg-gray-900">
            <button
              onClick={handleZoomOut}
              className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleFitToScreen}
              className="min-w-[60px] rounded px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleFitToScreen}
              className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title="Fit to screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Property panel */}
        {showPropertyPanel && (
          <div className="w-64 flex-shrink-0 border-l border-gray-700 bg-gray-900 overflow-hidden">
            <PropertyPanel />
          </div>
        )}
      </div>
    </div>
  );
}
