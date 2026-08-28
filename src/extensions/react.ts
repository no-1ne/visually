import { useSyncExternalStore } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { editorExtensions, type EditorExtensionContext, type EditorExtensionRegistry } from './registry';

export function useExtensionRegistry(
  registry: EditorExtensionRegistry = editorExtensions,
): EditorExtensionRegistry {
  useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
  return registry;
}

export function useEditorExtensionContext(): EditorExtensionContext {
  const document = useEditorStore((state) => state.pages[state.activePageIndex]);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const addElement = useEditorStore((state) => state.addElement);
  const updateElement = useEditorStore((state) => state.updateElement);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  return {
    document,
    selectedIds,
    selectedElements: document.elements.filter((element) => selectedIds.includes(element.id)),
    addElement,
    updateElement,
    setSelectedIds,
    deleteSelected,
  };
}
