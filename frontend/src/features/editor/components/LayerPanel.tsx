import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, GripVertical, Type, Image, Subtitles } from 'lucide-react';
import { clsx } from 'clsx';
import { useEditorStore } from '@/shared/stores/editorStore';
import { Button } from '@/shared/components/ui/Button';
import { createDefaultTextLayer } from '../utils/canvasUtils';
import type { Layer, LayerType } from '@/shared/types';

const layerTypeIcon: Record<LayerType, React.ReactNode> = {
  TEXT: <Type className="h-3.5 w-3.5" />,
  IMAGE: <Image className="h-3.5 w-3.5" />,
  SUBTITLE: <Subtitles className="h-3.5 w-3.5" />,
  SHAPE: <div className="h-3 w-3 rounded-sm border border-current" />,
  VIDEO_REGION: <div className="h-3.5 w-3.5 rounded-sm bg-current opacity-60" />,
};

export function LayerPanel() {
  const {
    layers,
    selectedLayerId,
    selectLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayers,
  } = useEditorStore();

  const handleAddLayer = () => {
    const maxZ = Math.max(0, ...layers.map((l) => l.zIndex));
    const newLayer = createDefaultTextLayer(`Text Layer ${layers.length + 1}`, maxZ + 1);
    setLayers([newLayer, ...layers]);
    selectLayer(newLayer.layerId);
  };

  const handleDeleteLayer = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    setLayers(layers.filter((l) => l.layerId !== layer.layerId));
    if (selectedLayerId === layer.layerId) selectLayer(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Layers
        </span>
        <Button
          variant="ghost"
          size="xs"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={handleAddLayer}
          className="text-gray-300 hover:text-white hover:bg-gray-700"
          title="Add text layer"
        />
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-500">
            No layers yet.
            <br />
            Click + to add a layer.
          </div>
        ) : (
          <ul className="divide-y divide-gray-700/50">
            {layers.map((layer) => (
              <li
                key={layer.layerId}
                onClick={() => selectLayer(layer.layerId)}
                className={clsx(
                  'group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors',
                  selectedLayerId === layer.layerId
                    ? 'bg-brand-900/40 border-l-2 border-brand-400'
                    : 'hover:bg-gray-700/40'
                )}
              >
                {/* Drag handle */}
                <GripVertical className="h-3.5 w-3.5 text-gray-600 flex-shrink-0 cursor-grab" />

                {/* Layer type icon */}
                <span className="text-gray-400 flex-shrink-0">
                  {layerTypeIcon[layer.type]}
                </span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p
                    className={clsx(
                      'text-xs truncate',
                      layer.visible ? 'text-gray-200' : 'text-gray-500',
                      layer.locked && 'italic'
                    )}
                  >
                    {layer.name}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layer.layerId);
                    }}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-200"
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerLock(layer.layerId);
                    }}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-200"
                    title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleDeleteLayer(e, layer)}
                    className="rounded p-0.5 text-gray-400 hover:text-red-400"
                    title="Delete layer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
