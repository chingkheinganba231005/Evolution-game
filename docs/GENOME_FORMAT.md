# Genome Format

The genome is a versioned, serialisable description of a creature. It is defined in
`src/engine/genome/types.ts`. Current version: **2**.

## Top level — `CreatureGenome`

| Field | Type | Notes |
|---|---|---|
| `version` | number | Schema version (migrated on load). |
| `id` | string | Unique genome id. |
| `name` | string | Display name (escaped in UI). |
| `generation` | number | Generation this genome was produced in. |
| `parentIds` | string[] | 0 (ancestor), 1 (mutation), or 2 (crossover) parents. |
| `randomSeed` | number | Seed used when the genome was created. |
| `segments` | BodySegmentGene[] | Body tree (see below). |
| `joints` | JointGene[] | One revolute joint per non-root segment. |
| `controller` | ControllerGenome | CPG or MLP controller. |
| `mutationHistory` | MutationRecord[] | Recent mutations (bounded length). |
| `descriptors?` | BehaviourDescriptors | Optional cached behaviour descriptors. |
| `metadata` | Record<string, string \| number \| boolean> | e.g. `origin`. |
| `createdAt` | number | Timestamp. |

## `BodySegmentGene`

A node in the body tree. `parentId` is `null` for exactly one **root** segment.

`shape` (`box` \| `circle` \| `capsule`), `halfW`, `halfH`, `local` (offset from the
parent's centre in the parent frame), `localRotation`, `density`, `friction`,
`restitution`, `linearDamping`, `angularDamping`, `hue` (inherited visual gene),
`groundSensor` (exposes a contact sensor to the controller).

## `JointGene`

A motorised revolute joint from `bodyA` (parent) to `bodyB` (child):
`lowerAngle`, `upperAngle`, `motorStrength` (max torque), `motorSpeedLimit`,
`damping`, `stiffness`, `controllerOutput` (which output drives it), `phaseOffset`
(CPG phase). Joints are always rebuilt to match the segment tree during repair, so
there is exactly one joint per non-root segment.

## `ControllerGenome`

`type` (`cpg` \| `mlp`), `inputCount`, `outputCount`, `hidden[]`, `recurrentSize`,
`weights[]`, `biases[]`, `frequency`, `amplitudes[]`, `outputScale`.

- **CPG:** each joint output is `sin(2π·frequency·t + phaseOffset) · amplitude`, with
  light sensory modulation.
- **MLP:** `tanh` layers over normalised observations; an optional recurrent hidden
  state is folded into the input/output. Layer sizes and parameter counts are derived
  in `src/engine/controllers/index.ts`.

Observation layout (fixed, length `6 + 2·joints + groundSensors`): body-orientation
sin/cos, angular velocity, linear velocity x/y, target direction, then per-joint angle
and relative angular velocity, then per-sensor ground contact.

## Validation & hard constraints

`validateGenome` / `repairGenome` (`src/engine/genome/validate.ts`) enforce
(`src/engine/genome/constraints.ts`):

- Exactly one root; every segment reachable (no disconnected islands).
- `1..12` segments; each joint references valid segments; valid angle spans.
- All numeric fields clamped into range; NaN/Infinity rejected.
- Controller weight/bias vectors resized to match topology.

`repairGenome` fixes what it can (clamping, reparenting orphans, dropping
disconnected segments, rebuilding joints, resizing the controller). Offspring that
cannot be repaired fall back to a clone of a valid parent.

## Versioning & migration

`migrateGenome` (`src/engine/genome/serialize.ts`) upgrades older genomes:

- **v1 → v2:** adds `groundSensor` and `restitution` to segments; adds
  `recurrentSize`, `outputScale`, `amplitudes`, `hidden` to controllers.

Unknown/missing fields are filled with safe defaults, then the genome is repaired.

## File format

```jsonc
{ "kind": "creature", "version": 2, "genome": { /* CreatureGenome */ } }
```

Parsing (`parseCreatureFile`) checks size, parses JSON (never executes it), migrates,
validates and repairs — malformed input throws a `GenomeParseError` with a readable
message.

## Mutation operations

See [`EVOLUTION.md`](./EVOLUTION.md#mutation-operators).
