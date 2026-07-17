/** Library of starter ancestor creatures. */

import { Rng } from '../random/prng';
import type { CreatureGenome, ShapeKind } from '../genome/types';
import { buildGenome, type SegmentSpec } from './factory';

const HALF_PI = Math.PI / 2;

export type StarterId =
  | 'worm'
  | 'biped'
  | 'quadruped'
  | 'hopper'
  | 'star'
  | 'snake'
  | 'minimal'
  | 'random';

export interface StarterMeta {
  id: StarterId;
  name: string;
  description: string;
}

export const STARTERS: StarterMeta[] = [
  { id: 'worm', name: 'Worm', description: 'A four-segment undulating crawler.' },
  { id: 'biped', name: 'Two-Legged Walker', description: 'A torso with two jointed legs.' },
  { id: 'quadruped', name: 'Four-Legged Walker', description: 'A long body on four legs.' },
  { id: 'hopper', name: 'Hopper', description: 'A body with one powerful spring leg.' },
  { id: 'star', name: 'Star Creature', description: 'A radial body with five limbs.' },
  { id: 'snake', name: 'Long Snake', description: 'Eight thin segments in a chain.' },
  { id: 'minimal', name: 'Minimal', description: 'The smallest valid two-segment creature.' },
  { id: 'random', name: 'Surprise Me', description: 'A random valid creature from a seed.' },
];

export function createStarter(id: StarterId, seed = 1): CreatureGenome {
  switch (id) {
    case 'worm':
      return worm(seed);
    case 'biped':
      return biped(seed);
    case 'quadruped':
      return quadruped(seed);
    case 'hopper':
      return hopper(seed);
    case 'star':
      return star(seed);
    case 'snake':
      return snake(seed);
    case 'minimal':
      return minimal(seed);
    case 'random':
      return randomCreature(seed);
  }
}

function chain(name: string, count: number, halfW: number, halfH: number, seed: number, hue: number) {
  const segments: SegmentSpec[] = [];
  for (let i = 0; i < count; i++) {
    segments.push({
      id: `s${i}`,
      parentId: i === 0 ? null : `s${i - 1}`,
      shape: 'capsule',
      halfW,
      halfH,
      local: i === 0 ? { x: 0, y: 0 } : { x: 2 * halfW, y: 0 },
      groundSensor: true,
      hue,
      joint:
        i === 0
          ? undefined
          : {
              lowerAngle: -0.9,
              upperAngle: 0.9,
              motorStrength: 16,
              motorSpeedLimit: 7,
              phaseOffset: i * 1.6,
            },
    });
  }
  return buildGenome({ name, seed, controllerType: 'cpg', segments });
}

function worm(seed: number): CreatureGenome {
  return chain('Worm', 4, 0.18, 0.09, seed, 130);
}

function snake(seed: number): CreatureGenome {
  return chain('Long Snake', 8, 0.13, 0.06, seed, 95);
}

function minimal(seed: number): CreatureGenome {
  return chain('Minimal', 2, 0.2, 0.1, seed, 200);
}

function leg(
  prefix: string,
  parent: string,
  x: number,
  hue: number,
  phase: number,
): SegmentSpec[] {
  return [
    {
      id: `${prefix}t`,
      parentId: parent,
      shape: 'capsule',
      halfW: 0.15,
      halfH: 0.07,
      local: { x, y: -0.12 },
      localRotation: -HALF_PI,
      hue,
      joint: {
        lowerAngle: -1.1,
        upperAngle: 1.1,
        motorStrength: 26,
        motorSpeedLimit: 7,
        phaseOffset: phase,
      },
    },
    {
      id: `${prefix}s`,
      parentId: `${prefix}t`,
      shape: 'capsule',
      halfW: 0.13,
      halfH: 0.06,
      local: { x: 0.28, y: 0 },
      hue,
      groundSensor: true,
      joint: {
        lowerAngle: -1.4,
        upperAngle: 0.2,
        motorStrength: 20,
        motorSpeedLimit: 8,
        phaseOffset: phase + 1.0,
      },
    },
  ];
}

function biped(seed: number): CreatureGenome {
  const segments: SegmentSpec[] = [
    { id: 's0', parentId: null, shape: 'box', halfW: 0.22, halfH: 0.12, local: { x: 0, y: 0 }, hue: 260 },
    ...leg('L', 's0', -0.12, 260, 0),
    ...leg('R', 's0', 0.12, 260, Math.PI),
  ];
  return buildGenome({ name: 'Two-Legged Walker', seed, controllerType: 'cpg', segments });
}

