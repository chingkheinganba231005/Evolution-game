/** Central laboratory state and evolution orchestration. */

import { create } from 'zustand';
import {
  createStarter,
  type StarterId,
} from '../engine/builder/starters';
import { resolveEnvironment, defaultWeights } from '../engine/environments/index';
import type { EnvKind, PresetId } from '../engine/environments/types';
import type { CreatureGenome } from '../engine/genome/types';
import { cloneGenome } from '../engine/genome/serialize';
import {
  defaultEvolutionConfig,
  type EvolutionConfig,
  type GenerationSummary,
  type Individual,
} from '../engine/evolution/types';
import {
  initialPopulation,
  reproduce,
  summarize,
  generationRng,
} from '../engine/evolution/algorithm';
import { rankPopulation } from '../engine/evolution/selection';
import { clusterSpecies, type Species } from '../engine/evolution/species';
import {
  MapElitesArchive,
  DESCRIPTOR_AXES,
  type DescriptorAxis,
} from '../engine/evolution/mapelites';
import { evaluate } from '../engine/simulate';
import type { ReplayData } from '../engine/replay/index';
import { EvaluationPool, suggestedWorkerCount } from '../workers/pool';
import { makeDiaryEntry } from '../features/diary';
import { saveExperiment as dbSave } from '../db/index';
import type { StoredExperiment } from '../db/types';

export type RunStatus = 'idle' | 'running' | 'paused';

export interface ChampionInfo {
  genome: CreatureGenome;
  fitness: number;
  replay: ReplayData | null;
  distance: number;
}

export interface ProgressInfo {
  completed: number;
  total: number;
  evalsPerSecond: number;
  generationMs: number;
  usingWorkers: boolean;
  workerCount: number;
}

interface LabState {
  experimentId: string;
  name: string;
  seed: number;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  config: EvolutionConfig;
  ancestor: CreatureGenome;
  population: Individual[];
  summaries: GenerationSummary[];
  species: Species[];
  champion: ChampionInfo | null;
  bestEver: number;
  generation: number;
  status: RunStatus;
  progress: ProgressInfo;
  diary: string[];
  archiveEnabled: boolean;
  archiveAxisX: DescriptorAxis;
  archiveAxisY: DescriptorAxis;
  archiveVersion: number;
  lastFitnessDistribution: number[];

  // Actions
  setName(name: string): void;
  setSeed(seed: number): void;
  setEnvironment(kind: EnvKind, preset: PresetId): void;
  setWeight(id: string, value: number): void;
  resetWeights(): void;
  setAncestorFromStarter(id: StarterId, seed?: number): void;
  setAncestor(genome: CreatureGenome): void;
  setPopulationSize(n: number): void;
  setDuration(d: number): void;
  setMutationRate(key: keyof EvolutionConfig['mutation'], value: number): void;
  toggleArchive(enabled: boolean): void;
  setArchiveAxes(x: DescriptorAxis, y: DescriptorAxis): void;

  start(generations: number): Promise<void>;
  pause(): void;
  resume(generations: number): Promise<void>;
  stepGeneration(): Promise<void>;
  reset(): void;
  newExperiment(): void;
  saveNow(): Promise<void>;
  loadFromStored(stored: StoredExperiment): void;
  regenerateChampionReplay(): void;
}

// Module-scoped, non-serialisable runtime state.
let pool: EvaluationPool | null = null;
let archive: MapElitesArchive | null = null;
let stopRequested = false;
let workerCountOverride = 0;

export function setWorkerCountOverride(n: number): void {
  workerCountOverride = n;
}

