/** Core genetic-algorithm operations (framework- and worker-independent). */

import { Rng } from '../random/prng';
import { cloneGenome } from '../genome/serialize';
import type { CreatureGenome } from '../genome/types';
import { crossover } from './crossover';
import { mutateGenome } from './mutation';
import {
  eliteCount,
  meanFitness,
  medianFitness,
  rankPopulation,
  tournamentSelect,
} from './selection';
import { clusterSpecies, diversityScore } from './species';
import type { EvolutionConfig, GenerationSummary, Individual } from './types';

/** Deterministic RNG for a given generation of a run. */
export function generationRng(config: EvolutionConfig, generation: number): Rng {
  return new Rng(`evo:${config.seed}:gen:${generation}`);
}

/** Build the generation-0 population from an ancestor genome. */
export function initialPopulation(
  ancestor: CreatureGenome,
  config: EvolutionConfig,
): Individual[] {
  const rng = generationRng(config, 0);
  const pop: Individual[] = [];
  // Slot 0 is the unmodified ancestor (keeps the pure baseline in the pool).
  const base = cloneGenome(ancestor);
  base.generation = 0;
  base.parentIds = [];
  pop.push({ genome: base, fitness: -Infinity, evaluated: false });
  for (let i = 1; i < config.populationSize; i++) {
    const child = mutateGenome(ancestor, config.mutation, rng, 0);
    pop.push({ genome: child, fitness: -Infinity, evaluated: false });
  }
  return pop;
}

/** Produce the next generation's genomes from a ranked, evaluated population. */
export function reproduce(
  evaluated: Individual[],
  config: EvolutionConfig,
  generation: number,
): Individual[] {
  const rng = generationRng(config, generation);
  const ranked = rankPopulation(evaluated);
  const elites = eliteCount(config.populationSize, config.eliteFraction);
  const next: Individual[] = [];

  // Preserve elites unchanged (re-evaluated next generation for consistency).
  for (let i = 0; i < elites && i < ranked.length; i++) {
    const g = cloneGenome(ranked[i].genome);
    next.push({ genome: g, fitness: -Infinity, evaluated: false });
  }

  while (next.length < config.populationSize) {
    const parentA = tournamentSelect(ranked, config.tournamentSize, rng);
    let childGenome: CreatureGenome;
    if (rng.bool(config.crossoverProbability)) {
      const parentB = tournamentSelect(ranked, config.tournamentSize, rng);
      const crossed = crossover(parentA.genome, parentB.genome, rng, generation);
      childGenome = mutateGenome(crossed, config.mutation, rng, generation);
    } else {
      childGenome = mutateGenome(parentA.genome, config.mutation, rng, generation);
    }
    next.push({ genome: childGenome, fitness: -Infinity, evaluated: false });
  }

  return next;
}

/** Summarise an evaluated population. */
export function summarize(evaluated: Individual[], generation: number): GenerationSummary {
  const ranked = rankPopulation(evaluated);
  const best = ranked[0];
  const species = clusterSpecies(evaluated);
  const mutationCounts: Record<string, number> = {};
  for (const ind of evaluated) {
    for (const m of ind.genome.mutationHistory) {
      if (m.generation === generation) {
        mutationCounts[m.type] = (mutationCounts[m.type] ?? 0) + 1;
      }
    }
  }
  return {
    generation,
    best: best.fitness,
    mean: meanFitness(evaluated),
    median: medianFitness(evaluated),
    worst: ranked[ranked.length - 1].fitness,
    diversity: diversityScore(evaluated),
    speciesCount: species.length,
    championId: best.genome.id,
    bestDistance: best.distance ?? 0,
    bestEnergy: best.energy ?? 0,
    bestStability: best.stability ?? 0,
    mutationCounts,
  };
}

export type EvaluateFn = (genome: CreatureGenome) => {
  fitness: number;
  descriptors: Individual['descriptors'];
  distance: number;
  energy: number;
  stability: number;
};

/**
 * Run a full evolution synchronously with the provided evaluator. Used by tests
 * and the single-thread fallback. Returns the per-generation summaries and the
 * final evaluated population.
 */
export function runEvolution(
  ancestor: CreatureGenome,
  config: EvolutionConfig,
  generations: number,
  evaluate: EvaluateFn,
): { summaries: GenerationSummary[]; finalPopulation: Individual[]; champion: Individual } {
  let pop = initialPopulation(ancestor, config);
  const summaries: GenerationSummary[] = [];
  let champion: Individual | null = null;

  for (let gen = 0; gen < generations; gen++) {
    for (const ind of pop) {
      const r = evaluate(ind.genome);
      ind.fitness = r.fitness;
      ind.descriptors = r.descriptors;
      ind.distance = r.distance;
      ind.energy = r.energy;
      ind.stability = r.stability;
      ind.evaluated = true;
    }
    const summary = summarize(pop, gen);
    summaries.push(summary);
    const genBest = rankPopulation(pop)[0];
    if (!champion || genBest.fitness > champion.fitness) champion = genBest;

    if (gen < generations - 1) {
      pop = reproduce(pop, config, gen + 1);
    }
  }

  return { summaries, finalPopulation: pop, champion: champion! };
}
