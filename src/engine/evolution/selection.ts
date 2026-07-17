/** Selection and ranking utilities. */

import { Rng } from '../random/prng';
import type { Individual } from './types';

/** Sort a copy of the population by descending fitness (stable by index). */
export function rankPopulation(pop: Individual[]): Individual[] {
  return pop
    .map((ind, i) => ({ ind, i }))
    .sort((a, b) => b.ind.fitness - a.ind.fitness || a.i - b.i)
    .map((x) => x.ind);
}

/** Number of elites for a population size and elite fraction. */
export function eliteCount(size: number, fraction: number): number {
  return Math.max(1, Math.floor(size * fraction));
}

/** Return the elite individuals (already the highest-fitness members). */
export function selectElites(ranked: Individual[], count: number): Individual[] {
  return ranked.slice(0, count);
}

/** Tournament selection: best of `k` uniformly random members. */
export function tournamentSelect(pop: Individual[], k: number, rng: Rng): Individual {
  let best = pop[rng.int(pop.length)];
  for (let i = 1; i < k; i++) {
    const challenger = pop[rng.int(pop.length)];
    if (challenger.fitness > best.fitness) best = challenger;
  }
  return best;
}

export function meanFitness(pop: Individual[]): number {
  if (pop.length === 0) return 0;
  return pop.reduce((s, p) => s + p.fitness, 0) / pop.length;
}

export function medianFitness(pop: Individual[]): number {
  if (pop.length === 0) return 0;
  const sorted = pop.map((p) => p.fitness).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
