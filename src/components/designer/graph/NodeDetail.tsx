'use client';

import React, { useMemo } from 'react';
import type { GraphNode, GraphEdge, DirectionName } from '@forgewright/lib/types';
import { DIRECTIONS } from '@forgewright/lib/types';
import { getNodeLabel, getNodeDirection, NODE_TYPE_COLORS } from './graph-to-canvas';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface NodeDetailProps {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

// ─── OCAP Badge ──────────────────────────────────────────────────────────────

const OCAP_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  public:    { icon: '🌐', label: 'Public',   color: '#22c55e' },
  community: { icon: '👥', label: 'Community', color: '#3b82f6' },
  ceremony:  { icon: '🔒', label: 'Ceremony', color: '#f59e0b' },
  sacred:    { icon: '🔐', label: 'Sacred',   color: '#ef4444' },
};

function OcapBadge({ access }: { access: string }) {
  const cfg = OCAP_CONFIG[access] ?? OCAP_CONFIG.public;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: cfg.color + '20', color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Direction Badge ─────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: DirectionName }) {
  const info = DIRECTIONS[direction];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-neutral-200"
      style={{ backgroundColor: '#ffffff10', border: '1px solid #ffffff20' }}
    >
      {info.emoji} {info.name} — {info.ojibwe}
    </span>
  );
}

// ─── Property Row ────────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-28 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-xs text-neutral-200 break-all">{value}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NodeDetail({
  node,
  edges,
  allNodes,
  onClose,
  onNavigateToNode,
}: NodeDetailProps) {
  const direction = getNodeDirection(node);
  const label = getNodeLabel(node);
  const colors = NODE_TYPE_COLORS[node.nodeType];

  // Find immediate neighbors
  const neighbors = useMemo(() => {
    const neighborIds = new Set<string>();
    for (const e of edges) {
      if (e.fromId === node.id) neighborIds.add(e.toId);
      if (e.toId === node.id) neighborIds.add(e.fromId);
    }
    return allNodes.filter((n) => neighborIds.has(n.id));
  }, [node.id, edges, allNodes]);

  // All node properties (type-specific)
  const properties = useMemo(() => {
    const props: Array<{ label: string; value: string }> = [];
    props.push({ label: 'ID', value: node.id });
    props.push({ label: 'Type', value: node.nodeType });
    props.push({ label: 'Created', value: node.createdAt });
    if (node.updatedAt) props.push({ label: 'Updated', value: node.updatedAt });

    switch (node.nodeType) {
      case 'Spec':
        props.push({ label: 'Version', value: node.version });
        props.push({ label: 'Status', value: node.status });
        if (node.content) props.push({ label: 'Content', value: node.content.slice(0, 120) });
        break;
      case 'Companion':
        props.push({ label: 'Role', value: node.role });
        if (node.embodiment) props.push({ label: 'Embodiment', value: node.embodiment });
        break;
      case 'Ceremony':
        props.push({ label: 'Phase', value: node.phase });
        break;
      case 'Session':
        if (node.title) props.push({ label: 'Title', value: node.title });
        props.push({ label: 'Started', value: node.startedAt });
        if (node.endedAt) props.push({ label: 'Ended', value: node.endedAt });
        props.push({ label: 'Status', value: node.status });
        break;
      case 'ActionStep':
        props.push({ label: 'Description', value: node.description });
        props.push({ label: 'Status', value: node.status });
        if (node.orderIndex !== undefined) props.push({ label: 'Order', value: String(node.orderIndex) });
        break;
      case 'NarrativeBeat':
        props.push({ label: 'Content', value: node.content.slice(0, 120) });
        if (node.emotion) props.push({ label: 'Emotion', value: node.emotion });
        props.push({ label: 'Intensity', value: String(node.intensity) });
        break;
      case 'Intent':
        props.push({ label: 'Description', value: node.description });
        props.push({ label: 'Urgency', value: node.urgency });
        break;
      case 'StateMachine':
        if (node.namespace) props.push({ label: 'Namespace', value: node.namespace });
        props.push({ label: 'Current State', value: node.currentState });
        break;
      case 'State':
        if (node.isInitial) props.push({ label: 'Initial', value: 'Yes' });
        if (node.isFinal) props.push({ label: 'Final', value: 'Yes' });
        if (node.kind) props.push({ label: 'Kind', value: node.kind });
        break;
      case 'Event':
        if (node.payload) props.push({ label: 'Payload', value: node.payload });
        if (node.firedAt) props.push({ label: 'Fired', value: node.firedAt });
        break;
    }
    return props;
  }, [node]);

  // Edges involving this node
  const relatedEdges = useMemo(
    () => edges.filter((e) => e.fromId === node.id || e.toId === node.id),
    [node.id, edges],
  );

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-neutral-700 bg-neutral-900/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: colors.stroke }}
          />
          <span className="truncate text-sm font-medium text-neutral-100">{label}</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: colors.stroke + '20', color: colors.stroke }}
          >
            {node.nodeType}
          </span>
          <OcapBadge access={node.ocap.access} />
          {direction && <DirectionBadge direction={direction} />}
        </div>

        {/* OCAP Details */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            OCAP Governance
          </h3>
          <div className="rounded border border-neutral-700 bg-neutral-800/50 px-3 py-2">
            <PropRow label="Ownership" value={node.ocap.ownership} />
            <PropRow label="Control" value={node.ocap.control} />
            <PropRow label="Access" value={node.ocap.access} />
            <PropRow label="Possession" value={node.ocap.possession} />
          </div>
        </div>

        {/* Properties */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Properties
          </h3>
          <div className="rounded border border-neutral-700 bg-neutral-800/50 px-3 py-2">
            {properties.map((p) => (
              <PropRow key={p.label} label={p.label} value={p.value} />
            ))}
          </div>
        </div>

        {/* Relationships */}
        {relatedEdges.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Relationships ({relatedEdges.length})
            </h3>
            <div className="space-y-1">
              {relatedEdges.map((e) => {
                const isOutgoing = e.fromId === node.id;
                const otherId = isOutgoing ? e.toId : e.fromId;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800/50 px-2 py-1.5 text-xs"
                  >
                    <span className="text-neutral-400">{isOutgoing ? '→' : '←'}</span>
                    <span className="text-neutral-300">{e.edgeType.replace(/_/g, ' ')}</span>
                    <span className="text-neutral-500">—</span>
                    <button
                      onClick={() => onNavigateToNode?.(otherId)}
                      className="truncate text-blue-400 hover:underline"
                      title={otherId}
                    >
                      {otherId.slice(0, 12)}…
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Neighbors */}
        {neighbors.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Neighbors ({neighbors.length})
            </h3>
            <div className="space-y-1">
              {neighbors.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onNavigateToNode?.(n.id)}
                  className="flex w-full items-center gap-2 rounded border border-neutral-700 bg-neutral-800/50 px-2 py-1.5 text-left text-xs hover:bg-neutral-700/50"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: NODE_TYPE_COLORS[n.nodeType].stroke }}
                  />
                  <span className="truncate text-neutral-200">{getNodeLabel(n)}</span>
                  <span className="ml-auto text-neutral-500">{n.nodeType}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
