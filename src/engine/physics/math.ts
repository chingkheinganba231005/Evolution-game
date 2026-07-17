/** Minimal 2D vector math for the deterministic physics engine. */

export interface Vec2 {
  x: number;
  y: number;
}

export const v2 = (x = 0, y = 0): Vec2 => ({ x, y });

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
/** 2D scalar cross product (a × b). */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}
/** Cross of vector with scalar: (v × s) => (s*v.y, -s*v.x). */
export function crossVS(v: Vec2, s: number): Vec2 {
  return { x: s * v.y, y: -s * v.x };
}
/** Cross of scalar with vector: (s × v) => (-s*v.y, s*v.x). */
export function crossSV(s: number, v: Vec2): Vec2 {
  return { x: -s * v.y, y: s * v.x };
}
export function len(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}
export function lenSq(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}
export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  if (l < 1e-12) return { x: 0, y: 0 };
  return { x: a.x / l, y: a.y / l };
}
export function rotate(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
export function isFiniteVec(a: Vec2): boolean {
  return Number.isFinite(a.x) && Number.isFinite(a.y);
}

/** Solve the 2x2 system K·x = b, returning x. K given as [a,b;c,d]. */
export function solve22(
  a: number,
  b: number,
  c: number,
  d: number,
  bx: number,
  by: number,
): Vec2 {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return { x: 0, y: 0 };
  const inv = 1 / det;
  return { x: inv * (d * bx - b * by), y: inv * (a * by - c * bx) };
}
