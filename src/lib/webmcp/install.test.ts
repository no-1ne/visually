import { afterEach, describe, expect, it, vi } from 'vitest';
import { installCanvaslyWebMcp, installVisuallyWebMcp } from './install';
import type { WebMcpTool, WebModelContext } from './types';

const setDocumentContext = (value?: WebModelContext) => {
  if (value) Object.defineProperty(document, 'modelContext', { configurable: true, value });
  else Reflect.deleteProperty(document, 'modelContext');
};

afterEach(() => {
  setDocumentContext();
  Reflect.deleteProperty(navigator, 'modelContext');
  delete document.documentElement.dataset.webmcp;
  vi.restoreAllMocks();
});

describe('Visually WebMCP installer', () => {
  it('retains the deprecated installer alias for existing integrations', () => {
    expect(installCanvaslyWebMcp).toBe(installVisuallyWebMcp);
  });

  it('progressively no-ops when the browser does not expose WebMCP', async () => {
    setDocumentContext();
    const bridge = installVisuallyWebMcp();
    expect(bridge.supported).toBe(false);
    expect(await bridge.ready).toBe(0);
    expect(document.documentElement.dataset.webmcp).toBe('unsupported');
    bridge.dispose();
  });

  it('registers the full catalog and aborts every registration on dispose', async () => {
    const registered: WebMcpTool[] = [];
    const signals: AbortSignal[] = [];
    const registerTool = vi.fn((tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      registered.push(tool);
      if (options?.signal) signals.push(options.signal);
      return Promise.resolve();
    });
    setDocumentContext({ registerTool });

    const bridge = installVisuallyWebMcp();
    expect(bridge.supported).toBe(true);
    expect(document.documentElement.dataset.webmcp).toBe('registering');
    expect(await bridge.ready).toBe(17);
    expect(registerTool).toHaveBeenCalledTimes(17);
    expect(registered.map((tool) => tool.name)).toContain('visually_get_editor_state');
    expect(document.documentElement.dataset.webmcp).toBe('ready');
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    bridge.dispose();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('marks registration errors without crashing the application', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setDocumentContext({ registerTool: vi.fn(() => Promise.reject(new DOMException('Denied', 'NotAllowedError'))) });
    const bridge = installVisuallyWebMcp();
    expect(await bridge.ready).toBe(0);
    expect(document.documentElement.dataset.webmcp).toBe('error');
    expect(console.warn).toHaveBeenCalledOnce();
    bridge.dispose();
  });

  it('supports early navigator-based WebMCP prototypes', async () => {
    const registerTool = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'modelContext', { configurable: true, value: { registerTool } });
    const bridge = installVisuallyWebMcp();
    expect(await bridge.ready).toBe(17);
    expect(registerTool).toHaveBeenCalledTimes(17);
    bridge.dispose();
  });
});
