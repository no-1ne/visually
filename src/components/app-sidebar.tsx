import type * as React from 'react';
import {
  AppWindowIcon,
  BrushIcon,
  BoxesIcon,
  ClapperboardIcon,
  Grid3X3Icon,
  Layers3Icon,
  Maximize2Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TextCursorInputIcon,
  TypeIcon,
  UploadCloudIcon,
  XIcon,
  PuzzleIcon,
} from 'lucide-react';

import { EditorPanel } from '@/components/editor-panel';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editor-store';
import type { PanelId } from '@/types';
import { useExtensionRegistry } from '@/extensions';

const tools: { id: PanelId; label: string; icon: typeof TypeIcon }[] = [
  { id: 'templates', label: 'Templates', icon: AppWindowIcon },
  { id: 'text', label: 'Text', icon: TypeIcon },
  { id: 'elements', label: 'Elements', icon: BoxesIcon },
  { id: 'uploads', label: 'Uploads', icon: UploadCloudIcon },
  { id: 'layers', label: 'Layers', icon: Layers3Icon },
  { id: 'draw', label: 'Draw', icon: BrushIcon },
  { id: 'tables', label: 'Tables', icon: Grid3X3Icon },
  { id: 'media', label: 'Media', icon: ClapperboardIcon },
  { id: 'animations', label: 'Animations', icon: SparklesIcon },
  { id: 'effects', label: 'Effects', icon: SlidersHorizontalIcon },
  { id: 'size', label: 'Resize', icon: Maximize2Icon },
  { id: 'fonts', label: 'Fonts', icon: TextCursorInputIcon },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const activePanel = useEditorStore((state) => state.activePanel);
  const setActivePanel = useEditorStore((state) => state.setActivePanel);
  const { setOpenMobile } = useSidebar();
  const extensionRegistry = useExtensionRegistry();
  const extensionTools = extensionRegistry.getPanels();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu className="relative">
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Visually">
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-[#7657ff] text-white shadow-sm">
                <SparklesIcon className="size-4" />
              </div>
              <div className="flex min-w-0 flex-col leading-none">
                <span className="truncate font-semibold tracking-tight">Visually</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground">Design studio</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <Button variant="ghost" size="icon-sm" className="absolute right-1 top-2 md:hidden" onClick={() => setOpenMobile(false)} aria-label="Close tools"><XIcon /></Button>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="max-h-[46vh] overflow-y-auto border-b border-sidebar-border p-2 group-data-[collapsible=icon]:max-h-none group-data-[collapsible=icon]:overflow-visible group-data-[collapsible=icon]:border-b-0">
          <SidebarMenu>
            {tools.map((tool) => (
              <SidebarMenuItem key={tool.id}>
                <SidebarMenuButton
                  isActive={activePanel === tool.id}
                  tooltip={tool.label}
                  onClick={() => setActivePanel(tool.id)}
                  className="min-h-9"
                >
                  <tool.icon />
                  <span>{tool.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {extensionTools.map((tool) => {
              const Icon = tool.icon ?? PuzzleIcon;
              return (
                <SidebarMenuItem key={tool.id}>
                  <SidebarMenuButton
                    isActive={activePanel === tool.id}
                    tooltip={tool.label}
                    onClick={() => setActivePanel(tool.id)}
                    className="min-h-9"
                  >
                    <Icon />
                    <span>{tool.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <div className="min-h-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
          <EditorPanel />
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
