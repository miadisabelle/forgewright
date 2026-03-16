/**
 * Forgewright MCP server — see rispecs/00-platform-architecture.spec.md
 * Layer 3: Unified MCP Tool Surface
 * Exposes: smcraft tools + PDE tools + ceremony tools + graph tools + session tools + STC tools
 * Transports: stdio (CLI) + HTTP (Next.js API route)
 *
 * 6 namespaces: pde/, sm/, graph/, ceremony/, stc/, session/
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ─── Tool Module Interface ───────────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

interface ToolModule {
  tools: ToolDefinition[];
  handlers: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

// ─── Namespace Registration ──────────────────────────────────────────────────

/**
 * Register all tools from a namespace module onto the server.
 * Each tool module exports { tools, handlers } following the pde.ts / sm.ts pattern.
 */
export function registerNamespace(
  server: McpServer,
  namespace: string,
  toolModule: ToolModule,
): void {
  for (const def of toolModule.tools) {
    const handler = toolModule.handlers[def.name];
    if (!handler) {
      console.warn(`[forgewright] No handler for tool "${def.name}" in namespace "${namespace}" — skipping`);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler,
    );
  }
}

// ─── Placeholder Module Factory ──────────────────────────────────────────────

/**
 * Create a placeholder tool module for namespaces whose tools are stubs.
 * Registers a single `{namespace}/status` tool that reports the namespace is pending.
 */
function createPlaceholderModule(namespace: string): ToolModule {
  const toolName = `${namespace}/status`;
  return {
    tools: [
      {
        name: toolName,
        description: `Status check for the ${namespace}/ namespace. Returns pending implementation status.`,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
    ],
    handlers: {
      [toolName]: async () => ({
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            namespace,
            status: 'pending',
            message: `The ${namespace}/ namespace tools are not yet implemented. This is a placeholder.`,
          }),
        }],
      }),
    },
  };
}

// ─── Dynamic Module Loader ───────────────────────────────────────────────────

/**
 * Safely extract ToolModule from a dynamically imported namespace module.
 * Handles the fact that modules export more than just { tools, handlers }.
 */
function extractToolModule(mod: Record<string, unknown>): ToolModule | null {
  if (
    Array.isArray(mod.tools) &&
    mod.tools.length > 0 &&
    mod.handlers &&
    typeof mod.handlers === 'object'
  ) {
    return {
      tools: mod.tools as ToolDefinition[],
      handlers: mod.handlers as Record<string, (...args: unknown[]) => Promise<unknown>>,
    };
  }
  return null;
}

// ─── Create Server ───────────────────────────────────────────────────────────

/**
 * Factory: creates a Forgewright MCP server with all 6 tool namespaces registered.
 *
 * Real namespaces (pde/, sm/, graph/) are loaded dynamically.
 * Stub namespaces (ceremony/, stc/, session/) get placeholder tools.
 */
export async function createForgewrightServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'forgewright',
    version: '0.1.0',
  });

  // All 6 tool namespaces — real ones have full implementations, stubs get placeholders
  const namespaces = ['pde', 'sm', 'graph', 'ceremony', 'stc', 'session'];

  for (const ns of namespaces) {
    try {
      const mod = await import(`./tools/${ns}.js`);
      const toolModule = extractToolModule(mod);
      if (toolModule) {
        registerNamespace(server, ns, toolModule);
      } else {
        registerNamespace(server, ns, createPlaceholderModule(ns));
      }
    } catch {
      registerNamespace(server, ns, createPlaceholderModule(ns));
    }
  }

  // Compound pipelines namespace — cross-domain chained operations
  try {
    const pipelineMod = await import('./pipelines/index');
    const pipelineModule = extractToolModule(pipelineMod);
    if (pipelineModule) {
      registerNamespace(server, 'pipeline', pipelineModule);
    }
  } catch {
    registerNamespace(server, 'pipeline', createPlaceholderModule('pipeline'));
  }

  return server;
}

// ─── Start Server (stdio transport) ──────────────────────────────────────────

/**
 * Entry point: creates the server + stdio transport, connects, and logs startup.
 * Used by `npm run mcp:start` (tsx src/lib/mcp/server.ts).
 */
export async function startServer(): Promise<void> {
  const server = await createForgewrightServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('[forgewright] MCP server running on stdio transport');
  console.error('[forgewright] Namespaces: pde/, sm/, graph/, ceremony/, stc/, session/, pipeline/');
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[forgewright] Fatal:', err);
    process.exit(1);
  });
}
