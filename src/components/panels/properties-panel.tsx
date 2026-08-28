import {
  AlignCenterIcon, AlignLeftIcon, AlignRightIcon, CopyIcon,
  LockIcon, Trash2Icon, UnlockIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useEditorStore } from '@/store/editor-store';
import { fitImageToPage } from '@/lib/images/image-layout';
import type { AudioElement, DrawingElement, EditorElement, ImageElement, LineElement, ShapeElement, TextElement, VideoElement } from '@/types';
import { TableProperties } from './table-properties';
import { RichTextRangeControls } from './rich-text-range-controls';

export function PropertiesPanel({ element }: { element: EditorElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const patch = (changes: Partial<EditorElement>) => updateElement(element.id, changes);
  return (
    <div className="mt-6 border-t pt-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{element.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{element.type}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={duplicateSelected} aria-label="Duplicate"><CopyIcon /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => toggleLock(element.id)} aria-label="Lock">{element.locked ? <LockIcon /> : <UnlockIcon />}</Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={deleteSelected} aria-label="Delete"><Trash2Icon /></Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <label className="field-label">X<Input className="mt-1" type="number" value={Math.round(element.x)} onChange={(event) => patch({ x: Number(event.target.value) })} /></label>
        <label className="field-label">Y<Input className="mt-1" type="number" value={Math.round(element.y)} onChange={(event) => patch({ y: Number(event.target.value) })} /></label>
        <label className="field-label">Width<Input className="mt-1" type="number" min="1" value={Math.round(element.width)} onChange={(event) => patch({ width: Math.max(1, Number(event.target.value)) })} /></label>
        <label className="field-label">Height<Input className="mt-1" type="number" min="1" value={Math.round(element.height)} onChange={(event) => patch({ height: Math.max(1, Number(event.target.value)) })} /></label>
        <label className="field-label col-span-2">Rotation<Input className="mt-1" type="number" value={Math.round(element.rotation)} onChange={(event) => patch({ rotation: Number(event.target.value) })} /></label>
      </div>
      {element.type === 'text' && (
        <>
          <RichTextRangeControls element={element} patch={patch} />
          <div className="grid grid-cols-[1fr_70px] gap-2">
            <select aria-label="Font family" className="control-select" value={element.fontFamily} onChange={(event) => patch({ fontFamily: event.target.value } as Partial<TextElement>)}>
              <option>Manrope</option><option>DM Sans</option><option>Playfair Display</option><option>Arial</option>
            </select>
            <Input aria-label="Font size" type="number" value={Math.round(element.fontSize)} onChange={(event) => patch({ fontSize: Number(event.target.value) } as Partial<TextElement>)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="field-label">Style<select className="control-select mt-1" value={element.fontStyle} onChange={(event) => patch({ fontStyle: event.target.value } as Partial<TextElement>)}><option value="normal">Regular</option><option value="bold">Bold</option><option value="italic">Italic</option><option value="bold italic">Bold italic</option></select></label>
            <label className="field-label">Weight<Input className="mt-1" type="number" min="100" max="900" step="100" value={element.fontWeight ?? (element.fontStyle.includes('bold') ? 700 : 400)} onChange={(event) => patch({ fontWeight: Number(event.target.value) } as Partial<TextElement>)} /></label>
            <label className="field-label">Line height<Input className="mt-1" type="number" min="0.5" max="4" step="0.05" value={element.lineHeight} onChange={(event) => patch({ lineHeight: Number(event.target.value) } as Partial<TextElement>)} /></label>
            <label className="field-label">Spacing<Input className="mt-1" type="number" step="0.1" value={element.letterSpacing} onChange={(event) => patch({ letterSpacing: Number(event.target.value) } as Partial<TextElement>)} /></label>
            <label className="field-label">Decoration<select className="control-select mt-1" value={element.textDecoration ?? 'none'} onChange={(event) => patch({ textDecoration: event.target.value } as Partial<TextElement>)}><option value="none">None</option><option value="underline">Underline</option><option value="line-through">Strike</option></select></label>
            <label className="field-label">Vertical<select className="control-select mt-1" value={element.verticalAlign ?? 'top'} onChange={(event) => patch({ verticalAlign: event.target.value } as Partial<TextElement>)}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
            <label className="field-label">Padding<Input className="mt-1" type="number" min="0" value={element.padding ?? 0} onChange={(event) => patch({ padding: Number(event.target.value) } as Partial<TextElement>)} /></label>
            <label className="field-label">Stroke width<Input className="mt-1" type="number" min="0" step="0.5" value={element.strokeWidth ?? 0} onChange={(event) => patch({ strokeWidth: Number(event.target.value) } as Partial<TextElement>)} /></label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <input aria-label="Text color" className="color-input" type="color" value={element.fill} onChange={(event) => patch({ fill: event.target.value } as Partial<TextElement>)} />
            <ToggleGroup value={[element.align]} onValueChange={(value) => value[0] && patch({ align: value[0] } as Partial<TextElement>)}>
              <ToggleGroupItem value="left" aria-label="Left"><AlignLeftIcon /></ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="Center"><AlignCenterIcon /></ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Right"><AlignRightIcon /></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="field-label">Text path<select
              aria-label="Text path"
              className="control-select mt-1"
              value={element.textPath?.enabled ? 'arc' : 'straight'}
              disabled={Boolean(element.runs?.length)}
              onChange={(event) => patch({
                textPath: event.target.value === 'arc'
                  ? { enabled: true, type: 'arc', bend: element.textPath?.bend ?? 35, reverse: element.textPath?.reverse ?? false }
                  : undefined,
              } as Partial<TextElement>)}
            ><option value="straight">Straight</option><option value="arc">Arc</option></select></label>
            {element.textPath?.enabled && !element.runs?.length && <label className="field-label">Arc bend<Input
              aria-label="Arc bend"
              className="mt-1"
              type="number"
              min="-100"
              max="100"
              value={element.textPath.bend}
              onChange={(event) => patch({ textPath: { ...element.textPath!, bend: Math.min(100, Math.max(-100, Number(event.target.value))) } } as Partial<TextElement>)}
            /></label>}
            {element.textPath?.enabled && !element.runs?.length && <Button
              variant={element.textPath.reverse ? 'default' : 'outline'}
              className="col-span-2"
              onClick={() => patch({ textPath: { ...element.textPath!, reverse: !element.textPath!.reverse } } as Partial<TextElement>)}
            >Reverse path</Button>}
            {Boolean(element.runs?.length) && <p className="col-span-2 text-[10px] text-muted-foreground">Curved paths are disabled while rich-text runs are active.</p>}
          </div>
        </>
      )}
      {element.type === 'shape' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="field-label col-span-2">Shape<select className="control-select mt-2" value={element.shape} onChange={(event) => patch({ shape: event.target.value } as Partial<ShapeElement>)}><option value="rect">Rectangle</option><option value="circle">Circle</option><option value="ellipse">Ellipse</option><option value="star">Star</option><option value="triangle">Triangle</option><option value="polygon">Polygon</option></select></label>
          <label className="field-label">Fill<input className="color-input mt-2" type="color" value={element.fill} onChange={(event) => patch({ fill: event.target.value })} /></label>
          <label className="field-label">Corners<Input className="mt-2" type="number" value={element.cornerRadius} onChange={(event) => patch({ cornerRadius: Number(event.target.value) })} /></label>
          <label className="field-label">Stroke<input className="color-input mt-2" type="color" value={element.stroke ?? '#000000'} onChange={(event) => patch({ stroke: event.target.value } as Partial<ShapeElement>)} /></label>
          <label className="field-label">Weight<Input className="mt-2" type="number" min="0" value={element.strokeWidth ?? 0} onChange={(event) => patch({ strokeWidth: Number(event.target.value) } as Partial<ShapeElement>)} /></label>
          {element.shape === 'polygon' && <label className="field-label col-span-2">Sides<Input className="mt-2" type="number" min="3" max="20" value={element.sides ?? 6} onChange={(event) => patch({ sides: Number(event.target.value) } as Partial<ShapeElement>)} /></label>}
        </div>
      )}
      {element.type === 'image' && <div className="grid grid-cols-2 gap-3">
        <label className="field-label">Corners<Input className="mt-2" type="number" value={element.cornerRadius} onChange={(event) => patch({ cornerRadius: Number(event.target.value) })} /></label>
        <label className="field-label">Fit<select className="control-select mt-2" value={element.objectFit ?? 'cover'} onChange={(event) => patch({ objectFit: event.target.value } as Partial<ImageElement>)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Stretch</option></select></label>
        <Button variant="outline" onClick={() => patch({ flipX: !element.flipX })}>Flip X</Button><Button variant="outline" onClick={() => patch({ flipY: !element.flipY })}>Flip Y</Button>
        <Button variant="outline" onClick={() => patch({ aspectLocked: element.aspectLocked === false })}>{element.aspectLocked === false ? 'Lock ratio' : 'Unlock ratio'}</Button>
        <Button variant="outline" onClick={() => { const { x, y, width, height } = fitImageToPage({ width: element.intrinsicWidth ?? element.width, height: element.intrinsicHeight ?? element.height }, page); patch({ x, y, width, height, objectFit: 'contain' } as Partial<ImageElement>); }}>Fit entire image</Button>
        <label className="field-label">Crop X<Input className="mt-1" type="number" value={element.crop?.x ?? 0} onChange={(event) => patch({ crop: { x: Number(event.target.value), y: element.crop?.y ?? 0, width: element.crop?.width ?? element.width, height: element.crop?.height ?? element.height } } as Partial<ImageElement>)} /></label>
        <label className="field-label">Crop Y<Input className="mt-1" type="number" value={element.crop?.y ?? 0} onChange={(event) => patch({ crop: { x: element.crop?.x ?? 0, y: Number(event.target.value), width: element.crop?.width ?? element.width, height: element.crop?.height ?? element.height } } as Partial<ImageElement>)} /></label>
      </div>}
      {element.type === 'line' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="field-label">Color<input className="color-input mt-2" type="color" value={element.fill} onChange={(event) => patch({ fill: event.target.value })} /></label>
          <label className="field-label">Weight<Input className="mt-2" type="number" min="1" value={element.strokeWidth} onChange={(event) => patch({ strokeWidth: Number(event.target.value) })} /></label>
          <label className="field-label col-span-2">Dash<select className="control-select mt-2" value={element.dash.join(',')} onChange={(event) => patch({ dash: event.target.value ? event.target.value.split(',').map(Number) : [] } as Partial<LineElement>)}><option value="">Solid</option><option value="12,8">Dashed</option><option value="2,6">Dotted</option></select></label>
        </div>
      )}
      {element.type === 'drawing' && <div className="grid grid-cols-2 gap-3"><label className="field-label">Stroke<input className="color-input mt-2" type="color" value={element.stroke} onChange={(event) => patch({ stroke: event.target.value } as Partial<DrawingElement>)} /></label><label className="field-label">Width<Input className="mt-2" type="number" min="1" value={element.strokeWidth} onChange={(event) => patch({ strokeWidth: Number(event.target.value) } as Partial<DrawingElement>)} /></label></div>}
      {element.type === 'table' && <TableProperties element={element} patch={patch} />}
      {(element.type === 'audio' || element.type === 'video') && <MediaProperties element={element} patch={patch} />}
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-[11px]"><span>Opacity</span><span className="text-muted-foreground">{Math.round(element.opacity * 100)}%</span></div>
        <Slider value={[element.opacity * 100]} min={0} max={100} onValueChange={(value) => patch({ opacity: Number(Array.isArray(value) ? value[0] : value) / 100 })} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="field-label">Shadow blur<Input className="mt-1" type="number" min="0" value={element.shadow?.blur ?? 0} onChange={(event) => patch({ shadow: { color: element.shadow?.color ?? '#000000', blur: Number(event.target.value), offsetX: element.shadow?.offsetX ?? 0, offsetY: element.shadow?.offsetY ?? 6, opacity: element.shadow?.opacity ?? .2 } })} /></label>
        <label className="field-label">Blend<select className="control-select mt-1" value={element.blendMode ?? 'normal'} onChange={(event) => patch({ blendMode: event.target.value } as Partial<EditorElement>)}><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="difference">Difference</option></select></label>
      </div>
    </div>
  );
}

function MediaProperties({ element, patch }: { element: AudioElement | VideoElement; patch: (changes: Partial<EditorElement>) => void }) {
  const duration = element.duration ?? 0;
  return <div className="grid grid-cols-2 gap-3">
    <label className="field-label">Trim start<Input className="mt-1" type="number" min="0" max={duration} step="0.1" value={element.trimStart ?? 0} onChange={(event) => patch({ trimStart: Number(event.target.value) } as Partial<AudioElement | VideoElement>)} /></label>
    <label className="field-label">Trim end<Input className="mt-1" type="number" min="0" max={duration} step="0.1" value={element.trimEnd ?? duration} onChange={(event) => patch({ trimEnd: Number(event.target.value) } as Partial<AudioElement | VideoElement>)} /></label>
    <label className="field-label">Volume<Input className="mt-1" type="number" min="0" max="1" step="0.05" value={element.volume ?? 1} onChange={(event) => patch({ volume: Number(event.target.value) } as Partial<AudioElement | VideoElement>)} /></label>
    <label className="field-label">Speed<Input className="mt-1" type="number" min="0.25" max="4" step="0.25" value={element.playbackRate ?? 1} onChange={(event) => patch({ playbackRate: Number(event.target.value) } as Partial<AudioElement | VideoElement>)} /></label>
    <Button variant={element.loop ? 'default' : 'outline'} onClick={() => patch({ loop: !element.loop } as Partial<AudioElement | VideoElement>)}>Loop</Button>
    <Button variant={element.muted ? 'default' : 'outline'} onClick={() => patch({ muted: !element.muted } as Partial<AudioElement | VideoElement>)}>Muted</Button>
  </div>;
}
