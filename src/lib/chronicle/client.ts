const DEFAULT_MEDICINE_WHEEL_URL = 'http://127.0.0.1:3940';
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
