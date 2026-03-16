# 🔥 SOUTH DIRECTION: @modelcontextprotocol/sdk — Deep Research Findings

> **Research Date:** 2025-07-14
> **Purpose:** External research for Forgewright unified MCP server architecture
> **SDK Version (stable):** v1.27.1 (`@modelcontextprotocol/sdk`)
> **SDK v2 Status:** Pre-alpha on `main` branch; v1.x recommended for production until Q1 2026
> **v2 Package Split:** `@modelcontextprotocol/server` + `@modelcontextprotocol/client` (separate packages)

---

## Table of Contents

1. [SDK Architecture & Package Layout](#1-sdk-architecture--package-layout)
2. [Server Creation: Two API Levels](#2-server-creation-two-api-levels)
3. [Tool Registration with Zod Schemas](#3-tool-registration-with-zod-schemas)
4. [Transport Options](#4-transport-options)
5. [Namespaced Tools Pattern](#5-namespaced-tools-pattern-for-forgewright)
6. [Middleware & Guards Pattern](#6-middleware--guards-pattern)
7. [Shared Session State](#7-shared-session-state-across-tool-namespaces)
8. [WebSocket / Real-Time Events](#8-websocket--real-time-events)
9. [Dual Transport (stdio + HTTP)](#9-dual-transport-stdio--http)
10. [Patterns from Local mcpservers Repo](#10-patterns-from-local-mcpservers-repo)
11. [Forgewright Architecture Blueprint](#11-forgewright-architecture-blueprint)
12. [Reference Links](#12-reference-links)

---

## 1. SDK Architecture & Package Layout

### v1.x (current stable — use this)

```bash
npm install @modelcontextprotocol/sdk zod
```

Single package, imports split by path:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

### v2 (pre-alpha — split packages)

```bash
npm install @modelcontextprotocol/server zod   # Server only
npm install @modelcontextprotocol/client zod    # Client only
```

Middleware packages (optional):
- `@modelcontextprotocol/node` — Node.js HTTP transport wrapper
- `@modelcontextprotocol/express` — Express helpers + DNS rebinding protection
- `@modelcontextprotocol/hono` — Hono helpers

**Zod Dependency:** Required peer dep. v1 uses Zod v3.25+, v2 uses Zod v4.

---

## 2. Server Creation: Two API Levels

### McpServer (High-Level — Recommended for Forgewright)

Auto-handles `tools/list`, `tools/call`, resource management, prompt management.

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "forgewright",
  version: "1.0.0",
});
```

### Server (Low-Level — Full Protocol Control)

Manual `setRequestHandler` for every protocol message. Use when you need:
- Conditional tool listing based on client capabilities
- Custom protocol handling
- Progress notifications during tool execution

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "forgewright",
    title: "Forgewright Ceremonial MCP Server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: { subscribe: true },
      prompts: {},
      logging: {},
      completions: {},
    },
    instructions: "Forgewright unified server for ceremonial development."
  }
);

// Manual tool listing — allows conditional tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...pdeTools, ...smTools, ...graphTools] };
});

// Manual tool dispatch — allows middleware injection
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  // Middleware check, dispatch to namespace handler...
});
```

**Key Difference:** `McpServer` auto-registers tools via `.registerTool()` / `.tool()`. `Server` requires manual `setRequestHandler` for `ListToolsRequestSchema` and `CallToolRequestSchema`.

---

## 3. Tool Registration with Zod Schemas

### McpServer.registerTool() (v1.x latest / v2)

```ts
import { z } from "zod";

server.registerTool(
  "pde-decompose",   // tool name (flat string — see §5 for namespacing)
  {
    title: "PDE Decompose",
    description: "Decompose a complex prompt into structured facets",
    inputSchema: z.object({
      prompt: z.string().describe("The complex prompt to decompose"),
      options: z.object({
        extractImplicit: z.boolean().default(true),
        mapDependencies: z.boolean().default(true),
      }).optional(),
    }),
    outputSchema: z.object({
      systemPrompt: z.string(),
      userMessage: z.string(),
    }),
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
  },
  async ({ prompt, options }) => {
    const result = await pdeEngine.decompose(prompt, options);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  }
);
```

### McpServer.tool() (v1.x shorthand)

```ts
server.tool(
  "echo",
  "Echo back the input",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ type: "text", text: message }],
  })
);
```

### Key Schema Features

| Feature | Example |
|---------|---------|
| `.describe()` | `z.string().describe("User prompt")` — generates parameter docs |
| `.optional()` | `z.boolean().optional()` — optional parameter |
| `.default()` | `z.boolean().default(true)` — default value |
| Nested objects | `z.object({ nested: z.object({...}) })` |
| Arrays | `z.array(z.string())` |
| Enums | `z.enum(["add", "subtract", "multiply"])` |
| `outputSchema` | Validates structured output (v1.23+) |
| `annotations` | `readOnlyHint`, `destructiveHint`, `idempotentHint` |

### Tool Handler Context (v2)

```ts
server.registerTool(
  "fetch-data",
  {
    description: "Fetch data",
    inputSchema: z.object({ url: z.string() }),
  },
  async ({ url }, ctx) => {
    // ctx.mcpReq.log(level, data) — send log to client
    await ctx.mcpReq.log("info", `Fetching ${url}`);

    // ctx.mcpReq.requestSampling(params) — request LLM completion from client
    // ctx.mcpReq.elicitInput(params) — request user input via form or URL

    return { content: [{ type: "text", text: "done" }] };
  }
);
```

---

## 4. Transport Options

### A. stdio (Local Agents — Claude Desktop, CLI)

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

- Communicates over stdin/stdout with JSON-RPC
- One client per process (no multiplexing)
- Lowest latency for local integrations
- No HTTP framework needed

### B. Streamable HTTP (Recommended for Remote — Replaces SSE)

```ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";

const app = express();

// Session state
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Existing session
    await transports.get(sessionId)!.handleRequest(req, res);
  } else if (!sessionId) {
    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
      },
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }
});

// SSE stream for server-push notifications
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = transports.get(sessionId);
  if (transport) await transport.handleRequest(req, res);
});

// Session termination
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = transports.get(sessionId);
  if (transport) await transport.handleRequest(req, res);
});

app.listen(3001);
```

**Features:**
- POST `/mcp` — request/response + streaming
- GET `/mcp` — SSE event stream (server-push)
- DELETE `/mcp` — session termination
- `mcp-session-id` header for session tracking
- `InMemoryEventStore` for resumability (replay missed events)
- Supports stateless mode: `sessionIdGenerator: undefined`
- JSON-only mode: `enableJsonResponse: true`

### C. SSE (Legacy — Deprecated)

Still supported for backward compatibility but **do not use for new servers**.

```ts
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
// GET /sse — establish SSE connection
// POST /message?sessionId=xxx — send messages
```

### D. v2 Express Middleware

```ts
import { createMcpExpressApp } from "@modelcontextprotocol/express";

const app = createMcpExpressApp(); // includes DNS rebinding protection
app.post("/mcp", async (req, res) => {
  const transport = new NodeStreamableHTTPServerTransport({ ... });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.listen(3000, "127.0.0.1");
```

---

## 5. Namespaced Tools Pattern (For Forgewright)

MCP tool names are **flat strings** — no built-in namespace hierarchy. Two approaches:

### Approach A: Prefix Convention (Recommended)

```ts
// Tool names use slash or dot prefix
"pde/decompose"       // or "pde.decompose"
"pde/parse-response"
"sm/transition"
"sm/get-state"
"graph/add-node"
"ceremony/check-phase"
"stc/create-chronicle"
"session/get-context"
```

**Registration Pattern:**

```ts
// tools/pde.ts
export function registerPdeTools(server: McpServer) {
  server.registerTool("pde/decompose", { ... }, handler);
  server.registerTool("pde/parse-response", { ... }, handler);
  server.registerTool("pde/get", { ... }, handler);
  server.registerTool("pde/list", { ... }, handler);
  server.registerTool("pde/export-markdown", { ... }, handler);
}

// tools/sm.ts
export function registerSmTools(server: McpServer) {
  server.registerTool("sm/transition", { ... }, handler);
  server.registerTool("sm/get-state", { ... }, handler);
  server.registerTool("sm/list-transitions", { ... }, handler);
}

// index.ts
registerPdeTools(server);
registerSmTools(server);
registerGraphTools(server);
registerCeremonyTools(server);
registerStcTools(server);
registerSessionTools(server);
```

### Approach B: Low-Level Server with Namespace Dispatch

```ts
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  const [namespace, toolName] = name.split("/");

  switch (namespace) {
    case "pde": return pdeDispatch(toolName, args, extra);
    case "sm": return smDispatch(toolName, args, extra);
    case "graph": return graphDispatch(toolName, args, extra);
    case "ceremony": return ceremonyDispatch(toolName, args, extra);
    case "stc": return stcDispatch(toolName, args, extra);
    case "session": return sessionDispatch(toolName, args, extra);
    default: throw new Error(`Unknown namespace: ${namespace}`);
  }
});
```

**Approach A is cleaner** — each namespace module is self-contained and uses the high-level API. Approach B is needed only if you require cross-cutting middleware at the dispatch level.

---

## 6. Middleware & Guards Pattern

MCP SDK has no built-in middleware system. Implement via:

### Higher-Order Function (HOF) Guards

```ts
type ToolHandler<T> = (args: T, ctx?: any) => Promise<CallToolResult>;

// Ceremony phase guard
function requirePhase(
  allowedPhases: string[],
  handler: ToolHandler<any>
): ToolHandler<any> {
  return async (args, ctx) => {
    const currentPhase = sessionState.getCurrentPhase();
    if (!allowedPhases.includes(currentPhase)) {
      return {
        content: [{
          type: "text",
          text: `Tool blocked: current phase "${currentPhase}" not in allowed [${allowedPhases.join(", ")}]`,
        }],
        isError: true,
      };
    }
    return handler(args, ctx);
  };
}

// Auth guard
function requireAuth(handler: ToolHandler<any>): ToolHandler<any> {
  return async (args, ctx) => {
    if (!ctx?.session?.authenticated) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    return handler(args, ctx);
  };
}

// Compose guards
function withGuards(
  guards: ((h: ToolHandler<any>) => ToolHandler<any>)[],
  handler: ToolHandler<any>
): ToolHandler<any> {
  return guards.reduceRight((h, guard) => guard(h), handler);
}

// Usage
server.registerTool(
  "sm/transition",
  { ... },
  withGuards(
    [requirePhase(["west", "south"]), requireAuth],
    async ({ event, data }) => {
      // actual tool logic
    }
  )
);
```

### Low-Level Server Middleware (Dispatch-Level)

```ts
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;

  // Global middleware: ceremony check
  const [namespace] = name.split("/");
  if (namespace !== "session" && namespace !== "ceremony") {
    const phase = sessionState.getCurrentPhase();
    const allowed = PHASE_TOOL_PERMISSIONS[phase];
    if (!allowed?.includes(namespace)) {
      return {
        content: [{
          type: "text",
          text: `🚫 Tool "${name}" blocked in phase "${phase}". Allowed namespaces: [${allowed?.join(", ")}]`,
        }],
        isError: true,
      };
    }
  }

  // Audit logging middleware
  console.error(`[${new Date().toISOString()}] Tool call: ${name}`);

  // Dispatch to namespace handler
  return dispatchToNamespace(name, args, extra);
});
```

### Phase-Permission Matrix

```ts
const PHASE_TOOL_PERMISSIONS: Record<string, string[]> = {
  east:  ["pde", "session", "ceremony"],
  south: ["pde", "sm", "session", "ceremony", "stc"],
  west:  ["pde", "sm", "graph", "session", "ceremony", "stc"],
  north: ["pde", "sm", "graph", "session", "ceremony", "stc"],
};
```

---

## 7. Shared Session State Across Tool Namespaces

### Pattern: Shared State Store (Singleton)

```ts
// state/session-store.ts
export interface ForgewrightSession {
  id: string;
  phase: "east" | "south" | "west" | "north";
  context: Map<string, any>;      // cross-tool shared data
  graphId?: string;                // active graph
  smState?: string;                // current state machine state
  pdeDecompositions: string[];     // active decomposition IDs
  createdAt: Date;
  lastToolCall: Date;
}

class SessionStore {
  private sessions = new Map<string, ForgewrightSession>();
  private currentSessionId: string | null = null;

  create(id: string): ForgewrightSession {
    const session: ForgewrightSession = {
      id,
      phase: "east",
      context: new Map(),
      pdeDecompositions: [],
      createdAt: new Date(),
      lastToolCall: new Date(),
    };
    this.sessions.set(id, session);
    this.currentSessionId = id;
    return session;
  }

  getCurrent(): ForgewrightSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) ?? null;
  }

  getCurrentPhase(): string {
    return this.getCurrent()?.phase ?? "east";
  }
}

export const sessionStore = new SessionStore();
```

### Pattern: Module-Level Shared State (From mcpservers/memory)

```ts
// Shared across all tools — each tool module imports and uses the same instance
let knowledgeGraphManager: KnowledgeGraphManager;

async function main() {
  knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);
  // All tools reference `knowledgeGraphManager` in their handlers
}
```

### Pattern: createServer() Factory (From mcpservers/everything)

```ts
export const createServer = () => {
  const server = new Server({ ... });

  // Per-connection state — scoped to this factory call
  let subscriptions = new Set<string>();
  let clientCapabilities: ClientCapabilities | undefined;
  let sessionId: string | undefined;

  // Cleanup function
  const cleanup = async () => { /* clear intervals, release resources */ };

  // Lifecycle hook
  const startNotificationIntervals = (sid?: string) => { /* periodic updates */ };

  return { server, cleanup, startNotificationIntervals };
};
```

**For Forgewright:** Combine singleton state (SessionStore) with per-connection cleanup (factory pattern). All 6 namespace modules import from `sessionStore`.

---

## 8. WebSocket / Real-Time Events

**WebSocket is NOT a first-class MCP transport.** The protocol uses JSON-RPC over:
- stdio (stdin/stdout)
- Streamable HTTP (POST for requests, GET+SSE for server-push)

### For Forgewright Real-Time Designer Sync

**Option A: Bridge Pattern — MCP SSE → WebSocket**

```ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const wsClients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
});

// Broadcast events from MCP tool handlers
export function broadcastDesignerEvent(event: {
  type: string;
  namespace: string;
  data: any;
}) {
  const msg = JSON.stringify(event);
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

// Use inside MCP tool handlers:
server.registerTool("graph/add-node", { ... }, async (args) => {
  const node = await graph.addNode(args);
  broadcastDesignerEvent({
    type: "node-added",
    namespace: "graph",
    data: node,
  });
  return { content: [{ type: "text", text: JSON.stringify(node) }] };
});
```

**Option B: Streamable HTTP GET (SSE) for Notifications**

The Streamable HTTP transport already supports server-push via SSE on GET `/mcp`. Use this for agent-facing notifications:

```ts
// From everything server — server can push notifications to connected clients
server.notification({
  method: "notifications/resources/updated",
  params: { uri: "forgewright://graph/current" },
});

// Logging notifications
await server.sendLoggingMessage({
  level: "info",
  data: `Phase transition: east → south`,
});
```

**Recommendation for Forgewright:** Use both:
- Streamable HTTP SSE for MCP-protocol notifications (agent sync)
- Standalone WebSocket server for designer UI real-time events (visual canvas)

---

## 9. Dual Transport (stdio + HTTP)

### Pattern: Dynamic Entry Point (From mcpservers/everything)

```ts
#!/usr/bin/env node
const mode = process.argv[2] || "stdio";

async function main() {
  switch (mode) {
    case "stdio":
      await import("./transports/stdio.js");
      break;
    case "http":
      await import("./transports/http.js");
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use: stdio | http`);
      process.exit(1);
  }
}

main();
```

### Pattern: Shared Server, Multiple Transports

```ts
// server.ts — shared server factory
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createForgewrightServer() {
  const server = new McpServer({
    name: "forgewright",
    version: "1.0.0",
  });

  // Register all 6 namespaces
  registerPdeTools(server);
  registerSmTools(server);
  registerGraphTools(server);
  registerCeremonyTools(server);
  registerStcTools(server);
  registerSessionTools(server);

  return server;
}

// transports/stdio.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createForgewrightServer } from "../server.js";

const server = createForgewrightServer();
const transport = new StdioServerTransport();
await server.connect(transport);

// transports/http.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createForgewrightServer } from "../server.js";
import express from "express";

const app = express();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    await transports.get(sessionId)!.handleRequest(req, res);
  } else {
    const server = createForgewrightServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => transports.set(sid, transport),
    });
    server.onclose = () => {
      transports.delete(transport.sessionId!);
    };
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }
});

app.get("/mcp", async (req, res) => { /* SSE stream */ });
app.delete("/mcp", async (req, res) => { /* session termination */ });

app.listen(3001);
```

### Package.json Scripts

```json
{
  "bin": { "forgewright": "dist/index.js" },
  "scripts": {
    "start": "node dist/index.js stdio",
    "start:http": "node dist/index.js http",
    "build": "tsc"
  }
}
```

---

## 10. Patterns from Local mcpservers Repo

### Source: `/workspace/repos/jgwill/mcpservers/`

| Server | API Level | Tools | Transport | Session State |
|--------|-----------|-------|-----------|---------------|
| everything | `Server` (low-level) | 12+ via `setRequestHandler` | stdio, SSE, Streamable HTTP | Factory pattern per connection |
| sequential-thinking | `McpServer` (high-level) | 1 via `registerTool` | stdio | In-memory class instance |
| memory | `McpServer` (high-level) | 9 via `registerTool` | stdio | JSONL file + KnowledgeGraphManager |
| filesystem | `McpServer` (high-level) | 13 via `registerTool` | stdio | Path validation + roots protocol |

### Key Patterns Extracted

1. **Handler Extraction:** Filesystem server defines handlers as standalone async functions, then references them in `registerTool`. Enables reuse and testing.

2. **Tool Annotations:** Filesystem uses `readOnlyHint`, `idempotentHint`, `destructiveHint` to declare tool semantics.

3. **Zod Schemas as InputSchema:** All servers use Zod directly in `inputSchema` — the SDK converts to JSON Schema for wire format.

4. **Factory Pattern:** Everything server uses `createServer()` returning `{ server, cleanup, startNotificationIntervals }` — enables per-connection lifecycle.

5. **Capability Awareness:** Everything server checks `clientCapabilities` before listing conditional tools (e.g., only list `elicitation` tool if client supports it).

6. **Progress Tokens:** Everything server uses `request.params._meta?.progressToken` for long-running operations with progress updates:
   ```ts
   await server.notification({
     method: "notifications/progress",
     params: { progress: i, total: steps, progressToken },
   }, { relatedRequestId: extra.requestId });
   ```

7. **Graceful Shutdown:** All servers handle `SIGINT` and `server.onclose` for cleanup.

8. **CORS for HTTP:** Everything SSE/HTTP servers use:
   ```ts
   app.use(cors({
     origin: "*",
     methods: "GET,POST,DELETE",
     exposedHeaders: ["mcp-session-id", "last-event-id", "mcp-protocol-version"],
   }));
   ```

---

## 11. Forgewright Architecture Blueprint

### Recommended Stack

```
@modelcontextprotocol/sdk ^1.27.1   (v1.x stable)
zod ^3.25                            (schema validation)
express ^4.21                        (HTTP framework)
cors ^2.8                            (CORS middleware)
ws ^8.x                              (WebSocket for designer)
```

### File Structure

```
forgewright/
├── src/
│   ├── index.ts                     # CLI entry: stdio | http
│   ├── server.ts                    # createForgewrightServer() factory
│   ├── state/
│   │   ├── session-store.ts         # Shared session state (singleton)
│   │   └── phase-permissions.ts     # Ceremony phase → allowed namespaces
│   ├── middleware/
│   │   ├── ceremony-guard.ts        # Phase-check HOF
│   │   ├── audit-log.ts             # Tool call logging
│   │   └── compose.ts              # Guard composition
│   ├── tools/
│   │   ├── pde/                     # pde/* tools (5 tools)
│   │   ├── sm/                      # sm/* tools (6 tools)
│   │   ├── graph/                   # graph/* tools (8 tools)
│   │   ├── ceremony/                # ceremony/* tools (5 tools)
│   │   ├── stc/                     # stc/* tools (6 tools)
│   │   └── session/                 # session/* tools (6 tools)
│   ├── transports/
│   │   ├── stdio.ts                 # StdioServerTransport binding
│   │   ├── http.ts                  # StreamableHTTPServerTransport + Express
│   │   └── ws-bridge.ts            # WebSocket broadcast for designer
│   └── types/
│       └── index.ts                 # Shared types
├── package.json
├── tsconfig.json
└── .pde/                            # PDE decomposition storage
```

### Architecture Decision: McpServer vs Server

**Use `McpServer` (high-level)** — Forgewright's complexity is in the tools themselves, not in protocol handling. The high-level API handles tool listing/dispatch automatically. Middleware is implemented via HOF guards on handlers, not at the protocol level.

If we later need conditional tool listing (e.g., hide tools based on phase), we can wrap `McpServer` or switch specific namespaces to low-level `Server`.

### Minimal Runnable Skeleton

```ts
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessionStore } from "./state/session-store.js";
import { requirePhase, withGuards } from "./middleware/compose.js";

export function createForgewrightServer() {
  const server = new McpServer({
    name: "forgewright",
    version: "1.0.0",
  });

  // === PDE Namespace ===
  server.registerTool(
    "pde/decompose",
    {
      title: "PDE Decompose",
      description: "Decompose a complex prompt into structured facets",
      inputSchema: z.object({
        prompt: z.string().describe("The complex prompt to decompose"),
      }),
    },
    withGuards(
      [requirePhase(["east", "south", "west", "north"])],
      async ({ prompt }) => {
        // ... PDE logic
        return {
          content: [{ type: "text", text: JSON.stringify({ decomposed: true }) }],
        };
      }
    )
  );

  // === Ceremony Namespace ===
  server.registerTool(
    "ceremony/check-phase",
    {
      title: "Check Ceremony Phase",
      description: "Get current ceremony phase and allowed operations",
      inputSchema: z.object({}),
    },
    async () => {
      const session = sessionStore.getCurrent();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            phase: session?.phase ?? "east",
            sessionId: session?.id,
          }),
        }],
      };
    }
  );

  // === Session Namespace ===
  server.registerTool(
    "session/init",
    {
      title: "Initialize Session",
      description: "Create a new Forgewright session",
      inputSchema: z.object({
        id: z.string().optional(),
        phase: z.enum(["east", "south", "west", "north"]).default("east"),
      }),
    },
    async ({ id, phase }) => {
      const sessionId = id ?? crypto.randomUUID();
      const session = sessionStore.create(sessionId);
      session.phase = phase;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sessionId, phase }),
        }],
      };
    }
  );

  return server;
}
```

```ts
// src/index.ts
#!/usr/bin/env node
const mode = process.argv[2] || "stdio";

