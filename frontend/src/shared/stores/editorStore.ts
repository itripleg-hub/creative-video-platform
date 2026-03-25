import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Layer, Template, ValidationIssue } from '@/shared/types';

interface EditorState {
  // Template being edited
  template: Template | null;

  // Active state
  selectedLayerId: string | null;
  activeAspectRatio: string;

  // Canvas state
  zoom: number;
  panX: number;
  panY: number;

  // Layers (editable copy)
  layers: Layer[];

  // Validation
  validationIssues: ValidationIssue[];

  // UI state
  showGrid: boolean;
  showSafeArea: boolean;
  showLayerPanel: boolean;
  showPropertyPanel: boolean;

  // Actions
  setTemplate: (template: Template) => void;
  setLayers: (layers: Layer[]) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;
  updateLayerContent: (layerId: string, content: Partial<Layer['content']>) => void;
  updateLayerStyle: (layerId: string, style: Partial<Layer['style']>) => void;
  updateLayerLayout: (layerId: string, layout: Partial<Layer['layout']>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  selectLayer: (layerId: string | null) => void;
  setActiveAspectRatio: (ratio: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setValidationIssues: (issues: ValidationIssue[]) => void;
  toggleGrid: () => void;
  toggleSafeArea: () => void;
  toggleLayerPanel: () => void;
  togglePropertyPanel: () => void;
  reset: () => void;
}

const initialState = {
  template: null,
  selectedLayerId: null,
  activeAspectRatio: '16:9',
  zoom: 1,
  panX: 0,
  panY: 0,
  layers: [],
  validationIssues: [],
  showGrid: false,
  showSafeArea: true,
  showLayerPanel: true,
  showPropertyPanel: true,
};

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      ...initialState,

      setTemplate: (template) => {
        set({
          template,
          layers: [...template.layers].sort((a, b) => b.zIndex - a.zIndex),
          activeAspectRatio:
            template.aspectRatioConfigs.find((c) => c.isPrimary)?.ratio ||
            template.aspectRatioConfigs[0]?.ratio ||
            '16:9',
        });
      },

      setLayers: (layers) => set({ layers }),

      updateLayer: (layerId, updates) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId ? { ...l, ...updates } : l
          ),
        })),

      updateLayerContent: (layerId, content) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId
              ? { ...l, content: { ...l.content, ...content } }
              : l
          ),
        })),

      updateLayerStyle: (layerId, style) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId
              ? { ...l, style: { ...l.style, ...style } }
              : l
          ),
        })),

      updateLayerLayout: (layerId, layout) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId
              ? { ...l, layout: { ...l.layout, ...layout } }
              : l
          ),
        })),

      reorderLayers: (fromIndex, toIndex) =>
        set((state) => {
          const newLayers = [...state.layers];
          const [moved] = newLayers.splice(fromIndex, 1);
          newLayers.splice(toIndex, 0, moved);
          // Update zIndex values
          return {
            layers: newLayers.map((l, i) => ({
              ...l,
              zIndex: newLayers.length - i,
            })),
          };
        }),

      selectLayer: (layerId) => set({ selectedLayerId: layerId }),

      setActiveAspectRatio: (ratio) => set({ activeAspectRatio: ratio }),

      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

      setPan: (panX, panY) => set({ panX, panY }),

      toggleLayerVisibility: (layerId) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId ? { ...l, visible: !l.visible } : l
          ),
        })),

      toggleLayerLock: (layerId) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layerId === layerId ? { ...l, locked: !l.locked } : l
          ),
        })),

      setValidationIssues: (validationIssues) => set({ validationIssues }),

      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      toggleSafeArea: () => set((state) => ({ showSafeArea: !state.showSafeArea })),
      toggleLayerPanel: () => set((state) => ({ showLayerPanel: !state.showLayerPanel })),
      togglePropertyPanel: () =>
        set((state) => ({ showPropertyPanel: !state.showPropertyPanel })),

      reset: () => set(initialState),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        layers: state.layers,
      }),
    }
  )
);
