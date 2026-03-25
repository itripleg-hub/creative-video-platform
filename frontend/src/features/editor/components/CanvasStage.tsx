import { useRef, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Stage, Layer, Rect, Text, Group, Transformer } from 'react-konva';
import { useEditorStore } from '@/shared/stores/editorStore';
import type { Layer as TemplateLayer, TextStyle, AspectRatioConfig } from '@/shared/types';
import {
  layoutToPixels,
  pixelsToLayout,
  textStyleToKonva,
  parsePadding,
  resolveLayout,
} from '../utils/canvasUtils';

interface CanvasStageProps {
  width: number;
  height: number;
  aspectRatioConfig: AspectRatioConfig;
}

interface TextLayerNodeProps {
  layer: TemplateLayer;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  activeAspectRatio: string;
}

function TextLayerNode({
  layer,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  activeAspectRatio,
}: TextLayerNodeProps) {
  const layout = resolveLayout(layer, activeAspectRatio);
  const pixels = layoutToPixels(layout, canvasWidth, canvasHeight);
  const style = layer.style as TextStyle;
  const content = layer.content as { text?: string };
  const padding = parsePadding(style.padding);
  const textProps = textStyleToKonva(style, canvasWidth, canvasHeight);

  if (!layer.visible) return null;

  const applyTransform = (text: string) => {
    if (style.textTransform === 'uppercase') return text.toUpperCase();
    if (style.textTransform === 'lowercase') return text.toLowerCase();
    return text;
  };

  return (
    <Group
      id={layer.layerId}
      x={pixels.x}
      y={pixels.y}
      width={pixels.width}
      height={pixels.height}
      rotation={pixels.rotation}
      opacity={layer.opacity}
      draggable={!layer.locked}
      onMouseDown={() => onSelect(layer.layerId)}
      onTap={() => onSelect(layer.layerId)}
      onDragEnd={(e) => onDragEnd(layer.layerId, e.target.x(), e.target.y())}
      onTransformEnd={(e) => onTransformEnd(layer.layerId, e.target)}
    >
      {/* Background box */}
      {style.backgroundColor && (
        <Rect
          width={pixels.width}
          height={pixels.height}
          fill={style.backgroundColor}
          cornerRadius={style.borderRadius || 0}
          stroke={style.borderColor}
          strokeWidth={style.borderWidth || 0}
          shadowColor={style.shadow?.color}
          shadowBlur={style.shadow?.blur}
          shadowOffsetX={style.shadow?.x}
          shadowOffsetY={style.shadow?.y}
        />
      )}

      {/* Text */}
      <Text
        x={padding.left}
        y={padding.top}
        width={pixels.width - padding.left - padding.right}
        height={pixels.height - padding.top - padding.bottom}
        text={applyTransform(content.text || '')}
        {...textProps}
        verticalAlign={style.verticalAlign || 'top'}
        stroke={style.strokeColor}
        strokeWidth={style.strokeWidth}
        shadowColor={!style.backgroundColor ? style.shadow?.color : undefined}
        shadowBlur={!style.backgroundColor ? style.shadow?.blur : undefined}
        shadowOffsetX={!style.backgroundColor ? style.shadow?.x : undefined}
        shadowOffsetY={!style.backgroundColor ? style.shadow?.y : undefined}
        wrap="word"
        ellipsis={layer.constraints.overflowBehavior === 'ELLIPSIS'}
        listening={false}
      />

      {/* Selection indicator when no background */}
      {isSelected && !style.backgroundColor && (
        <Rect
          width={pixels.width}
          height={pixels.height}
          stroke="#3354ff"
          strokeWidth={1}
          dash={[4, 3]}
          listening={false}
        />
      )}
    </Group>
  );
}

export function CanvasStage({ width, height, aspectRatioConfig: _aspectRatioConfig }: CanvasStageProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const {
    layers,
    selectedLayerId,
    selectLayer,
    updateLayerLayout,
    activeAspectRatio,
    showGrid,
    showSafeArea,
  } = useEditorStore();

  // Attach transformer to selected node
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    const stage = stageRef.current;
    const selectedNode = selectedLayerId
      ? stage.findOne(`#${selectedLayerId}`)
      : null;

    if (selectedNode) {
      transformerRef.current.nodes([selectedNode]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, layers]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        selectLayer(null);
      }
    },
    [selectLayer]
  );

  const handleDragEnd = useCallback(
    (layerId: string, x: number, y: number) => {
      updateLayerLayout(
        layerId,
        pixelsToLayout(x, y, 0, 0, 0, width, height)
      );
    },
    [updateLayerLayout, width, height]
  );

  const handleTransformEnd = useCallback(
    (layerId: string, node: Konva.Node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      updateLayerLayout(layerId, {
        x: node.x() / width,
        y: node.y() / height,
        width: (node.width() * scaleX) / width,
        height: (node.height() * scaleY) / height,
        rotation: node.rotation(),
      });
    },
    [updateLayerLayout, width, height]
  );

  // Sort layers by zIndex (lower zIndex = rendered first = behind)
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  const SAFE_AREA_PERCENT = 0.05;

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onClick={handleStageClick}
      style={{ background: '#1a1a1a' }}
    >
      <Layer>
        {/* Canvas background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#000000"
          listening={false}
        />

        {/* Grid */}
        {showGrid &&
          Array.from({ length: 10 }, (_, i) => (
            <Rect
              key={`grid-v-${i}`}
              x={(width / 10) * i}
              y={0}
              width={1}
              height={height}
              fill="rgba(255,255,255,0.1)"
              listening={false}
            />
          ))}
        {showGrid &&
          Array.from({ length: 10 }, (_, i) => (
            <Rect
              key={`grid-h-${i}`}
              x={0}
              y={(height / 10) * i}
              width={width}
              height={1}
              fill="rgba(255,255,255,0.1)"
              listening={false}
            />
          ))}

        {/* Safe area */}
        {showSafeArea && (
          <Rect
            x={width * SAFE_AREA_PERCENT}
            y={height * SAFE_AREA_PERCENT}
            width={width * (1 - SAFE_AREA_PERCENT * 2)}
            height={height * (1 - SAFE_AREA_PERCENT * 2)}
            stroke="rgba(255, 200, 0, 0.5)"
            strokeWidth={1}
            dash={[6, 4]}
            listening={false}
          />
        )}

        {/* Layers */}
        {sortedLayers.map((layer) => (
          <TextLayerNode
            key={layer.layerId}
            layer={layer}
            canvasWidth={width}
            canvasHeight={height}
            isSelected={selectedLayerId === layer.layerId}
            onSelect={selectLayer}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            activeAspectRatio={activeAspectRatio}
          />
        ))}

        {/* Transformer */}
        <Transformer
          ref={transformerRef}
          enabledAnchors={[
            'top-left',
            'top-center',
            'top-right',
            'middle-right',
            'middle-left',
            'bottom-left',
            'bottom-center',
            'bottom-right',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 10) return oldBox;
            return newBox;
          }}
          rotateEnabled={true}
          borderStroke="#3354ff"
          borderStrokeWidth={1.5}
          anchorFill="#ffffff"
          anchorStroke="#3354ff"
          anchorSize={8}
          anchorCornerRadius={2}
        />
      </Layer>
    </Stage>
  );
}
