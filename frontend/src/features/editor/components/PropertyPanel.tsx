import { useEditorStore } from '@/shared/stores/editorStore';
import type { TextStyle } from '@/shared/types';
import { clsx } from 'clsx';

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-gray-400">{children}</span>;
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label>{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SmallInput({
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  className,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-brand-400 focus:outline-none',
        className
      )}
    />
  );
}

function SmallSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-brand-400 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded border border-gray-600 bg-transparent p-0"
      />
      <SmallInput value={value || '#000000'} onChange={onChange} className="flex-1" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-700 px-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {children}
      </span>
    </div>
  );
}

export function PropertyPanel() {
  const { layers, selectedLayerId, updateLayerStyle, updateLayerLayout, updateLayerContent } =
    useEditorStore();

  const layer = layers.find((l) => l.layerId === selectedLayerId);

  if (!layer) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-gray-500">
        Select a layer to edit its properties
      </div>
    );
  }

  const style = layer.style as TextStyle;
  const layout = layer.layout;
  const content = layer.content as { text?: string };

  const updateStyle = (updates: Partial<TextStyle>) => {
    updateLayerStyle(layer.layerId, updates);
  };

  const isText = layer.type === 'TEXT';

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Layer name */}
      <div className="border-b border-gray-700 px-3 py-2">
        <p className="text-xs font-semibold text-gray-200 truncate">{layer.name}</p>
        <p className="text-xs text-gray-500 capitalize">{layer.type.toLowerCase()} layer</p>
      </div>

      {/* Text content */}
      {isText && (
        <>
          <SectionTitle>Content</SectionTitle>
          <div className="px-3 py-2">
            <textarea
              rows={4}
              value={content.text || ''}
              onChange={(e) => updateLayerContent(layer.layerId, { text: e.target.value })}
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:border-brand-400 focus:outline-none resize-none"
              placeholder="Enter text..."
            />
          </div>
        </>
      )}

      {/* Position & Size */}
      <SectionTitle>Position & Size</SectionTitle>
      <div className="px-3 py-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>X (%)</Label>
            <SmallInput
              type="number"
              value={Math.round(layout.x * 1000) / 10}
              min={0}
              max={100}
              step={0.1}
              onChange={(v) => updateLayerLayout(layer.layerId, { x: parseFloat(v) / 100 })}
            />
          </div>
          <div>
            <Label>Y (%)</Label>
            <SmallInput
              type="number"
              value={Math.round(layout.y * 1000) / 10}
              min={0}
              max={100}
              step={0.1}
              onChange={(v) => updateLayerLayout(layer.layerId, { y: parseFloat(v) / 100 })}
            />
          </div>
          <div>
            <Label>W (%)</Label>
            <SmallInput
              type="number"
              value={Math.round(layout.width * 1000) / 10}
              min={1}
              max={100}
              step={0.1}
              onChange={(v) => updateLayerLayout(layer.layerId, { width: parseFloat(v) / 100 })}
            />
          </div>
          <div>
            <Label>H (%)</Label>
            <SmallInput
              type="number"
              value={Math.round(layout.height * 1000) / 10}
              min={1}
              max={100}
              step={0.1}
              onChange={(v) => updateLayerLayout(layer.layerId, { height: parseFloat(v) / 100 })}
            />
          </div>
        </div>
        <PropRow label="Rotation">
          <SmallInput
            type="number"
            value={layout.rotation}
            min={-360}
            max={360}
            onChange={(v) => updateLayerLayout(layer.layerId, { rotation: parseFloat(v) })}
          />
        </PropRow>
        <PropRow label="Opacity">
          <SmallInput
            type="number"
            value={layer.opacity}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => useEditorStore.getState().updateLayer(layer.layerId, { opacity: parseFloat(v) })}
          />
        </PropRow>
      </div>

      {/* Typography */}
      {isText && (
        <>
          <SectionTitle>Typography</SectionTitle>
          <div className="px-3 py-2 space-y-1.5">
            <PropRow label="Font">
              <SmallInput
                value={style.fontFamily || 'Inter'}
                onChange={(v) => updateStyle({ fontFamily: v })}
              />
            </PropRow>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Size</Label>
                <SmallInput
                  type="number"
                  value={style.fontSize || 32}
                  min={8}
                  max={300}
                  onChange={(v) => updateStyle({ fontSize: parseInt(v) })}
                />
              </div>
              <div>
                <Label>Weight</Label>
                <SmallSelect
                  value={String(style.fontWeight || 400)}
                  onChange={(v) => updateStyle({ fontWeight: parseInt(v) })}
                  options={[
                    { value: '300', label: 'Light' },
                    { value: '400', label: 'Regular' },
                    { value: '500', label: 'Medium' },
                    { value: '600', label: 'SemiBold' },
                    { value: '700', label: 'Bold' },
                    { value: '800', label: 'ExtraBold' },
                  ]}
                />
              </div>
              <div>
                <Label>Line Height</Label>
                <SmallInput
                  type="number"
                  value={style.lineHeight || 1.2}
                  min={0.5}
                  max={4}
                  step={0.1}
                  onChange={(v) => updateStyle({ lineHeight: parseFloat(v) })}
                />
              </div>
              <div>
                <Label>Letter Spacing</Label>
                <SmallInput
                  type="number"
                  value={style.letterSpacing || 0}
                  min={-10}
                  max={50}
                  step={0.5}
                  onChange={(v) => updateStyle({ letterSpacing: parseFloat(v) })}
                />
              </div>
            </div>
            <PropRow label="Align">
              <SmallSelect
                value={style.textAlign || 'left'}
                onChange={(v) => updateStyle({ textAlign: v as 'left' | 'center' | 'right' })}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
              />
            </PropRow>
            <PropRow label="V-Align">
              <SmallSelect
                value={style.verticalAlign || 'top'}
                onChange={(v) =>
                  updateStyle({ verticalAlign: v as 'top' | 'middle' | 'bottom' })
                }
                options={[
                  { value: 'top', label: 'Top' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'bottom', label: 'Bottom' },
                ]}
              />
            </PropRow>
            <PropRow label="Style">
              <SmallSelect
                value={style.fontStyle || 'normal'}
                onChange={(v) => updateStyle({ fontStyle: v as 'normal' | 'italic' })}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'italic', label: 'Italic' },
                ]}
              />
            </PropRow>
            <PropRow label="Transform">
              <SmallSelect
                value={style.textTransform || 'none'}
                onChange={(v) =>
                  updateStyle({
                    textTransform: v as 'none' | 'uppercase' | 'lowercase',
                  })
                }
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'uppercase', label: 'Uppercase' },
                  { value: 'lowercase', label: 'Lowercase' },
                ]}
              />
            </PropRow>
          </div>

          {/* Colors */}
          <SectionTitle>Colors</SectionTitle>
          <div className="px-3 py-2 space-y-2">
            <div>
              <Label>Text Color</Label>
              <ColorInput
                value={style.textColor || '#FFFFFF'}
                onChange={(v) => updateStyle({ textColor: v })}
              />
            </div>
            <div>
              <Label>Background</Label>
              <ColorInput
                value={style.backgroundColor || ''}
                onChange={(v) => updateStyle({ backgroundColor: v })}
              />
            </div>
            <div>
              <Label>Border Color</Label>
              <ColorInput
                value={style.borderColor || ''}
                onChange={(v) => updateStyle({ borderColor: v })}
              />
            </div>
          </div>

          {/* Box */}
          <SectionTitle>Box</SectionTitle>
          <div className="px-3 py-2 space-y-1.5">
            <PropRow label="Padding">
              <div className="grid grid-cols-4 gap-1">
                {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, i) => (
                  <SmallInput
                    key={side}
                    type="number"
                    value={style.padding?.[i] ?? 0}
                    min={0}
                    max={100}
                    onChange={(v) => {
                      const p: [number, number, number, number] = [
                        ...(style.padding || [0, 0, 0, 0]),
                      ] as [number, number, number, number];
                      p[i] = parseInt(v);
                      updateStyle({ padding: p });
                    }}
                  />
                ))}
              </div>
            </PropRow>
            <PropRow label="Border R.">
              <SmallInput
                type="number"
                value={style.borderRadius || 0}
                min={0}
                max={100}
                onChange={(v) => updateStyle({ borderRadius: parseInt(v) })}
              />
            </PropRow>
            <PropRow label="Border W.">
              <SmallInput
                type="number"
                value={style.borderWidth || 0}
                min={0}
                max={20}
                onChange={(v) => updateStyle({ borderWidth: parseInt(v) })}
              />
            </PropRow>
          </div>

          {/* Shadow */}
          <SectionTitle>Shadow</SectionTitle>
          <div className="px-3 py-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>X</Label>
                <SmallInput
                  type="number"
                  value={style.shadow?.x ?? 0}
                  onChange={(v) =>
                    updateStyle({
                      shadow: { ...style.shadow, x: parseFloat(v), y: style.shadow?.y ?? 0, blur: style.shadow?.blur ?? 0, color: style.shadow?.color ?? '#000000' },
                    })
                  }
                />
              </div>
              <div>
                <Label>Y</Label>
                <SmallInput
                  type="number"
                  value={style.shadow?.y ?? 0}
                  onChange={(v) =>
                    updateStyle({
                      shadow: { ...style.shadow, x: style.shadow?.x ?? 0, y: parseFloat(v), blur: style.shadow?.blur ?? 0, color: style.shadow?.color ?? '#000000' },
                    })
                  }
                />
              </div>
              <div>
                <Label>Blur</Label>
                <SmallInput
                  type="number"
                  value={style.shadow?.blur ?? 0}
                  min={0}
                  onChange={(v) =>
                    updateStyle({
                      shadow: { ...style.shadow, x: style.shadow?.x ?? 0, y: style.shadow?.y ?? 0, blur: parseFloat(v), color: style.shadow?.color ?? '#000000' },
                    })
                  }
                />
              </div>
              <div>
                <Label>Color</Label>
                <ColorInput
                  value={style.shadow?.color ?? '#000000'}
                  onChange={(v) =>
                    updateStyle({
                      shadow: { ...style.shadow, x: style.shadow?.x ?? 0, y: style.shadow?.y ?? 0, blur: style.shadow?.blur ?? 0, color: v },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
