import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Layer, Template, ValidationIssue } from '../types';

interface EditorState {
  template: Template | null;
  selectedLayerId: string | null;
  activeAspectRatio: string;
  zoom: number;
  panX: number;
  panY: number;
  layers: Layer[];
  validationIssues: ValidationIssue[];
  showGrid: boolean;
  showSafeArea: boolean;
  showLayerPanel: boolean;
  showPropertyPanel: boolean;

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

const initialState: Pick<
  EditorState,
  | 'template'
  | 'selectedLayerId'
  | 'activeAspectRatio'
  | 'zoom'
  | 'panX'
  | 'panY'
  | 'layers'
  | 'validationIssues'
  | 'showGrid'
  | 'showSafeArea'
  | 'showLayerPanel'
  | 'showPropertyPanel'
> = {
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
    (set: (fn: EditorState | Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void) => ({
      ...initialState,

      setTemplate: (template: Template) => {
        set({
          template,
          layers: [...template.layers].sort((a: Layer, b: Layer) => b.zIndex - a.zIndex),
          activeAspectRatio:
            template.aspectRatioConfigs.find((c: { isPrimary?: boolean }) => c.isPrimary)?.ratio ||
            template.aspectRatioConfigs[0]?.ratio ||
            '16:9',
        });
      },

      setLayers: (layers: Layer[]) => set({ layers }),

      updateLayer: (layerId: string, updates: Partial<Layer>) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId ? { ...l, ...updates } : l
          ),
        })),

      updateLayerContent: (layerId: string, content: Partial<Layer['content']>) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId
              ? { ...l, content: { ...l.content, ...content } }
              : l
          ),
        })),

      updateLayerStyle: (layerId: string, style: Partial<Layer['style']>) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId
              ? { ...l, style: { ...l.style, ...style } }
              : l
          ),
        })),

      updateLayerLayout: (layerId: string, layout: Partial<Layer['layout']>) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId
              ? { ...l, layout: { ...l.layout, ...layout } }
              : l
          ),
        })),

      reorderLayers: (fromIndex: number, toIndex: number) =>
        set((state: EditorState) => {
          const newLayers = [...state.layers];
          const [moved] = newLayers.splice(fromIndex, 1);
          newLayers.splice(toIndex, 0, moved);
          return {
            layers: newLayers.map((l: Layer, i: number) => ({
              ...l,
              zIndex: newLayers.length - i,
            })),
          };
        }),

      selectLayer: (layerId: string | null) => set({ selectedLayerId: layerId }),
      setActiveAspectRatio: (ratio: string) => set({ activeAspectRatio: ratio }),
      setZoom: (zoom: number) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
      setPan: (panX: number, panY: number) => set({ panX, panY }),

      toggleLayerVisibility: (layerId: string) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId ? { ...l, visible: !l.visible } : l
          ),
        })),

      toggleLayerLock: (layerId: string) =>
        set((state: EditorState) => ({
          layers: state.layers.map((l: Layer) =>
            l.layerId === layerId ? { ...l, locked: !l.locked } : l
          ),
        })),

      setValidationIssues: (validationIssues: ValidationIssue[]) => set({ validationIssues }),
      toggleGrid: () => set((state: EditorState) => ({ showGrid: !state.showGrid })),
      toggleSafeArea: () => set((state: EditorState) => ({ showSafeArea: !state.showSafeArea })),
      toggleLayerPanel: () => set((state: EditorState) => ({ showLayerPanel: !state.showLayerPanel })),
      togglePropertyPanel: () => set((state: EditorState) => ({ showPropertyPanel: !state.showPropertyPanel })),
      reset: () => set(initialState),
    }),
    {
      limit: 50,
      partialize: (state: EditorState) => ({
        layers: state.layers,
      }),
    }
  )
);