function quadruped(seed: number): CreatureGenome {
  const segments: SegmentSpec[] = [
    { id: 's0', parentId: null, shape: 'box', halfW: 0.34, halfH: 0.1, local: { x: 0, y: 0 }, hue: 30 },
  ];
  const xs = [-0.24, -0.08, 0.08, 0.24];
  const phases = [0, Math.PI, Math.PI, 0];
  xs.forEach((x, i) => {
    segments.push({
      id: `l${i}`,
      parentId: 's0',
      shape: 'capsule',
      halfW: 0.16,
      halfH: 0.06,
      local: { x, y: -0.1 },
      localRotation: -HALF_PI,
      hue: 30,
      groundSensor: true,
      joint: {
        lowerAngle: -1.0,
        upperAngle: 1.0,
        motorStrength: 22,
        motorSpeedLimit: 7,
        phaseOffset: phases[i],
      },
    });
  });
  return buildGenome({ name: 'Four-Legged Walker', seed, controllerType: 'cpg', segments });
}

function hopper(seed: number): CreatureGenome {
  const segments: SegmentSpec[] = [
    { id: 's0', parentId: null, shape: 'box', halfW: 0.18, halfH: 0.14, local: { x: 0, y: 0 }, hue: 340 },
    {
      id: 't',
      parentId: 's0',
      shape: 'capsule',
      halfW: 0.18,
      halfH: 0.08,
      local: { x: 0, y: -0.16 },
      localRotation: -HALF_PI,
      hue: 340,
      joint: { lowerAngle: -1.2, upperAngle: 1.2, motorStrength: 42, motorSpeedLimit: 9, phaseOffset: 0 },
    },
    {
      id: 'f',
      parentId: 't',
      shape: 'capsule',
      halfW: 0.14,
      halfH: 0.07,
      local: { x: 0.3, y: 0 },
      hue: 340,
      groundSensor: true,
      joint: { lowerAngle: -1.5, upperAngle: 0.4, motorStrength: 34, motorSpeedLimit: 10, phaseOffset: 1.4 },
    },
  ];
  return buildGenome({ name: 'Hopper', seed, controllerType: 'cpg', segments });
}

function star(seed: number): CreatureGenome {
  const arms = 5;
  const radius = 0.14;
  const segments: SegmentSpec[] = [
    { id: 's0', parentId: null, shape: 'circle', halfW: radius, halfH: radius, local: { x: 0, y: 0 }, hue: 190 },
  ];
  for (let i = 0; i < arms; i++) {
    const theta = -HALF_PI + (i / (arms - 1)) * Math.PI; // fan below/around
    const armHalf = 0.16;
    segments.push({
      id: `a${i}`,
      parentId: 's0',
      shape: 'capsule',
      halfW: armHalf,
      halfH: 0.05,
      local: { x: Math.cos(theta) * (radius + armHalf), y: Math.sin(theta) * (radius + armHalf) },
      localRotation: theta,
      hue: 190,
      groundSensor: true,
      joint: {
        lowerAngle: -1.0,
        upperAngle: 1.0,
        motorStrength: 18,
        motorSpeedLimit: 7,
        phaseOffset: (i / arms) * Math.PI * 2,
      },
    });
  }
  return buildGenome({ name: 'Star Creature', seed, controllerType: 'cpg', segments });
}

function randomCreature(seed: number): CreatureGenome {
  const rng = new Rng(`random-creature:${seed}`);
  const count = rng.intRange(3, 6);
  const shapes: ShapeKind[] = ['capsule', 'box', 'capsule'];
  const hue = rng.intRange(0, 359);
  const segments: SegmentSpec[] = [
    {
      id: 's0',
      parentId: null,
      shape: 'box',
      halfW: rng.range(0.16, 0.3),
      halfH: rng.range(0.1, 0.16),
      local: { x: 0, y: 0 },
      hue,
    },
  ];
  for (let i = 1; i < count; i++) {
    const parentIdx = rng.int(i);
    const angle = rng.range(-Math.PI, 0); // bias downward/outward
    const halfW = rng.range(0.1, 0.22);
    segments.push({
      id: `s${i}`,
      parentId: `s${parentIdx}`,
      shape: rng.pick(shapes),
      halfW,
      halfH: rng.range(0.05, 0.09),
      local: { x: Math.cos(angle) * 0.25, y: Math.sin(angle) * 0.25 },
      localRotation: angle,
      hue: (hue + rng.intRange(-20, 20) + 360) % 360,
      groundSensor: rng.bool(0.6),
      joint: {
        lowerAngle: -rng.range(0.6, 1.3),
        upperAngle: rng.range(0.6, 1.3),
        motorStrength: rng.range(14, 34),
        motorSpeedLimit: rng.range(5, 9),
        phaseOffset: rng.range(0, Math.PI * 2),
      },
    });
  }
  return buildGenome({
    name: 'Random Creature',
    seed,
    controllerType: rng.bool(0.5) ? 'cpg' : 'mlp',
    segments,
  });
}
