/** Bounded genome mutation operators. */

import { Rng } from '../random/prng';
import { CONSTRAINTS } from '../genome/constraints';
import { repairGenome, structuredCloneSafe } from '../genome/validate';
import type {
  BodySegmentGene,
  CreatureGenome,
  JointGene,
  MutationRecord,
  MutationType,
} from '../genome/types';
import type { MutationConfig } from './types';

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function newId(rng: Rng, prefix: string): string {
  return `${prefix}${rng.nextUint().toString(36)}`;
}

function record(
  history: MutationRecord[],
  generation: number,
  type: MutationType,
  target: string,
  summary: string,
  severity: number,
  parentId: string,
): void {
  history.push({ generation, type, target, summary, severity, parentGenomeId: parentId });
}

/**
 * Produce a mutated child of `parent`. The child is repaired to guarantee
 * validity; if repair fails the parent is cloned unchanged as a safe fallback.
 */
export function mutateGenome(
  parent: CreatureGenome,
  config: MutationConfig,
  rng: Rng,
  generation: number,
): CreatureGenome {
  const child = structuredCloneSafe(parent);
  const parentId = parent.id;
  child.id = newId(rng, 'c');
  child.parentIds = [parentId];
  child.generation = generation;
  child.mutationHistory = parent.mutationHistory.slice(-40);
  child.metadata = { ...parent.metadata, origin: 'mutation' };
  const history = child.mutationHistory;

  // --- Controller mutations ---
  if (rng.bool(config.controllerRate)) {
    mutateController(child, config, rng, generation, parentId, history);
  }

  // --- Morphology parameter mutations ---
  if (rng.bool(config.morphologyRate)) {
    mutateMorphologyParam(child, config, rng, generation, parentId, history);
  }

  // --- Structural mutations ---
  if (rng.bool(config.addSegmentRate) && child.segments.length < CONSTRAINTS.maxSegments) {
    addSegment(child, rng, generation, parentId, history);
  }
  if (rng.bool(config.removeSegmentRate) && child.segments.length > 2) {
    removeLeafSegment(child, rng, generation, parentId, history);
  }
  if (rng.bool(config.duplicateBranchRate) && child.segments.length < CONSTRAINTS.maxSegments) {
    duplicateBranch(child, rng, generation, parentId, history, false);
  }

  const repaired = repairGenome(child, child.randomSeed || rng.nextUint());
  if (!repaired) {
    // Safe fallback: clone the parent (valid by construction).
    const fallback = structuredCloneSafe(parent);
    fallback.id = child.id;
    fallback.parentIds = [parentId];
    fallback.generation = generation;
    return fallback;
  }
  return repaired;
}

function mutateController(
  g: CreatureGenome,
  config: MutationConfig,
  rng: Rng,
  gen: number,
  parentId: string,
  history: MutationRecord[],
): void {
  const c = g.controller;
  if (c.type === 'mlp') {
    let changed = 0;
    for (let i = 0; i < c.weights.length; i++) {
      if (rng.bool(0.25)) {
        if (rng.bool(config.weightResetRate)) c.weights[i] = rng.normal(0, 0.5);
        else c.weights[i] = clamp(c.weights[i] + rng.normal(0, config.weightScale), -6, 6);
        changed++;
      }
    }
    for (let i = 0; i < c.biases.length; i++) {
      if (rng.bool(0.15)) c.biases[i] = clamp(c.biases[i] + rng.normal(0, config.weightScale), -6, 6);
    }
    record(history, gen, 'controller-weights', 'controller', `Perturbed ${changed} weights`, 0.3, parentId);
  }
  // Frequency / amplitude / phase (used by CPG, harmless for MLP).
  c.frequency = clamp(c.frequency + rng.normal(0, config.frequencyScale), 0.2, 4);
  for (let i = 0; i < c.amplitudes.length; i++) {
    if (rng.bool(0.4)) c.amplitudes[i] = clamp(c.amplitudes[i] + rng.normal(0, 0.15), 0.1, 1.4);
  }
  for (const j of g.joints) {
    if (rng.bool(0.4)) {
      j.phaseOffset = j.phaseOffset + rng.normal(0, config.phaseScale);
    }
  }
  record(history, gen, 'controller-frequency', 'controller', `Frequency → ${c.frequency.toFixed(2)}Hz`, 0.2, parentId);
}

