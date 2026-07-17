# 🧬 Creature Evolution Lab

**Design the ancestor. Define the challenge. Watch evolution discover a creature
you would never have designed yourself.**

A local-first web application where you build simple articulated creatures and let
**neuroevolution** optimise both their **bodies** and their **controllers** for
different environments. It contains a real deterministic physics simulation, real
evolutionary optimisation, inherited genomes, mutation, selection, measurable
fitness, lineage tracking, replays, analytics and saved experiments — no fake data
in the core loop.

---

## Highlights

- **Real deterministic physics** — a custom impulse-based 2D rigid-body engine
  (revolute motors, angle limits, heightfield ground contacts, friction, a
  simplified fluid model) running at a fixed 1/120 s timestep.
- **Real evolution** — tournament selection, elitism, id-matched crossover, bounded
  morphology + controller mutation, validation & repair, lineage tracking, champion
  snapshots. Same seed ⇒ reproducible run.
- **Two controller types** — a Central Pattern Generator (rhythmic gaits) and a tiny
  feed-forward/recurrent neural network, both implemented from scratch in TypeScript.
- **Parallel evaluation** — a Web Worker pool with progress reporting, cancellation,
  crash recovery and an automatic single-thread fallback.
- **Diversity Lab** — a MAP-Elites quality-diversity archive with a live heatmap, plus
  species clustering with deterministically generated names.
