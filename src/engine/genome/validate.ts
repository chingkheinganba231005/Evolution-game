/** Genome validation and repair. */

import { Rng } from '../random/prng';
import { controllerDims, mlpParamCounts } from '../controllers';
import { CONSTRAINTS } from './constraints';
import { rootSegment, segmentById } from './build';
import type { CreatureGenome, JointGene } from './types';

export interface ValidationIssue {
  code: string;
  message: string;
  fatal: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}

/** Validate a genome without mutating it. */
export function validateGenome(genome: CreatureGenome): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, fatal = true): void => {
    issues.push({ code, message, fatal });
  };

  if (!genome.segments || genome.segments.length < CONSTRAINTS.minSegments) {
    add('no-segments', 'Creature has no body segments.');
  }
  if (genome.segments && genome.segments.length > CONSTRAINTS.maxSegments) {
    add('too-many-segments', `More than ${CONSTRAINTS.maxSegments} segments.`);
  }

  const roots = genome.segments.filter((s) => s.parentId === null);
  if (roots.length !== 1) {
    add('root-count', `Expected exactly one root segment, found ${roots.length}.`);
  }

  const ids = new Set(genome.segments.map((s) => s.id));
  for (const s of genome.segments) {
    if (s.parentId !== null && !ids.has(s.parentId)) {
      add('orphan', `Segment ${s.id} references missing parent ${s.parentId}.`);
    }
  }

  // Connectivity: every segment reachable from the root.
  if (roots.length === 1) {
    const reachable = new Set<string>();
    const stack = [roots[0].id];
    const byParent = new Map<string, string[]>();
    for (const s of genome.segments) {
      if (s.parentId) {
        const arr = byParent.get(s.parentId) ?? [];
        arr.push(s.id);
        byParent.set(s.parentId, arr);
      }
    }
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const c of byParent.get(id) ?? []) stack.push(c);
    }
    if (reachable.size !== genome.segments.length) {
      add('disconnected', 'Creature has disconnected body islands.');
    }
  }

  // Joints must map to non-root segments.
  for (const j of genome.joints) {
    if (!ids.has(j.bodyA) || !ids.has(j.bodyB)) {
      add('joint-ref', `Joint ${j.id} references a missing segment.`);
    }
    if (j.upperAngle - j.lowerAngle < CONSTRAINTS.minAngleSpan) {
      add('joint-limits', `Joint ${j.id} has an invalid angle span.`, false);
    }
  }

  // Controller size consistency.
  const dims = controllerDims(genome);
  if (genome.controller.outputCount !== dims.outputCount) {
    add('controller-out', 'Controller output count does not match joint count.', false);
  }
  if (genome.controller.type === 'mlp') {
    const { weights, biases } = mlpParamCounts(genome.controller);
    if (genome.controller.weights.length !== weights) {
      add('controller-weights', 'Controller weight vector has the wrong size.', false);
    }
    if (genome.controller.biases.length !== biases) {
      add('controller-biases', 'Controller bias vector has the wrong size.', false);
    }
  }

  // Numeric sanity.
  for (const s of genome.segments) {
    if (!Number.isFinite(s.halfW) || !Number.isFinite(s.halfH)) {
      add('nan-dimension', `Segment ${s.id} has non-finite dimensions.`);
    }
  }

  return { valid: issues.every((i) => !i.fatal), issues };
}

/**
 * Repair a genome in place-safe manner (returns a new, valid genome).
 * Clamps values into range, rebuilds joints to match the segment tree, drops
 * disconnected segments, and resizes controller arrays. Returns null only if
 * the morphology is unsalvageable (no root / no segments).
 */
