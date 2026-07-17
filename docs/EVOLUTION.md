# Evolution

Implemented in `src/engine/evolution/`. The algorithm is a standard generational
genetic algorithm with quality-diversity extensions.

## Configuration (`EvolutionConfig`)

| Field | Default | Meaning |
|---|---|---|
| `populationSize` | 60 | Individuals per generation. |
| `eliteFraction` | 0.1 | Fraction copied unchanged to the next generation. |
| `tournamentSize` | 3 | Tournament selection pressure. |
| `crossoverProbability` | 0.6 | Chance an offspring is produced by crossover. |
| `mutation` | see below | Per-category mutation rates/scales. |
| `duration` | 12 s | Simulated evaluation length. |
| `seed` | user | Reproducibility seed. |

## Generational loop

1. **Initialise** — the ancestor is copied into slot 0; the rest are mutated clones
   (`initialPopulation`).
2. **Evaluate** — every genome runs in the physics simulation (in workers) producing
   real fitness, behaviour descriptors and summary metrics.
3. **Summarise** — best / mean / median / worst, diversity, species count, mutation
   counts (`summarize`).
4. **Archive** — if the Diversity Lab is on, each individual is offered to the
   MAP-Elites archive.
5. **Champion** — the best-ever genome is snapshotted with a replay.
6. **Reproduce** — elites are preserved; the rest come from tournament-selected
   parents via crossover and/or mutation (`reproduce`).
7. Repeat until the target generation count, or pause safely between generations.

## Selection & elitism

`rankPopulation` sorts by descending fitness (stable by index for determinism).
`tournamentSelect` returns the fittest of `k` uniformly random members. Elites (the
top `floor(size · eliteFraction)`) are copied unchanged, so best fitness is
**monotonically non-decreasing** across generations.

## Crossover

`crossover(a, b)` inherits `a`'s topology, then for segments/joints shared by stable
id it blends scalar parameters from both parents. Controller weights/biases/amplitudes
are uniformly crossed over only when the architectures match. Structurally
incompatible parents fall back to a clone of `a`. The child is always repaired.

## Mutation operators

`mutateGenome` applies, under per-category probabilities:

- **Controller:** perturb / reset neural weights and biases; shift oscillator
  frequency, amplitudes and joint phase offsets (bounded Gaussian).
- **Morphology parameters:** segment dimensions, density, friction, attachment point,
  joint limits, motor strength.
- **Structural:** add a segment, remove a leaf segment, duplicate or mirror a branch.

All perturbations are bounded and the result is repaired; every change is written to
`mutationHistory` with a severity and summary, powering the diary and genome diff.

## Fitness

Each environment defines named fitness components with default weights; the total is a
transparent weighted sum (`FitnessBreakdown`). Composite objectives discourage reward
exploits (e.g. Running pairs distance and speed with stability and a body-drag
penalty). The champion's live breakdown is shown in the fitness editor.

## Diversity, species & MAP-Elites

- **Diversity score:** mean pairwise behavioural distance across the population.
- **Species:** greedy deterministic clustering by morphological distance, each named
  from its traits (e.g. *"Fast symmetric mid-sized walkers"*) — no external AI.
- **MAP-Elites:** a 2-D grid over two chosen behavioural descriptors; each cell keeps
  the highest-fitness creature for that niche. Serialisable; the heatmap lets you click
  a cell to load that creature. See `mapelites.ts` (replacement logic is unit-tested).

## Determinism

Given the same `(genome, environment, weights, seed, duration, dt)`, `evaluate`
returns bit-identical results (no wall-clock time, no `Math.random`). Evolution uses a
seed-derived PRNG per generation, and worker results are re-associated by index before
selection, so parallelism cannot change outcomes. This is asserted by
`src/engine/simulate.test.ts` (identical generation summaries for the same seed).
