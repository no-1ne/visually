import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/store/editor-store';
import { templates } from '@/templates';
import type { DesignDocument, EditorElement } from '@/types';
import { PanelHeading } from './panel-heading';

function PreviewElement({ element }: { element: EditorElement }) {
  if (element.hidden) return null;
  const transform = `translate(${element.x} ${element.y}) rotate(${element.rotation})`;
  const opacity = element.opacity;
  if (element.type === 'shape') {
    if (element.shape === 'circle' || element.shape === 'ellipse') return <ellipse transform={transform} opacity={opacity} cx={element.width / 2} cy={element.height / 2} rx={element.width / 2} ry={element.height / 2} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />;
    if (element.shape === 'triangle') return <polygon transform={transform} opacity={opacity} points={`${element.width / 2},0 ${element.width},${element.height} 0,${element.height}`} fill={element.fill} />;
    return <rect transform={transform} opacity={opacity} width={element.width} height={element.height} rx={element.cornerRadius} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} />;
  }
  if (element.type === 'text') {
    const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
    const x = element.align === 'center' ? element.width / 2 : element.align === 'right' ? element.width : 0;
    return <text transform={transform} opacity={opacity} x={x} y={element.fontSize} fill={element.fill} fontFamily={element.fontFamily} fontSize={element.fontSize} fontWeight={element.fontStyle.includes('bold') ? 700 : 400} letterSpacing={element.letterSpacing} textAnchor={anchor}>{element.text.split('\n').map((line, index) => <tspan key={`${line}-${index}`} x={x} dy={index ? element.fontSize * element.lineHeight : 0}>{line}</tspan>)}</text>;
  }
  if (element.type === 'line') return <line transform={transform} opacity={opacity} x1={0} y1={element.height / 2} x2={element.width} y2={element.height / 2} stroke={element.fill} strokeWidth={element.strokeWidth} strokeDasharray={element.dash.join(' ')} />;
  return null;
}

function TemplatePreview({ document }: { document: DesignDocument }) {
  return <span className="template-preview-shell">
    <svg className="template-preview" viewBox={`0 0 ${document.width} ${document.height}`} role="img" aria-label={`${document.name} preview`}>
      <rect width={document.width} height={document.height} fill={document.background} />
      {document.elements.map((element) => <PreviewElement key={element.id} element={element} />)}
    </svg>
  </span>;
}

export function TemplatesPanel() {
  const applyTemplate = useEditorStore((state) => state.applyTemplate);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const categories = useMemo(() => ['All', ...new Set(templates.map((template) => template.category))], []);
  const visible = useMemo(() => templates.filter((template) =>
    (category === 'All' || template.category === category)
    && `${template.name} ${template.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [category, query]);
  return (
    <>
      <PanelHeading title="Templates" note={`${templates.length} polished designs, fully editable.`} />
      <div className="relative mb-3"><SearchIcon className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><Input aria-label="Search templates" className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" /></div>
      <div className="template-category-row mb-4" aria-label="Template categories">{categories.map((item) => <button key={item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((template) => (
          <button key={template.id} className="template-card group text-left" onClick={() => applyTemplate(template.document)}>
            <TemplatePreview document={template.document} />
            <span className="mt-2 block truncate text-xs font-medium">{template.name}</span>
            <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{template.category}</span><span>{template.document.width}×{template.document.height}</span></span>
          </button>
        ))}
      </div>
      {!visible.length && <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No templates match “{query}”.</div>}
    </>
  );
}
