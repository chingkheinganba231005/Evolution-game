/** Instantiate a physics creature (bodies + joints) from a genome. */

import { resolveTransforms, morphologyExtent } from '../genome/build';
import type { CreatureGenome } from '../genome/types';
import { rotate, type Vec2 } from './math';
import { Body, RevoluteJoint, World } from './world';

export interface CreatureInstance {
  genome: CreatureGenome;
  bodies: Map<string, Body>;
  joints: RevoluteJoint[];
  /** Root body, used as the "main body" for observations. */
  root: Body;
  /** Segments that expose a ground sensor, in genome order. */
  sensorBodies: Body[];
}

export interface SpawnOptions {
  x: number;
  /** Clearance of the lowest point above the terrain at spawn. */
  clearance: number;
}

/** Build the creature into an existing world at the given spawn location. */
export function buildCreature(
  world: World,
  genome: CreatureGenome,
  spawn: SpawnOptions,
): CreatureInstance {
  const transforms = resolveTransforms(genome);
  const extent = morphologyExtent(genome);
  const groundYAtSpawn = world.terrain.height(spawn.x);
  const offsetY = groundYAtSpawn + spawn.clearance - extent.minY;

  const bodies = new Map<string, Body>();
  for (const seg of genome.segments) {
    const t = transforms.get(seg.id)!;
    const body = world.addBody({
      shape: seg.shape,
      halfW: seg.halfW,
      halfH: seg.halfH,
      position: { x: t.x + spawn.x, y: t.y + offsetY },
      angle: t.angle,
      density: seg.density,
      friction: seg.friction,
      restitution: seg.restitution,
      linearDamping: seg.linearDamping,
      angularDamping: seg.angularDamping,
      tag: seg.id,
    });
    bodies.set(seg.id, body);
  }

  const joints: RevoluteJoint[] = [];
  const byId = new Map(genome.segments.map((s) => [s.id, s]));
  for (const jg of genome.joints) {
    const a = bodies.get(jg.bodyA);
    const b = bodies.get(jg.bodyB);
    const childSeg = byId.get(jg.bodyB);
    if (!a || !b || !childSeg) continue;

    // Shared pivot at the child's proximal end so the constraint is satisfied
    // exactly at rest (no initial yank).
    const proximalLocal: Vec2 =
      childSeg.shape === 'circle' ? { x: 0, y: 0 } : { x: -childSeg.halfW, y: 0 };
    const worldAnchor = {
      x: b.position.x + rotate(proximalLocal, b.angle).x,
      y: b.position.y + rotate(proximalLocal, b.angle).y,
    };
    const localAnchorA = rotate(
      { x: worldAnchor.x - a.position.x, y: worldAnchor.y - a.position.y },
      -a.angle,
    );

    const joint = world.addJoint({
      bodyA: a,
      bodyB: b,
      localAnchorA,
      localAnchorB: proximalLocal,
      referenceAngle: b.angle - a.angle,
      enableMotor: true,
      motorSpeed: 0,
      maxMotorTorque: jg.motorStrength,
      enableLimit: true,
      lowerAngle: jg.lowerAngle,
      upperAngle: jg.upperAngle,
      tag: jg.id,
    });
    joints.push(joint);
  }

  const root = bodies.get(genome.segments.find((s) => s.parentId === null)!.id)!;
  const sensorBodies = genome.segments
    .filter((s) => s.groundSensor)
    .map((s) => bodies.get(s.id)!)
    .filter(Boolean);

  return { genome, bodies, joints, root, sensorBodies };
}
