import { TypeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore } from '@/store/editor-store';
import { PanelHeading } from './panel-heading';

const uid = () => crypto.randomUUID();

export function TextPanel() {
  const addElement = useEditorStore((state) => state.addElement);
  const addText = (preset: 'heading' | 'subheading' | 'body') => {
    const values = {
      heading: { text: 'Add a heading', size: 76, height: 110, weight: 'bold' as const },
      subheading: { text: 'Add a subheading', size: 44, height: 70, weight: 'bold' as const },
      body: { text: 'Add a little bit of body text', size: 28, height: 100, weight: 'normal' as const },
    }[preset];
    addElement({
      id: uid(), type: 'text', name: preset[0].toUpperCase() + preset.slice(1), text: values.text,
      x: 240, y: 410, width: 600, height: values.height, rotation: 0, opacity: 1,
      fontSize: values.size, fontFamily: 'Manrope', fontStyle: values.weight, fill: '#171923',
      align: 'center', letterSpacing: 0, lineHeight: 1.1,
    });
  };
  return (
    <>
      <PanelHeading title="Text" note="Build hierarchy with editable type." />
      <Button className="mb-4 w-full bg-[#7657ff] hover:bg-[#6546ee]" onClick={() => addText('heading')}>
        <TypeIcon data-icon="inline-start" /> Add text box
      </Button>
      <div className="space-y-2">
        <button className="text-preset text-preset-heading" onClick={() => addText('heading')}>Add a heading</button>
        <button className="text-preset text-preset-sub" onClick={() => addText('subheading')}>Add a subheading</button>
        <button className="text-preset text-preset-body" onClick={() => addText('body')}>Add a little bit of body text</button>
      </div>
      <Separator className="my-5" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Text styles</span>
        <Badge variant="secondary">3 styles</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {['Aa', 'Ab', 'Ag'].map((item, index) => (
          <button key={item} className={`font-swatch font-swatch-${index}`} onClick={() => addText(index === 2 ? 'body' : 'subheading')}>{item}</button>
        ))}
      </div>
    </>
  );
}
