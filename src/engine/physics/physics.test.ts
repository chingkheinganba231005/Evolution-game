import { describe, it, expect } from 'vitest';
import { World, flatTerrain } from './world';
import { makeReplay, pushReplayFrame, sampleReplay, replayDuration } from '../replay/index';

describe('physics world', () => {
  it('a body falls under gravity and rests on flat ground without exploding', () => {
    const world = new World({ gravity: { x: 0, y: -9.81 }, terrain: flatTerrain });
    const body = world.addBody({
      shape: 'box',
      halfW: 0.2,
      halfH: 0.2,
      position: { x: 0, y: 2 },
      angle: 0,
      density: 1,
      friction: 0.9,
      restitution: 0,
      linearDamping: 0.02,
      angularDamping: 0.02,
    });
    for (let i = 0; i < 600; i++) world.step(1 / 120);
    expect(world.exploded).toBe(false);
    // Rests with its base near the ground (half-height above 0).
    expect(body.position.y).toBeLessThan(0.35);
    expect(body.position.y).toBeGreaterThan(0.1);
    expect(Math.abs(body.velocity.y)).toBeLessThan(0.5);
  });

  it('a revolute joint keeps two bodies connected', () => {
    const world = new World({ gravity: { x: 0, y: -9.81 }, terrain: flatTerrain });
    const a = world.addBody({
      shape: 'box',
      halfW: 0.3,
      halfH: 0.1,
      position: { x: 0, y: 3 },
      angle: 0,
      density: 1,
      friction: 0.5,
      restitution: 0,
      linearDamping: 0,
      angularDamping: 0,
      isStatic: true,
    });
    const b = world.addBody({
      shape: 'capsule',
      halfW: 0.25,
      halfH: 0.06,
      position: { x: 0.5, y: 3 },
      angle: 0,
      density: 1,
      friction: 0.5,
      restitution: 0,
      linearDamping: 0.05,
      angularDamping: 0.05,
    });
    world.addJoint({
      bodyA: a,
      bodyB: b,
      localAnchorA: { x: 0.3, y: 0 },
      localAnchorB: { x: -0.25, y: 0 },
      referenceAngle: 0,
      enableMotor: false,
      motorSpeed: 0,
      maxMotorTorque: 0,
      enableLimit: false,
      lowerAngle: -1,
      upperAngle: 1,
    });
    for (let i = 0; i < 300; i++) world.step(1 / 120);
    // The anchor points should remain close (constraint satisfied).
    const anchorA = { x: a.position.x + 0.3, y: a.position.y };
    const rbx = Math.cos(b.angle) * -0.25 - Math.sin(b.angle) * 0;
    const rby = Math.sin(b.angle) * -0.25 + Math.cos(b.angle) * 0;
    const anchorB = { x: b.position.x + rbx, y: b.position.y + rby };
    const drift = Math.hypot(anchorA.x - anchorB.x, anchorA.y - anchorB.y);
    expect(world.exploded).toBe(false);
    expect(drift).toBeLessThan(0.1);
  });
});

describe('replay round-trip', () => {
  it('encodes and interpolates sampled transforms', () => {
    const replay = makeReplay(0.1, [{ kind: 'box', halfW: 0.2, halfH: 0.2, hue: 100, tag: 's0' }]);
    pushReplayFrame(replay, [0, 0, 0]);
    pushReplayFrame(replay, [1, 2, Math.PI / 2]);
    expect(replay.frames.length).toBe(2);
    expect(replayDuration(replay)).toBeCloseTo(0.1, 5);
    const mid = sampleReplay(replay, 0, 0.05);
    expect(mid.x).toBeCloseTo(0.5, 2);
    expect(mid.y).toBeCloseTo(1.0, 2);
    const end = sampleReplay(replay, 0, 0.1);
    expect(end.x).toBeCloseTo(1, 3);
  });
});
