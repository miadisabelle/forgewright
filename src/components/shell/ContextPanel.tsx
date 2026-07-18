'use client';

import { useState } from 'react';
import { useDesignerStore, useCeremonyStore } from '@forgewright/stores';
import { DIRECTIONS, CEREMONY_ICONS, type CeremonyPhase, type DirectionName } from '@forgewright/lib/types';

// ─── Tab types ────────────────────────────────────────────────────────────────

type ContextTab = 'properties' | 'narrative' | 'ceremony';

const CONTEXT_TABS: { id: ContextTab; label: string }[] = [
  { id: 'properties', label: 'Properties' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'ceremony', label: 'Ceremony' },
];

// ─── Direction ink + tint (semantic, AA on coal) ─────────────────────────────

const DIRECTION_ROW: Record<DirectionName, { ink: string; tint: string }> = {
  east: { ink: 'text-forge-east-ink', tint: 'bg-forge-east-tint' },
  south: { ink: 'text-forge-south-ink', tint: 'bg-forge-south-tint' },
  west: { ink: 'text-forge-west-ink', tint: 'bg-forge-west-tint' },
  north: { ink: 'text-forge-north-ink', tint: 'bg-forge-north-tint' },
};

// ─── Phase guidance (static) ──────────────────────────────────────────────────

const PHASE_GUIDANCE: Record<CeremonyPhase, string> = {
  preparation: 'Set intention. Decompose the prompt. Honor existing relations before acting.',
  opening: 'Open the ceremony. Invoke companions. Establish relational accountability.',
  active: 'Full creative engagement. State machines, graphs, and narrative are all available.',
  integration: 'Gather learnings. Record narrative beats. Prepare for reflection.',
  closing: 'Close with gratitude. Archive the story. Honor what was forged.',
};

