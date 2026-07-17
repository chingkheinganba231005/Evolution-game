/** Helpers to construct valid genomes programmatically. */

import { Rng } from '../random/prng';
import { repairGenome } from '../genome/validate';
import { controllerDims, mlpParamCounts } from '../controllers';
import type {
  BodySegmentGene,
  ControllerGenome,
  ControllerType,
  CreatureGenome,
  JointGene,
  ShapeKind,
} from '../genome/types';
import { GENOME_VERSION } from '../genome/types';

export interface SegmentSpec {
  id: string;
  parentId: string | null;
  shape?: ShapeKind;
  halfW: number;
  halfH: number;
  local: { x: number; y: number };
  localRotation?: number;
  density?: number;
  friction?: number;
  hue?: number;
  groundSensor?: boolean;
  joint?: Partial<Omit<JointGene, 'id' | 'bodyA' | 'bodyB' | 'type' | 'controllerOutput'>>;
}

let idCounter = 0;
export function uid(prefix = 'g'): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function defaultSegment(spec: SegmentSpec): BodySegmentGene {
  return {
    id: spec.id,
    parentId: spec.parentId,
    shape: spec.shape ?? 'capsule',
    halfW: spec.halfW,
    halfH: spec.halfH,
    local: spec.local,
    localRotation: spec.localRotation ?? 0,
    density: spec.density ?? 1.0,
    friction: spec.friction ?? 0.9,
    restitution: 0.05,
    linearDamping: 0.05,
    angularDamping: 0.05,
    hue: spec.hue ?? 170,
    groundSensor: spec.groundSensor ?? false,
  };
}

export function makeController(
  type: ControllerType,
  dims: { inputCount: number; outputCount: number },
  rng: Rng,
): ControllerGenome {
  const hidden = type === 'mlp' ? [Math.max(4, Math.round(dims.inputCount * 0.75))] : [];
  const controller: ControllerGenome = {
    type,
    inputCount: dims.inputCount,
    outputCount: dims.outputCount,
    hidden,
    recurrentSize: type === 'mlp' ? 2 : 0,
    weights: [],
    biases: [],
    frequency: rng.range(0.9, 1.6),
    amplitudes: Array.from({ length: dims.outputCount }, () => rng.range(0.7, 1.0)),
    outputScale: 1,
  };
  if (type === 'mlp') {
    const counts = mlpParamCounts(controller);
    controller.weights = Array.from({ length: counts.weights }, () => rng.normal(0, 0.6));
    controller.biases = Array.from({ length: counts.biases }, () => 0);
  }
  return controller;
}

export interface BuildGenomeOptions {
  name: string;
  seed: number;
  controllerType?: ControllerType;
  segments: SegmentSpec[];
}

/** Assemble, size and repair a genome from segment specs. */
export function buildGenome(opts: BuildGenomeOptions): CreatureGenome {
  const rng = new Rng(`build:${opts.seed}:${opts.name}`);
  const segments = opts.segments.map(defaultSegment);

  const joints: JointGene[] = [];
  let outIndex = 0;
  for (const spec of opts.segments) {
    if (spec.parentId === null) continue;
    const j = spec.joint ?? {};
    joints.push({
      id: `j_${spec.id}`,
      bodyA: spec.parentId,
      bodyB: spec.id,
      type: 'revolute',
      lowerAngle: j.lowerAngle ?? -Math.PI / 3,
      upperAngle: j.upperAngle ?? Math.PI / 3,
      motorStrength: j.motorStrength ?? 22,
      motorSpeedLimit: j.motorSpeedLimit ?? 6,
      damping: j.damping ?? 0.1,
      stiffness: j.stiffness ?? 0.5,
      controllerOutput: outIndex++,
      phaseOffset: j.phaseOffset ?? 0,
    });
  }

  const draft: CreatureGenome = {
    version: GENOME_VERSION,
    id: uid('c'),
    name: opts.name,
    generation: 0,
    parentIds: [],
    randomSeed: opts.seed,
    segments,
    joints,
    controller: makeController(
      opts.controllerType ?? 'cpg',
      controllerDims({ segments, joints } as CreatureGenome),
      rng,
    ),
    mutationHistory: [],
    metadata: { origin: 'starter' },
    createdAt: Date.now(),
  };

  const repaired = repairGenome(draft, opts.seed);
  if (!repaired) throw new Error(`Failed to build valid genome: ${opts.name}`);
  return repaired;
}
