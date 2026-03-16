/**
 * pipeline/ MCP Tool Namespace — Compound cross-domain pipelines.
 *
 * 2 tools:
 *   - pipeline/intent_to_machine — prompt → PDE → STC → state machine
 *   - pipeline/session_cycle     — advance session through Medicine Wheel direction
 *
 * Re-exports tool definitions and handlers for registration with the MCP server.
 */

import {
  tools as intentToMachineTools,
  handlers as intentToMachineHandlers,
} from './intent-to-machine';
import {
  tools as sessionCycleTools,
  handlers as sessionCycleHandlers,
} from './session-cycle';
import type { ToolHandler, ToolResult } from '../guards';
import type { ToolDefinition } from '../tools/sm';
import type { z } from 'zod';

// ─── Aggregated Exports ──────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  ...intentToMachineTools,
  ...sessionCycleTools,
];

export const handlers: Record<string, ToolHandler> = {
  ...intentToMachineHandlers,
  ...sessionCycleHandlers,
};

/** Register all pipeline/ tools on an McpServer instance. */
export function registerPipelineTools(server: {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: z.ZodType; annotations?: Record<string, boolean> },
    handler: (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
  ) => void;
}): void {
  for (const def of tools) {
    const handler = handlers[def.name];
    if (!handler) continue;
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler as (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
    );
  }
}
