import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorStore } from '@/store/editor-store';
import { ElementsPanel } from './panels/elements-panel';
import { LayersPanel } from './panels/layers-panel';
import { PropertiesPanel } from './panels/properties-panel';
import { TemplatesPanel } from './panels/templates-panel';
import { TextPanel } from './panels/text-panel';
import { UploadsPanel } from './panels/uploads-panel';
import { AnimationsPanel, DrawPanel, EffectsPanel, FontsPanel, MediaPanel, SizePanel, TablesPanel } from './panels/advanced-panels';
import { useEditorExtensionContext, useExtensionRegistry } from '@/extensions';

export function EditorPanel() {
  const activePanel = useEditorStore((state) => state.activePanel);
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedId = useEditorStore((state) => state.selectedIds[0]);
  const selected = page.elements.find((element) => element.id === selectedId);
  const extensionRegistry = useExtensionRegistry();
  const extensionContext = useEditorExtensionContext();
  const extensionPanel = extensionRegistry.getPanels().find((panel) => panel.id === activePanel);
  const ExtensionPanel = extensionPanel?.component;
  return (
    <ScrollArea className="h-full">
      <div className="p-4 pb-8">
        {activePanel === 'templates' && <TemplatesPanel />}
        {activePanel === 'text' && <TextPanel />}
        {activePanel === 'elements' && <ElementsPanel />}
        {activePanel === 'uploads' && <UploadsPanel />}
        {activePanel === 'layers' && <LayersPanel />}
        {activePanel === 'draw' && <DrawPanel />}
        {activePanel === 'tables' && <TablesPanel />}
        {activePanel === 'media' && <MediaPanel />}
        {activePanel === 'animations' && <AnimationsPanel />}
        {activePanel === 'effects' && <EffectsPanel />}
        {activePanel === 'size' && <SizePanel />}
        {activePanel === 'fonts' && <FontsPanel />}
        {ExtensionPanel && <ExtensionPanel {...extensionContext} />}
        {selected && <PropertiesPanel element={selected} />}
      </div>
    </ScrollArea>
  );
}
