/** Modular environment definitions with fitness and behaviour descriptors. */

import type { BehaviourDescriptors } from '../genome/types';
import type { Terrain, Vec2, WaterModel } from '../physics/index';
import type {
  EnvKind,
  EnvMeta,
  EvalAccumulators,
  FitnessBreakdown,
  FitnessComponentSpec,
  PresetId,
  ResolvedEnvironment,
} from './types';

export type {
  EnvKind,
  EnvMeta,
  EvalAccumulators,
  FitnessBreakdown,
  FitnessComponentSpec,
  PresetId,
  ResolvedEnvironment,
} from './types';

/** Build a heightfield terrain from a height function using a numeric normal. */
function heightfield(h: (x: number) => number): Terrain {
  const e = 0.05;
  return {
    height: h,
    normal: (x: number): Vec2 => {
      const slope = (h(x + e) - h(x - e)) / (2 * e);
      const len = Math.sqrt(1 + slope * slope);
      return { x: -slope / len, y: 1 / len };
    },
  };
}

function totalTime(acc: EvalAccumulators): number {
  return Math.max(acc.steps * acc.dt, 1e-6);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Estimate signal periodicity via normalised autocorrelation peak. */
function periodicity(samples: number[]): number {
  const n = samples.length;
  if (n < 8) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  for (const s of samples) denom += (s - mean) * (s - mean);
  if (denom < 1e-9) return 0;
  let best = 0;
  const maxLag = Math.floor(n / 2);
  for (let lag = 2; lag < maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < n - lag; i++) {
      num += (samples[i] - mean) * (samples[i + lag] - mean);
    }
    const corr = num / denom;
    if (corr > best) best = corr;
  }
  return clamp(best, 0, 1);
}

function baseDescriptors(acc: EvalAccumulators): BehaviourDescriptors {
  const time = totalTime(acc);
  const distance = acc.maxX - acc.startX;
  const energyMean = acc.energy / Math.max(acc.steps, 1);
  const sym =
    acc.leftActivity + acc.rightActivity > 1e-6
      ? 1 - Math.abs(acc.leftActivity - acc.rightActivity) / (acc.leftActivity + acc.rightActivity)
      : 1;
  return {
    segmentCount: acc.segmentCount,
    averageSpeed: distance / time,
    energyEfficiency: distance / (energyMean * time + 1),
    stability: acc.uprightSum / Math.max(acc.steps, 1),
    bodyLength: acc.bodyLength,
    maxHeight: acc.maxComY - (acc.comSamples[0] ?? acc.maxComY),
    dutyCycle: acc.sensorCountTotal > 0 ? acc.sensorFrames / acc.sensorCountTotal : 0,
    periodicity: periodicity(acc.contactSamples),
    symmetry: sym,
  };
}

function weightedSum(
  components: FitnessComponentSpec[],
  raw: Record<string, number>,
  weights: Record<string, number>,
): FitnessBreakdown {
  const out: Record<string, number> = {};
  let total = 0;
  for (const c of components) {
    const w = weights[c.id] ?? c.defaultWeight;
    const value = (raw[c.id] ?? 0) * w;
    out[c.id] = value;
    total += value;
  }
  return { total, components: out };
}

// --- Running -----------------------------------------------------------------

const runningComponents: FitnessComponentSpec[] = [
  { id: 'distance', label: 'Distance', defaultWeight: 8, unit: 'm', description: 'Forward distance travelled.' },
  { id: 'speed', label: 'Speed', defaultWeight: 6, unit: 'm/s', description: 'Average forward speed.' },
  { id: 'stability', label: 'Stability', defaultWeight: 25, unit: '0–1', description: 'Time spent upright.' },
  { id: 'finish', label: 'Finish bonus', defaultWeight: 30, unit: 'bonus', description: 'Reached the finish line.' },
  { id: 'energy', label: 'Energy', defaultWeight: -1.0, unit: 'penalty', description: 'Motor effort penalty.', penalty: true },
  { id: 'drag', label: 'Body drag', defaultWeight: -12, unit: 'penalty', description: 'Main body dragging on the ground.', penalty: true },
];

