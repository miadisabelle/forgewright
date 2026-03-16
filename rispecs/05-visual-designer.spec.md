# 05 — Visual Designer

> Human point-and-click. LLM tool calls. Same canvas. Same model. Two hands on one forge.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

A web-based visual design surface that renders and edits:
1. **State machine graphs** — SMDF hierarchical state machines with composite drill-down, parallel regions, transition wiring
2. **Relational web graphs** — KuzuDB kinship networks with Four Directions circular layout
3. **Creative process visualization** — live state machine position showing where the session IS in the creative spiral

Both human interaction (drag, click, draw) and AI agent operations (MCP tools) modify the same underlying model. Changes propagate in real-time via WebSocket.

## Structural Tension

**Current Reality**: smcraft web designer exists (Next.js + React + SVG + Zustand) with flat state rendering, transition drawing, validation panel. Composite drill-down is specified but not implemented. The graph-viz package renders Mermaid output but has no interactive canvas. No bidirectional sync between visual designer and MCP tools.

**Desired State**: One designer with two views (state machine view + relational graph view) sharing a canvas engine. Composite drill-down works. MCP tool calls update the canvas live. Canvas edits propagate to MCP state.

---

## Two Views, One Engine

### State Machine View

Canvas renders SMDF definitions:

```
┌─ Root > Assimilation > CodeImplementation ──────┐
│  [breadcrumb navigation]                        │
│                                                  │
│  ┌──────────┐  EvGenerate  ┌─────────────┐     │
│  │ Planning │─────────────→│ Generating  │     │
│  └──────────┘              └──────┬──────┘     │
│                          EvReview │              │
│                                   ▼              │
│  ┌──────────┐  EvApprove  ┌─────────────┐     │
│  │ Revising │←────────────│ Reviewing   │     │
│  └──────────┘              └─────────────┘     │
└──────────────────────────────────────────────────┘
```

**Interactions**:
- Double-click composite state → drill into children (breadcrumb navigation)
- Drag states to reposition
- Draw mode: click source → click target → event picker
- Right-click context menu: add state, remove, set kind
- "Generate" button → real codegen (smcg via API, not JSON export)
- Validation errors highlight states with red borders + warning icons

**Composite Drill-Down** (critical missing feature):
- Store tracks `navigationPath: string[]` (breadcrumb)
- Canvas renders only `currentParent.states`, not `collectAllStates()`
- `navigateInto(stateName)` on double-click
- `navigateUp()` on breadcrumb click

**Parallel Regions**:
```
┌─ ParallelState ──────────────────────────────┐
│ ┌─ Region1 ─────────┐ ┌─ Region2 ─────────┐ │
│ │ StateA → StateB    │ │ StateC → StateD    │ │
│ └────────────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Relational Graph View

Canvas renders KuzuDB graph with circular layout:

```
              ❄️ NORTH
              (Action)
         ┌──────────────┐
         │ Integration  │
    ┌────┤              ├────┐
    │    └──────────────┘    │
🌊 WEST                    🔥 SOUTH
(Validation)              (Analysis)
    │    ┌──────────────┐    │
    └────┤              ├────┘
         │  Decompose   │
         └──────────────┘
              🌅 EAST
              (Vision)
```

**Interactions**:
- Nodes positioned by their `direction` property (Four Directions layout)
- Click node → properties panel shows OCAP metadata, relationships
- Edges colored by type (kinship=blue, dependency=gray, accountability=gold)
- Filter by ceremony context, OCAP level, direction
- Export to Mermaid diagram

### Live State Indicator

Overlay on state machine view showing current session position:
- Current state highlighted (pulsing green border)
- Completed states dimmed
- Next possible transitions highlighted
- Tension level gauge (distance to final state)

## Canvas Engine

Shared SVG rendering engine for both views:

```typescript
interface CanvasEngine {
  nodes: CanvasNode[];           // positioned elements
  edges: CanvasEdge[];           // connections
  viewport: Viewport;            // pan, zoom
  mode: 'select' | 'transition' | 'pan';
  selection: string | null;

  // Rendering
  render(): SVGElement;
  autoLayout(algorithm: 'hierarchical' | 'circular' | 'force'): void;

  // Interaction
  onNodeClick(handler): void;
  onNodeDoubleClick(handler): void;
  onEdgeDraw(handler): void;
  onContextMenu(handler): void;

  // Sync
  applyDelta(delta: GraphDelta): void;    // from MCP
  emitDelta(): GraphDelta;                 // to MCP
}
```

## MCP ↔ Designer Sync

Bidirectional real-time synchronization:

```
MCP tool call (sm/add_state)
    → server updates SMDF in memory
    → WebSocket pushes GraphDelta to designer
    → Canvas re-renders with new state

Designer interaction (drag state, draw transition)
    → Zustand store updates
    → WebSocket pushes GraphDelta to server
    → MCP state updated (next tool call sees change)
```

## Technology

| Component | Tech |
|-----------|------|
| Canvas | SVG + React components |
| State | Zustand store with undo/redo (50-deep) |
| Layout | Hierarchical (dagre) for SM, circular for graph |
| Sync | WebSocket (real-time) + REST (fallback) |
| Code preview | Monaco editor (syntax-highlighted generated code) |

## References

- `smcraft/rispecs/74-web-designer-spec.md` — Web designer architecture
- `smcraft/rispecs/73-mcp-server-spec.md` — MCP ↔ designer shared model
- `medicine-wheel/rispecs/graph-viz-spec.md` — Circular Four Directions layout
- `mia-code-server/rispecs/smcraft-integration/03-visual-designer-integration.spec.md` — IDE integration
