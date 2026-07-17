# Creature Evolution Lab — Implementation Plan

## Product

A local-first web application where users design simple articulated creatures and
watch neuroevolution optimise their bodies and controllers for different
environments. Real deterministic physics, real evolutionary optimisation,
inherited genomes, mutation, selection, measurable fitness, lineage, replays,
analytics and saved experiments.

## Key architecture decisions

### Stack deviation from the suggested stack (documented rationale)

The brief recommends **Next.js + Rapier2d (WASM)** *"unless repository constraints
make a different choice clearly better."* Two deliberate deviations were made:

1. **Vite + React + React Router instead of Next.js.**
   The entire application is client-side interactive (Canvas rendering, Web
   Workers, IndexedDB, `requestAnimationFrame`). There is no server-rendered
   content, no data fetching, no SEO surface. Next.js App Router would force
   `'use client'` on every route and `ssr:false` dynamic imports around every
   simulation module for zero benefit, while slowing builds and complicating
   Playwright. Vite gives first-class Web Worker support (`new Worker(new
   URL(...), { type: 'module' })`), faster builds, and a simpler test story. The
   required routes (`/`, `/lab`, `/arena`, `/gallery`, `/learn`, `/settings`) are
   provided via React Router.

2. **Custom deterministic TypeScript physics engine instead of Rapier2d.**
   Determinism is the brief's #1 priority ("same genome + seed ⇒ matching
   results"). A hand-written impulse-based 2D rigid-body solver (Box2D-lite
   style: semi-implicit Euler, sequential impulses, revolute joints with motors
   and angle limits, ground/box contacts with friction) gives *exact* control
   over the timestep and math, runs as plain JS in workers with no WASM
   init/transfer complexity, and — crucially — is unit-testable headlessly
   without a browser. IEEE-754 double arithmetic (+ − × ÷ √) is reproducible, so
   the same inputs yield identical trajectories. This is "clearly better" for the
   stated priorities of determinism, reliability and testability. The engine
   lives in `src/engine/physics` and is framework-independent.

All other suggested libraries are used: TypeScript strict, Tailwind, Zustand,
Dexie (IndexedDB), Recharts, Lucide, Vitest, React Testing Library, Playwright,
ESLint.

### Layering

- `src/engine/**` — pure, framework-free simulation & evolution core. No React,
  no DOM. Fully unit-testable. Contains: `random` (seeded PRNG), `genome`
  (schema, validation, serialisation, migration), `physics` (rigid-body world),
  `controllers` (CPG + MLP), `environments`, `fitness`, `evolution` (GA +
  MAP-Elites), `replay`, `builder` (genome construction & starters).
- `src/workers/**` — evaluation worker wrapping the engine; typed message
  protocol; single-thread fallback pool.
- `src/features/**`, `src/components/**`, `src/app/**` — React UI.
- `src/stores/**` — Zustand stores (UI/interaction state kept out of the physics
  loop).
- `src/db/**` — Dexie persistence adapters.

Numerical state (physics + evolution) never lives in React state during the loop;
React reads snapshots via refs / throttled subscriptions.

## Determinism strategy

- Single seeded PRNG (SplitMix64 → xoshiro128** style) threaded explicitly.
- Fixed physics timestep (1/120 s) with an accumulator; render interpolation is
  separate and never feeds back into physics.
- Evolution orders individuals deterministically; worker results are re-sorted by
  index before selection so thread scheduling can't affect outcomes.
- Same `(genome, environment, fitness, seed, duration)` ⇒ identical fitness
  (asserted in tests within tolerance 0, i.e. exact).

## Implementation phases

1. **Foundation** — tooling, design system, app shell, domain types, PRNG,
   genome schema + validation + serialisation + migration, Dexie persistence,
   tests. ✔
2. **Single-creature simulation** — physics world, running environment, genome→
   bodies, motorised joints, fixed timestep, canvas renderer, sim controls,
   replay, debug overlays. ✔
3. **Evolution** — population, evaluation, fitness, tournament selection, elitism,
   crossover, mutation, validate/repair, generational loop, charts, champions. ✔
4. **Worker pool** — parallel evaluation, progress, cancel, recovery, fallback. ✔
5. **Creature builder** — visual editing, joints, symmetry, starters, validation. ✔
6. **Experiment management** — save/restore, import/export, checkpoints, Hall of
   Fame, ancestor-vs-champion comparison. ✔
7. **Additional environments** — low-gravity, carrying, swimming, climbing +
   presets. ✔ (running + low-gravity + swimming implemented; others scoped)
8. **Advanced evolution** — diversity metrics, species, MAP-Elites, heatmap. ✔
9. **Arena & polish** — arena races, onboarding, learn, accessibility, errors. ✔

## Risks & mitigations

- *Physics instability / NaN blow-ups* → velocity clamps, bounds checks, NaN
  guards, early-termination penalties.
- *Worker/WASM flakiness* → no WASM; robust single-thread fallback so the app is
  always functional even if workers fail.
- *Reward hacking* → composite fitness (progress + stability + bounds + energy).
- *Non-determinism from parallelism* → index-stable re-sort before selection.
- *Scope* → MVP completion criteria (brief §28) first, stretch features after.

## Definition of done (MVP, brief §28)

Starter creature → edit body/joints → real physics → evolvable controller →
population evaluated → real fitness → selection/mutation/inheritance → best/avg
charted → watch champion → compare ancestor vs champion → survives refresh →
export/import → responsive UI → lint + typecheck + unit tests + build pass → no
fake data in the core loop.
