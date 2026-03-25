import type { Layer, LayerLayout, AspectRatioConfig, TextStyle } from '@/shared/types';

/** Reference resolution for 1:1 font scale */
export const REFERENCE_WIDTH = 1920;
export const REFERENCE_HEIGHT = 1080;

/** Convert normalized layout (0–1) to pixel rect for the given canvas dimensions */
export function layoutToPixels(
  layout: LayerLayout,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number; rotation: number } {
  return {
    x: layout.x * canvasWidth,
    y: layout.y * canvasHeight,
    width: layout.width * canvasWidth,
    height: layout.height * canvasHeight,
    rotation: layout.rotation,
  };
}

/** Convert pixel rect back to normalized layout */
export function pixelsToLayout(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  canvasWidth: number,
  canvasHeight: number
): LayerLayout {
  return {
    x: x / canvasWidth,
    y: y / canvasHeight,
    width: width / canvasWidth,
    height: height / canvasHeight,
    rotation,
    anchorPoint: 'TOP_LEFT',
  };
}

/** Scale font size from reference resolution to canvas preview size */
export function scaleFontSize(
  fontSize: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  const scaleX = canvasWidth / REFERENCE_WIDTH;
  const scaleY = canvasHeight / REFERENCE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  return Math.round(fontSize * scale);
}

/** Get canvas dimensions from aspect ratio config */
export function getCanvasDimensions(
  config: AspectRatioConfig,
  maxWidth = 960
): { width: number; height: number; scale: number } {
  const scale = maxWidth / config.width;
  return {
    width: Math.round(config.width * scale),
    height: Math.round(config.height * scale),
    scale,
  };
}

/** Resolve layout for a layer with aspect ratio overrides applied */
export function resolveLayout(layer: Layer, aspectRatio: string): LayerLayout {
  const override = layer.aspectRatioOverrides?.[aspectRatio];
  if (override) {
    return { ...layer.layout, ...override } as LayerLayout;
  }
  return layer.layout;
}

/** Build Konva text configuration from TextStyle */
export function textStyleToKonva(style: TextStyle, canvasWidth: number, canvasHeight: number) {
  return {
    fontFamily: style.fontFamily || 'Inter',
    fontSize: scaleFontSize(style.fontSize || 32, canvasWidth, canvasHeight),
    fontStyle: [
      style.fontWeight && style.fontWeight >= 700 ? 'bold' : '',
      style.fontStyle === 'italic' ? 'italic' : '',
    ]
      .filter(Boolean)
      .join(' ') || 'normal',
    lineHeight: style.lineHeight || 1.2,
    letterSpacing: style.letterSpacing || 0,
    align: style.textAlign || 'left',
    fill: style.textColor || '#000000',
    textDecoration: style.textDecoration && style.textDecoration !== 'none'
      ? style.textDecoration
      : undefined,
  };
}

/** Parse padding (supports array or single value) */
export function parsePadding(
  padding?: [number, number, number, number] | number
): { top: number; right: number; bottom: number; left: number } {
  if (!padding) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] };
}

/** Generate a unique layer ID */
export function generateLayerId(prefix = 'layer'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a default text layer */
export function createDefaultTextLayer(name: string, zIndex: number): Layer {
  return {
    layerId: generateLayerId('text'),
    type: 'TEXT',
    name,
    editable: true,
    translatable: true,
    visible: true,
    locked: false,
    zIndex,
    opacity: 1,
    layout: {
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.15,
      rotation: 0,
      anchorPoint: 'TOP_LEFT',
    },
    style: {
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 700,
      fontStyle: 'normal',
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'left',
      verticalAlign: 'top',
      textColor: '#FFFFFF',
    },
    content: { text: name },
    constraints: {
      overflowBehavior: 'WRAP',
      autoFit: false,
      safeArea: true,
    },
  };
}