export function repairGenome(input: CreatureGenome, seed: number): CreatureGenome | null {
  const rng = new Rng(`repair:${seed}:${input.id}`);
  const genome: CreatureGenome = structuredCloneSafe(input);

  if (!genome.segments || genome.segments.length === 0) return null;

  // Ensure a single root: keep the first null-parent, or promote segment[0].
  let root = rootSegment(genome);
  if (!root) {
    genome.segments[0].parentId = null;
    root = genome.segments[0];
  } else {
    // Demote any additional roots by attaching them to the primary root.
    let seenRoot = false;
    for (const s of genome.segments) {
      if (s.parentId === null) {
        if (seenRoot) s.parentId = root.id;
        else seenRoot = true;
      }
    }
  }

  const ids = new Set(genome.segments.map((s) => s.id));
  // Fix orphan references.
  for (const s of genome.segments) {
    if (s.parentId !== null && !ids.has(s.parentId)) s.parentId = root.id;
  }

  // Drop disconnected segments (keep only those reachable from root).
  const reachable = collectReachable(genome, root.id);
  genome.segments = genome.segments.filter((s) => reachable.has(s.id));

  // Enforce segment count cap by removing leaf segments furthest from root.
  while (genome.segments.length > CONSTRAINTS.maxSegments) {
    const leaf = findRemovableLeaf(genome);
    if (!leaf) break;
    genome.segments = genome.segments.filter((s) => s.id !== leaf);
  }

  // Clamp numeric fields.
  const byId = segmentById(genome);
  for (const s of genome.segments) {
    s.halfW = clamp(s.halfW, CONSTRAINTS.minHalf, CONSTRAINTS.maxHalf);
    s.halfH = clamp(s.halfH, CONSTRAINTS.minHalf, CONSTRAINTS.maxHalf);
    s.density = clamp(s.density, CONSTRAINTS.minDensity, CONSTRAINTS.maxDensity);
    s.friction = clamp(s.friction, CONSTRAINTS.minFriction, CONSTRAINTS.maxFriction);
    s.restitution = clamp(s.restitution, CONSTRAINTS.minRestitution, CONSTRAINTS.maxRestitution);
    s.linearDamping = clamp(s.linearDamping, CONSTRAINTS.minDamping, CONSTRAINTS.maxDamping);
    s.angularDamping = clamp(s.angularDamping, CONSTRAINTS.minDamping, CONSTRAINTS.maxDamping);
    if (!Number.isFinite(s.local.x)) s.local.x = 0;
    if (!Number.isFinite(s.local.y)) s.local.y = 0;
    if (!Number.isFinite(s.localRotation)) s.localRotation = 0;
    s.hue = ((s.hue % 360) + 360) % 360;
  }

  // Rebuild joints so each non-root segment has exactly one joint to its parent.
  const oldJoints = new Map<string, JointGene>();
  for (const j of genome.joints) oldJoints.set(j.bodyB, j);
  const joints: JointGene[] = [];
  let outputIndex = 0;
  for (const s of genome.segments) {
    if (s.parentId === null) continue;
    const prev = oldJoints.get(s.id);
    let lower = prev?.lowerAngle ?? -Math.PI / 3;
    let upper = prev?.upperAngle ?? Math.PI / 3;
    lower = clamp(lower, CONSTRAINTS.minAngle, CONSTRAINTS.maxAngle);
    upper = clamp(upper, CONSTRAINTS.minAngle, CONSTRAINTS.maxAngle);
    if (upper - lower < CONSTRAINTS.minAngleSpan) {
      const mid = (upper + lower) / 2;
      lower = mid - CONSTRAINTS.minAngleSpan / 2;
      upper = mid + CONSTRAINTS.minAngleSpan / 2;
    }
    joints.push({
      id: prev?.id ?? `j_${s.id}`,
      bodyA: s.parentId,
      bodyB: s.id,
      type: 'revolute',
      lowerAngle: lower,
      upperAngle: upper,
      motorStrength: clamp(
        prev?.motorStrength ?? 20,
        CONSTRAINTS.minMotorStrength,
        CONSTRAINTS.maxMotorStrength,
      ),
      motorSpeedLimit: clamp(
        prev?.motorSpeedLimit ?? 6,
        CONSTRAINTS.minMotorSpeed,
        CONSTRAINTS.maxMotorSpeed,
      ),
      damping: clamp(prev?.damping ?? 0.1, 0, 5),
      stiffness: clamp(prev?.stiffness ?? 0.5, 0, 5),
      controllerOutput: outputIndex++,
      phaseOffset: Number.isFinite(prev?.phaseOffset) ? (prev as JointGene).phaseOffset : 0,
    });
  }
  genome.joints = joints;
  void byId;

  // Resize controller to match new topology.
  resizeController(genome, rng);

  return genome;
}

function resizeController(genome: CreatureGenome, rng: Rng): void {
  const dims = controllerDims(genome);
  const c = genome.controller;
  c.inputCount = dims.inputCount;
  c.outputCount = dims.outputCount;

  // Amplitudes / phase arrays sized to outputs.
  c.amplitudes = resizeArray(c.amplitudes, c.outputCount, () => rng.range(0.6, 1.0));

  if (c.type === 'mlp') {
    const { weights, biases } = mlpParamCounts(c);
    c.weights = resizeArray(c.weights, weights, () => rng.normal(0, 0.5));
    c.biases = resizeArray(c.biases, biases, () => 0);
  }
  if (!Number.isFinite(c.frequency)) c.frequency = 1.2;
  if (!Number.isFinite(c.outputScale)) c.outputScale = 1;
}

function resizeArray(arr: number[], size: number, fill: () => number): number[] {
  const out = arr.slice(0, size);
  while (out.length < size) out.push(fill());
  for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i])) out[i] = 0;
  return out;
}

function collectReachable(genome: CreatureGenome, rootId: string): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const s of genome.segments) {
    if (s.parentId) {
      const arr = byParent.get(s.parentId) ?? [];
      arr.push(s.id);
      byParent.set(s.parentId, arr);
    }
  }
  const reachable = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of byParent.get(id) ?? []) stack.push(c);
  }
  return reachable;
}

function findRemovableLeaf(genome: CreatureGenome): string | null {
  const hasChild = new Set<string>();
  for (const s of genome.segments) if (s.parentId) hasChild.add(s.parentId);
  // A leaf is a non-root segment with no children.
  for (let i = genome.segments.length - 1; i >= 0; i--) {
    const s = genome.segments[i];
    if (s.parentId !== null && !hasChild.has(s.id)) return s.id;
  }
  return null;
}

/** structuredClone with a JSON fallback for older runtimes. */
export function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Validate then repair; guarantees a valid genome or null. */
export function ensureValid(genome: CreatureGenome, seed: number): CreatureGenome | null {
  const check = validateGenome(genome);
  if (check.valid && check.issues.length === 0) return genome;
  const repaired = repairGenome(genome, seed);
  if (!repaired) return null;
  const recheck = validateGenome(repaired);
  return recheck.valid ? repaired : null;
}
