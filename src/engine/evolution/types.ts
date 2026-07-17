/** Evolution configuration and result types. */

import type { BehaviourDescriptors, CreatureGenome } from '../genome/types';
import type { EnvKind, PresetId } from '../environments/types';

export interface MutationConfig {
  morphologyRate: number;
  controllerRate: number;
  addSegmentRate: number;
  removeSegmentRate: number;
  duplicateBranchRate: number;
  weightScale: number;
  weightResetRate: number;
  dimensionScale: number;
  frequencyScale: number;
  phaseScale: number;
}

export interface EvolutionConfig {
  populationSize: number;
  eliteFraction: number;
  tournamentSize: number;
  crossoverProbability: number;
  mutation: MutationConfig;
  seed: number;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  duration: number;
}

export interface Individual {
  genome: CreatureGenome;
  fitness: number;
  descriptors?: BehaviourDescriptors;
  distance?: number;
  energy?: number;
  stability?: number;
  evaluated: boolean;
}

export interface GenerationSummary {
  generation: number;
  best: number;
  mean: number;
  median: number;
  worst: number;
  diversity: number;
  speciesCount: number;
  championId: string;
  bestDistance: number;
  bestEnergy: number;
  bestStability: number;
  mutationCounts: Record<string, number>;
}

export const DEFAULT_MUTATION: MutationConfig = {
  morphologyRate: 0.35,
  controllerRate: 0.9,
  addSegmentRate: 0.06,
  removeSegmentRate: 0.05,
  duplicateBranchRate: 0.04,
  weightScale: 0.35,
  weightResetRate: 0.03,
  dimensionScale: 0.12,
  frequencyScale: 0.12,
  phaseScale: 0.4,
};

export function defaultEvolutionConfig(
  seed: number,
  env: { kind: EnvKind; preset: PresetId },
  weights: Record<string, number>,
): EvolutionConfig {
  return {
    populationSize: 60,
    eliteFraction: 0.1,
    tournamentSize: 3,
    crossoverProbability: 0.6,
    mutation: { ...DEFAULT_MUTATION },
    seed,
    env,
    weights,
    duration: 12,
  };
}
