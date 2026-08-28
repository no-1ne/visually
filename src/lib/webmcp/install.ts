import { createVisuallyWebMcpTools } from './visually-tools';
import type { WebMcpBridge, WebModelContext } from './types';

let activeController: AbortController | null = null;

function context(): WebModelContext | undefined {
  const currentDocument = document as Document & { modelContext?: WebModelContext };
  if (currentDocument.modelContext?.registerTool) return currentDocument.modelContext;

  // Early WebMCP prototypes exposed the API on Navigator. Keeping this fallback is
  // harmless and lets Visually work in those browser builds while targeting the draft.
  const currentNavigator = navigator as Navigator & { modelContext?: WebModelContext };
  return currentNavigator.modelContext?.registerTool ? currentNavigator.modelContext : undefined;
}

function setStatus(status: 'unsupported' | 'registering' | 'ready' | 'error') {
  document.documentElement.dataset.webmcp = status;
  document.dispatchEvent(new CustomEvent('visually:webmcp-status', { detail: status }));
  document.dispatchEvent(new CustomEvent('canvasly:webmcp-status', { detail: status }));
}

export function installVisuallyWebMcp(): WebMcpBridge {
  const modelContext = context();
  if (!modelContext) {
    setStatus('unsupported');
    return { supported: false, ready: Promise.resolve(0), dispose: () => undefined };
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const tools = createVisuallyWebMcpTools();
  setStatus('registering');

  const ready = (async () => {
    try {
      for (const tool of tools) {
        await modelContext.registerTool(tool, { signal: controller.signal });
      }
      if (!controller.signal.aborted) setStatus('ready');
      return controller.signal.aborted ? 0 : tools.length;
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('error');
        console.warn('Visually WebMCP registration failed.', error);
      }
      return 0;
    }
  })();

  return {
    supported: true,
    ready,
    dispose: () => {
      controller.abort();
      if (activeController === controller) activeController = null;
    },
  };
}

/** @deprecated Use installVisuallyWebMcp. */
export const installCanvaslyWebMcp = installVisuallyWebMcp;
