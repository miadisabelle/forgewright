/**
 * AgentLoop — autonomous development loop governed by the Medicine Wheel spiral.
 *
 * Orchestrates the full circular development cycle:
 *   🌅 East (Decompose) → 🔥 South (Research) → 🌊 West (Implement) → ❄️ North (Integrate)
 *
 * Each direction boundary triggers a checkpoint evaluation. Oscillation patterns
 * cause escalation. Maximum 3 cycles then mandatory human review.
 *
 * The loop does not execute direction work directly — it delegates to the
 * `onDirectionWork` callback, which fires the appropriate MCP tools for each
 * direction. The loop's responsibility is spiral governance: tracking position,
 * enforcing checkpoints, detecting oscillation, and honoring sovereignty.
 */

import type { DirectionName } from '../types/directions.js';
import type { CheckpointPolicy, ForgewrightSession, SpiralPosition } from '../types/session.js';
import { DIRECTIONS } from '../types/directions.js';
import { SpiralTracker, SpiralMaxCyclesError } from './spiral-tracker.js';
import type { DirectionEntry } from './spiral-tracker.js';
import { detectSessionOscillation } from './oscillation-detector.js';
import type { SessionOscillationReport } from './oscillation-detector.js';
import { CheckpointManager } from './checkpoint.js';
import type { Checkpoint, CheckpointDecision } from './checkpoint.js';

// ─── Direction Labels ────────────────────────────────────────────────────────

