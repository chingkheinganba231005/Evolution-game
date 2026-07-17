/** Shared per-step observation and actuation logic (used by eval and live sim). */

import type { CreatureInstance } from './physics/creature';

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Fill the controller input buffer with the fixed observation layout. */
export function observe(creature: CreatureInstance, inputs: number[]): void {
  const root = creature.root;
  inputs[0] = Math.sin(root.angle);
  inputs[1] = Math.cos(root.angle);
  inputs[2] = clamp(root.angularVelocity / 10, -1, 1);
  inputs[3] = clamp(root.velocity.x / 8, -1, 1);
  inputs[4] = clamp(root.velocity.y / 8, -1, 1);
  inputs[5] = 1; // forward target direction (+x)
  let idx = 6;
  for (const j of creature.joints) {
    inputs[idx++] = clamp(j.angle / Math.PI, -1, 1);
    inputs[idx++] = clamp((j.bodyB.angularVelocity - j.bodyA.angularVelocity) / 10, -1, 1);
  }
  for (const s of creature.sensorBodies) {
    inputs[idx++] = s.contactCount > 0 ? 1 : 0;
  }
}

/** Apply controller outputs to joint motors as desired angular velocities. */
export function actuate(
  creature: CreatureInstance,
  outputs: number[],
  speedLimits: number[],
): void {
  const joints = creature.joints;
  for (let i = 0; i < joints.length; i++) {
    const o = outputs[i] ?? 0;
    joints[i].motorSpeed = o * (speedLimits[i] ?? 6);
  }
}
