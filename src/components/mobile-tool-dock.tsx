import { AppWindowIcon, BoxesIcon, Layers3Icon, TypeIcon, UploadCloudIcon } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useEditorStore } from '@/store/editor-store';
import type { PanelId } from '@/types';

const tools: { id: PanelId; label: string; icon: typeof TypeIcon }[] = [
  { id: 'templates', label: 'Design', icon: AppWindowIcon },
  { id: 'text', label: 'Text', icon: TypeIcon },
  { id: 'elements', label: 'Elements', icon: BoxesIcon },
  { id: 'uploads', label: 'Uploads', icon: UploadCloudIcon },
  { id: 'layers', label: 'Layers', icon: Layers3Icon },
];

export function MobileToolDock() {
  const { setOpenMobile } = useSidebar();
  const active = useEditorStore((state) => state.activePanel);
  const setActive = useEditorStore((state) => state.setActivePanel);
  return (
    <nav className="mobile-tool-dock">
      {tools.map((tool) => (
        <button key={tool.id} className={active === tool.id ? 'is-active' : ''} onClick={() => { setActive(tool.id); setOpenMobile(true); }}>
          <tool.icon /><span>{tool.label}</span>
        </button>
      ))}
    </nav>
  );
}
