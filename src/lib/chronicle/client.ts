const DEFAULT_MEDICINE_WHEEL_URL = 'http://127.0.0.1:8040';
const ARTIFACT_CONTRACT = 'miadi.artifact-ref.v1';

const ARTIFACT_KINDS = [
  'chronicle_root',
  'chronicle_episode',
  'structured_plan',
  'state_machine',
] as const;

const DIRECTIONS = ['east', 'south', 'west', 'north'] as const;

type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
type Direction = (typeof DIRECTIONS)[number];

interface MedicineWheelHealth {
  status: 'healthy';
  provider: 'jsonl';
  counts?: {
    nodes?: number;
    ceremonies?: number;
  };
}

interface MedicineWheelNode {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  description?: unknown;
  direction?: unknown;
  metadata?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

interface MedicineWheelNodesResponse {
  nodes?: unknown;
  provider?: unknown;
  count?: unknown;
}

export interface ChronicleArtifactReference {
  id: string;
  name: string;
  description?: string;
  kind: ArtifactKind;
  relativePath: string;
  parentId?: string;
  goalId?: string;
  goalSummary?: string;
  schemaVersion?: string;
  status?: string;
  direction?: Direction;
  createdAt?: string;
  updatedAt?: string;
  /** Session that authored the plan (metadata.source_session). */
  sessionId?: string;
  /** SHA-256 of the plan file at registration (metadata.source_sha256). */
  planSha256?: string;
}

export interface ChronicleSnapshot {
  readonly: true;
  source: {
    service: 'medicine-wheel';
    baseUrl: string;
    status: 'healthy';
    provider: 'jsonl';
  };
  root: ChronicleArtifactReference | null;
  episodes: ChronicleArtifactReference[];
  structuredPlans: ChronicleArtifactReference[];
  stateMachines: ChronicleArtifactReference[];
  ignoredNodeCount: number;
}

export interface ChronicleClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function resolveBaseUrl(value?: string): string {
  const candidate = value ?? process.env.MW_API_URL ?? DEFAULT_MEDICINE_WHEEL_URL;
  const parsed = new URL(candidate);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('MW_API_URL must use http or https');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('MW_API_URL must be an origin without credentials, path, query, or fragment');
  }

  return parsed.origin;
}

export interface ChronicleSourceInfo {
  service: 'medicine-wheel';
  baseUrl: string | null;
  configError?: string;
}

/**
 * Resolve the upstream identity without throwing, so API proxies can report
 * WHICH Medicine Wheel they failed to reach (or that MW_API_URL is misconfigured).
 */
export function describeChronicleSource(baseUrl?: string): ChronicleSourceInfo {
  try {
    return { service: 'medicine-wheel', baseUrl: resolveBaseUrl(baseUrl) };
  } catch (error) {
    return {
      service: 'medicine-wheel',
      baseUrl: null,
      configError: error instanceof Error ? error.message : 'invalid MW_API_URL',
    };
  }
}

