import type { ComponentType } from 'react';
import type { DesignDocument, EditorElement, ElementAnimation } from '@/types';

export type ExtensionDisposer = () => void;

export interface EditorExtensionContext {
  document: DesignDocument;
  selectedIds: readonly string[];
  selectedElements: readonly EditorElement[];
  addElement: (element: EditorElement) => void;
  updateElement: (id: string, changes: Partial<EditorElement>, commit?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  deleteSelected: () => void;
}

export interface SidebarPanelContribution {
  /** Use a stable, namespaced value such as `acme.brand-kit`. */
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType<EditorExtensionContext>;
  order?: number;
}

export interface ToolbarActionContribution {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  order?: number;
  when?: (context: EditorExtensionContext) => boolean;
  disabled?: (context: EditorExtensionContext) => boolean;
  run: (context: EditorExtensionContext) => void | Promise<void>;
}

export interface CanvasRendererProps {
  element: EditorElement;
  selected: boolean;
  playhead: number;
  playing: boolean;
  update: (changes: Partial<EditorElement>, commit?: boolean) => void;
}

export interface CanvasRendererContribution {
  id: string;
  order?: number;
  matches: (element: EditorElement) => boolean;
  component: ComponentType<CanvasRendererProps>;
}

export interface AnimationPresetContribution {
  id: string;
  label: string;
  description?: string;
  order?: number;
  create: (element: EditorElement) => ElementAnimation;
}

export interface EditorExtensionLifecycleContext {
  registry: EditorExtensionRegistry;
  extensionId: string;
}

export interface EditorExtension {
  id: string;
  name?: string;
  panels?: readonly SidebarPanelContribution[];
  toolbarActions?: readonly ToolbarActionContribution[];
  canvasRenderers?: readonly CanvasRendererContribution[];
  animationPresets?: readonly AnimationPresetContribution[];
  activate?: (context: EditorExtensionLifecycleContext) => void | ExtensionDisposer;
}

export interface ExtensionRegistration {
  readonly id: string;
  dispose: ExtensionDisposer;
}

/** Identity helper that preserves literal contribution IDs for extension packages. */
export function defineEditorExtension<const T extends EditorExtension>(extension: T): T {
  return extension;
}

interface ActiveExtension {
  definition: EditorExtension;
  cleanup?: ExtensionDisposer;
}

type ContributionKey = 'panels' | 'toolbarActions' | 'canvasRenderers' | 'animationPresets';

const byOrderAndId = <T extends { id: string; order?: number }>(left: T, right: T) =>
  (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

/**
 * Mutable registration boundary with immutable read snapshots. A registry can be
 * created per editor, while `editorExtensions` is the convenient application default.
 */
export class EditorExtensionRegistry {
  private readonly extensions = new Map<string, ActiveExtension>();
  private readonly panels = new Map<string, SidebarPanelContribution>();
  private readonly toolbarActions = new Map<string, ToolbarActionContribution>();
  private readonly canvasRenderers = new Map<string, CanvasRendererContribution>();
  private readonly animationPresets = new Map<string, AnimationPresetContribution>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  readonly subscribe = (listener: () => void): ExtensionDisposer => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.revision;

  register(extension: EditorExtension): ExtensionRegistration {
    if (!extension.id.trim()) throw new Error('Extension ID must not be empty.');
    if (this.extensions.has(extension.id)) throw new Error(`Extension ID "${extension.id}" is already registered.`);
    this.assertContributionsAvailable(extension);

    const active: ActiveExtension = { definition: extension };
    this.extensions.set(extension.id, active);
    this.addContributions(extension);
    try {
      active.cleanup = extension.activate?.({ registry: this, extensionId: extension.id }) || undefined;
    } catch (error) {
      this.removeContributions(extension);
      this.extensions.delete(extension.id);
      throw error;
    }
    this.emit();

    let disposed = false;
    return {
      id: extension.id,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.unregister(extension.id);
      },
    };
  }

  unregister(extensionId: string): boolean {
    const active = this.extensions.get(extensionId);
    if (!active) return false;
    let cleanupError: unknown;
    try {
      active.cleanup?.();
    } catch (error) {
      cleanupError = error;
    } finally {
      this.removeContributions(active.definition);
      this.extensions.delete(extensionId);
      this.emit();
    }
    if (cleanupError) throw cleanupError;
    return true;
  }

  clear(): void {
    for (const id of [...this.extensions.keys()]) this.unregister(id);
  }

  has(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  getPanels(): readonly SidebarPanelContribution[] {
    return [...this.panels.values()].sort(byOrderAndId);
  }

  getToolbarActions(): readonly ToolbarActionContribution[] {
    return [...this.toolbarActions.values()].sort(byOrderAndId);
  }

  getCanvasRenderers(): readonly CanvasRendererContribution[] {
    return [...this.canvasRenderers.values()].sort(byOrderAndId);
  }

  getAnimationPresets(): readonly AnimationPresetContribution[] {
    return [...this.animationPresets.values()].sort(byOrderAndId);
  }

  findCanvasRenderer(element: EditorElement): CanvasRendererContribution | undefined {
    return this.getCanvasRenderers().find((renderer) => renderer.matches(element));
  }

  private assertContributionsAvailable(extension: EditorExtension) {
    const categories: Array<[ContributionKey, Map<string, unknown>]> = [
      ['panels', this.panels],
      ['toolbarActions', this.toolbarActions],
      ['canvasRenderers', this.canvasRenderers],
      ['animationPresets', this.animationPresets],
    ];
    for (const [key, target] of categories) {
      const seen = new Set<string>();
      for (const contribution of extension[key] ?? []) {
        if (!contribution.id.trim()) throw new Error(`${key} contribution ID must not be empty.`);
        if (seen.has(contribution.id) || target.has(contribution.id)) {
          throw new Error(`${key} contribution ID "${contribution.id}" is already registered.`);
        }
        seen.add(contribution.id);
      }
    }
  }

  private addContributions(extension: EditorExtension) {
    for (const panel of extension.panels ?? []) this.panels.set(panel.id, panel);
    for (const action of extension.toolbarActions ?? []) this.toolbarActions.set(action.id, action);
    for (const renderer of extension.canvasRenderers ?? []) this.canvasRenderers.set(renderer.id, renderer);
    for (const preset of extension.animationPresets ?? []) this.animationPresets.set(preset.id, preset);
  }

  private removeContributions(extension: EditorExtension) {
    for (const panel of extension.panels ?? []) this.panels.delete(panel.id);
    for (const action of extension.toolbarActions ?? []) this.toolbarActions.delete(action.id);
    for (const renderer of extension.canvasRenderers ?? []) this.canvasRenderers.delete(renderer.id);
    for (const preset of extension.animationPresets ?? []) this.animationPresets.delete(preset.id);
  }

  private emit() {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}

export const editorExtensions = new EditorExtensionRegistry();
