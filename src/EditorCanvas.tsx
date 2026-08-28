import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Star, Text, TextPath, Transformer } from 'react-konva';
import type { DesignDocument, EditorElement } from './types';
import type { EditorTool } from './store/tool-store';
import { evaluateKeyframes, type AnimatableValue, type EasingName } from './features/advanced/animation';
import { snapObjectPosition, type SnapGuide, type SnapTargetRect } from './features/advanced/object-snapping';
import { isCoveredGridCell } from './features/advanced/table-grid';
import { createArcTextPath } from './features/advanced/curved-text';
import { useExtensionRegistry, type CanvasRendererContribution } from './extensions';

export interface CanvasHandle {
  exportImage: () => string | null;
}

interface EditorCanvasProps {
  document: DesignDocument;
  selectedIds: string[];
  zoom: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany?: (ids: string[]) => void;
  onZoomChange?: (zoom: number) => void;
  tool?: EditorTool;
  brush?: { color: string; width: number; opacity: number };
  onCreateElement?: (element: EditorElement) => void;
  onErase?: (id: string) => void;
  playhead?: number;
  playing?: boolean;
  onChange: (id: string, changes: Partial<EditorElement>, record?: boolean) => void;
}

function animatedElement(element: EditorElement, playhead: number): EditorElement {
  const animation = element.animation;
  if (!animation?.enabled || !animation.tracks.length) return element;
  const delay = animation.delay ?? 0;
  const duration = Math.max(.001, animation.duration ?? Math.max(...animation.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.time)), 1));
  if (playhead < delay) return element;
  const elapsed = playhead - delay;
  const localTime = animation.iterationCount === 'infinite' ? elapsed % duration : Math.min(elapsed, duration);
  const next = { ...element } as EditorElement;
  for (const track of animation.tracks) {
    const value = evaluateKeyframes(track.keyframes.map((keyframe) => ({
      time: keyframe.time,
      value: keyframe.value as AnimatableValue,
      easing: (keyframe.easing?.type === 'cubic-bezier' ? keyframe.easing.controlPoints : keyframe.easing?.type) as EasingName | readonly [number, number, number, number] | undefined,
    })), localTime);
    if (value !== undefined) (next as unknown as Record<string, unknown>)[track.property] = value;
  }
  return next;
}

interface GuideState {
  x?: number;
  y?: number;
}

function useImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const next = new Image();
    next.crossOrigin = 'anonymous';
    next.onload = () => setImage(next);
    next.src = src;
    return () => { next.onload = null; };
  }, [src]);
  return image;
}