function mutateMorphologyParam(
  g: CreatureGenome,
  config: MutationConfig,
  rng: Rng,
  gen: number,
  parentId: string,
  history: MutationRecord[],
): void {
  const roll = rng.next();
  const seg = rng.pick(g.segments);
  const ds = config.dimensionScale;
  if (roll < 0.3) {
    seg.halfW = clamp(seg.halfW * (1 + rng.normal(0, ds)), CONSTRAINTS.minHalf, CONSTRAINTS.maxHalf);
    seg.halfH = clamp(seg.halfH * (1 + rng.normal(0, ds)), CONSTRAINTS.minHalf, CONSTRAINTS.maxHalf);
    record(history, gen, 'segment-dimensions', seg.id, 'Adjusted segment size', 0.3, parentId);
  } else if (roll < 0.45) {
    seg.density = clamp(seg.density * (1 + rng.normal(0, ds)), CONSTRAINTS.minDensity, CONSTRAINTS.maxDensity);
    record(history, gen, 'segment-density', seg.id, 'Adjusted density', 0.2, parentId);
  } else if (roll < 0.6) {
    seg.friction = clamp(seg.friction + rng.normal(0, 0.1), CONSTRAINTS.minFriction, CONSTRAINTS.maxFriction);
    record(history, gen, 'segment-friction', seg.id, 'Adjusted friction', 0.2, parentId);
  } else if (roll < 0.72) {
    if (seg.parentId !== null) {
      seg.local.x += rng.normal(0, 0.05);
      seg.local.y += rng.normal(0, 0.05);
      record(history, gen, 'attachment-point', seg.id, 'Moved attachment', 0.3, parentId);
    }
  } else if (roll < 0.86) {
    const j = rng.pick(g.joints.length ? g.joints : [null as unknown as JointGene]);
    if (j) {
      j.lowerAngle = clamp(j.lowerAngle + rng.normal(0, 0.15), CONSTRAINTS.minAngle, CONSTRAINTS.maxAngle);
      j.upperAngle = clamp(j.upperAngle + rng.normal(0, 0.15), CONSTRAINTS.minAngle, CONSTRAINTS.maxAngle);
      record(history, gen, 'joint-limits', j.id, 'Adjusted joint limits', 0.3, parentId);
    }
  } else {
    const j = g.joints.length ? rng.pick(g.joints) : null;
    if (j) {
      j.motorStrength = clamp(
        j.motorStrength * (1 + rng.normal(0, ds)),
        CONSTRAINTS.minMotorStrength,
        CONSTRAINTS.maxMotorStrength,
      );
      record(history, gen, 'motor-strength', j.id, 'Adjusted motor strength', 0.3, parentId);
    }
  }
}

function addSegment(
  g: CreatureGenome,
  rng: Rng,
  gen: number,
  parentId: string,
  history: MutationRecord[],
): void {
  const parent = rng.pick(g.segments);
  const angle = rng.range(-Math.PI, 0);
  const id = newId(rng, 's');
  const seg: BodySegmentGene = {
    id,
    parentId: parent.id,
    shape: rng.bool(0.7) ? 'capsule' : 'box',
    halfW: rng.range(0.1, 0.2),
    halfH: rng.range(0.05, 0.09),
    local: { x: Math.cos(angle) * 0.25, y: Math.sin(angle) * 0.25 },
    localRotation: angle,
    density: 1,
    friction: 0.9,
    restitution: 0.05,
    linearDamping: 0.05,
    angularDamping: 0.05,
    hue: (parent.hue + rng.intRange(-15, 15) + 360) % 360,
    groundSensor: rng.bool(0.6),
  };
  g.segments.push(seg);
  // The joint is (re)created by repair; add a placeholder with useful params.
  g.joints.push({
    id: `j_${id}`,
    bodyA: parent.id,
    bodyB: id,
    type: 'revolute',
    lowerAngle: -rng.range(0.6, 1.2),
    upperAngle: rng.range(0.6, 1.2),
    motorStrength: rng.range(14, 30),
    motorSpeedLimit: rng.range(5, 9),
    damping: 0.1,
    stiffness: 0.5,
    controllerOutput: 0,
    phaseOffset: rng.range(0, Math.PI * 2),
  });
  record(history, gen, 'add-segment', id, 'Added a body segment', 0.6, parentId);
}

function removeLeafSegment(
  g: CreatureGenome,
  rng: Rng,
  gen: number,
  parentId: string,
  history: MutationRecord[],
): void {
  const hasChild = new Set<string>();
  for (const s of g.segments) if (s.parentId) hasChild.add(s.parentId);
  const leaves = g.segments.filter((s) => s.parentId !== null && !hasChild.has(s.id));
  if (leaves.length === 0) return;
  const leaf = rng.pick(leaves);
  g.segments = g.segments.filter((s) => s.id !== leaf.id);
  g.joints = g.joints.filter((j) => j.bodyB !== leaf.id && j.bodyA !== leaf.id);
  record(history, gen, 'remove-segment', leaf.id, 'Removed a leaf segment', 0.6, parentId);
}

function duplicateBranch(
  g: CreatureGenome,
  rng: Rng,
  gen: number,
  parentId: string,
  history: MutationRecord[],
  mirror: boolean,
): void {
  const src = rng.pick(g.segments.filter((s) => s.parentId !== null));
  if (!src) return;
  const clone = structuredCloneSafe(src);
  clone.id = newId(rng, 's');
  if (mirror) {
    clone.local.x = -clone.local.x;
    clone.localRotation = -clone.localRotation;
  } else {
    clone.local.x += rng.normal(0, 0.08);
  }
  g.segments.push(clone);
  const srcJoint = g.joints.find((j) => j.bodyB === src.id);
  g.joints.push({
    id: `j_${clone.id}`,
    bodyA: src.parentId!,
    bodyB: clone.id,
    type: 'revolute',
    lowerAngle: srcJoint?.lowerAngle ?? -1,
    upperAngle: srcJoint?.upperAngle ?? 1,
    motorStrength: srcJoint?.motorStrength ?? 20,
    motorSpeedLimit: srcJoint?.motorSpeedLimit ?? 6,
    damping: 0.1,
    stiffness: 0.5,
    controllerOutput: 0,
    phaseOffset: rng.range(0, Math.PI * 2),
  });
  record(
    history,
    gen,
    mirror ? 'mirror-branch' : 'duplicate-branch',
    clone.id,
    mirror ? 'Mirrored a branch' : 'Duplicated a branch',
    0.7,
    parentId,
  );
}
