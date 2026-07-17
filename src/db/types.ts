/** Storage models (distinct from domain and UI view models). */

import type { CreatureGenome } from '../engine/genome/types';
import type { EnvKind, PresetId } from '../engine/environments/types';
import type { EvolutionConfig, GenerationSummary } from '../engine/evolution/types';
import type { SerializedArchive } from '../engine/evolution/mapelites';
import type { ReplayData } from '../engine/replay/index';

export interface StoredExperiment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  seed: number;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  config: EvolutionConfig;
  ancestor: CreatureGenome;
  generation: number;
  summaries: GenerationSummary[];
  /** Current population genomes for checkpoint/resume. */
  population: CreatureGenome[];
  championGenome: CreatureGenome | null;
  championFitness: number;
  championReplay: ReplayData | null;
  archive?: SerializedArchive;
}

export type HofCategory =
  | 'highest'
  | 'fastest'
  | 'efficient'
  | 'stable'
  | 'simplest'
  | 'strangest'
  | 'favourite';

export interface HallOfFameEntry {
  id: string;
  name: string;
  notes: string;
  category: HofCategory;
  genome: CreatureGenome;
  fitness: number;
  distance: number;
  env: { kind: EnvKind; preset: PresetId };
  createdAt: number;
  replay: ReplayData | null;
}

export interface AppSettings {
  id: 'app';
  theme: 'dark' | 'light';
  workerCount: number;
  reducedMotion: boolean;
  colorBlind: boolean;
  defaultDuration: number;
  sampleFps: number;
  showPerfOverlay: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  theme: 'dark',
  workerCount: 0, // 0 = auto (suggested)
  reducedMotion: false,
  colorBlind: false,
  defaultDuration: 12,
  sampleFps: 30,
  showPerfOverlay: false,
};
