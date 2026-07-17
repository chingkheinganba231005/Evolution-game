# Adding Environments

Environments live in `src/engine/environments/`. An environment couples a physics
setup, spawn placement, fitness components and behaviour descriptors.

## The interface (`ResolvedEnvironment`)

Defined in `src/engine/environments/types.ts`:

```ts
interface ResolvedEnvironment {
  kind: EnvKind;
  preset: PresetId;
  name: string;
  description: string;
  gravity: Vec2;
  terrain: Terrain;              // height(x) + normal(x)
  water?: WaterModel;            // optional fluid
  spawnClearance: number;       // lowest point above ground at spawn
  spawnX: number;
  finishX: number;
  bounds: { minX; maxX; minY; maxY };
  duration: number;             // seconds
  components: FitnessComponentSpec[];
  computeFitness(acc, weights): FitnessBreakdown;
  descriptors(acc): BehaviourDescriptors;
}
```

## Steps to add one

1. **Register metadata** in the `ENVIRONMENTS` array (`kind`, `name`, `description`,
   presets `beginner` / `standard` / `extreme`). Add the new `kind` to `EnvKind` in
   `types.ts`.
2. **Build the world** inside `resolveEnvironment(kind, preset)`: choose `gravity`, a
   `terrain` (use the `heightfield(h)` helper), and optionally a `WaterModel`. Set
   `spawnX`, `spawnClearance`, `finishX`, `bounds` and `duration`.
3. **Define fitness components** (`FitnessComponentSpec[]`) — id, label, unit,
   `defaultWeight` (negative for penalties, with `penalty: true`), and a description
   shown in the fitness editor.
4. **Compute raw values** from `EvalAccumulators` (distance, speed, stability, energy,
   contact/sensor frames, COM samples, etc.) and combine them with `weightedSum`.
5. **Provide behaviour descriptors** — reuse `baseDescriptors` or specialise it.

## Fitness hooks

`computeFitness(acc, weights)` receives the accumulators gathered during the run and
the user's weights. Keep objectives composite to avoid reward exploits (pair a "more
is better" signal with a stability/energy/bounds counter-signal).

## Rendering hooks

The canvas renderer (`src/features/simulation/renderer.ts`) already draws the terrain
heightfield, an optional water surface, start/finish markers and distance labels from
the `ResolvedEnvironment`, so most environments need no renderer changes. Add custom
props (e.g. grip points, a carried object) by extending the renderer and passing extra
data through the viewport.

## Observation additions

To keep genomes portable across environments, the controller observation layout is
fixed and does **not** change per environment. If a new environment needs bespoke
sensors (e.g. a carried-object position), extend the observation builder in
`src/engine/creature-runtime.ts` and update `controllerDims` so weight vectors resize
consistently — then bump the genome version and add a migration.

## Testing requirements

- Add an entry to the environments smoke test: every starter should produce a finite,
  non-exploding fitness in the new environment.
- Add a determinism assertion: the same genome + seed yields identical fitness.
- If you add accumulators or descriptors, cover their edge cases (empty run, immediate
  failure) so `NaN`/`Infinity` never leak into fitness.

## Example: the planned Carrying environment

- Add a movable object body to the world at build time (a dynamic box in a pickup
  zone) and a delivery zone at `finishX`.
- Extend observations with the object's relative position/possession state.
- Fitness: object progress toward the goal, time the object stays controlled,
  successful delivery bonus, creature progress, energy penalty.
- No dedicated gripper is required — reward emergent trapping/pushing/cradling.
