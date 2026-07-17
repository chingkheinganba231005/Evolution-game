/**
 * Deterministic single-creature evaluation: run a genome in an environment and
 * return real fitness, behaviour descriptors and an optional replay.
 *
 * Given the same (genome, environment, weights, seed, duration, dt) this returns
 * bit-identical results — no wall-clock time or Math.random is used.
 */

import { buildController } from './controllers';
import { observe } from './creature-runtime';
import type { BehaviourDescriptors, CreatureGenome } from './genome/types';
import { morphologyExtent } from './genome/build';
import { buildCreature } from './physics/creature';
import { World } from './physics/world';
import type { EvalAccumulators, FitnessBreakdown, ResolvedEnvironment } from './environments/types';
import { makeReplay, pushReplayFrame, type ReplayData, type ReplayShape } from './replay/index';

export interface EvaluateParams {
  genome: CreatureGenome;
  env: ResolvedEnvironment;
  weights: Record<string, number>;
  seed: number;
  /** Override the environment's default duration (seconds). */
  duration?: number;
  dt?: number;
  /** Replay sample rate (frames per simulated second). 0 disables replay. */
  sampleFps?: number;
}

export interface EvaluationResult {
  fitness: number;
  breakdown: FitnessBreakdown;
  descriptors: BehaviourDescriptors;
  distance: number;
  energy: number;
  stability: number;
  maxHeight: number;
  finalState: { comX: number; comY: number };
  failure: string | null;
  steps: number;
  replay?: ReplayData;
}

const DEFAULT_DT = 1 / 120;

export function evaluate(params: EvaluateParams): EvaluationResult {
  const { genome, env, weights, seed } = params;
  const dt = params.dt ?? DEFAULT_DT;
  const duration = params.duration ?? env.duration;
  const totalSteps = Math.max(1, Math.round(duration / dt));
  const sampleFps = params.sampleFps ?? 0;
  const captureReplay = sampleFps > 0;
  const sampleEvery = captureReplay ? Math.max(1, Math.round(1 / (sampleFps * dt))) : 0;

  const world = new World({
    gravity: env.gravity,
    terrain: env.terrain,
    water: env.water,
  });
  void seed; // seed reserved for future stochastic environments; sim is deterministic

  const creature = buildCreature(world, genome, {
    x: env.spawnX,
    clearance: env.spawnClearance,
  });

  const controller = buildController(genome);
  controller.reset();

  // Map joints to their genome speed limits (bodies order matches genome order).
  const speedLimits = genome.joints.map((j) => j.motorSpeedLimit);
  const jointBodies = creature.joints;
  const inputCount = genome.controller.inputCount;
  const inputs = new Array<number>(inputCount).fill(0);

  const extent = morphologyExtent(genome);
  const startCom = world.centerOfMass();

  const acc: EvalAccumulators = {
    steps: 0,
    dt,
    startX: startCom.x,
    comX: startCom.x,
    comY: startCom.y,
    maxX: startCom.x,
    minComY: startCom.y,
    maxComY: startCom.y,
    prevComX: startCom.x,
    pathLength: 0,
    uprightSum: 0,
    energy: 0,
    contactFrames: 0,
    sensorFrames: 0,
    sensorCountTotal: 0,
    fell: false,
    outOfBounds: false,
    exploded: false,
    finished: false,
    finishStep: -1,
    comSamples: [startCom.y],
    contactSamples: [],
    bodyLength: extent.width,
    segmentCount: genome.segments.length,
    leftActivity: 0,
    rightActivity: 0,
  };

  let replay: ReplayData | undefined;
  if (captureReplay) {
    const shapes: ReplayShape[] = genome.segments.map((s) => ({
      kind: s.shape,
      halfW: s.halfW,
      halfH: s.halfH,
      hue: s.hue,
      tag: s.id,
    }));
    replay = makeReplay(sampleEvery * dt, shapes);
    pushReplayFrame(replay, flattenTransforms(world));
  }

  let failure: string | null = null;

  for (let step = 0; step < totalSteps; step++) {
    const root = creature.root;
    const t = step * dt;

    // --- Observations (fixed layout) ---
    observe(creature, inputs);

    // --- Control ---
    const outputs = controller.step(inputs, t);
    let stepEnergy = 0;
    for (let i = 0; i < jointBodies.length; i++) {
      const o = outputs[i] ?? 0;
      jointBodies[i].motorSpeed = o * (speedLimits[i] ?? 6);
      const mag = Math.abs(o);
      stepEnergy += mag;
      if (jointBodies[i].bodyB.position.x < root.position.x) acc.leftActivity += mag;
      else acc.rightActivity += mag;
    }
    acc.energy += stepEnergy;

    // --- Step physics ---
    world.step(dt);
    acc.steps = step + 1;

    if (world.exploded) {
      acc.exploded = true;
      failure = 'Simulation became numerically unstable.';
      break;
    }

    const com = world.centerOfMass();
    acc.comX = com.x;
    acc.comY = com.y;
    acc.maxX = Math.max(acc.maxX, com.x);
    acc.maxComY = Math.max(acc.maxComY, com.y);
    acc.minComY = Math.min(acc.minComY, com.y);
    acc.pathLength += Math.abs(com.x - acc.prevComX);
    acc.prevComX = com.x;
    acc.uprightSum += Math.max(0, Math.cos(root.angle));
    if (root.contactCount > 0) acc.contactFrames += 1;

    let sensorsInContact = 0;
    for (const s of creature.sensorBodies) if (s.contactCount > 0) sensorsInContact += 1;
    acc.sensorFrames += sensorsInContact;
    acc.sensorCountTotal += creature.sensorBodies.length;

    if (!acc.finished && com.x >= env.finishX) {
      acc.finished = true;
      acc.finishStep = step;
    }

    if (
      com.x < env.bounds.minX ||
      com.y < env.bounds.minY ||
      com.y > env.bounds.maxY ||
      !Number.isFinite(com.x)
    ) {
      acc.outOfBounds = true;
      failure = 'Creature left the simulation bounds.';
      break;
    }

    if (captureReplay && (step + 1) % sampleEvery === 0) {
      pushReplayFrame(replay!, flattenTransforms(world));
      acc.comSamples.push(com.y);
      acc.contactSamples.push(sensorsInContact);
    } else if (!captureReplay && step % 4 === 0) {
      acc.comSamples.push(com.y);
      acc.contactSamples.push(sensorsInContact);
    }
  }

  const breakdown = env.computeFitness(acc, weights);
  const descriptors = env.descriptors(acc);
  const fitness = Number.isFinite(breakdown.total) ? breakdown.total : -1000;

  return {
    fitness,
    breakdown,
    descriptors,
    distance: acc.maxX - acc.startX,
    energy: acc.energy / Math.max(acc.steps, 1),
    stability: acc.uprightSum / Math.max(acc.steps, 1),
    maxHeight: acc.maxComY - startCom.y,
    finalState: { comX: acc.comX, comY: acc.comY },
    failure,
    steps: acc.steps,
    replay,
  };
}

function flattenTransforms(world: World): number[] {
  const out: number[] = [];
  for (const b of world.bodies) {
    if (b.isStatic) continue;
    out.push(b.position.x, b.position.y, b.angle);
  }
  return out;
}
