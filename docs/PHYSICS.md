# Physics

A custom deterministic 2D rigid-body engine in `src/engine/physics/`. A hand-written
engine was chosen over Rapier2d/WASM because determinism is the project's top
priority and a pure-TypeScript solver gives exact control over the timestep and math,
runs as plain JS in Web Workers, and is unit-testable headlessly.

## Units

SI-like: metres, seconds, kilograms (mass = density × area). Gravity defaults to
`-9.81 m/s²`. Angles in radians. The world's y-axis points up.

## Timestep

Fixed **1/120 s**, integrated with **semi-implicit Euler**. Physics time is separate
from render time:

- Evaluation (`simulate.ts`) steps a fixed number of times (`duration / dt`).
- The live viewport (`live-sim.ts`) accumulates real elapsed time and runs whole fixed
  steps, capping the number of steps per frame to avoid a spiral of death. Rendering
  interpolates transforms and **never** feeds back into the simulation.

## Solver

Sequential impulses (Box2D-lite style) per step:

1. Integrate forces — gravity, exponential linear/angular damping, and (in water)
   buoyancy + drag — into velocities.
2. Generate ground contacts (see below).
3. Velocity iterations (default 12): solve each revolute joint (motor, angle limits,
   point-to-point 2×2 constraint) and each contact (normal non-penetration with
   Baumgarte bias + Coulomb friction).
4. Integrate positions with clamped velocities.
5. Position iterations (default 4): correct joint drift.

## Joint actuation

Each revolute joint exposes:

- **Motor:** drives the relative angular velocity toward `motorSpeed`, limited by
  `maxMotorTorque · dt` (so strength is a torque budget, not an instantaneous force).
  Controllers set `motorSpeed = output · motorSpeedLimit` each step.
- **Limits:** hard `[lowerAngle, upperAngle]` bounds enforced as one-sided constraints.

Joint anchors are computed at build time at the child's proximal end so the constraint
is exactly satisfied at rest — no initial "yank".

## Ground contact

Ground is a heightfield `y = h(x)` with a numerically-derived surface normal. Each
dynamic body contributes candidate points (box corners; capsule cap centres as circles;
circle centre). A point penetrating the surface generates a contact with the surface
normal, penetration depth and per-body friction. Self-collision between a creature's
own segments is intentionally disabled — a standard, stable simplification for
articulated evolved creatures.

## Water approximation (Swimming)

A deliberately simplified, educational model — **not** computational fluid dynamics.
For each submerged body: buoyancy proportional to the submerged area opposes gravity;
linear and angular drag damp motion toward a horizontal current. Configured by
`WaterModel { level, density, linearDrag, angularDrag, current }`.

## Stability protections

- Linear/angular velocity clamps (`MAX_LINEAR_SPEED`, `MAX_ANGULAR_SPEED`).
- Out-of-bounds termination (leaving the environment's `bounds`).
- NaN/Infinity guard: a non-finite body marks the world as `exploded`; the evaluation
  ends and the creature is penalised rather than corrupting results.

## Determinism notes

Bodies, joints and contacts are iterated in stable insertion order and the maths uses
only IEEE-754 double arithmetic (`+ − × ÷ √`, `sin`, `cos`), so identical inputs
produce identical trajectories.
