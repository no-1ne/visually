import { useRef } from 'react';
import { CircleIcon, HexagonIcon, MinusIcon, RectangleHorizontalIcon, SparklesIcon, StarIcon, TriangleIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore } from '@/store/editor-store';
import type { ShapeKind } from '@/types';
import { PanelHeading } from './panel-heading';

const uid = () => crypto.randomUUID();

export function ElementsPanel() {
  const addElement = useEditorStore((state) => state.addElement);
  const svgRef = useRef<HTMLInputElement>(null);
  const addShape = (kind: ShapeKind, fill: string) => addElement({
    id: uid(), type: 'shape', name: kind[0].toUpperCase() + kind.slice(1), shape: kind,
    x: 340, y: 340, width: 360, height: 360, rotation: 0, opacity: 1, fill,
    cornerRadius: kind === 'rect' ? 36 : 0,
  });
  const colors = ['#7657FF', '#FF6B57', '#FFB84C', '#C7F65C', '#1E293B', '#F4EFE6'];
  const addLine = () => addElement({
    id: uid(), type: 'line', name: 'Line', x: 290, y: 520, width: 500, height: 40,
    rotation: 0, opacity: 1, fill: '#1E293B', strokeWidth: 10, dash: [],
  });
  const addSvg = async (file?: File) => {
    if (!file) return;
    const markup = await file.text();
    addElement({ id: uid(), type: 'svg', name: file.name, markup, x: 240, y: 240, width: 600, height: 600, rotation: 0, opacity: 1, preserveAspectRatio: 'xMidYMid meet' });
  };
  return (
    <>
      <PanelHeading title="Elements" note="Shapes, lines, and design accents." />
      <p className="panel-label">Shapes</p>
      <div className="grid grid-cols-3 gap-2">
        <button className="element-tile" aria-label="Add rectangle" onClick={() => addShape('rect', '#7657FF')}><RectangleHorizontalIcon /></button>
        <button className="element-tile" aria-label="Add circle" onClick={() => addShape('circle', '#FFB84C')}><CircleIcon /></button>
        <button className="element-tile" aria-label="Add star" onClick={() => addShape('star', '#FF6B57')}><StarIcon /></button>
        <button className="element-tile" aria-label="Add triangle" onClick={() => addShape('triangle', '#C7F65C')}><TriangleIcon /></button>
        <button className="element-tile" aria-label="Add polygon" onClick={() => addShape('polygon', '#7657FF')}><HexagonIcon /></button>
        <button className="element-tile" aria-label="Add ellipse" onClick={() => addShape('ellipse', '#FFB84C')}><CircleIcon className="scale-x-125" /></button>
      </div>
      <button className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-muted/40 text-xs font-medium hover:bg-muted" onClick={addLine}><MinusIcon /> Add line</button>
      <input ref={svgRef} hidden type="file" accept="image/svg+xml,.svg" onChange={(event) => void addSvg(event.target.files?.[0])} />
      <Button className="mt-2 w-full" variant="outline" onClick={() => svgRef.current?.click()}><UploadIcon />Import SVG</Button>
      <Separator className="my-5" />
      <p className="panel-label">Quick colors</p>
      <div className="grid grid-cols-6 gap-2">
        {colors.map((color) => <button key={color} className="color-swatch" style={{ background: color }} onClick={() => addShape('circle', color)} aria-label={`Add ${color} circle`} />)}
      </div>
      <div className="mt-5 rounded-2xl bg-[#F1EEFF] p-4 text-[#4D35B5]">
        <SparklesIcon className="mb-2 size-5" />
        <p className="text-xs font-semibold">Extensible by design</p>
        <p className="mt-1 text-[11px] leading-relaxed opacity-75">SVG, GIF, video, audio and custom renderers plug into the same element registry.</p>
      </div>
    </>
  );
}