- **Environments** — Running, Low Gravity and Swimming, each with Beginner / Standard
  / Extreme presets. (Climbing and Carrying are scoped as future work — see
  [Known limitations](#known-limitations).)
- **Full workflow** — creature builder, fitness editor, evolution charts, evolution
  diary, ancestor-vs-champion genome diff, arena races, local Hall of Fame, and
  import/export of `.creature.json` / `.evolution.json` files.
- **Local-first** — everything runs and is stored in your browser via IndexedDB. No
  accounts, no analytics, no network requests.

## Screenshots

> Screenshots are not committed to keep the repository lightweight. Run the app
> (`pnpm dev`) and visit `/lab` for the main laboratory, `/arena` for races and
> `/gallery` for the Hall of Fame.

---

## Installation

Requirements: **Node ≥ 20** and **pnpm ≥ 9** (the repo pins `pnpm@10`).

```bash
pnpm install
```

## Development

```bash
pnpm dev        # start Vite dev server (http://localhost:5173)
```

Open the URL, click **Quick Start** on the dashboard, and an experiment begins
evolving within two clicks.

## Production build & preview

```bash
pnpm build      # type-checks then builds to dist/
pnpm preview    # serve the production build on http://localhost:4173
```

## Testing

```bash
pnpm lint       # ESLint (0 warnings allowed)
pnpm typecheck  # strict TypeScript project references
pnpm test       # Vitest unit tests (engine, determinism, evolution)
pnpm test:e2e   # Playwright: quick-start → evolve → champion → save → reload → restore
```

The e2e config auto-detects a pre-installed Chromium (via `/opt/pw-browsers/chromium`
or `PW_CHROMIUM_PATH`) and otherwise uses Playwright's bundled browser.

---

## Architecture

```
src/
  engine/          Framework-free simulation & evolution core (no React, no DOM)
    random/          Seeded PRNG (mulberry32 + splitmix hashing)
    genome/          Versioned schema, validation/repair, serialisation, migration
    physics/         Deterministic 2D rigid-body world + creature construction
    controllers/     CPG and MLP controllers
    environments/    Running / low-gravity / swimming definitions + fitness
    evolution/       GA (selection, crossover, mutation), MAP-Elites, species
    replay/          Compact sampled-transform replay format
    simulate.ts      evaluate(): genome + env + seed → fitness, descriptors, replay
    live-sim.ts      Real-time viewport simulation
  workers/         Typed evaluation worker + pool (with single-thread fallback)
  stores/          Zustand state (lab orchestration, arena roster, settings)
  db/              Dexie (IndexedDB) persistence with in-memory fallback
  features/        UI features (builder, simulation, evolution, arena, gallery, io)
  components/      Shared UI primitives, charts, error boundaries
  app/             Routes (/, /lab, /arena, /gallery, /learn, /settings)
```

The engine is deliberately independent of React so it can be unit-tested headlessly
and executed inside Web Workers. Numerical state (physics + evolution) never lives
in React state during the loop.

**Stack:** Vite · React 18 · TypeScript (strict) · Tailwind · Zustand · Dexie ·
Recharts · Lucide · Vitest · Playwright.

See [`PLAN.md`](./PLAN.md) for the two deliberate deviations from the suggested
stack (Vite instead of Next.js; a custom physics engine instead of Rapier2d) and
their rationale.

## Simulation model

- Fixed timestep of **1/120 s** integrated with semi-implicit Euler and a sequential
  impulse solver. Rendering interpolates between physics frames and never feeds back
  into the simulation.
- Revolute joints provide a motor (bounded torque driving a target angular velocity)
  and hard angle limits. Ground contact is point-vs-heightfield with Coulomb friction.
- Self-collision between a creature's own segments is disabled — a standard, stable
  simplification for articulated evolved creatures.
- Stability protections: velocity clamps, out-of-bounds termination, and NaN/Infinity
  guards that mark a run as failed rather than corrupting results.

See [`docs/PHYSICS.md`](./docs/PHYSICS.md).

## Evolution model

- Population 60 (configurable), 10% elitism, tournament selection (size 3),
  ~60% crossover, per-category bounded Gaussian mutation.
- Offspring are always validated and repaired; if repair fails the parent is cloned.
- Reproducible: the same seed produces identical generation summaries. Worker results
  are re-associated by index so thread scheduling cannot affect outcomes.

See [`docs/EVOLUTION.md`](./docs/EVOLUTION.md) and
[`docs/GENOME_FORMAT.md`](./docs/GENOME_FORMAT.md).

## Environment assumptions

- **Swimming** uses a simplified educational fluid model (per-segment buoyancy +
  linear/angular drag + a horizontal current) — not computational fluid dynamics.
- **Low gravity** simply reduces the gravitational acceleration.
- Fitness is always a transparent weighted sum of named components; penalties carry
  negative weights.

See [`docs/ADDING_ENVIRONMENTS.md`](./docs/ADDING_ENVIRONMENTS.md).

## Export formats

- `*.creature.json` — a single versioned creature genome (`{ kind, version, genome }`).
- `*.evolution.json` — experiment settings, ancestor, per-generation summaries and the
  champion (replay optional).

Imports are size-checked, JSON-parsed (never executed), schema-validated, migrated
across versions and repaired; malformed files fail safely with a readable message.

## Browser support

Modern evergreen browsers (Chromium, Firefox, Safari) with Web Workers and IndexedDB.
Without workers the app falls back to single-threaded evaluation; without IndexedDB it
falls back to in-memory storage (a warning is shown in Settings).

## Performance guidance

- Population 60 evaluates without freezing the UI; work runs in workers.
- Set worker count in **Settings → Performance** (0 = auto, reserving a core for the UI).
- Long experiments aggregate chart data; replays sample transforms rather than storing
  every substep.
- Route-level code splitting keeps the initial bundle small; the physics/lab code loads
  only on `/lab`.

## Known limitations

- **Climbing** and **Carrying** environments are designed for but not yet implemented;
  the environment interface supports adding them (see the adding-environments doc).
- Crossover is parameter/uniform with a clone fallback for structurally incompatible
  topologies (full structural graph crossover is future work).
- The physics engine trades a little accuracy for determinism and robustness; it is a
  game/education-grade solver, not an engineering tool.

## Recommended next development milestone

Implement the **Carrying** environment end-to-end (movable object body, pickup/delivery
zones, object-progress fitness) as the first use of the environment extension points,
followed by the **Climbing** environment and grip sensors.

## License

Original work created for this project. Not affiliated with, and does not copy the
branding, assets, UI or code of, any existing game.