async function fetchJson(
  path: string,
  options: Required<Pick<ChronicleClientOptions, 'fetchImpl' | 'timeoutMs'>> & { baseUrl: string },
): Promise<unknown> {
  const response = await options.fetchImpl(`${options.baseUrl}${path}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Medicine Wheel ${path} returned HTTP ${response.status}`);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && (ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false;
  if (value === '.') return true;
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return false;
  return !value.split('/').some((segment) => segment === '..');
}

function normalizeReference(node: MedicineWheelNode): ChronicleArtifactReference | null {
  if (
    node.type !== 'knowledge' ||
    typeof node.id !== 'string' ||
    typeof node.name !== 'string' ||
    !isRecord(node.metadata) ||
    node.metadata.contract !== ARTIFACT_CONTRACT ||
    node.metadata.root !== 'MIADI_CHRONICLE_ROOT' ||
    !isArtifactKind(node.metadata.kind) ||
    !isSafeRelativePath(node.metadata.relative_path)
  ) {
    return null;
  }

  const reference: ChronicleArtifactReference = {
    id: node.id,
    name: node.name,
    kind: node.metadata.kind,
    relativePath: node.metadata.relative_path,
  };

  const description = optionalString(node.description);
  const parentId = optionalString(node.metadata.parent_id);
  const goalId = optionalString(node.metadata.goal_id);
  const goalSummary = optionalString(node.metadata.goal_summary);
  const schemaVersion = optionalString(node.metadata.schema_version);
  const status = optionalString(node.metadata.status);
  const createdAt = optionalString(node.created_at);
  const updatedAt = optionalString(node.updated_at);
  const sessionId = optionalString(node.metadata.source_session);
  const planSha256 = optionalString(node.metadata.source_sha256);

  if (description) reference.description = description;
  if (parentId) reference.parentId = parentId;
  if (goalId) reference.goalId = goalId;
  if (goalSummary) reference.goalSummary = goalSummary;
  if (schemaVersion) reference.schemaVersion = schemaVersion;
  if (status) reference.status = status;
  if (isDirection(node.direction)) reference.direction = node.direction;
  if (createdAt) reference.createdAt = createdAt;
  if (updatedAt) reference.updatedAt = updatedAt;
  if (sessionId) reference.sessionId = sessionId;
  if (planSha256) reference.planSha256 = planSha256;

  return reference;
}

export function findParentEpisode(
  plan: ChronicleArtifactReference,
  episodes: readonly ChronicleArtifactReference[],
): ChronicleArtifactReference | null {
  if (plan.kind !== 'structured_plan' || !plan.parentId) return null;
  return episodes.find(
    (episode) => episode.kind === 'chronicle_episode' && episode.id === plan.parentId,
  ) ?? null;
}

export function getEpisodeInquiryPath(episode: ChronicleArtifactReference): string {
  return episode.relativePath.replace(/\/episode\.ya?ml$/, '');
}

function byNewestThenName(
  left: ChronicleArtifactReference,
  right: ChronicleArtifactReference,
): number {
  const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? '') || 0;
  const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? '') || 0;
  return rightTime - leftTime || left.name.localeCompare(right.name);
}

export async function getChronicleSnapshot(
  options: ChronicleClientOptions = {},
): Promise<ChronicleSnapshot> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const requestOptions = {
    baseUrl,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 5_000,
  };

  const [healthValue, nodesValue] = await Promise.all([
    fetchJson('/api/health', requestOptions),
    fetchJson('/api/nodes', requestOptions),
  ]);

  if (
    !isRecord(healthValue) ||
    healthValue.status !== 'healthy' ||
    healthValue.provider !== 'jsonl'
  ) {
    throw new Error('Medicine Wheel health contract is not healthy JSONL');
  }

  const health = healthValue as unknown as MedicineWheelHealth;
  const nodesResponse = nodesValue as MedicineWheelNodesResponse;
  if (!isRecord(nodesValue) || !Array.isArray(nodesResponse.nodes)) {
    throw new Error('Medicine Wheel nodes response is malformed');
  }

  const references = nodesResponse.nodes
    .map((node) => (isRecord(node) ? normalizeReference(node) : null))
    .filter((reference): reference is ChronicleArtifactReference => reference !== null);

  return {
    readonly: true,
    source: {
      service: 'medicine-wheel',
      baseUrl,
      status: health.status,
      provider: health.provider,
    },
    root: references.find((reference) => reference.kind === 'chronicle_root') ?? null,
    episodes: references
      .filter((reference) => reference.kind === 'chronicle_episode')
      .sort(byNewestThenName),
    structuredPlans: references
      .filter((reference) => reference.kind === 'structured_plan')
      .sort(byNewestThenName),
    stateMachines: references
      .filter((reference) => reference.kind === 'state_machine')
      .sort(byNewestThenName),
    ignoredNodeCount: nodesResponse.nodes.length - references.length,
  };
}

