import { z } from 'zod';

// ─── Direction Name ──────────────────────────────────────────────────────────

export const DirectionNameSchema = z.enum(['east', 'south', 'west', 'north']);
export type DirectionName = z.infer<typeof DirectionNameSchema>;

// ─── Direction Info ──────────────────────────────────────────────────────────

export const DirectionInfoSchema = z.object({
  name: z.string(),
  ojibwe: z.string(),
  season: z.string(),
  act: z.number().int().min(1).max(4),
  emoji: z.string(),
});
export type DirectionInfo = z.infer<typeof DirectionInfoSchema>;

// ─── DIRECTIONS constant (canonical) ────────────────────────────────────────

export const DIRECTIONS = {
  east:  { name: 'East',  ojibwe: 'Waabinong',    season: 'Spring', act: 1, emoji: '🌅' },
  south: { name: 'South', ojibwe: 'Zhaawanong',   season: 'Summer', act: 2, emoji: '🔥' },
  west:  { name: 'West',  ojibwe: 'Epangishmok',  season: 'Autumn', act: 3, emoji: '🌊' },
  north: { name: 'North', ojibwe: 'Kiiwedinong',  season: 'Winter', act: 4, emoji: '❄️' },
} as const satisfies Record<DirectionName, DirectionInfo>;

// ─── Lookup maps ─────────────────────────────────────────────────────────────

export const DIRECTION_NAMES: readonly DirectionName[] = ['east', 'south', 'west', 'north'] as const;

export const OJIBWE_NAMES: Record<DirectionName, string> = {
  east: 'Waabinong',
  south: 'Zhaawanong',
  west: 'Epangishmok',
  north: 'Kiiwedinong',
};

export const DIRECTION_COLORS: Record<DirectionName, string> = {
  east: '#FFD700',
  south: '#DC143C',
  west: '#1a1a2e',
  north: '#E8E8E8',
};

export const DIRECTION_SEASONS: Record<DirectionName, string> = {
  east: 'Spring',
  south: 'Summer',
  west: 'Autumn',
  north: 'Winter',
};

export const DIRECTION_ACTS: Record<DirectionName, number> = {
  east: 1, south: 2, west: 3, north: 4,
};

export const ACT_DIRECTIONS: Record<number, DirectionName> = {
  1: 'east', 2: 'south', 3: 'west', 4: 'north',
};