function runningRaw(acc: EvalAccumulators): Record<string, number> {
  const time = totalTime(acc);
  const distance = acc.maxX - acc.startX;
  return {
    distance: clamp(distance, -5, 400),
    speed: clamp(distance / time, -2, 12),
    stability: acc.uprightSum / Math.max(acc.steps, 1),
    finish: acc.finished ? 1 : 0,
    energy: acc.energy / Math.max(acc.steps, 1),
    drag: acc.contactFrames / Math.max(acc.steps, 1),
  };
}

// --- Low gravity -------------------------------------------------------------

const lowGravComponents: FitnessComponentSpec[] = [
  { id: 'distance', label: 'Distance', defaultWeight: 9, unit: 'm', description: 'Horizontal progress.' },
  { id: 'airtime', label: 'Airtime', defaultWeight: 4, unit: '0–1', description: 'Effective use of low gravity.' },
  { id: 'landing', label: 'Landing control', defaultWeight: 18, unit: '0–1', description: 'Stability after motion.' },
  { id: 'finish', label: 'Finish bonus', defaultWeight: 25, unit: 'bonus', description: 'Reached the finish line.' },
  { id: 'energy', label: 'Energy', defaultWeight: -0.8, unit: 'penalty', description: 'Motor effort penalty.', penalty: true },
];

function lowGravRaw(acc: EvalAccumulators): Record<string, number> {
  const distance = acc.maxX - acc.startX;
  const airtime = 1 - acc.sensorFrames / Math.max(acc.sensorCountTotal, 1);
  return {
    distance: clamp(distance, -5, 400),
    airtime: clamp(airtime, 0, 1),
    landing: acc.uprightSum / Math.max(acc.steps, 1),
    finish: acc.finished ? 1 : 0,
    energy: acc.energy / Math.max(acc.steps, 1),
  };
}

// --- Swimming ----------------------------------------------------------------

const swimComponents: FitnessComponentSpec[] = [
  { id: 'distance', label: 'Distance', defaultWeight: 10, unit: 'm', description: 'Forward aquatic distance.' },
  { id: 'speed', label: 'Speed', defaultWeight: 6, unit: 'm/s', description: 'Average swimming speed.' },
  { id: 'depth', label: 'Depth control', defaultWeight: 12, unit: '0–1', description: 'Staying near useful depth.' },
  { id: 'smooth', label: 'Smooth propulsion', defaultWeight: 8, unit: '0–1', description: 'Rhythmic propulsion.' },
  { id: 'energy', label: 'Energy', defaultWeight: -0.7, unit: 'penalty', description: 'Motor effort penalty.', penalty: true },
];

function swimRaw(acc: EvalAccumulators, water: WaterModel): Record<string, number> {
  const time = totalTime(acc);
  const distance = acc.maxX - acc.startX;
  // Reward staying within a band around the water level.
  const depthError = Math.abs(acc.comY - (water.level - 1.2));
  const depth = clamp(1 - depthError / 3, 0, 1);
  return {
    distance: clamp(distance, -5, 400),
    speed: clamp(distance / time, -2, 12),
    depth,
    smooth: periodicity(acc.contactSamples),
    energy: acc.energy / Math.max(acc.steps, 1),
  };
}

// --- Registry ----------------------------------------------------------------