function makeId(): string {
  return `exp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function buildConfig(state: {
  seed: number;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  config: EvolutionConfig;
}): EvolutionConfig {
  return {
    ...state.config,
    seed: state.seed,
    env: state.env,
    weights: state.weights,
  };
}

function initialEnv(): { kind: EnvKind; preset: PresetId } {
  return { kind: 'running', preset: 'beginner' };
}

function freshState(): Pick<
  LabState,
  | 'experimentId'
  | 'name'
  | 'seed'
  | 'env'
  | 'weights'
  | 'config'
  | 'ancestor'
  | 'population'
  | 'summaries'
  | 'species'
  | 'champion'
  | 'bestEver'
  | 'generation'
  | 'status'
  | 'progress'
  | 'diary'
  | 'lastFitnessDistribution'
> {
  const env = initialEnv();
  const resolved = resolveEnvironment(env.kind, env.preset);
  const weights = defaultWeights(resolved);
  const seed = 12345;
  const ancestor = createStarter('biped', seed);
  const config = defaultEvolutionConfig(seed, env, weights);
  return {
    experimentId: makeId(),
    name: 'Untitled Experiment',
    seed,
    env,
    weights,
    config,
    ancestor,
    population: [],
    summaries: [],
    species: [],
    champion: null,
    bestEver: -Infinity,
    generation: 0,
    status: 'idle',
    progress: {
      completed: 0,
      total: 0,
      evalsPerSecond: 0,
      generationMs: 0,
      usingWorkers: false,
      workerCount: 0,
    },
    diary: [],
    lastFitnessDistribution: [],
  };
}

function ensurePool(config: EvolutionConfig): EvaluationPool {
  const workerCount = workerCountOverride > 0 ? workerCountOverride : suggestedWorkerCount();
  if (pool) pool.dispose();
  pool = new EvaluationPool({
    env: config.env,
    weights: config.weights,
    duration: config.duration,
    workerCount,
  });
  return pool;
}

export const useLabStore = create<LabState>((set, get) => ({
  ...freshState(),
  archiveEnabled: false,
  archiveAxisX: DESCRIPTOR_AXES[0],
  archiveAxisY: DESCRIPTOR_AXES[1],
  archiveVersion: 0,

  setName: (name) => set({ name }),
  setSeed: (seed) => {
    if (get().status !== 'idle') return;
    const ancestorMeta = get().ancestor.metadata;
    const keepAncestor = ancestorMeta.origin === 'imported' || ancestorMeta.origin === 'custom';
    set((s) => ({
      seed,
      config: { ...s.config, seed },
      ancestor: keepAncestor ? s.ancestor : createStarter('biped', seed),
    }));
  },
  setEnvironment: (kind, preset) => {
    const resolved = resolveEnvironment(kind, preset);
    const weights = defaultWeights(resolved);
    set((s) => ({
      env: { kind, preset },
      weights,
      config: { ...s.config, env: { kind, preset }, weights, duration: resolved.duration },
    }));
  },
  setWeight: (id, value) => set((s) => ({ weights: { ...s.weights, [id]: value } })),
  resetWeights: () => {
    const resolved = resolveEnvironment(get().env.kind, get().env.preset);
    set({ weights: defaultWeights(resolved) });
  },
  setAncestorFromStarter: (id, seed) => {
    const s = seed ?? get().seed;
    const g = createStarter(id, s);
    set({ ancestor: g });
  },
  setAncestor: (genome) => set({ ancestor: cloneGenome(genome) }),
  setPopulationSize: (n) =>
    set((s) => ({ config: { ...s.config, populationSize: Math.max(6, Math.min(200, Math.round(n))) } })),
  setDuration: (d) => set((s) => ({ config: { ...s.config, duration: Math.max(3, Math.min(30, d)) } })),
  setMutationRate: (key, value) =>
    set((s) => ({ config: { ...s.config, mutation: { ...s.config.mutation, [key]: value } } })),
  toggleArchive: (enabled) => {
    if (enabled && !archive) {
      archive = new MapElitesArchive(get().archiveAxisX, get().archiveAxisY);
    }
    set({ archiveEnabled: enabled });
  },
  setArchiveAxes: (x, y) => {
    archive = new MapElitesArchive(x, y);
    set((s) => ({ archiveAxisX: x, archiveAxisY: y, archiveVersion: s.archiveVersion + 1 }));
  },

  start: async (generations) => {
    const state = get();
    if (state.status === 'running') return;
    const config = buildConfig(state);
    ensurePool(config);
    if (state.archiveEnabled && !archive) {
      archive = new MapElitesArchive(state.archiveAxisX, state.archiveAxisY);
    }
    const pop = initialPopulation(state.ancestor, config);
    set({
      config,
      population: pop,
      summaries: [],
      generation: 0,
      champion: null,
      bestEver: -Infinity,
      diary: [],
      status: 'running',
    });
    stopRequested = false;
    await runLoop(get, set, generations);
  },

  pause: () => {
    stopRequested = true;
    pool?.cancel();
    set({ status: 'paused' });
  },

  resume: async (generations) => {
    if (get().status !== 'paused') return;
    const config = buildConfig(get());
    ensurePool(config);
    set({ status: 'running', config });
    stopRequested = false;
    await runLoop(get, set, get().generation + generations);
  },

  stepGeneration: async () => {
    const state = get();
    if (state.status === 'running') return;
    const config = buildConfig(state);
    ensurePool(config);
    if (state.population.length === 0) {
      set({ population: initialPopulation(state.ancestor, config), generation: 0, summaries: [] });
    }
    set({ status: 'running', config });
    stopRequested = false;
    await runOneGeneration(get, set);
    set({ status: 'paused' });
  },

  reset: () => {
    stopRequested = true;
    pool?.dispose();
    pool = null;
    archive = null;
    const fresh = freshState();
    set({
      ...fresh,
      // Preserve current design choices.
      name: get().name,
      seed: get().seed,
      env: get().env,
      weights: get().weights,
      ancestor: get().ancestor,
      config: buildConfig(get()),
    });
  },

  newExperiment: () => {
    stopRequested = true;
    pool?.dispose();
    pool = null;
    archive = null;
    set({ ...freshState(), archiveEnabled: false, archiveVersion: get().archiveVersion + 1 });
  },

  saveNow: async () => {
    await persist(get());
  },

  loadFromStored: (stored) => {
    stopRequested = true;
    pool?.dispose();
    pool = null;
    archive = stored.archive ? MapElitesArchive.deserialize(stored.archive) : null;
    const resolved = resolveEnvironment(stored.env.kind, stored.env.preset);
    const population: Individual[] = stored.population.map((g) => ({
      genome: g,
      fitness: -Infinity,
      evaluated: false,
    }));
    set({
      experimentId: stored.id,
      name: stored.name,
      seed: stored.seed,
      env: stored.env,
      weights: stored.weights,
      config: stored.config,
      ancestor: stored.ancestor,
      population,
      summaries: stored.summaries,
      species: [],
      champion: stored.championGenome
        ? {
            genome: stored.championGenome,
            fitness: stored.championFitness,
            replay: stored.championReplay,
            distance: 0,
          }
        : null,
      bestEver: stored.championFitness,
      generation: stored.generation,
      status: 'idle',
      diary: [],
      archiveEnabled: !!stored.archive,
      lastFitnessDistribution: [],
      progress: {
        completed: 0,
        total: 0,
        evalsPerSecond: 0,
        generationMs: 0,
        usingWorkers: false,
        workerCount: 0,
      },
    });
    void resolved;
  },

  regenerateChampionReplay: () => {
    const state = get();
    if (!state.champion) return;
    const resolved = resolveEnvironment(state.env.kind, state.env.preset);
    const r = evaluate({
      genome: state.champion.genome,
      env: resolved,
      weights: state.weights,
      seed: state.seed,
      duration: state.config.duration,
      sampleFps: 30,
    });
    set({
      champion: { ...state.champion, replay: r.replay ?? null, distance: r.distance, fitness: r.fitness },
    });
  },
}));

// --- Evolution loop (module functions, not part of the store object) ---------

type Get = () => LabState;
type Set = (partial: Partial<LabState> | ((s: LabState) => Partial<LabState>)) => void;

async function runLoop(get: Get, set: Set, targetGeneration: number): Promise<void> {
  while (!stopRequested && get().generation < targetGeneration && get().status === 'running') {
    await runOneGeneration(get, set);
  }
  if (get().status === 'running') set({ status: 'idle' });
  void persist(get());
}

async function runOneGeneration(get: Get, set: Set): Promise<void> {
  const state = get();
  if (!pool) return;
  const gen = state.generation;
  const tasks = state.population.map((ind) => ({ genome: ind.genome, seed: state.seed }));
  const total = tasks.length;
  const startTime = now();

  const results = await pool.evaluateBatch(tasks, (completed) => {
    const elapsed = (now() - startTime) / 1000;
    set({
      progress: {
        completed,
        total,
        evalsPerSecond: elapsed > 0 ? completed / elapsed : 0,
        generationMs: now() - startTime,
        usingWorkers: pool!.usingWorkers,
        workerCount: pool!.activeWorkers,
      },
    });
  });

  if (stopRequested) return;

  const evaluated: Individual[] = state.population.map((ind, i) => ({
    genome: ind.genome,
    fitness: results[i].fitness,
    descriptors: results[i].descriptors,
    distance: results[i].distance,
    energy: results[i].energy,
    stability: results[i].stability,
    evaluated: true,
  }));

  const summary = summarize(evaluated, gen);
  const ranked = rankPopulation(evaluated);
  const best = ranked[0];
  const species = clusterSpecies(evaluated);

  // Feed the MAP-Elites archive.
  if (get().archiveEnabled && archive) {
    for (const ind of evaluated) {
      if (ind.descriptors) archive.consider(ind.genome, ind.fitness, ind.descriptors);
    }
  }

  // Champion + replay (regenerate only when we have a new overall best).
  let champion = get().champion;
  let bestEver = get().bestEver;
  if (best.fitness > bestEver) {
    bestEver = best.fitness;
    const resolved = resolveEnvironment(state.env.kind, state.env.preset);
    const champReplay = evaluate({
      genome: best.genome,
      env: resolved,
      weights: state.weights,
      seed: state.seed,
      duration: state.config.duration,
      sampleFps: 30,
    });
    champion = {
      genome: best.genome,
      fitness: best.fitness,
      replay: champReplay.replay ?? null,
      distance: best.distance ?? 0,
    };
  }

  // Diary entry from real metric deltas.
  const prevSummary = state.summaries[state.summaries.length - 1];
  const diaryEntry = makeDiaryEntry(prevSummary, summary, best.genome);
  const diary = diaryEntry ? [...get().diary, diaryEntry].slice(-60) : get().diary;

  const distribution = evaluated.map((e) => e.fitness).filter((f) => Number.isFinite(f));

  // Reproduce the next generation.
  const config = buildConfig(state);
  const nextPop = reproduce(evaluated, config, gen + 1);

  set({
    population: nextPop,
    summaries: [...state.summaries, summary],
    species,
    champion,
    bestEver,
    generation: gen + 1,
    diary,
    archiveVersion: get().archiveVersion + 1,
    lastFitnessDistribution: distribution,
  });

  // Fire-and-forget autosave for refresh resilience.
  void persist(get());
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function persist(state: LabState): Promise<void> {
  const stored: StoredExperiment = {
    id: state.experimentId,
    name: state.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seed: state.seed,
    env: state.env,
    weights: state.weights,
    config: state.config,
    ancestor: state.ancestor,
    generation: state.generation,
    summaries: state.summaries,
    population: state.population.map((p) => p.genome),
    championGenome: state.champion?.genome ?? null,
    championFitness: state.champion?.fitness ?? -Infinity,
    championReplay: state.champion?.replay ?? null,
    archive: state.archiveEnabled && archive ? archive.serialize() : undefined,
  };
  await dbSave(stored);
}

export function getArchive(): MapElitesArchive | null {
  return archive;
}

export { generationRng };
