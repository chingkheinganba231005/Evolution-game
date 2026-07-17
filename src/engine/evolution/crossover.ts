/** Genome crossover with graceful fallback for incompatible topologies. */

import { Rng } from '../random/prng';
import { repairGenome, structuredCloneSafe } from '../genome/validate';
import type { CreatureGenome } from '../genome/types';

function newId(rng: Rng, prefix: string): string {
  return `${prefix}${rng.nextUint().toString(36)}`;
}

/**
 * Combine two parents. The child's topology is inherited from `a`; segments and
 * joints shared by stable id blend scalar parameters from both parents, and the
 * controller is uniformly crossed over when the architectures match. When the
 * genomes are structurally incompatible the child falls back to a clone of `a`.
 */
export function crossover(
  a: CreatureGenome,
  b: CreatureGenome,
  rng: Rng,
  generation: number,
): CreatureGenome {
  const child = structuredCloneSafe(a);
  child.id = newId(rng, 'c');
  child.parentIds = [a.id, b.id];
  child.generation = generation;
  child.metadata = { ...a.metadata, origin: 'crossover' };

  const bSeg = new Map(b.segments.map((s) => [s.id, s]));
  for (const seg of child.segments) {
    const other = bSeg.get(seg.id);
    if (other && rng.bool(0.5)) {
      seg.halfW = other.halfW;
      seg.halfH = other.halfH;
      seg.density = other.density;
      seg.friction = other.friction;
      seg.local = { ...other.local };
      seg.localRotation = other.localRotation;
    }
  }

  const bJoint = new Map(b.joints.map((j) => [j.bodyB, j]));
  for (const j of child.joints) {
    const other = bJoint.get(j.bodyB);
    if (other && rng.bool(0.5)) {
      j.lowerAngle = other.lowerAngle;
      j.upperAngle = other.upperAngle;
      j.motorStrength = other.motorStrength;
      j.motorSpeedLimit = other.motorSpeedLimit;
      j.phaseOffset = other.phaseOffset;
    }
  }

  // Controller crossover only when compatible.
  const ca = child.controller;
  const cb = b.controller;
  if (
    ca.type === cb.type &&
    ca.weights.length === cb.weights.length &&
    ca.biases.length === cb.biases.length &&
    ca.amplitudes.length === cb.amplitudes.length
  ) {
    for (let i = 0; i < ca.weights.length; i++) if (rng.bool(0.5)) ca.weights[i] = cb.weights[i];
    for (let i = 0; i < ca.biases.length; i++) if (rng.bool(0.5)) ca.biases[i] = cb.biases[i];
    for (let i = 0; i < ca.amplitudes.length; i++) if (rng.bool(0.5)) ca.amplitudes[i] = cb.amplitudes[i];
    if (rng.bool(0.5)) ca.frequency = cb.frequency;
  }

  const repaired = repairGenome(child, child.randomSeed || rng.nextUint());
  if (!repaired) {
    const fallback = structuredCloneSafe(a);
    fallback.id = child.id;
    fallback.parentIds = [a.id, b.id];
    fallback.generation = generation;
    return fallback;
  }
  return repaired;
}
