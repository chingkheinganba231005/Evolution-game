/** Diversity metrics, distances, and deterministic species clustering. */

import type { BehaviourDescriptors, CreatureGenome } from '../genome/types';
import type { Individual } from './types';

/** Aggregate morphology feature vector for distance comparisons. */
export function morphologyFeatures(g: CreatureGenome): number[] {
  const n = g.segments.length;
  let sumW = 0;
  let sumH = 0;
  let sumDensity = 0;
  for (const s of g.segments) {
    sumW += s.halfW;
    sumH += s.halfH;
    sumDensity += s.density;
  }
  const jointStrength = g.joints.reduce((a, j) => a + j.motorStrength, 0) / Math.max(g.joints.length, 1);
  return [n, sumW / n, sumH / n, sumDensity / n, g.joints.length, jointStrength / 30];
}

export function morphologicalDistance(a: CreatureGenome, b: CreatureGenome): number {
  const fa = morphologyFeatures(a);
  const fb = morphologyFeatures(b);
  let d = 0;
  for (let i = 0; i < fa.length; i++) {
    const diff = fa[i] - fb[i];
    d += diff * diff;
  }
  return Math.sqrt(d);
}

export function controllerDistance(a: CreatureGenome, b: CreatureGenome): number {
  const ca = a.controller;
  const cb = b.controller;
  if (ca.type !== cb.type) return 1;
  let d = Math.abs(ca.frequency - cb.frequency);
  if (ca.weights.length === cb.weights.length && ca.weights.length > 0) {
    let sum = 0;
    for (let i = 0; i < ca.weights.length; i++) {
      const diff = ca.weights[i] - cb.weights[i];
      sum += diff * diff;
    }
    d += Math.sqrt(sum / ca.weights.length);
  }
  return d;
}

function descriptorVector(d: BehaviourDescriptors): number[] {
  return [
    d.segmentCount / 12,
    d.averageSpeed / 6,
    d.stability,
    d.energyEfficiency / 4,
    d.dutyCycle,
    d.periodicity,
    d.symmetry,
  ];
}

function euclid(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    s += diff * diff;
  }
  return Math.sqrt(s);
}

/** Mean pairwise behavioural distance across the population (subsampled). */
export function diversityScore(pop: Individual[]): number {
  const vecs = pop.filter((p) => p.descriptors).map((p) => descriptorVector(p.descriptors!));
  if (vecs.length < 2) return 0;
  const step = Math.max(1, Math.floor(vecs.length / 20));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < vecs.length; i += step) {
    for (let j = i + step; j < vecs.length; j += step) {
      sum += euclid(vecs[i], vecs[j]);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export interface Species {
  id: number;
  members: Individual[];
  label: string;
  representative: Individual;
}

/** Greedy deterministic clustering by morphological distance. */
export function clusterSpecies(pop: Individual[], threshold = 0.9): Species[] {
  const species: Species[] = [];
  for (const ind of pop) {
    let placed = false;
    for (const sp of species) {
      if (morphologicalDistance(ind.genome, sp.representative.genome) < threshold) {
        sp.members.push(ind);
        if (ind.fitness > sp.representative.fitness) sp.representative = ind;
        placed = true;
        break;
      }
    }
    if (!placed) {
      species.push({ id: species.length, members: [ind], label: '', representative: ind });
    }
  }
  for (const sp of species) sp.label = speciesLabel(sp.representative);
  return species;
}

/** Deterministic trait-based species name (no external AI). */
export function speciesLabel(ind: Individual): string {
  const g = ind.genome;
  const d = ind.descriptors;
  const size = g.segments.length <= 3 ? 'compact' : g.segments.length <= 6 ? 'mid-sized' : 'long-bodied';
  const speed = d ? (d.averageSpeed > 1.5 ? 'fast' : d.averageSpeed > 0.5 ? 'steady' : 'slow') : 'untested';
  const gait = d
    ? d.dutyCycle > 0.6
      ? 'crawlers'
      : d.periodicity > 0.5
        ? 'hoppers'
        : 'walkers'
    : 'movers';
  const sym = d && d.symmetry > 0.85 ? 'symmetric' : 'asymmetric';
  return `${cap(speed)} ${sym} ${size} ${gait}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