const DIRECTION_WORK: Record<DirectionName, string> = {
  east: 'decompose',
  south: 'research',
  west: 'implement',
  north: 'integrate',
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentConfig {
  sessionId: string;
  intent: string;
  maxCycles?: number;
  checkpointPolicy?: CheckpointPolicy;
  /** Called for each direction — fires appropriate MCP tools. */
  onDirectionWork?: (
    direction: DirectionName,
    context: DirectionContext,
  ) => Promise<DirectionResult>;
  /** Called at checkpoint boundaries — returns human decision. */
  onCheckpoint?: (checkpoint: Checkpoint) => Promise<CheckpointDecision>;
  /** Called when oscillation is detected — returns escalation decision. */
  onOscillation?: (
    report: SessionOscillationReport,
  ) => Promise<CheckpointDecision>;
}

export interface DirectionContext {
  intent: string;
  direction: DirectionName;
  directionLabel: string;
  position: SpiralPosition;
  history: readonly DirectionEntry[];
  cycleCount: number;
}

export interface DirectionResult {
  success: boolean;
  artifacts: string[];
  tensionDelta?: number;
  notes?: string;
}

export type AgentLoopStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'halted'
  | 'max_cycles_reached';

export interface AgentLoopResult {
  status: AgentLoopStatus;
  finalPosition: SpiralPosition;
  cyclesCompleted: number;
  directionResults: Map<string, DirectionResult>;
  checkpoints: Checkpoint[];
  oscillationReports: SessionOscillationReport[];
  history: readonly DirectionEntry[];
}

// ─── Default Policy ──────────────────────────────────────────────────────────

const DEFAULT_POLICY: CheckpointPolicy = {
  type: 'direction-change',
  mandatoryAt: ['north'],
  maxAutonomousCycles: 3,
};

// ─── AgentLoop ───────────────────────────────────────────────────────────────

export class AgentLoop {
  private tracker!: SpiralTracker;
  private checkpointManager: CheckpointManager;
  private policy!: CheckpointPolicy;
  private directionResults: Map<string, DirectionResult> = new Map();
  private oscillationReports: SessionOscillationReport[] = [];
  private status: AgentLoopStatus = 'running';

  constructor() {
    this.checkpointManager = new CheckpointManager();
  }

  /**
   * Run the autonomous development spiral.
   *
   * Spiral flow:
   *   decompose (E) → research (S) → implement (W) → integrate (N)
   *
   * At each boundary: checkpoint check + oscillation detection.
   * Max 3 cycles then mandatory human review.
   */
  async run(intent: string, config: AgentConfig): Promise<AgentLoopResult> {
    this.policy = config.checkpointPolicy ?? DEFAULT_POLICY;
    this.tracker = new SpiralTracker(config.sessionId, {
      maxCycles: config.maxCycles ?? this.policy.maxAutonomousCycles,
    });
    this.directionResults = new Map();
    this.oscillationReports = [];
    this.status = 'running';

    try {
      while (this.status === 'running') {
        const position = this.tracker.getCurrentPosition();
        const direction = position.direction;

        // ── Execute direction work ──────────────────────────
        if (config.onDirectionWork) {
          const context: DirectionContext = {
            intent,
            direction,
            directionLabel: `${DIRECTIONS[direction].emoji} ${DIRECTIONS[direction].name} (${DIRECTION_WORK[direction]})`,
            position,
            history: this.tracker.getHistory(),
            cycleCount: position.cycleCount,
          };

          const result = await config.onDirectionWork(direction, context);
          const key = `${direction}-cycle${position.cycleCount}`;
          this.directionResults.set(key, result);

          if (!result.success) {
            this.status = 'halted';
            break;
          }
        }

        // ── Oscillation check ───────────────────────────────
        const oscillation = detectSessionOscillation(
          this.tracker.getHistory(),
        );

        if (oscillation) {
          this.oscillationReports.push(oscillation);

          if (config.onOscillation) {
            const decision = await config.onOscillation(oscillation);
            if (decision === 'stop') {
              this.status = 'halted';
              break;
            }
          }

          if (oscillation.severity === 'critical') {
            this.status = 'halted';
            break;
          }
        }

        // ── Advance direction ───────────────────────────────
        try {
          this.tracker.advanceDirection();
        } catch (err) {
          if (err instanceof SpiralMaxCyclesError) {
            this.status = 'max_cycles_reached';
            break;
          }
          throw err;
        }

        const newPosition = this.tracker.getCurrentPosition();

        // ── Checkpoint evaluation ───────────────────────────
        const shouldPause = this.checkpointManager.shouldCheckpoint(
          newPosition,
          this.policy,
          oscillation !== null,
        );

        if (shouldPause) {
          const session = this.buildSessionForCheckpoint(
            config,
            newPosition,
          );
          const checkpoint = this.checkpointManager.createCheckpoint(
            session,
            `Direction boundary: ${position.direction} → ${newPosition.direction} (cycle ${newPosition.cycleCount})`,
            oscillation ?? undefined,
          );

          if (config.onCheckpoint) {
            const decision = await config.onCheckpoint(checkpoint);

            switch (decision) {
              case 'stop':
                this.status = 'halted';
                break;
              case 'adjust':
              case 'fork':
                this.status = 'paused';
                break;
              case 'continue':
              default:
                break;
            }

            if (this.status !== 'running') break;
          }
        }
      }
    } catch (err) {
      if (err instanceof SpiralMaxCyclesError) {
        this.status = 'max_cycles_reached';
      } else {
        throw err;
      }
    }

    if (this.status === 'running') {
      this.status = 'completed';
    }

    return {
      status: this.status,
      finalPosition: this.tracker.getCurrentPosition(),
      cyclesCompleted: this.tracker.getCurrentPosition().cycleCount,
      directionResults: this.directionResults,
      checkpoints: this.checkpointManager.listCheckpoints(config.sessionId),
      oscillationReports: this.oscillationReports,
      history: this.tracker.getHistory(),
    };
  }

  /** Current loop status. */
  getStatus(): AgentLoopStatus {
    return this.status;
  }

  /** Access the underlying spiral tracker. */
  getTracker(): SpiralTracker {
    return this.tracker;
  }

  /** Access the checkpoint manager for inspection or restoration. */
  getCheckpointManager(): CheckpointManager {
    return this.checkpointManager;
  }

  /**
   * Build a minimal ForgewrightSession object for checkpoint creation.
   */
  private buildSessionForCheckpoint(
    config: AgentConfig,
    position: SpiralPosition,
  ): ForgewrightSession {
    const now = new Date().toISOString();
    return {
      id: config.sessionId,
      intent: config.intent,
      companions: [],
      spiralPosition: position,
      status: 'active',
      checkpointPolicy: this.policy,
      createdAt: now,
      updatedAt: now,
    };
  }
}