export const ENVIRONMENTS: EnvMeta[] = [
  {
    kind: 'running',
    name: 'Running',
    description: 'Locomote across terrain as far and as fast as possible while staying upright.',
    presets: [
      { id: 'beginner', label: 'Beginner (flat)' },
      { id: 'standard', label: 'Standard (gentle bumps)' },
      { id: 'extreme', label: 'Extreme (rough hills)' },
    ],
  },
  {
    kind: 'lowgrav',
    name: 'Low Gravity',
    description: 'Move across a reduced-gravity course and control landings.',
    presets: [
      { id: 'beginner', label: 'Beginner' },
      { id: 'standard', label: 'Standard' },
      { id: 'extreme', label: 'Extreme (very low g)' },
    ],
  },
  {
    kind: 'swimming',
    name: 'Swimming',
    description: 'Propel through a simplified fluid (buoyancy + drag, not full CFD).',
    presets: [
      { id: 'beginner', label: 'Calm water' },
      { id: 'standard', label: 'Standard' },
      { id: 'extreme', label: 'Strong current' },
    ],
  },
];

function runningTerrain(preset: PresetId): Terrain {
  switch (preset) {
    case 'beginner':
      return heightfield(() => 0);
    case 'standard':
      return heightfield((x) => (x > 4 ? 0.12 * Math.sin(x * 0.5) : 0));
    case 'extreme':
      return heightfield((x) =>
        x > 4 ? 0.35 * Math.sin(x * 0.45) + 0.15 * Math.sin(x * 1.3) : 0,
      );
  }
}

export function resolveEnvironment(
  kind: EnvKind,
  preset: PresetId,
): ResolvedEnvironment {
  const bounds = { minX: -6, maxX: 260, minY: -12, maxY: 40 };
  const spawnX = 2;

  if (kind === 'running') {
    const terrain = runningTerrain(preset);
    const finishX = preset === 'extreme' ? 40 : preset === 'standard' ? 30 : 25;
    const duration = 12;
    return {
      kind,
      preset,
      name: 'Running',
      description: 'Run across terrain as far and fast as possible.',
      gravity: { x: 0, y: -9.81 },
      terrain,
      spawnClearance: 0.15,
      spawnX,
      finishX,
      bounds,
      duration,
      components: runningComponents,
      computeFitness: (acc, w) => weightedSum(runningComponents, runningRaw(acc), w),
      descriptors: baseDescriptors,
    };
  }

  if (kind === 'lowgrav') {
    const g = preset === 'extreme' ? -1.6 : preset === 'standard' ? -3.2 : -4.5;
    const terrain = heightfield((x) => (x > 5 ? 0.2 * Math.sin(x * 0.4) : 0));
    return {
      kind,
      preset,
      name: 'Low Gravity',
      description: 'Traverse a low-gravity course and land under control.',
      gravity: { x: 0, y: g },
      terrain,
      spawnClearance: 0.15,
      spawnX,
      finishX: 30,
      bounds,
      duration: 13,
      components: lowGravComponents,
      computeFitness: (acc, w) => weightedSum(lowGravComponents, lowGravRaw(acc), w),
      descriptors: baseDescriptors,
    };
  }

  // swimming
  const current = preset === 'extreme' ? -1.4 : preset === 'standard' ? -0.4 : 0;
  const water: WaterModel = {
    level: 2.5,
    density: 1.15,
    linearDrag: 2.4,
    angularDrag: 2.0,
    current,
  };
  const terrain = heightfield(() => 0); // floor well below spawn depth
  return {
    kind,
    preset,
    name: 'Swimming',
    description: 'Swim forward through a simplified fluid.',
    gravity: { x: 0, y: -9.81 },
    terrain,
    water,
    spawnClearance: 1.2,
    spawnX,
    finishX: 30,
    bounds,
    duration: 13,
    components: swimComponents,
    computeFitness: (acc, w) => weightedSum(swimComponents, swimRaw(acc, water), w),
    descriptors: baseDescriptors,
  };
}

/** Default fitness weights for an environment (for the fitness editor). */
export function defaultWeights(env: ResolvedEnvironment): Record<string, number> {
  const w: Record<string, number> = {};
  for (const c of env.components) w[c.id] = c.defaultWeight;
  return w;
}

export function environmentMeta(kind: EnvKind): EnvMeta {
  return ENVIRONMENTS.find((e) => e.kind === kind)!;
}
