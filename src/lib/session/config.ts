/**
 * Session configuration defaults and utilities.
 *
 * Provides sensible defaults for ForgewrightConfig and session-level
 * settings. Deep merge preserves user overrides while filling gaps.
 */

import { ForgewrightConfigSchema, type ForgewrightConfig } from '../types/session';
import type { CheckpointPolicy } from '../types/session';

// ─── Default Checkpoint Policy ───────────────────────────────────────────────

export const DEFAULT_CHECKPOINT_POLICY: CheckpointPolicy = {
  type: 'cycle-complete',
  mandatoryAt: ['north'],
  maxAutonomousCycles: 3,
};

// ─── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: ForgewrightConfig = {
  graphPath: '~/.forgewright/graph',
  mcpTransport: 'stdio',
};

// ─── Session Defaults ────────────────────────────────────────────────────────

export const SESSION_DEFAULTS = {
  maxCycles: 4,
  initialDirection: 'east' as const,
  storageDir: '~/.forgewright/sessions',
} as const;

// ─── Deep Merge ──────────────────────────────────────────────────────────────

/**
 * Deep merge a partial config into defaults.
 * User-provided values always win over defaults.
 */
export function mergeConfig(
  partial: Partial<ForgewrightConfig>,
  defaults: ForgewrightConfig = DEFAULT_CONFIG,
): ForgewrightConfig {
  return {
    ...defaults,
    ...partial,
    // Only override defined values
    graphPath: partial.graphPath ?? defaults.graphPath,
    mcpTransport: partial.mcpTransport ?? defaults.mcpTransport,
    redisUrl: partial.redisUrl ?? defaults.redisUrl,
  };
}

// ─── Validate Config ─────────────────────────────────────────────────────────

export interface ConfigValidationResult {
  valid: boolean;
  config?: ForgewrightConfig;
  errors: string[];
}

/**
 * Validate a config object against the Zod schema.
 * Returns parsed config on success, error messages on failure.
 */
export function validateConfig(config: unknown): ConfigValidationResult {
  const result = ForgewrightConfigSchema.safeParse(config);

  if (result.success) {
    return { valid: true, config: result.data, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    ),
  };
}