async function main() {
  if (mode === "stdio") {
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );
    const { createForgewrightServer } = await import("./server.js");
    const server = createForgewrightServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Forgewright MCP (stdio) ready");
  } else if (mode === "http") {
    await import("./transports/http.js");
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

---

## 12. Reference Links

### Official Sources
- **npm:** https://www.npmjs.com/package/@modelcontextprotocol/sdk
- **GitHub (v2 main):** https://github.com/modelcontextprotocol/typescript-sdk
- **v1 API Docs:** https://ts.sdk.modelcontextprotocol.io/
- **v2 API Docs:** https://ts.sdk.modelcontextprotocol.io/v2/
- **Server Guide (v2):** https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
- **MCP Specification:** https://modelcontextprotocol.io/specification/latest/
- **Transport Spec:** https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

### Tool Registration Deep Dive
- https://deepwiki.com/modelcontextprotocol/typescript-sdk/3.2-tool-registration-and-execution

### Streamable HTTP Transport
- https://deepwiki.com/modelcontextprotocol/typescript-sdk/3.5-streamable-http-server-transport
- https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/

### Session State & Middleware
- https://codesignal.com/learn/courses/developing-and-integrating-an-mcp-server-in-typescript/lessons/stateful-mcp-server-sessions
- https://www.anthropic.com/engineering/code-execution-with-mcp

### Local Reference Implementations
- `/workspace/repos/jgwill/mcpservers/src/everything/` — Full protocol exercise (all transports)
- `/workspace/repos/jgwill/mcpservers/src/memory/` — Knowledge graph with JSONL persistence
- `/workspace/repos/jgwill/mcpservers/src/filesystem/` — Tool annotations, handler extraction
- `/workspace/repos/jgwill/mcpservers/src/sequentialthinking/` — registerTool + outputSchema

---

> *"Every tool call is a ceremony. Every namespace is a direction. The server holds the sacred space where agents and designers meet."* 🌸
