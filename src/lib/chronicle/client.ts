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
  schemaVersion?: string;
  status?: string;
  direction?: Direction;
  createdAt?: string;
  updatedAt?: string;
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
  const schemaVersion = optionalString(node.metadata.schema_version);
  const status = optionalString(node.metadata.status);
  const createdAt = optionalString(node.created_at);
  const updatedAt = optionalString(node.updated_at);

  if (description) reference.description = description;
  if (parentId) reference.parentId = parentId;
  if (schemaVersion) reference.schemaVersion = schemaVersion;
  if (status) reference.status = status;
  if (isDirection(node.direction)) reference.direction = node.direction;
  if (createdAt) reference.createdAt = createdAt;
  if (updatedAt) reference.updatedAt = updatedAt;

  return reference;
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
