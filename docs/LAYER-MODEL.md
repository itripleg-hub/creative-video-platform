# Dynamic Layer Model Contract

This is the canonical layer schema. Frontend, backend, and worker MUST all understand this structure.

## Layer Types

- `TEXT` — editable text with full styling
- `IMAGE` — static image/logo overlay
- `SUBTITLE` — auto-generated subtitle region
- `SHAPE` — decorative background/shape
- `VIDEO_REGION` — source video placement area

## Layer Structure

```typescript
interface Layer {
  layerId: string;          // unique within template
  type: LayerType;
  name: string;
  editable: boolean;
  translatable: boolean;    // only for TEXT layers
  visible: boolean;
  locked: boolean;
  zIndex: number;
  opacity: number;          // 0.0 - 1.0
  
  layout: LayerLayout;
  style: LayerStyle;        // type-specific
  content: LayerContent;    // type-specific
  constraints: LayerConstraints;
  
  // Per-aspect-ratio overrides
  aspectRatioOverrides?: Record<string, Partial<LayerLayout & LayerStyle>>;
}

interface LayerLayout {
  x: number;                // 0.0 - 1.0, relative to canvas
  y: number;
  width: number;
  height: number;
  rotation: number;         // degrees
  anchorPoint: AnchorPoint; // CENTER, TOP_LEFT, etc.
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;         // pixels at reference resolution (1080p)
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number;       // multiplier
  letterSpacing: number;    // pixels
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  textColor: string;        // hex with optional alpha
  backgroundColor?: string;
  padding?: [number, number, number, number]; // top, right, bottom, left
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: ShadowConfig;
  strokeColor?: string;
  strokeWidth?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

interface TextConstraints {
  maxLines?: number;
  overflowBehavior: 'WRAP' | 'SHRINK' | 'CLIP' | 'ELLIPSIS';
  autoFit: boolean;
  safeArea: boolean;
}

interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  color: string;
}

type AnchorPoint = 
  | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT'
  | 'CENTER_LEFT' | 'CENTER' | 'CENTER_RIGHT'
  | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT';
```

## Reference Resolution

- Template coordinates are normalized (0.0-1.0)
- Font sizes are specified at 1080p reference (1920x1080)
- Workers scale font sizes proportionally to actual output resolution
- Frontend renders at preview resolution and scales accordingly

## Aspect Ratio Handling

- Each template defines a primary aspect ratio
- `aspectRatioOverrides` on each layer can override layout/style for other ratios
- If no override exists, the primary layout is used (may clip or letterbox)

## Job Payload

When a job is submitted, the backend persists a snapshot of all layers with:
- Final text content (potentially translated)
- Final style overrides from the editor
- Resolved per-aspect-ratio layouts
- This snapshot is immutable and is the source of truth for rendering
```
