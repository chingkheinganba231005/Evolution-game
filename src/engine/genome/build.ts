/** Morphology tree helpers: resolve world transforms from the genome tree. */

import type { CreatureGenome, BodySegmentGene } from './types';

export interface SegmentTransform {
  x: number;
  y: number;
  angle: number;
}

export function rootSegment(genome: CreatureGenome): BodySegmentGene | undefined {
  return genome.segments.find((s) => s.parentId === null);
}

export function segmentById(genome: CreatureGenome): Map<string, BodySegmentGene> {
  const map = new Map<string, BodySegmentGene>();
  for (const s of genome.segments) map.set(s.id, s);
  return map;
}

export function childrenOf(genome: CreatureGenome): Map<string, BodySegmentGene[]> {
  const map = new Map<string, BodySegmentGene[]>();
  for (const s of genome.segments) {
    if (s.parentId === null) continue;
    const arr = map.get(s.parentId) ?? [];
    arr.push(s);
    map.set(s.parentId, arr);
  }
  return map;
}

/**
 * Compute the rest-pose world transform of every segment.
 * child.local is the offset (in the parent's local frame) from the parent's
 * centre to the child's centre; child.localRotation is relative to the parent.
 */
export function resolveTransforms(genome: CreatureGenome): Map<string, SegmentTransform> {
  const children = childrenOf(genome);
  const out = new Map<string, SegmentTransform>();
  const root = rootSegment(genome);
  if (!root) return out;

  const walk = (seg: BodySegmentGene, parent: SegmentTransform | null): void => {
    let t: SegmentTransform;
    if (parent === null) {
      t = { x: seg.local.x, y: seg.local.y, angle: seg.localRotation };
    } else {
      const cos = Math.cos(parent.angle);
      const sin = Math.sin(parent.angle);
      t = {
        x: parent.x + (seg.local.x * cos - seg.local.y * sin),
        y: parent.y + (seg.local.x * sin + seg.local.y * cos),
        angle: parent.angle + seg.localRotation,
      };
    }
    out.set(seg.id, t);
    for (const c of children.get(seg.id) ?? []) walk(c, t);
  };
  walk(root, null);
  return out;
}

/** Bounding metrics of a genome in its rest pose. */
export function morphologyExtent(genome: CreatureGenome): {
  width: number;
  height: number;
  minY: number;
  maxY: number;
} {
  const transforms = resolveTransforms(genome);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const byId = segmentById(genome);
  for (const [id, t] of transforms) {
    const seg = byId.get(id)!;
    const reach = Math.max(seg.halfW, seg.halfH) + Math.abs(seg.halfH);
    minX = Math.min(minX, t.x - reach);
    maxX = Math.max(maxX, t.x + reach);
    minY = Math.min(minY, t.y - reach);
    maxY = Math.max(maxY, t.y + reach);
  }
  if (!Number.isFinite(minX)) return { width: 0, height: 0, minY: 0, maxY: 0 };
  return { width: maxX - minX, height: maxY - minY, minY, maxY };
}
