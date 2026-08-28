import type { WebMcpTool } from './types';
import { createDocumentTools } from './tools/document-tools';
import { createElementTools } from './tools/element-tools';
import { createQueryTools } from './tools/query-tools';

/** Stable public Visually tool catalog. */
export function createVisuallyWebMcpTools(): WebMcpTool[] {
  return [
    ...createQueryTools(),
    ...createElementTools(),
    ...createDocumentTools(),
  ];
}
