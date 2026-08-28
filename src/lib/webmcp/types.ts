export type JsonSchema = Record<string, unknown>;

export interface WebMcpTool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: TInput, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>;
}

export interface WebModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => void | Promise<void>;
}

export interface WebMcpBridge {
  supported: boolean;
  ready: Promise<number>;
  dispose: () => void;
}

