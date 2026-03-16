// ─── Auto-Layout Algorithms ─────────────────────────────────────────────────
// Pure functions that assign (x, y) positions to CanvasNode[].
// No React, no side effects — consumed by CanvasEngine and view layers.

import type { DirectionName } from '@forgewright/lib/types';
import type { CanvasNode, CanvasEdge } from './types';

const NODE_GAP_X = 60;
const NODE_GAP_Y = 80;

// ─── Hierarchical Layout (state machines) ────────────────────────────────────
// Top-down layered layout using topological sort.

export function hierarchicalLayout(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): CanvasNode[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Kahn's topological sort → assign layers
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const layers: string[][] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const layer = [...queue];
    layers.push(layer);
    queue.length = 0;

    for (const id of layer) {
      visited.add(id);
      for (const child of adj.get(id) ?? []) {
        const newDeg = (inDegree.get(child) ?? 1) - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0 && !visited.has(child)) {
          queue.push(child);
        }
      }
    }
  }

  // Nodes not reachable by topo sort (cycles) — append as final layer
  const remaining = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
  if (remaining.length > 0) layers.push(remaining);

  // Assign positions
  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const totalWidth = layer.reduce((sum, id) => {
      const n = nodeMap.get(id)!;
      return sum + n.width + NODE_GAP_X;
    }, -NODE_GAP_X);

    let x = -totalWidth / 2;
    for (const id of layer) {
      const n = nodeMap.get(id)!;
      n.x = x + n.width / 2;
      n.y = layerIdx * (n.height + NODE_GAP_Y);
      x += n.width + NODE_GAP_X;
    }
  }

  return Array.from(nodeMap.values());
}

// ─── Circular / Four Directions Layout (relational graphs) ───────────────────
// Positions nodes on a circle, optionally grouping by direction quadrant.

const DIRECTION_ANGLES: Record<DirectionName, number> = {
  north: -Math.PI / 2,    // top
  east: 0,                // right
  south: Math.PI / 2,     // bottom
  west: Math.PI,          // left
};

export function circularLayout(
  nodes: CanvasNode[],
  _edges: CanvasEdge[],
  directions?: DirectionName[],
): CanvasNode[] {
  if (nodes.length === 0) return [];

  const radius = Math.max(200, nodes.length * 40);

  // If directions provided, group nodes by direction quadrant
  if (directions && directions.length > 0) {
    return directionalCircularLayout(nodes, radius, directions);
  }

  // Simple even circular distribution
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return {
      ...n,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

function directionalCircularLayout(
  nodes: CanvasNode[],
  radius: number,
  directions: DirectionName[],
): CanvasNode[] {
  const groups = new Map<DirectionName, CanvasNode[]>();
  const ungrouped: CanvasNode[] = [];

  for (const dir of directions) groups.set(dir, []);
  for (const n of nodes) {
    if (n.direction && groups.has(n.direction)) {
      groups.get(n.direction)!.push(n);
    } else {
      ungrouped.push(n);
    }
  }

  const result: CanvasNode[] = [];
  const quadrantSpread = Math.PI / 6; // spread within each quadrant

  for (const [dir, group] of groups) {
    const baseAngle = DIRECTION_ANGLES[dir];
    for (let i = 0; i < group.length; i++) {
      const offset =
        group.length === 1
          ? 0
          : ((i / (group.length - 1)) - 0.5) * 2 * quadrantSpread;
      const angle = baseAngle + offset;
      result.push({
        ...group[i],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
  }

  // Ungrouped nodes fill gaps
  const usedAngles = result.length;
  const totalSlots = usedAngles + ungrouped.length;
  for (let i = 0; i < ungrouped.length; i++) {
    const angle = (2 * Math.PI * (usedAngles + i)) / totalSlots - Math.PI / 2;
    result.push({
      ...ungrouped[i],
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return result;
}

// ─── Force-Directed Layout (fallback) ────────────────────────────────────────
// Simple spring-electric simulation. Runs synchronously for a fixed iteration count.

const FORCE_ITERATIONS = 120;
const REPULSION = 8000;
const ATTRACTION = 0.005;
const DAMPING = 0.9;
const MIN_DISTANCE = 1;

export function forceLayout(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): CanvasNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  type Body = { id: string; x: number; y: number; vx: number; vy: number };
  const bodies: Body[] = nodes.map((n, i) => ({
    id: n.id,
    // Initial positions: spread on a circle to avoid overlap
    x: n.x !== 0 ? n.x : Math.cos((2 * Math.PI * i) / nodes.length) * 200,
    y: n.y !== 0 ? n.y : Math.sin((2 * Math.PI * i) / nodes.length) * 200,
    vx: 0,
    vy: 0,
  }));
  const bodyIndex = new Map(bodies.map((b) => [b.id, b]));

  for (let iter = 0; iter < FORCE_ITERATIONS; iter++) {
    // Repulsion (all pairs)
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DISTANCE);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction (edges)
    for (const e of edges) {
      const a = bodyIndex.get(e.source);
      const b = bodyIndex.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * ATTRACTION;
      const fy = dy * ATTRACTION;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Apply velocity with damping
    for (const body of bodies) {
      body.vx *= DAMPING;
      body.vy *= DAMPING;
      body.x += body.vx;
      body.y += body.vy;
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return bodies.map((b) => ({
    ...nodeMap.get(b.id)!,
    x: Math.round(b.x),
    y: Math.round(b.y),
  }));
}