function mediaPreviewSource(element: EditorElement) {
  if (element.type === 'image') return element.src;
  if (element.type === 'svg') return element.src ?? (element.markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(element.markup)}` : '');
  if (element.type === 'video' || element.type === 'audio') return element.poster ?? '';
  return '';
}

function transformText(value: string, mode: Extract<EditorElement, { type: 'text' }>['textTransform']) {
  if (mode === 'uppercase') return value.toUpperCase();
  if (mode === 'lowercase') return value.toLowerCase();
  if (mode === 'capitalize') return value.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
  return value;
}

function FilteredImage({ element, image }: { element: Extract<EditorElement, { type: 'image' | 'video' }>; image: HTMLImageElement | null }) {
  const imageRef = useRef<Konva.Image>(null);
  const effects = element.effects;
  useEffect(() => {
    const node = imageRef.current;
    if (!node || !image) return;
    const filters = [] as NonNullable<Parameters<Konva.Image['filters']>[0]>;
    if (effects?.brightness) filters.push(Konva.Filters.Brighten);
    if (effects?.contrast) filters.push(Konva.Filters.Contrast);
    if (effects?.saturation || effects?.hue) filters.push(Konva.Filters.HSL);
    if (effects?.blur) filters.push(Konva.Filters.Blur);
    if (effects?.grayscale) filters.push(Konva.Filters.Grayscale);
    if (effects?.sepia) filters.push(Konva.Filters.Sepia);
    if (effects?.invert) filters.push(Konva.Filters.Invert);
    if (filters.length) node.cache({ pixelRatio: 1 });
    else node.clearCache();
    node.filters(filters);
    node.brightness((effects?.brightness ?? 0) / 100);
    node.contrast(effects?.contrast ?? 0);
    node.saturation((effects?.saturation ?? 0) / 100);
    node.hue(effects?.hue ?? 0);
    node.blurRadius(Math.max(0, effects?.blur ?? 0));
    node.getLayer()?.batchDraw();
    return () => { node.clearCache(); };
  }, [effects, image]);

  const naturalWidth = image?.naturalWidth || ('intrinsicWidth' in element ? element.intrinsicWidth : undefined) || element.width;
  const naturalHeight = image?.naturalHeight || ('intrinsicHeight' in element ? element.intrinsicHeight : undefined) || element.height;
  const crop = element.crop;
  let cropProps = crop ? { cropX: crop.x, cropY: crop.y, cropWidth: crop.width, cropHeight: crop.height } : {};
  const objectFit = 'objectFit' in element ? element.objectFit : 'cover';
  if (!crop && (objectFit ?? 'cover') === 'cover') {
    const targetRatio = element.width / element.height;
    const sourceRatio = naturalWidth / naturalHeight;
    if (sourceRatio > targetRatio) {
      const width = naturalHeight * targetRatio;
      cropProps = { cropX: (naturalWidth - width) / 2, cropY: 0, cropWidth: width, cropHeight: naturalHeight };
    } else {
      const height = naturalWidth / targetRatio;
      cropProps = { cropX: 0, cropY: (naturalHeight - height) / 2, cropWidth: naturalWidth, cropHeight: height };
    }
  }
  let x = 0;
  let y = 0;
  let width = element.width;
  let height = element.height;
  if (!crop && objectFit === 'contain') {
    const scale = Math.min(element.width / naturalWidth, element.height / naturalHeight);
    width = naturalWidth * scale;
    height = naturalHeight * scale;
    x = (element.width - width) / 2;
    y = (element.height - height) / 2;
  }
  return <Group>
    <Rect width={element.width} height={element.height} fill="transparent" />
    <KonvaImage ref={imageRef} x={x} y={y} width={width} height={height} image={image ?? undefined} {...cropProps} />
  </Group>;
}

function syncVideoPlayback(video: HTMLVideoElement, element: Extract<EditorElement, { type: 'video' }>, playhead: number, playing: boolean) {
  const start = element.trimStart ?? 0;
  const end = element.trimEnd ?? element.duration ?? video.duration;
  const time = Math.min(end, start + playhead * (element.playbackRate ?? 1));
  if (Number.isFinite(time) && Math.abs(video.currentTime - time) > .12) video.currentTime = time;
  if (playing) void video.play().catch(() => undefined);
  else video.pause();
}

function disposeVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute('src');
  video.load();
}

function VideoFrame({ element, playhead, playing }: { element: Extract<EditorElement, { type: 'video' }>; playhead: number; playing: boolean }) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    const media = document.createElement('video');
    media.crossOrigin = 'anonymous';
    media.preload = 'auto';
    media.muted = element.muted ?? true;
    media.loop = element.loop ?? false;
    media.playbackRate = element.playbackRate ?? 1;
    media.src = element.src;
    media.onloadeddata = () => setVideo(media);
    return () => disposeVideo(media);
  }, [element.loop, element.muted, element.playbackRate, element.src]);
  useEffect(() => {
    if (!video) return;
    syncVideoPlayback(video, element, playhead, playing);
  }, [element, playhead, playing, video]);
  return <KonvaImage width={element.width} height={element.height} image={video ?? undefined} />;
}

function AudioPlayback({ element, playhead, playing }: { element: Extract<EditorElement, { type: 'audio' }>; playhead: number; playing: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const media = new Audio(element.src);
    media.preload = 'auto';
    audio.current = media;
    return () => { media.pause(); audio.current = null; };
  }, [element.src]);
  useEffect(() => {
    const media = audio.current;
    if (!media) return;
    media.volume = element.muted ? 0 : Math.max(0, Math.min(1, element.volume ?? 1));
    media.loop = element.loop ?? false;
    media.playbackRate = element.playbackRate ?? 1;
    const time = Math.min(element.trimEnd ?? element.duration ?? media.duration, (element.trimStart ?? 0) + playhead * media.playbackRate);
    if (Number.isFinite(time) && Math.abs(media.currentTime - time) > .12) media.currentTime = time;
    if (playing) void media.play().catch(() => undefined); else media.pause();
  }, [element.duration, element.loop, element.muted, element.playbackRate, element.trimEnd, element.trimStart, element.volume, playhead, playing]);
  return null;
}

interface CanvasElementProps {
  element: EditorElement;
  selected: boolean;
  onSelect: (additive?: boolean) => void;
  onChange: (changes: Partial<EditorElement>, record?: boolean) => void;
  register: (node: Konva.Group | null) => void;
  pageWidth: number;
  pageHeight: number;
  snapTargets: readonly SnapTargetRect[];
  customGuides: readonly SnapGuide[];
  snapThreshold: number;
  snapScale: number;
  onGuides: (guides: GuideState) => void;
  editing: boolean;
  onEditText: () => void;
  tool: EditorTool;
  onErase?: () => void;
  mask?: EditorElement;
  playhead: number;
  playing: boolean;
  renderer?: CanvasRendererContribution;
}

function CanvasElement({ element, selected, onSelect, onChange, register, pageWidth, pageHeight, snapTargets, customGuides, snapThreshold, snapScale, onGuides, editing, onEditText, tool, onErase, mask, playhead, playing, renderer }: CanvasElementProps) {
  const image = useImage(mediaPreviewSource(element));
  if (element.hidden) return null;
  const ExtensionRenderer = renderer?.component;

  const common = {
    width: element.width,
    height: element.height,
    listening: true,
  };

  return (
    <Group
      ref={register}
      id={element.id}
      name="design-element"
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      scaleX={(element.flipX ? -1 : 1) * (element.scaleX ?? 1)}
      scaleY={(element.flipY ? -1 : 1) * (element.scaleY ?? 1)}
      offsetX={element.flipX ? element.width : 0}
      offsetY={element.flipY ? element.height : 0}
      globalCompositeOperation={element.blendMode === 'normal' || !element.blendMode ? 'source-over' : element.blendMode}
      shadowColor={element.shadow?.color}
      shadowBlur={element.shadow?.blur}
      shadowOffsetX={element.shadow?.offsetX}
      shadowOffsetY={element.shadow?.offsetY}
      shadowOpacity={element.shadow?.opacity}
      draggable={!element.locked && tool === 'select'}
      dragBoundFunc={(position) => {
        const localPosition = { x: position.x / snapScale, y: position.y / snapScale };
        const snapped = snapObjectPosition(
          { ...localPosition, width: element.width, height: element.height },
          {
            page: { width: pageWidth, height: pageHeight },
            targets: snapTargets,
            guides: customGuides,
            threshold: snapThreshold,
          },
        );
        onGuides(snapped.guides);
        return { x: snapped.x * snapScale, y: snapped.y * snapScale };
      }}
      onClick={(event) => { event.cancelBubble = true; if (tool === 'eraser') onErase?.(); else if (tool === 'select') onSelect(Boolean(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)); }}
      onTap={(event) => { event.cancelBubble = true; if (tool === 'eraser') onErase?.(); else if (tool === 'select') onSelect(Boolean(event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)); }}
      onDblClick={(event) => { event.cancelBubble = true; if (element.type === 'text' && !element.locked) onEditText(); }}
      onDblTap={(event) => { event.cancelBubble = true; if (element.type === 'text' && !element.locked) onEditText(); }}
      onDragStart={() => onSelect(false)}
      onDragMove={(event) => onChange({ x: event.target.x(), y: event.target.y() }, false)}
      onDragEnd={(event) => {
        onGuides({});
        onChange({ x: event.target.x(), y: event.target.y() }, true);
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(24, element.width * scaleX),
          height: Math.max(24, element.height * scaleY),
          rotation: node.rotation(),
        }, true);
      }}
    >
      {ExtensionRenderer ? (
        <ExtensionRenderer
          element={element}
          selected={selected}
          playhead={playhead}
          playing={playing}
          update={onChange}
        />
      ) : <>
      {element.type === 'text' && (
        element.textPath?.enabled && !element.runs?.length ? <TextPath
          data={createArcTextPath(element.width, element.height, element.textPath).data}
          text={transformText(element.text, element.textTransform)}
          fontSize={element.fontSize}
          fontFamily={element.fontFamily}
          fontStyle={`${(element.fontWeight ?? (element.fontStyle.includes('bold') ? 700 : 400)) >= 600 ? 'bold ' : ''}${element.fontStyle.includes('italic') ? 'italic' : ''}`.trim() || 'normal'}
          fill={element.fill}
          align={element.align}
          letterSpacing={element.letterSpacing}
          textDecoration={element.textDecoration === 'line-through' ? 'line-through' : element.textDecoration}
          direction={element.direction}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          visible={!editing}
        /> : element.runs?.length ? <Group visible={!editing} clip={{ x: 0, y: 0, width: element.width, height: element.height }}>
          {element.runs.reduce<{ nodes: React.ReactNode[]; x: number }>((result, run, index) => {
            const size = run.fontSize ?? element.fontSize;
            const text = transformText(run.text, element.textTransform);
            result.nodes.push(<Text key={`${index}-${run.text}`} x={result.x} y={0} text={text} fontSize={size} fontFamily={run.fontFamily ?? element.fontFamily} fontStyle={`${(run.fontWeight ?? element.fontWeight ?? 400) >= 600 ? 'bold ' : ''}${run.fontStyle === 'italic' ? 'italic' : ''}`.trim() || 'normal'} fill={run.fill ?? element.fill} textDecoration={run.underline ? 'underline' : run.strikeThrough ? 'line-through' : undefined} padding={element.padding ?? 0} />);
            result.x += text.length * size * .56 + Math.max(0, text.length - 1) * element.letterSpacing;
            return result;
          }, { nodes: [], x: 0 }).nodes}
        </Group> : <Text
            {...common}
            text={transformText(element.text, element.textTransform)}
            fontSize={element.fontSize}
            fontFamily={element.fontFamily}
            fontStyle={`${(element.fontWeight ?? (element.fontStyle.includes('bold') ? 700 : 400)) >= 600 ? 'bold ' : ''}${element.fontStyle.includes('italic') ? 'italic' : ''}`.trim() || 'normal'}
            fill={element.fill}
            align={element.align}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            verticalAlign={element.verticalAlign ?? 'top'}
            wrap="word"
            textDecoration={element.textDecoration === 'line-through' ? 'line-through' : element.textDecoration}
            padding={element.padding ?? 0}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            visible={!editing}
          />
      )}
      {element.type === 'shape' && element.shape === 'rect' && (
        <Rect {...common} fill={element.fill} cornerRadius={element.cornerRadius} stroke={element.stroke} strokeWidth={element.strokeWidth} />
      )}
      {element.type === 'shape' && (element.shape === 'circle' || element.shape === 'ellipse') && (
        <Ellipse x={element.width / 2} y={element.height / 2} radiusX={element.width / 2} radiusY={element.height / 2} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />
      )}
      {element.type === 'shape' && element.shape === 'star' && (
        <Star x={element.width / 2} y={element.height / 2} numPoints={5} innerRadius={Math.min(element.width, element.height) * .22} outerRadius={Math.min(element.width, element.height) * .48} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />
      )}
      {element.type === 'shape' && element.shape === 'triangle' && (
        <Line points={[element.width / 2, 0, element.width, element.height, 0, element.height]} closed fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} lineJoin="round" />
      )}
      {element.type === 'shape' && element.shape === 'polygon' && (
        <Line points={Array.from({ length: Math.max(3, element.sides ?? 6) }, (_, index) => {
          const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(3, element.sides ?? 6);
          return [element.width / 2 + Math.cos(angle) * element.width / 2, element.height / 2 + Math.sin(angle) * element.height / 2];
        }).flat()} closed fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} lineJoin="round" />
      )}
      {element.type === 'image' && (
        <Group clipFunc={(context) => {
          if (mask?.type === 'shape' && (mask.shape === 'circle' || mask.shape === 'ellipse')) {
            context.beginPath();
            context.ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
            context.closePath();
            return;
          }
          if (mask?.type === 'shape' && mask.shape === 'triangle') {
            context.beginPath(); context.moveTo(element.width / 2, 0); context.lineTo(element.width, element.height); context.lineTo(0, element.height); context.closePath();
            return;
          }
          const radius = Math.min(element.cornerRadius, element.width / 2, element.height / 2);
          context.beginPath();
          context.roundRect(0, 0, element.width, element.height, radius);
          context.closePath();
        }}>
          <FilteredImage element={element} image={image} />
        </Group>
      )}
      {element.type === 'svg' && <KonvaImage {...common} image={image ?? undefined} />}
      {element.type === 'video' && (
        <Group clipFunc={(context) => {
          context.beginPath();
          context.roundRect(0, 0, element.width, element.height, Math.min(element.cornerRadius ?? 0, element.width / 2, element.height / 2));
          context.closePath();
        }}>
          <Rect {...common} fill="#171923" />
          <VideoFrame element={element} playhead={playhead} playing={playing} />
          {!playing && <Text text="▶" width={element.width} height={element.height} align="center" verticalAlign="middle" fill="white" fontSize={Math.min(element.width, element.height) * .2} />}
        </Group>
      )}
      {element.type === 'audio' && (
        <Group>
          <AudioPlayback element={element} playhead={playhead} playing={playing} />
          <Rect {...common} fill="#f2efff" cornerRadius={Math.min(16, element.height / 3)} stroke="#8b6cff" strokeWidth={2} />
          <Line
            points={(element.waveform?.length ? element.waveform : [.2, .5, .8, .35, .65, .25, .9, .45]).flatMap((value, index, values) => [
              18 + index * Math.max(1, (element.width - 36) / Math.max(1, values.length - 1)),
              element.height / 2 - value * element.height * .3,
            ])}
            stroke="#6d4aff" strokeWidth={3} lineCap="round" lineJoin="round"
          />
        </Group>
      )}
      {element.type === 'line' && (
        <Line points={element.points ?? [0, element.height / 2, element.width, element.height / 2]} stroke={element.fill} strokeWidth={element.strokeWidth} dash={element.dash} lineCap={element.lineCap ?? 'round'} lineJoin={element.lineJoin ?? 'round'} hitStrokeWidth={Math.max(20, element.strokeWidth)} />
      )}
      {element.type === 'drawing' && (
        <Line points={element.points} stroke={element.stroke} strokeWidth={element.strokeWidth} dash={element.dash} tension={element.tension ?? .2} lineCap={element.lineCap ?? 'round'} lineJoin={element.lineJoin ?? 'round'} closed={element.closed} fill={element.fill} hitStrokeWidth={Math.max(20, element.strokeWidth)} />
      )}
      {element.type === 'table' && (() => {
        const columnWidths = element.columnWidths ?? Array.from({ length: element.columns }, () => element.width / element.columns);
        const rowHeights = element.rowHeights ?? Array.from({ length: element.rows }, () => element.height / element.rows);
        return element.cells.flatMap((row, rowIndex) => row.map((cell, columnIndex) => {
          if (isCoveredGridCell(cell)) return null;
          const x = columnWidths.slice(0, columnIndex).reduce((sum, value) => sum + value, 0);
          const y = rowHeights.slice(0, rowIndex).reduce((sum, value) => sum + value, 0);
          const width = columnWidths.slice(columnIndex, columnIndex + (cell.colSpan ?? 1)).reduce((sum, value) => sum + value, 0);
          const height = rowHeights.slice(rowIndex, rowIndex + (cell.rowSpan ?? 1)).reduce((sum, value) => sum + value, 0);
          return <Group key={cell.id} x={x} y={y}>
            <Rect width={width} height={height} fill={cell.fill ?? '#ffffff'} stroke={element.borderColor ?? '#cbd0db'} strokeWidth={element.borderWidth ?? 1} dash={element.borderStyle === 'dashed' ? [7, 4] : element.borderStyle === 'dotted' ? [2, 3] : undefined} />
            <Text text={cell.text} width={width} height={height} padding={cell.padding ?? 8} fill={cell.textColor ?? '#182033'} fontFamily={cell.fontFamily ?? 'Arial'} fontSize={cell.fontSize ?? 16} fontStyle={(cell.fontWeight ?? 400) >= 600 ? 'bold' : 'normal'} align={cell.align ?? 'left'} verticalAlign={cell.verticalAlign ?? 'middle'} />
          </Group>;
        }));
      })()}
      {element.type === 'group' && <Rect {...common} stroke={selected ? '#7C5CFC' : 'transparent'} dash={[8, 5]} listening={false} />}
      </>}
      {selected && element.locked && (
        <Rect {...common} stroke="#7C5CFC" strokeWidth={3} dash={[10, 8]} listening={false} />
      )}
    </Group>
  );
}

export const EditorCanvas = forwardRef<CanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { document, selectedIds, zoom, onSelect, onSelectMany, onZoomChange, tool = 'select', brush = { color: '#191b24', width: 8, opacity: 1 }, onCreateElement, onErase, playhead = 0, playing = false, onChange }, ref,
) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const pinchZoom = useRef(zoom);
  const drawingPoints = useRef<number[] | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [guides, setGuides] = useState<GuideState>({});
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [liveDrawing, setLiveDrawing] = useState<number[] | null>(null);
  const selected = useMemo(() => document.elements.filter((element) => selectedIds.includes(element.id)), [document.elements, selectedIds]);
  const extensionRegistry = useExtensionRegistry();
  const extensionRenderers = extensionRegistry.getCanvasRenderers();
  const snapTargets = useMemo<SnapTargetRect[]>(() => document.elements
    .filter((element) => !element.hidden && !selectedIds.includes(element.id))
    .map((element) => ({
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width * Math.abs(element.scaleX ?? 1),
      height: element.height * Math.abs(element.scaleY ?? 1),
    })), [document.elements, selectedIds]);
  const customGuides = useMemo<SnapGuide[]>(() => document.metadata?.guides?.map((guide) => ({
    id: guide.id,
    axis: guide.axis,
    position: guide.position,
  })) ?? [], [document.metadata?.guides]);

  useImperativeHandle(ref, () => ({
    exportImage: () => {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      if (!stage) return null;
      transformer?.visible(false);
      transformer?.getLayer()?.draw();
      const data = stage.toDataURL({ pixelRatio: 2 / zoom });
      transformer?.visible(true);
      transformer?.getLayer()?.draw();
      return data;
    },
  }), [zoom]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.nodes(selected.filter((element) => !element.locked).map((element) => nodes.current.get(element.id)).filter(Boolean) as Konva.Group[]);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, selected, document.elements]);

  useEffect(() => { pinchZoom.current = zoom; }, [zoom]);

  const pointerInDocument = () => {
    const pointer = stageRef.current?.getPointerPosition();
    return pointer ? { x: pointer.x / zoom, y: pointer.y / zoom } : null;
  };

  const beginMarquee = (target: Konva.Node) => {
    if (tool === 'draw' || tool === 'highlighter') {
      const pointer = pointerInDocument();
      if (!pointer) return;
      drawingPoints.current = [pointer.x, pointer.y];
      setLiveDrawing(drawingPoints.current);
      return;
    }
    if (tool !== 'select') return;
    if (target !== target.getStage() && target.name() !== 'page-background') return;
    const pointer = pointerInDocument();
    if (!pointer) return;
    selectionStart.current = pointer;
    setSelectionBox({ ...pointer, width: 0, height: 0 });
    onSelect(null);
  };

  const updateMarquee = () => {
    if (drawingPoints.current) {
      const pointer = pointerInDocument();
      if (!pointer) return;
      const points = [...drawingPoints.current, pointer.x, pointer.y];
      drawingPoints.current = points;
      setLiveDrawing(points);
      return;
    }
    if (!selectionStart.current) return;
    const pointer = pointerInDocument();
    if (!pointer) return;
    const start = selectionStart.current;
    setSelectionBox({
      x: Math.min(start.x, pointer.x),
      y: Math.min(start.y, pointer.y),
      width: Math.abs(pointer.x - start.x),
      height: Math.abs(pointer.y - start.y),
    });
  };

  const finishMarquee = () => {
    if (drawingPoints.current) {
      const points = drawingPoints.current;
      drawingPoints.current = null;
      setLiveDrawing(null);
      if (points.length < 4 || !onCreateElement) return;
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const width = Math.max(1, Math.max(...xs) - x);
      const height = Math.max(1, Math.max(...ys) - y);
      onCreateElement({
        id: crypto.randomUUID(), type: 'drawing', name: tool === 'highlighter' ? 'Highlighter' : 'Drawing',
        x, y, width, height, rotation: 0, opacity: tool === 'highlighter' ? Math.min(.45, brush.opacity) : brush.opacity,
        points: points.flatMap((value, index) => index % 2 === 0 ? [value - x] : [value - y]),
        stroke: brush.color, strokeWidth: tool === 'highlighter' ? brush.width * 2 : brush.width,
        tension: .25, lineCap: 'round', lineJoin: 'round', blendMode: tool === 'highlighter' ? 'multiply' : 'normal',
      });
      return;
    }
    const box = selectionBox;
    selectionStart.current = null;
    setSelectionBox(null);
    if (!box || box.width < 3 || box.height < 3 || !onSelectMany) return;
    const ids = document.elements
      .filter((element) => !element.hidden && Konva.Util.haveIntersection(box, {
        x: element.x, y: element.y, width: element.width, height: element.height,
      }))
      .map((element) => element.id);
    onSelectMany(ids);
  };

  const editingText = document.elements.find((element) => element.id === editingTextId && element.type === 'text') as Extract<EditorElement, { type: 'text' }> | undefined;
  const finishTextEdit = () => {
    if (editingText && editingTextValue !== editingText.text) onChange(editingText.id, { text: editingTextValue }, true);
    setEditingTextId(null);
  };

  return (
    <div className="canvas-page-wrap" style={{ width: document.width * zoom, height: document.height * zoom }}>
      <Stage
        ref={stageRef}
        width={document.width * zoom}
        height={document.height * zoom}
        scaleX={zoom}
        scaleY={zoom}
        style={{ width: document.width * zoom, height: document.height * zoom }}
        onWheel={(event) => {
          event.evt.preventDefault();
          onZoomChange?.(zoom * (event.evt.deltaY > 0 ? .9 : 1.1));
        }}
        onMouseDown={(event) => beginMarquee(event.target)}
        onMouseMove={updateMarquee}
        onMouseUp={finishMarquee}
        onTouchStart={(event) => {
          const touches = event.evt.touches;
          if (touches.length === 2) {
            const [a, b] = Array.from(touches);
            pinchDistance.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            pinchZoom.current = zoom;
            selectionStart.current = null;
            setSelectionBox(null);
            return;
          }
          beginMarquee(event.target);
        }}
        onTouchMove={(event) => {
          const touches = event.evt.touches;
          if (touches.length === 2 && pinchDistance.current) {
            event.evt.preventDefault();
            const [a, b] = Array.from(touches);
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            onZoomChange?.(pinchZoom.current * distance / pinchDistance.current);
            return;
          }
          updateMarquee();
        }}
        onTouchEnd={() => {
          if (pinchDistance.current) {
            pinchDistance.current = null;
            return;
          }
          finishMarquee();
        }}
      >
        <Layer>
          <Rect name="page-background" width={document.width} height={document.height} fill={document.background} shadowColor="#172034" shadowBlur={22 / zoom} shadowOpacity={.12} />
          {Boolean(document.metadata?.bleed) && <Rect x={document.metadata?.bleed} y={document.metadata?.bleed} width={document.width - (document.metadata?.bleed ?? 0) * 2} height={document.height - (document.metadata?.bleed ?? 0) * 2} stroke="#ef476f" strokeWidth={1 / zoom} dash={[8 / zoom, 5 / zoom]} listening={false} />}
          {document.metadata?.safeArea && <Rect x={document.metadata.safeArea.left} y={document.metadata.safeArea.top} width={document.width - document.metadata.safeArea.left - document.metadata.safeArea.right} height={document.height - document.metadata.safeArea.top - document.metadata.safeArea.bottom} stroke="#20a4f3" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} listening={false} />}
          {document.metadata?.guides?.map((guide) => <Line key={guide.id} points={guide.axis === 'x' ? [guide.position, 0, guide.position, document.height] : [0, guide.position, document.width, guide.position]} stroke="#20a4f3" strokeWidth={1 / zoom} listening={false} />)}
          {document.elements.map((element) => (
            <CanvasElement
              key={element.id}
              element={animatedElement(element, playhead)}
              selected={selectedIds.includes(element.id)}
              onSelect={(additive) => onSelect(element.id, additive)}
              onChange={(changes, record) => onChange(element.id, changes, record)}
              register={(node) => {
                if (node) nodes.current.set(element.id, node);
                else nodes.current.delete(element.id);
              }}
              pageWidth={document.width}
              pageHeight={document.height}
              snapTargets={snapTargets}
              customGuides={customGuides}
              snapThreshold={9 / Math.max(zoom, .01)}
              snapScale={Math.max(zoom, .01)}
              onGuides={setGuides}
              editing={editingTextId === element.id}
              onEditText={() => {
                if (element.type !== 'text') return;
                setEditingTextId(element.id);
                setEditingTextValue(element.text);
              }}
              tool={tool}
              onErase={() => onErase?.(element.id)}
              mask={'maskId' in element && element.maskId ? document.elements.find((item) => item.id === element.maskId) : undefined}
              playhead={playhead}
              playing={playing}
              renderer={extensionRenderers.find((renderer) => renderer.matches(element))}
            />
          ))}
          {liveDrawing && <Line points={liveDrawing} stroke={brush.color} strokeWidth={tool === 'highlighter' ? brush.width * 2 : brush.width} opacity={tool === 'highlighter' ? Math.min(.45, brush.opacity) : brush.opacity} tension={.25} lineCap="round" lineJoin="round" listening={false} />}
          {guides.x !== undefined && <Line points={[guides.x, 0, guides.x, document.height]} stroke="#ef476f" strokeWidth={1 / zoom} dash={[7 / zoom, 5 / zoom]} listening={false} />}
          {guides.y !== undefined && <Line points={[0, guides.y, document.width, guides.y]} stroke="#ef476f" strokeWidth={1 / zoom} dash={[7 / zoom, 5 / zoom]} listening={false} />}
          {selectionBox && <Rect {...selectionBox} fill="rgba(124,92,252,.12)" stroke="#7C5CFC" strokeWidth={1.5 / zoom} dash={[6 / zoom, 4 / zoom]} listening={false} />}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={selected.some((element) => element.type === 'image' && element.aspectLocked !== false)}
            flipEnabled={false}
            anchorSize={12 / zoom}
            anchorCornerRadius={3 / zoom}
            borderStroke="#7C5CFC"
            borderStrokeWidth={2 / zoom}
            anchorFill="#FFFFFF"
            anchorStroke="#7C5CFC"
            anchorStrokeWidth={2 / zoom}
            rotateAnchorOffset={28 / zoom}
            boundBoxFunc={(oldBox, newBox) => newBox.width < 24 || newBox.height < 24 ? oldBox : newBox}
          />
        </Layer>
      </Stage>
      {editingText?.type === 'text' && (
        <textarea
          autoFocus
          aria-label="Edit canvas text"
          value={editingTextValue}
          onChange={(event) => setEditingTextValue(event.target.value)}
          onBlur={finishTextEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setEditingTextValue(editingText.text);
              setEditingTextId(null);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') finishTextEdit();
          }}
          style={{
            position: 'absolute',
            left: editingText.x * zoom,
            top: editingText.y * zoom,
            width: editingText.width * zoom,
            height: editingText.height * zoom,
            transform: `rotate(${editingText.rotation}deg)`,
            transformOrigin: 'top left',
            zIndex: 5,
            resize: 'none',
            overflow: 'hidden',
            border: '2px solid #7C5CFC',
            outline: 'none',
            padding: 0,
            background: 'transparent',
            color: editingText.fill,
            fontFamily: editingText.fontFamily,
            fontSize: editingText.fontSize * zoom,
            fontWeight: editingText.fontStyle === 'bold' ? 700 : 400,
            lineHeight: editingText.lineHeight,
            letterSpacing: editingText.letterSpacing * zoom,
            textAlign: editingText.align,
          }}
        />
      )}
    </div>
  );
});
