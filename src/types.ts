export const CURRENT_DOCUMENT_SCHEMA_VERSION = 2 as const;

export type DocumentSchemaVersion = typeof CURRENT_DOCUMENT_SCHEMA_VERSION;
export type BuiltInPanelId =
  | 'templates' | 'text' | 'elements' | 'uploads' | 'layers'
  | 'draw' | 'tables' | 'media' | 'animations' | 'effects' | 'size' | 'fonts';
/** Built-in IDs retain autocomplete while extensions may use a namespaced string ID. */
export type PanelId = BuiltInPanelId | (string & { readonly __extensionPanelId?: never });
export type ShapeKind = 'rect' | 'circle' | 'star' | 'triangle' | 'polygon' | 'ellipse';
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference'
  | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface ElementShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface AnimationEasing {
  type: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier' | 'spring';
  controlPoints?: [number, number, number, number];
}

export type AnimatableProperty =
  | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'scaleX' | 'scaleY'
  | 'fill' | 'stroke' | 'fontSize' | 'volume';

export interface AnimationKeyframe {
  id: string;
  time: number;
  value: number | string | boolean;
  easing?: AnimationEasing;
}

export interface AnimationTrack {
  id: string;
  property: AnimatableProperty;
  keyframes: AnimationKeyframe[];
}

export interface ElementAnimation {
  enabled: boolean;
  delay?: number;
  duration?: number;
  iterationCount?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  tracks: AnimationTrack[];
}

export interface BaseElement {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  groupId?: string;
  /** Ordered inner-to-outer logical groups. `groupId` mirrors the outermost entry for legacy documents. */
  groupPath?: string[];
  parentId?: string;
  flipX?: boolean;
  flipY?: boolean;
  scaleX?: number;
  scaleY?: number;
  blendMode?: BlendMode;
  shadow?: ElementShadow;
  animation?: ElementAnimation;
  metadata?: Record<string, unknown>;
}

export interface RichTextRun {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fill?: string;
  background?: string;
  underline?: boolean;
  strikeThrough?: boolean;
  link?: string;
}

export interface TextPathSettings {
  enabled: boolean;
  type: 'arc';
  /** Signed bend percentage: positive arches upward, negative bows downward. */
  bend: number;
  reverse?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  runs?: RichTextRun[];
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  fontWeight?: number;
  fill: string;
  align: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  letterSpacing: number;
  lineHeight: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  padding?: number;
  stroke?: string;
  strokeWidth?: number;
  direction?: 'ltr' | 'rtl' | 'auto';
  textPath?: TextPathSettings;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill: string;
  cornerRadius: number;
  stroke?: string;
  strokeWidth?: number;
  sides?: number;
  innerRadius?: number;
  pathData?: string;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface MediaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface MediaEffects {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  blur?: number;
  grayscale?: number;
  sepia?: number;
  invert?: number;
  temperature?: number;
  vignette?: number;
  duotone?: [string, string];
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  aspectLocked?: boolean;
  alt?: string;
  mimeType?: string;
  cornerRadius: number;
  crop?: MediaCrop;
  effects?: MediaEffects;
  maskId?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export interface SvgElement extends BaseElement {
  type: 'svg';
  src?: string;
  markup?: string;
  viewBox?: string;
  fill?: string;
  stroke?: string;
  preserveAspectRatio?: string;
  effects?: MediaEffects;
}

export interface LineElement extends BaseElement {
  type: 'line';
  fill: string;
  strokeWidth: number;
  dash: number[];
  points?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  startMarker?: 'none' | 'arrow' | 'circle' | 'square';
  endMarker?: 'none' | 'arrow' | 'circle' | 'square';
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dash?: number[];
  closed?: boolean;
  fill?: string;
}

export interface TableCell {
  id: string;
  text: string;
  rowSpan?: number;
  colSpan?: number;
  fill?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  columns: number;
  cells: TableCell[][];
  columnWidths?: number[];
  rowHeights?: number[];
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}

interface TimedMediaElement extends BaseElement {
  src: string;
  mimeType?: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  loop?: boolean;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
}

export interface AudioElement extends TimedMediaElement {
  type: 'audio';
  waveform?: number[];
  poster?: string;
}

export interface VideoElement extends TimedMediaElement {
  type: 'video';
  poster?: string;
  crop?: MediaCrop;
  effects?: MediaEffects;
  cornerRadius?: number;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  childIds: string[];
  clipPathId?: string;
}

export type EditorElement =
  | TextElement | ShapeElement | ImageElement | SvgElement | LineElement | DrawingElement
  | TableElement | AudioElement | VideoElement | GroupElement;

export interface PageTransition {
  type: 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface PageMetadata {
  id?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  duration?: number;
  transition?: PageTransition;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  bleed?: number;
  guides?: Array<{ id: string; axis: 'x' | 'y'; position: number; locked?: boolean }>;
  notes?: string;
}

export interface DesignDocument {
  /** Optional so version-1 JSON and existing template literals remain valid. */
  schemaVersion?: DocumentSchemaVersion;
  name: string;
  width: number;
  height: number;
  background: string;
  elements: EditorElement[];
  metadata?: PageMetadata;
}

export interface DesignProject {
  schemaVersion: DocumentSchemaVersion;
  name?: string;
  pages: DesignDocument[];
  metadata?: Record<string, unknown>;
}

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  background: string;
  accent: string;
  document: DesignDocument;
}
