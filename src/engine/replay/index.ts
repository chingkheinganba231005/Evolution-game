/** Compact replay format: sampled body transforms plus shape metadata. */

import type { ShapeKind } from '../genome/types';

export interface ReplayShape {
  kind: ShapeKind;
  halfW: number;
  halfH: number;
  hue: number;
  tag: string;
}

export interface ReplayData {
  version: 1;
  sampleDt: number;
  shapes: ReplayShape[];
  /** One frame per sample: [x0,y0,a0, x1,y1,a1, ...] rounded for compactness. */
  frames: number[][];
}

const ROUND = 1e4;
function r(x: number): number {
  return Math.round(x * ROUND) / ROUND;
}

export function makeReplay(sampleDt: number, shapes: ReplayShape[]): ReplayData {
  return { version: 1, sampleDt, shapes, frames: [] };
}

export function pushReplayFrame(replay: ReplayData, transforms: number[]): void {
  const frame = new Array<number>(transforms.length);
  for (let i = 0; i < transforms.length; i++) frame[i] = r(transforms[i]);
  replay.frames.push(frame);
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** Interpolated pose of body `bodyIndex` at continuous time `t` seconds. */
export function sampleReplay(replay: ReplayData, bodyIndex: number, t: number): Pose {
  const { frames, sampleDt } = replay;
  if (frames.length === 0) return { x: 0, y: 0, angle: 0 };
  const fpos = t / sampleDt;
  const i0 = Math.max(0, Math.min(frames.length - 1, Math.floor(fpos)));
  const i1 = Math.min(frames.length - 1, i0 + 1);
  const frac = fpos - i0;
  const a = frames[i0];
  const b = frames[i1];
  const base = bodyIndex * 3;
  const lerp = (u: number, v: number): number => u + (v - u) * frac;
  return {
    x: lerp(a[base], b[base]),
    y: lerp(a[base + 1], b[base + 1]),
    // Angle interpolation via shortest path.
    angle: lerpAngle(a[base + 2], b[base + 2], frac),
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export function replayDuration(replay: ReplayData): number {
  return Math.max(0, (replay.frames.length - 1) * replay.sampleDt);
}
