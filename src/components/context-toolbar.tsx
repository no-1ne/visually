import {
  BringToFrontIcon, CopyIcon, GroupIcon, LockIcon, SendToBackIcon, Trash2Icon, UngroupIcon, UnlockIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore } from '@/store/editor-store';
import { useEditorExtensionContext, useExtensionRegistry } from '@/extensions';

export function ContextToolbar() {
  const page = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedId = useEditorStore((state) => state.selectedIds[0]);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selected = page.elements.find((element) => element.id === selectedId);
  const updatePage = useEditorStore((state) => state.updatePage);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const groupSelected = useEditorStore((state) => state.groupSelected);
  const ungroupSelected = useEditorStore((state) => state.ungroupSelected);
  const alignSelected = useEditorStore((state) => state.alignSelected);
  const distributeSelected = useEditorStore((state) => state.distributeSelected);
  const copyStyle = useEditorStore((state) => state.copyStyle);
  const pasteStyle = useEditorStore((state) => state.pasteStyle);
  const styleClipboard = useEditorStore((state) => state.styleClipboard);
  const colorElement = selected && 'fill' in selected && typeof selected.fill === 'string' ? selected : null;
  const extensionRegistry = useExtensionRegistry();
  const extensionContext = useEditorExtensionContext();
  const extensionActions = extensionRegistry.getToolbarActions().filter((action) => action.when?.(extensionContext) ?? true);

  return (
    <div className="context-toolbar">
      {!selected ? (
        <>
          <span className="toolbar-label">Page</span>
          <label className="toolbar-color-label"><input type="color" value={page.background} onChange={(event) => updatePage({ background: event.target.value })} /> Background</label>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-xs text-muted-foreground">{page.width} × {page.height}px</span>
        </>
      ) : (
        <>
          <span className="toolbar-label capitalize">{selected.type}</span>
          {colorElement && <label className="toolbar-color-label"><input type="color" value={colorElement.fill} onChange={(event) => useEditorStore.getState().updateElement(selected.id, { fill: event.target.value })} /> Color</label>}
          <Separator orientation="vertical" className="h-5" />
          <Button variant="ghost" size="sm" onClick={() => moveLayer(selected.id, 'top')}><BringToFrontIcon /> <span className="hidden xl:inline">Forward</span></Button>
          <Button variant="ghost" size="sm" onClick={() => moveLayer(selected.id, 'bottom')}><SendToBackIcon /> <span className="hidden xl:inline">Backward</span></Button>
          {selectedIds.length > 1 && <>
            <Button variant="ghost" size="sm" onClick={() => alignSelected('left')} aria-label="Align left">Left</Button>
            <Button variant="ghost" size="sm" onClick={() => alignSelected('middle')} aria-label="Align middle">Middle</Button>
            <Button variant="ghost" size="sm" onClick={() => alignSelected('right')} aria-label="Align right">Right</Button>
            <Button variant="ghost" size="sm" onClick={() => distributeSelected('horizontal')} aria-label="Distribute horizontally">Distribute</Button>
          </>}
          <Button variant="ghost" size="icon-sm" onClick={duplicateSelected} aria-label="Duplicate"><CopyIcon /></Button>
          <Button variant="ghost" size="sm" onClick={() => copyStyle(selected.id)} aria-label="Copy style">Style</Button>
          <Button variant="ghost" size="sm" disabled={!styleClipboard} onClick={pasteStyle} aria-label="Paste style">Apply</Button>
          {selectedIds.length > 1 && <Button variant="ghost" size="icon-sm" onClick={groupSelected} aria-label="Group"><GroupIcon /></Button>}
          {selectedIds.some((id) => page.elements.find((element) => element.id === id)?.groupId) && <Button variant="ghost" size="icon-sm" onClick={ungroupSelected} aria-label="Ungroup"><UngroupIcon /></Button>}
          <Button variant="ghost" size="icon-sm" onClick={() => toggleLock(selected.id)} aria-label="Lock">{selected.locked ? <LockIcon /> : <UnlockIcon />}</Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={deleteSelected} aria-label="Delete"><Trash2Icon /></Button>
        </>
      )}
      {extensionActions.length > 0 && <Separator orientation="vertical" className="h-5" />}
      {extensionActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            disabled={action.disabled?.(extensionContext) ?? false}
            onClick={() => { void action.run(extensionContext); }}
            aria-label={action.label}
          >
            {Icon && <Icon />}
            <span>{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
