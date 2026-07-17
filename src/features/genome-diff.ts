/** Human-readable genome comparison for lineage / ancestor-vs-champion views. */

import type { CreatureGenome } from '../engine/genome/types';

export interface DiffLine {
  text: string;
  kind: 'add' | 'remove' | 'change';
}

export interface GenomeDiff {
  morphology: DiffLine[];
  controller: DiffLine[];
}

export function diffGenomes(a: CreatureGenome, b: CreatureGenome): GenomeDiff {
  const morphology: DiffLine[] = [];
  const controller: DiffLine[] = [];

  const aSeg = new Map(a.segments.map((s) => [s.id, s]));
  const bSeg = new Map(b.segments.map((s) => [s.id, s]));

  const segDelta = b.segments.length - a.segments.length;
  if (segDelta > 0) morphology.push({ text: `Added ${segDelta} segment${segDelta > 1 ? 's' : ''}`, kind: 'add' });
  if (segDelta < 0)
    morphology.push({ text: `Removed ${-segDelta} segment${-segDelta > 1 ? 's' : ''}`, kind: 'remove' });

  for (const [id, sb] of bSeg) {
    const sa = aSeg.get(id);
    if (!sa) continue;
    const wChange = pctChange(sa.halfW, sb.halfW);
    if (Math.abs(wChange) >= 5)
      morphology.push({ text: `Segment ${id.slice(0, 4)} length ${signed(wChange)}%`, kind: 'change' });
    const fChange = pctChange(sa.friction, sb.friction);
    if (Math.abs(fChange) >= 10)
      morphology.push({ text: `Segment ${id.slice(0, 4)} friction ${signed(fChange)}%`, kind: 'change' });
  }

  const aJoint = new Map(a.joints.map((j) => [j.bodyB, j]));
  for (const j of b.joints) {
    const ja = aJoint.get(j.bodyB);
    if (!ja) continue;
    const mChange = pctChange(ja.motorStrength, j.motorStrength);
    if (Math.abs(mChange) >= 10)
      morphology.push({ text: `Joint ${j.id.slice(0, 4)} motor strength ${signed(mChange)}%`, kind: 'change' });
    if (Math.abs(j.upperAngle - ja.upperAngle) > 0.15 || Math.abs(j.lowerAngle - ja.lowerAngle) > 0.15)
      morphology.push({ text: `Joint ${j.id.slice(0, 4)} range adjusted`, kind: 'change' });
  }

  const freqChange = pctChange(a.controller.frequency, b.controller.frequency);
  if (Math.abs(freqChange) >= 3)
    controller.push({ text: `Oscillator frequency ${signed(freqChange)}%`, kind: 'change' });

  if (a.controller.type !== b.controller.type)
    controller.push({ text: `Controller type ${a.controller.type} → ${b.controller.type}`, kind: 'change' });

  if (
    a.controller.type === 'mlp' &&
    b.controller.type === 'mlp' &&
    a.controller.weights.length === b.controller.weights.length
  ) {
    let changed = 0;
    for (let i = 0; i < b.controller.weights.length; i++) {
      if (Math.abs(b.controller.weights[i] - a.controller.weights[i]) > 0.05) changed++;
    }
    if (changed > 0)
      controller.push({ text: `${changed} neural weight${changed > 1 ? 's' : ''} changed`, kind: 'change' });
  }

  if (morphology.length === 0) morphology.push({ text: 'No significant morphology change', kind: 'change' });
  if (controller.length === 0) controller.push({ text: 'No significant controller change', kind: 'change' });
  return { morphology, controller };
}

function pctChange(a: number, b: number): number {
  if (Math.abs(a) < 1e-9) return 0;
  return ((b - a) / Math.abs(a)) * 100;
}
function signed(x: number): string {
  return (x >= 0 ? '+' : '') + x.toFixed(0);
}