// ─── Section head — the slab speaks for panel sections ───────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-[13px] font-semibold tracking-wide text-neutral-200">
      {children}
    </h3>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ContextPanelProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function ContextPanel({ collapsed = false, onToggle }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<ContextTab>('properties');

  const selection = useDesignerStore((s) => s.selection);
  const nodes = useDesignerStore((s) => s.nodes);
  const edges = useDesignerStore((s) => s.edges);

  const activeCeremony = useCeremonyStore((s) => s.activeCeremony);
  const currentPhase = useCeremonyStore((s) => s.currentPhase);
  const participants = useCeremonyStore((s) => s.participants);

  // Collapsed state
  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center border-l border-neutral-800 bg-neutral-950 py-3">
        <button
          onClick={onToggle}
          className="rounded px-1.5 py-0.5 text-sm text-neutral-400 transition-colors duration-(--fw-dur-fast) hover:bg-neutral-900 hover:text-neutral-100"
          aria-label="Expand context panel"
          title="Expand context panel"
        >
          «
        </button>
      </aside>
    );
  }

  const selectedNode = selection ? nodes.find((n) => n.id === selection) : null;
  const selectedEdge = selection ? edges.find((e) => e.id === selection) : null;

  return (
    <aside className="flex h-full w-80 flex-col border-l border-neutral-800 bg-neutral-950">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-2 py-1.5">
        <nav className="flex gap-1" role="tablist" aria-label="Context panel tabs">
          {CONTEXT_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded px-2 py-1 text-caption font-medium transition-colors duration-(--fw-dur-fast) ${
                activeTab === tab.id
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {onToggle && (
          <button
            onClick={onToggle}
            className="rounded px-1.5 py-0.5 text-sm text-neutral-400 transition-colors duration-(--fw-dur-fast) hover:bg-neutral-900 hover:text-neutral-100"
            aria-label="Collapse context panel"
            title="Collapse context panel"
          >
            »
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'properties' && (
          <PropertiesTab node={selectedNode} edge={selectedEdge} />
        )}
        {activeTab === 'narrative' && <NarrativeTab />}
        {activeTab === 'ceremony' && (
          <CeremonyTab
            ceremony={activeCeremony}
            currentPhase={currentPhase}
            participants={participants}
          />
        )}
      </div>
    </aside>
  );
}

// ─── Properties Tab ───────────────────────────────────────────────────────────

function PropertiesTab({
  node,
  edge,
}: {
  node: ReturnType<typeof useDesignerStore.getState>['nodes'][number] | null | undefined;
  edge: ReturnType<typeof useDesignerStore.getState>['edges'][number] | null | undefined;
}) {
  if (!node && !edge) {
    return (
      <p className="text-caption text-neutral-500">
        Select a node or edge on the canvas to see its properties here.
      </p>
    );
  }

  if (node) {
    return (
      <div className="space-y-3">
        <SectionHead>Node</SectionHead>
        <PropertyRow label="Name" value={node.name} />
        <PropertyRow label="Kind" value={node.kind} />
        <PropertyRow label="ID" value={node.id} mono />
        <PropertyRow label="Position" value={`(${Math.round(node.x)}, ${Math.round(node.y)})`} mono />
        <PropertyRow label="Size" value={`${node.width} × ${node.height}`} mono />
        {node.direction && (
          <PropertyRow
            label="Direction"
            value={`${DIRECTIONS[node.direction].emoji} ${DIRECTIONS[node.direction].name}`}
          />
        )}
        {node.parentId && <PropertyRow label="Parent" value={node.parentId} mono />}
      </div>
    );
  }

  if (edge) {
    return (
      <div className="space-y-3">
        <SectionHead>Edge</SectionHead>
        <PropertyRow label="Event" value={edge.event} />
        <PropertyRow label="ID" value={edge.id} mono />
        <PropertyRow label="Source" value={edge.sourceId} mono />
        <PropertyRow label="Target" value={edge.targetId} mono />
        {edge.condition && <PropertyRow label="Condition" value={edge.condition} />}
        {edge.label && <PropertyRow label="Label" value={edge.label} />}
      </div>
    );
  }

  return null;
}

function PropertyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span
        className={`break-all text-right text-caption text-neutral-200 ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Narrative Tab ────────────────────────────────────────────────────────────

function NarrativeTab() {
  // Narrative beats would come from a narrative store — honest placeholder until wired
  return (
    <div className="space-y-3">
      <SectionHead>Narrative arc</SectionHead>
      <p className="text-caption text-neutral-500">
        Beats are not wired yet. They will appear here as the ceremony moves through
        the Four Directions.
      </p>
      <div className="space-y-2">
        {(['east', 'south', 'west', 'north'] as const).map((dir) => (
          <div
            key={dir}
            className={`flex items-center gap-2 rounded border border-neutral-800 px-2 py-1.5 ${DIRECTION_ROW[dir].tint}`}
          >
            <span aria-hidden className="text-sm">{DIRECTIONS[dir].emoji}</span>
            <span className={`text-caption font-medium ${DIRECTION_ROW[dir].ink}`}>
              {DIRECTIONS[dir].name}
            </span>
            <span className="ml-auto text-[10px] text-neutral-500">{DIRECTIONS[dir].ojibwe}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ceremony Tab ─────────────────────────────────────────────────────────────

function CeremonyTab({
  ceremony,
  currentPhase,
  participants,
}: {
  ceremony: ReturnType<typeof useCeremonyStore.getState>['activeCeremony'];
  currentPhase: CeremonyPhase;
  participants: string[];
}) {
  const guidance = PHASE_GUIDANCE[currentPhase];

  return (
    <div className="space-y-4">
      <SectionHead>Ceremony</SectionHead>

      {/* Phase indicator */}
      <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-caption font-semibold capitalize text-neutral-100">
            {currentPhase}
          </span>
          <PhaseIndicator currentPhase={currentPhase} />
        </div>
        <p className="text-caption leading-relaxed text-neutral-400">{guidance}</p>
      </div>

      {/* Active ceremony details */}
      {ceremony ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-sm">{CEREMONY_ICONS[ceremony.type]}</span>
            <span className="text-caption capitalize text-neutral-200">
              {ceremony.type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-caption text-neutral-400">{ceremony.intention}</p>

          {participants.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                Participants
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {participants.map((p) => (
                  <span
                    key={p}
                    className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ceremony.events.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                Events ({ceremony.events.length})
              </span>
              <ul className="mt-1 space-y-1">
                {ceremony.events.slice(-5).map((evt) => (
                  <li key={evt.id} className="text-[10px] text-neutral-400">
                    <span className="font-mono tabular-nums text-neutral-500">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    {evt.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-caption text-neutral-500">
          No ceremony is open. One opens with the next session.
        </p>
      )}
    </div>
  );
}

// ─── Phase progress dots ──────────────────────────────────────────────────────

const PHASES: CeremonyPhase[] = ['preparation', 'opening', 'active', 'integration', 'closing'];

function PhaseIndicator({ currentPhase }: { currentPhase: CeremonyPhase }) {
  const currentIdx = PHASES.indexOf(currentPhase);

  return (
    <div className="ml-auto flex items-center gap-1">
      {PHASES.map((phase, idx) => (
        <span
          key={phase}
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-(--fw-dur) ${
            idx <= currentIdx ? 'bg-neutral-300' : 'bg-neutral-700'
          }`}
          title={phase}
        />
      ))}
    </div>
  );
}