// ─── Inquiry Weaves (spec 09) ────────────────────────────────────────────────
// Read-only projection of `<episode>/inquiry/weave.yaml` served by Medicine Wheel
// at GET {MW_API_URL}/api/inquiry-weaves?episode_path=<path>. Forgewright is a pure
// read consumer: three identities (artefact + issue + episode) + last_sync state.

const ISSUE_REF_PATTERN = /^[^\s/]+\/[^\s/#]+#\d+$/;

export const INQUIRY_SYNC_STATES = [
  'in-sync',
  'stale',
  'never-synced',
  'episode-copy-diverged',
] as const;

export type InquirySyncState = (typeof INQUIRY_SYNC_STATES)[number];

export interface InquiryRelation {
  artefact: string;
  issueRef?: string;
  issueUrl?: string;
  syncState: InquirySyncState;
  syncedAt?: string;
  relatedAt?: string;
  /** Episode identity from the weave record, so one unfiltered projection can be grouped per episode client-side. */
  episodePath?: string;
}

export interface EpisodeInquiry {
  /** null when the projection spans every registered weave (no episode filter). */
  episodePath: string | null;
  count: number;
  inquiries: InquiryRelation[];
}

function isInquirySyncState(value: unknown): value is InquirySyncState {
  return typeof value === 'string' && (INQUIRY_SYNC_STATES as readonly string[]).includes(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeInquiryRelation(value: unknown): InquiryRelation | null {
  if (!isRecord(value)) return null;

  const artefact = optionalString(value.artefact)
    ?? (isRecord(value.artefact) ? optionalString(value.artefact.id) : undefined);
  if (!artefact) return null;

  const relation: InquiryRelation = { artefact, syncState: 'never-synced' };

  const issueRef = optionalString(value.issue);
  if (issueRef && ISSUE_REF_PATTERN.test(issueRef)) relation.issueRef = issueRef;

  const issueUrl = optionalString(value.issue_url);
  if (issueUrl && isHttpUrl(issueUrl)) relation.issueUrl = issueUrl;

  if (isRecord(value.last_sync)) {
    if (isInquirySyncState(value.last_sync.state)) relation.syncState = value.last_sync.state;
    const syncedAt = optionalString(value.last_sync.at);
    if (syncedAt) relation.syncedAt = syncedAt;
  }

  const relatedAt = optionalString(value.related_at);
  if (relatedAt) relation.relatedAt = relatedAt;

  const episodePath = isRecord(value.episode) ? value.episode.path : undefined;
  if (isSafeRelativePath(episodePath)) relation.episodePath = episodePath;

  return relation;
}

function collectInquiryRelations(value: unknown): InquiryRelation[] {
  if (!isRecord(value)) return [];

  if (Array.isArray(value.weaves)) {
    // Grouped by episode (episode_number can match several); flatten every weave,
    // stamping the group's episode path on relations that lack their own.
    const relations: InquiryRelation[] = [];
    for (const weave of value.weaves) {
      if (!isRecord(weave) || !Array.isArray(weave.inquiries)) continue;
      const groupPath = isRecord(weave.episode) ? weave.episode.path : undefined;
      for (const entry of weave.inquiries) {
        const relation = normalizeInquiryRelation(entry);
        if (!relation) continue;
        if (!relation.episodePath && isSafeRelativePath(groupPath)) {
          relation.episodePath = groupPath;
        }
        relations.push(relation);
      }
    }
    return relations;
  }

  let raw: unknown[] = [];
  if (Array.isArray(value.inquiry_weaves)) {
    raw = value.inquiry_weaves;
  } else if (Array.isArray(value.inquiries)) {
    raw = value.inquiries;
  }

  return raw
    .map((relation) => normalizeInquiryRelation(relation))
    .filter((relation): relation is InquiryRelation => relation !== null);
}

export async function getEpisodeInquiry(
  episodePath: string | null,
  options: ChronicleClientOptions = {},
): Promise<EpisodeInquiry> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const requestOptions = {
    baseUrl,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 5_000,
  };

  const path = episodePath
    ? `/api/inquiry-weaves?episode_path=${encodeURIComponent(episodePath)}`
    : '/api/inquiry-weaves';
  const value = await fetchJson(path, requestOptions);
  const inquiries = collectInquiryRelations(value);

  return { episodePath, count: inquiries.length, inquiries };
}

// ─── Plan Perspectives (spec 10) ─────────────────────────────────────────────
// Read-only projection of PerspectiveRecord served by Medicine Wheel at
// GET {MW_API_URL}/api/plan-perspectives. One perspective may relate to many
// episode paths and appears beside each without forking its identity; the
// session file stays authoritative and ForgeWright never registers or mutates.

const PERSPECTIVE_ID_PREFIX = 'plan-perspective:';
const PERSPECTIVE_BODY_LIMIT = 64 * 1024;

export interface PlanPerspective {
  id: string;
  sessionId: string;
  planFilename: string;
  planSha256?: string;
  title: string;
  bodyMarkdown: string;
  miaContext?: string;
  episodePaths: string[];
  registeredAt?: string;
  updatedAt?: string;
  generator?: string;
}

export interface PlanPerspectives {
  count: number;
  perspectives: PlanPerspective[];
}

export interface PlanPerspectiveQuery {
  episodePath?: string;
  sessionId?: string;
  id?: string;
}

function normalizePlanPerspective(value: unknown): PlanPerspective | null {
  if (!isRecord(value)) return null;

  const id = optionalString(value.id);
  if (!id || !id.startsWith(PERSPECTIVE_ID_PREFIX)) return null;
  if (!isRecord(value.plan) || !isRecord(value.narrative)) return null;

  const sessionId = optionalString(value.plan.session_id);
  const planFilename = optionalString(value.plan.plan_filename);
  const title = optionalString(value.narrative.title);
  const body = optionalString(value.narrative.body_markdown);
  if (!sessionId || !planFilename || !title || !body) return null;

  const perspective: PlanPerspective = {
    id,
    sessionId,
    planFilename,
    title,
    bodyMarkdown: body.length > PERSPECTIVE_BODY_LIMIT ? body.slice(0, PERSPECTIVE_BODY_LIMIT) : body,
    episodePaths: [],
  };

  const planSha256 = optionalString(value.plan.plan_sha256);
  if (planSha256) perspective.planSha256 = planSha256;

  if (Array.isArray(value.episodes)) {
    const seen = new Set<string>();
    for (const episode of value.episodes) {
      const path = isRecord(episode) ? episode.path : undefined;
      if (isSafeRelativePath(path) && !seen.has(path)) {
        seen.add(path);
        perspective.episodePaths.push(path);
      }
    }
  }

  const miaContext = optionalString(value.narrative.mia_context);
  if (miaContext) perspective.miaContext = miaContext;

  if (isRecord(value.source)) {
    const registeredAt = optionalString(value.source.registered_at);
    const updatedAt = optionalString(value.source.updated_at);
    if (registeredAt) perspective.registeredAt = registeredAt;
    if (updatedAt) perspective.updatedAt = updatedAt;
    if (isRecord(value.source.generator)) {
      const generator = [
        optionalString(value.source.generator.system),
        optionalString(value.source.generator.model),
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
      if (generator) perspective.generator = generator;
    }
  }

  return perspective;
}

function collectPlanPerspectives(value: unknown): PlanPerspective[] {
  if (!isRecord(value)) return [];

  let raw: unknown[] = [];
  if (Array.isArray(value.plan_perspectives)) {
    raw = value.plan_perspectives;
  } else if (Array.isArray(value.perspectives)) {
    raw = value.perspectives;
  } else if (isRecord(value.record)) {
    raw = [value.record];
  }

  return raw
    .map((record) => normalizePlanPerspective(record))
    .filter((perspective): perspective is PlanPerspective => perspective !== null);
}

/**
 * Match a registered perspective to a structured-plan card.
 * Identity keys decide when both sides carry them: session_id first, then
 * plan_sha256. Filename comparison is the last resort — generic plan names
 * can collide across episodes, so it never overrides a strong-key verdict.
 */
export function perspectiveMatchesPlan(
  perspective: PlanPerspective,
  plan: ChronicleArtifactReference,
): boolean {
  if (plan.sessionId && perspective.sessionId) {
    return plan.sessionId === perspective.sessionId;
  }
  if (plan.planSha256 && perspective.planSha256) {
    return plan.planSha256 === perspective.planSha256;
  }
  const cardBase = plan.relativePath.split('/').pop()?.replace(/\.md$/, '');
  const recordBase = perspective.planFilename.replace(/\.md$/, '');
  return Boolean(cardBase) && cardBase === recordBase;
}

export async function getPlanPerspectives(
  query: PlanPerspectiveQuery,
  options: ChronicleClientOptions = {},
): Promise<PlanPerspectives> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const requestOptions = {
    baseUrl,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 5_000,
  };

  const params = new URLSearchParams();
  if (query.episodePath) {
    params.set('episode_path', query.episodePath);
  } else if (query.sessionId) {
    params.set('session_id', query.sessionId);
  } else if (query.id) {
    params.set('id', query.id);
  } else {
    throw new Error('plan perspectives query needs episode_path, session_id, or id');
  }

  const value = await fetchJson(`/api/plan-perspectives?${params.toString()}`, requestOptions);
  const perspectives = collectPlanPerspectives(value);

  return { count: perspectives.length, perspectives };
}

// ─── Narrative Beats (spec 11) ───────────────────────────────────────────────
// Read-only projection of NarrativeBeat / MedicineWheelCycle served by Medicine
// Wheel at GET {MW_API_URL}/api/narrative/beats and /api/narrative/cycles.
// Medicine Wheel is the system of record; ForgeWright reads, groups, and draws.
// It ships NO write path here — no POST, PATCH, or DELETE against /api/narrative.
//
// The wheel serves no filters yet (spec 11 Exportation §3), so the fetch is
// always unfiltered and the query is applied client-side. That keeps ONE probe
// feeding the metric tile, every episode section, and every arc.

export type ChronicleDirection = Direction;

/** Prose is bounded to the same 64 KiB the perspective body already honours. */
export const BEAT_PROSE_LIMIT = 64 * 1024;

/** Sunwise ordinal of a direction — the authority `act` is checked against. */
export const ACT_FOR_DIRECTION: Record<ChronicleDirection, number> = {
  east: 1,
  south: 2,
  west: 3,
  north: 4,
};

export type BeatDiscrepancyKind =
  | 'act-direction-mismatch'
  | 'missing-child'
  | 'missing-parent';

export interface BeatDiscrepancy {
  beatId: string;
  kind: BeatDiscrepancyKind;
  /** The unresolved id, for missing-child / missing-parent. */
  ref?: string;
}

export interface BeatOrigin {
  producer: string;
  sourceRef?: string;
  method?: string;
}

export interface NarrativeBeatRecord {
  id: string;
  direction: ChronicleDirection;
  /** Derived from `direction`; a contradicting served act raises a discrepancy. */
  act: number;
  title: string;
  description?: string;
  prose?: string;
  ceremonies: string[];
  learnings: string[];
  relationsHonored: string[];
  timestamp: string;
  /** Absent → unbound. NEVER inferred: membership is record, not view. */
  cycleId?: string;
  parentBeatId?: string;
  subBeatIds: string[];
  origin?: BeatOrigin;
}

export interface NarrativeCycleRecord {
  id: string;
  researchQuestion?: string;
  currentDirection?: ChronicleDirection;
  startDate?: string;
  /** A legacy cycle with no `beats` array is served as [], never an error. */
  beatIds: string[];
}

export interface ChronicleBeats {
  count: number;
  /** Records that failed the contract — surfaced, like ignoredNodeCount. */
  droppedCount: number;
  beats: NarrativeBeatRecord[];
  cycles: NarrativeCycleRecord[];
  discrepancies: BeatDiscrepancy[];
  /**
   * Set when the cycle surface did not answer — an older wheel may not serve it.
   * Beats still render from their own `cycle_id`; the view says the membership
   * list is missing rather than pretending there are no cycles.
   */
  cyclesUnavailable?: string;
}

export interface ChronicleArc {
  /** null when the lane is the unbound collection. */
  cycleId: string | null;
  researchQuestion?: string;
  currentDirection?: ChronicleDirection;
  byDirection: Record<ChronicleDirection, NarrativeBeatRecord[]>;
  unbound: NarrativeBeatRecord[];
  count: number;
  droppedCount: number;
  discrepancies: BeatDiscrepancy[];
}

export interface NarrativeBeatQuery {
  cycleId?: string;
  direction?: ChronicleDirection;
  episodePath?: string;
}

export function isChronicleDirection(value: unknown): value is ChronicleDirection {
  return isDirection(value);
}

/** Guard for an `episode_path` query value — same safety rule as a relative_path. */
export function isEpisodePathParam(value: unknown): value is string {
  return isSafeRelativePath(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const list: string[] = [];
  for (const entry of value) {
    const text = optionalString(entry)
      ?? (isRecord(entry) ? optionalString(entry.id) ?? optionalString(entry.name) : undefined);
    if (text) list.push(text);
  }
  return list;
}

function normalizeBeatOrigin(value: unknown): BeatOrigin | undefined {
  if (!isRecord(value)) return undefined;
  const producer = optionalString(value.producer);
  if (!producer) return undefined;

  const origin: BeatOrigin = { producer };
  const sourceRef = optionalString(value.source_ref);
  const method = optionalString(value.method);
  if (sourceRef) origin.sourceRef = sourceRef;
  if (method) origin.method = method;
  return origin;
}

interface NormalizedBeat {
  beat: NarrativeBeatRecord;
  actMismatch: boolean;
}

function normalizeNarrativeBeat(value: unknown): NormalizedBeat | null {
  if (!isRecord(value)) return null;

  const id = optionalString(value.id);
  const title = optionalString(value.title);
  const timestamp = optionalString(value.timestamp);
  // Fail closed: no id, direction, title, or timestamp → the record is dropped
  // and counted. A half-rendered beat would read as record.
  if (!id || !title || !timestamp || !isDirection(value.direction)) return null;

  const act = ACT_FOR_DIRECTION[value.direction];
  const servedAct = typeof value.act === 'number' && Number.isFinite(value.act)
    ? value.act
    : null;

  const beat: NarrativeBeatRecord = {
    id,
    direction: value.direction,
    act,
    title,
    timestamp,
    ceremonies: stringList(value.ceremonies),
    learnings: stringList(value.learnings),
    relationsHonored: stringList(value.relations_honored),
    subBeatIds: stringList(value.sub_beats),
  };

  const description = optionalString(value.description);
  const prose = optionalString(value.prose);
  const cycleId = optionalString(value.cycle_id);
  const parentBeatId = optionalString(value.parent_beat_id);
  const origin = normalizeBeatOrigin(value.origin);

  if (description) beat.description = description;
  if (prose) beat.prose = prose.length > BEAT_PROSE_LIMIT ? prose.slice(0, BEAT_PROSE_LIMIT) : prose;
  if (cycleId) beat.cycleId = cycleId;
  if (parentBeatId) beat.parentBeatId = parentBeatId;
  if (origin) beat.origin = origin;

  return { beat, actMismatch: servedAct !== act };
}

function normalizeNarrativeCycle(value: unknown): NarrativeCycleRecord | null {
  if (!isRecord(value)) return null;

  const id = optionalString(value.id);
  if (!id) return null;

  const cycle: NarrativeCycleRecord = { id, beatIds: stringList(value.beats) };

  const researchQuestion = optionalString(value.research_question)
    ?? optionalString(value.cycle_question);
  const startDate = optionalString(value.start_date);
  if (researchQuestion) cycle.researchQuestion = researchQuestion;
  if (startDate) cycle.startDate = startDate;
  if (isDirection(value.current_direction)) cycle.currentDirection = value.current_direction;

  return cycle;
}

/** A bare array and `{ beats: [...] }` are both accepted (spec 11.5, 11.7 §1). */
function collectRawList(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return [];
}

// ─── Episode ↔ beat association ──────────────────────────────────────────────
// The wheel registers a REFERENCE to an episode, and a beat carries its own
// provenance. Association is therefore derived at read time from what the wheel
// served, never written back: `origin.source_ref` first (the explicit claim),
// then the episode number carried by a cycle id (`cycle-ep299-…`). Deriving an
// episode is not deriving a cycle — an unbound beat stays unbound.

const EPISODE_NUMBER_PATTERNS = [/episode[-_](\d{1,6})/i, /\bep[-_]?(\d{1,6})\b/i];

/** Episode ordinal carried by a path, a source_ref, or a cycle id. */
export function episodeNumberOf(value: string): string | null {
  for (const pattern of EPISODE_NUMBER_PATTERNS) {
    const match = pattern.exec(value);
    if (match) return String(Number.parseInt(match[1], 10));
  }
  return null;
}

export function beatMatchesEpisode(beat: NarrativeBeatRecord, episodePath: string): boolean {
  const episodeNumber = episodeNumberOf(episodePath);
  const sourceRef = beat.origin?.sourceRef;

  if (sourceRef) {
    // Exact vessel, a file inside the vessel, or the vessel name truncated
    // before its slug (`2026-07-25-episode-299` for `…-299-isolation`).
    if (sourceRef === episodePath) return true;
    if (sourceRef.startsWith(`${episodePath}/`)) return true;
    if (episodePath.startsWith(`${sourceRef}-`) || episodePath.startsWith(`${sourceRef}/`)) return true;

    // An explicit claim decides on its own: a source_ref naming another episode
    // must not be overridden by a cycle-id convention.
    const refNumber = episodeNumberOf(sourceRef);
    if (refNumber) return episodeNumber !== null && refNumber === episodeNumber;
  }

  if (episodeNumber && beat.cycleId) {
    const cycleNumber = episodeNumberOf(beat.cycleId);
    if (cycleNumber) return cycleNumber === episodeNumber;
  }

  return false;
}

/** A cycle belongs to an episode through its own id or any member beat. */
export function cycleMatchesEpisode(
  cycle: NarrativeCycleRecord,
  episodePath: string,
  beats: readonly NarrativeBeatRecord[],
): boolean {
  const episodeNumber = episodeNumberOf(episodePath);
  if (episodeNumber) {
    const cycleNumber = episodeNumberOf(cycle.id);
    if (cycleNumber && cycleNumber === episodeNumber) return true;
  }
  return beats.some(
    (beat) =>
      (beat.cycleId === cycle.id || cycle.beatIds.includes(beat.id))
      && beatMatchesEpisode(beat, episodePath),
  );
}

/** True when no registered episode claims this beat — surfaced, never hidden. */
export function beatHasNoEpisode(
  beat: NarrativeBeatRecord,
  episodePaths: readonly string[],
): boolean {
  return !episodePaths.some((path) => beatMatchesEpisode(beat, path));
}

function collectBeatDiscrepancies(beats: readonly NormalizedBeat[]): BeatDiscrepancy[] {
  const served = new Set(beats.map((entry) => entry.beat.id));
  const discrepancies: BeatDiscrepancy[] = [];

  for (const { beat, actMismatch } of beats) {
    if (actMismatch) discrepancies.push({ beatId: beat.id, kind: 'act-direction-mismatch' });
    for (const childId of beat.subBeatIds) {
      if (!served.has(childId)) {
        discrepancies.push({ beatId: beat.id, kind: 'missing-child', ref: childId });
      }
    }
    if (beat.parentBeatId && !served.has(beat.parentBeatId)) {
      discrepancies.push({ beatId: beat.id, kind: 'missing-parent', ref: beat.parentBeatId });
    }
  }

  return discrepancies;
}

/**
 * Read the beat surface. The beats endpoint is load-bearing — when it fails the
 * error travels (the proxy answers 503) so an unreachable wheel is never shaped
 * like an empty chronicle. The cycles endpoint is enriching: an older wheel that
 * does not serve it degrades to `cyclesUnavailable` with the beats still drawn.
 */
export async function getNarrativeBeats(
  query: NarrativeBeatQuery = {},
  options: ChronicleClientOptions = {},
): Promise<ChronicleBeats> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const requestOptions = {
    baseUrl,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 5_000,
  };

  const [beatsResult, cyclesResult] = await Promise.allSettled([
    fetchJson('/api/narrative/beats', requestOptions),
    fetchJson('/api/narrative/cycles', requestOptions),
  ]);

  if (beatsResult.status === 'rejected') {
    throw beatsResult.reason instanceof Error
      ? beatsResult.reason
      : new Error('Medicine Wheel /api/narrative/beats is unavailable');
  }

  const normalized = collectRawList(beatsResult.value, 'beats', 'narrative_beats')
    .map((record) => normalizeNarrativeBeat(record))
    .filter((entry): entry is NormalizedBeat => entry !== null);
  const droppedCount = collectRawList(beatsResult.value, 'beats', 'narrative_beats').length
    - normalized.length;

  let cycles: NarrativeCycleRecord[] = [];
  let cyclesUnavailable: string | undefined;
  if (cyclesResult.status === 'fulfilled') {
    cycles = collectRawList(cyclesResult.value, 'cycles', 'narrative_cycles')
      .map((record) => normalizeNarrativeCycle(record))
      .filter((cycle): cycle is NarrativeCycleRecord => cycle !== null);
  } else {
    cyclesUnavailable = cyclesResult.reason instanceof Error
      ? cyclesResult.reason.message
      : 'Medicine Wheel /api/narrative/cycles is unavailable';
  }

  const discrepancies = collectBeatDiscrepancies(normalized);
  let beats = normalized.map((entry) => entry.beat);

  // The wheel serves no filters yet, so the query is honoured here.
  if (query.cycleId) {
    const cycle = cycles.find((entry) => entry.id === query.cycleId);
    beats = beats.filter(
      (beat) => beat.cycleId === query.cycleId || (cycle?.beatIds.includes(beat.id) ?? false),
    );
  }
  if (query.direction) {
    beats = beats.filter((beat) => beat.direction === query.direction);
  }
  if (query.episodePath) {
    const episodePath = query.episodePath;
    beats = beats.filter((beat) => beatMatchesEpisode(beat, episodePath));
    cycles = cycles.filter((cycle) => cycleMatchesEpisode(cycle, episodePath, beats));
  }

  const keptIds = new Set(beats.map((beat) => beat.id));

  const result: ChronicleBeats = {
    count: beats.length,
    droppedCount,
    beats,
    cycles,
    discrepancies: discrepancies.filter((entry) => keptIds.has(entry.beatId)),
  };
  if (cyclesUnavailable) result.cyclesUnavailable = cyclesUnavailable;
  return result;
}
