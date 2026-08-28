import { useRef, useState } from 'react';
import { BoldIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { replaceTextKeepingRuns, styleTextRange, type RichTextStyle } from '@/features/advanced/rich-text';
import type { EditorElement, TextElement } from '@/types';

export function RichTextRangeControls({ element, patch }: { element: TextElement; patch: (changes: Partial<EditorElement>) => void }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const rememberRange = () => {
    const target = textarea.current;
    if (target) setRange({ start: target.selectionStart, end: target.selectionEnd });
  };
  const apply = (style: RichTextStyle) => {
    const start = range.start === range.end ? 0 : range.start;
    const end = range.start === range.end ? element.text.length : range.end;
    patch({ runs: styleTextRange(element.text, element.runs, start, end, style) } as Partial<TextElement>);
  };
  return <div className="mb-3 space-y-2">
    <Textarea
      ref={textarea}
      value={element.text}
      onSelect={rememberRange}
      onKeyUp={rememberRange}
      onChange={(event) => {
        const text = event.target.value;
        patch({ text, runs: replaceTextKeepingRuns(element.text, element.runs, text) } as Partial<TextElement>);
      }}
      className="min-h-20 resize-none"
    />
    <div className="flex items-center gap-1" aria-label="Selected text formatting">
      <Button size="icon-sm" variant="outline" aria-label="Bold selected text" onClick={() => apply({ fontWeight: 700 })}><BoldIcon /></Button>
      <Button size="icon-sm" variant="outline" aria-label="Italicize selected text" onClick={() => apply({ fontStyle: 'italic' })}><ItalicIcon /></Button>
      <Button size="icon-sm" variant="outline" aria-label="Underline selected text" onClick={() => apply({ underline: true })}><UnderlineIcon /></Button>
      <Button size="icon-sm" variant="outline" aria-label="Strike selected text" onClick={() => apply({ strikeThrough: true })}><StrikethroughIcon /></Button>
      <Input className="ml-auto h-8 w-11 p-1" type="color" aria-label="Selected text color" defaultValue={element.fill} onChange={(event) => apply({ fill: event.target.value })} />
    </div>
    <p className="text-[10px] text-muted-foreground">Select characters above, then apply formatting. With no selection, formatting applies to all text.</p>
  </div>;
}

