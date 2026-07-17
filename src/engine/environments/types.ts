/** Environment and fitness type definitions. */

import type { BehaviourDescriptors } from '../genome/types';
import type { Terrain, WaterModel, Vec2 } from '../physics/index';

export type EnvKind = 'running' | 'lowgrav' | 'swimming';
export type PresetId = 'beginner' | 'standard' | 'extreme';

export interface FitnessComponentSpec {
  id: string;
  label: string;
  defaultWeight: number;
  unit: string;
  description: string;
  /** True if this component is a penalty (typically negative contribution). */
  penalty?: boolean;
}

export interface FitnessBreakdown {
  total: number;
  components: Record<string, number>;
}

/** Running accumulators updated every physics step during an evaluation. */
export interface EvalAccumulators {
  steps: number;
  dt: number;
  startX: number;
  comX: number;
  comY: number;
  maxX: number;
  minComY: number;
  maxComY: number;
  prevComX: number;
  pathLength: number;
  uprightSum: number;
  energy: number;
  contactFrames: number;
  sensorFrames: number;
  sensorCountTotal: number;
  fell: boolean;
  outOfBounds: boolean;
  exploded: boolean;
  finished: boolean;
  finishStep: number;
  /** Sampled COM x for periodicity/analysis. */
  comSamples: number[];
  /** Sampled sensor contact bitcount per sample for duty cycle/periodicity. */
  contactSamples: number[];
  bodyLength: number;
  segmentCount: number;
  /** Per-side motor activity for a symmetry estimate. */
  leftActivity: number;
  rightActivity: number;
}

export interface ResolvedEnvironment {
  kind: EnvKind;
  preset: PresetId;
  name: string;
  description: string;
  gravity: Vec2;
  terrain: Terrain;
  water?: WaterModel;
  spawnClearance: number;
  spawnX: number;
  finishX: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Recommended evaluation duration (seconds). */
  duration: number;
  components: FitnessComponentSpec[];
  computeFitness(acc: EvalAccumulators, weights: Record<string, number>): FitnessBreakdown;
  descriptors(acc: EvalAccumulators): BehaviourDescriptors;
}

export interface EnvMeta {
  kind: EnvKind;
  name: string;
  description: string;
  presets: { id: PresetId; label: string }[];
}
