# Tasks

Legend: `[x]` done · `[~]` partial · `[ ]` todo

## Phase 1 — Foundation
- [x] Vite + React + TS strict tooling, ESLint, Vitest, Playwright
- [x] Tailwind design system (dark/light, glass panels, tokens)
- [x] App shell + routing (`/ /lab /arena /gallery /learn /settings`)
- [x] Domain types
- [x] Seeded PRNG (+ tests)
- [x] Genome schema, validation, serialise/deserialise, migration (+ tests)
- [x] Dexie persistence foundation

## Phase 2 — Single-creature simulation
- [x] Deterministic rigid-body physics world (bodies, revolute+motor joints, contacts, friction)
- [x] Running environment
- [x] Genome → physics construction
- [x] Fixed timestep + accumulator + render interpolation
- [x] Canvas renderer (creatures, ground, markers, camera)
- [x] Simulation controls (play/pause/step/speed)
- [x] Replay format (sampled transforms) + tests
- [x] Debug overlays (COM, velocity, contacts, joints, trail)

## Phase 3 — Evolution
- [x] Population init from ancestor
- [x] Evaluation → fitness components + descriptors
- [x] Tournament selection (+ tests) & elitism (+ tests)
- [x] Crossover (id-matched) (+ tests)
- [x] Morphology + controller mutation (bounded) (+ tests)
- [x] Validate & repair offspring (+ tests)
- [x] Generational loop, lineage tracking, champion snapshots
- [x] Fitness charts (best/mean/median, distribution, diversity)
- [x] Determinism test (same seed ⇒ same generation summary)

## Phase 4 — Worker pool
- [x] Typed evaluation worker
- [x] Worker pool with progress, cancel, crash recovery
- [x] Single-thread fallback
- [x] Throughput / utilisation reporting in UI

## Phase 5 — Creature builder
- [x] Starter ancestors (worm, biped, quadruped, hopper, star, snake, minimal, random)
- [x] Add/select/move/resize/delete/duplicate segment + joint editing
- [x] Symmetry / mirror, undo/redo, snap to grid
- [x] Validation feedback + "Surprise Me"
- [x] Test creature (no evolution)

## Phase 6 — Experiment management
- [x] Save / restore experiments
- [x] Import/export `.creature.json` / `.evolution.json` (validated)
- [x] Checkpoints (pause/resume mid-run)
- [x] Hall of Fame / Gallery
- [x] Ancestor vs champion comparison + genome diff

## Phase 7 — Environments
- [x] Running (flat + slope/bumps presets)
- [x] Low gravity
- [x] Swimming (simplified buoyancy/drag)
- [~] Climbing (scoped/documented as future)
- [~] Carrying (scoped/documented as future)
- [x] Beginner / Standard / Extreme presets per implemented env

## Phase 8 — Advanced evolution
- [x] Diversity metrics + morphological/controller distance
- [x] Species clustering + deterministic species names
- [x] MAP-Elites archive + replacement logic (+ tests)
- [x] Archive heatmap (hover/click to load)

## Phase 9 — Arena & polish
- [x] Arena mode (2–8 creatures, rankings, replay, result export)
- [x] Guided onboarding / Quick Start
- [x] Learn section
- [x] Accessibility (reduced motion, focus, contrast, labels)
- [x] Responsive behaviour
- [x] Robust error handling + boundaries
- [x] Evolution diary (deterministic)

## Verification
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `pnpm test:e2e` (Playwright smoke of Quick Start flow)

## Docs
- [x] README, PLAN, TASKS
- [x] docs/GENOME_FORMAT.md, EVOLUTION.md, PHYSICS.md, ADDING_ENVIRONMENTS.md
