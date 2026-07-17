/**
 * Deterministic 2D rigid-body physics world.
 *
 * Impulse-based sequential solver (Box2D-lite style): semi-implicit Euler
 * integration, revolute joints with motors and angle limits, and point-vs-
 * heightfield ground contacts with Coulomb friction. Self-collision between
 * creature segments is intentionally disabled (a standard simplification for
 * articulated evolved-creature simulations) which keeps the solver simple,
 * fast and stable.
 *
 * Determinism: arrays are iterated in stable insertion order and the maths uses
 * only IEEE-754 doubles, so identical inputs yield identical trajectories.
 */

import {
  add,
  clamp,
  cross,
  crossSV,
  dot,
  scale,
  solve22,
  sub,
  v2,
  type Vec2,
} from './math';
import type { ShapeKind } from '../genome/types';

export interface BodyDef {
  shape: ShapeKind;
  /** box: half-width; capsule: half-length of the straight section; circle: unused. */
  halfW: number;
  /** box: half-height; capsule/circle: radius. */
  halfH: number;
  position: Vec2;
  angle: number;
  density: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  isStatic?: boolean;
  /** Arbitrary tag for reporting/rendering (e.g. genome segment id). */
  tag?: string;
}

export interface ContactInfo {
  point: Vec2;
  normal: Vec2;
  bodyIndex: number;
}

export class Body {
  position: Vec2;
  angle: number;
  velocity: Vec2 = v2();
  angularVelocity = 0;
  readonly shape: ShapeKind;
  readonly halfW: number;
  readonly halfH: number;
  readonly friction: number;
  readonly restitution: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly isStatic: boolean;
  readonly tag: string;
  mass: number;
  invMass: number;
  inertia: number;
  invInertia: number;
  /** Number of ground-contact points in the most recent step. */
  contactCount = 0;

  constructor(def: BodyDef) {
    this.position = { ...def.position };
    this.angle = def.angle;
    this.shape = def.shape;
    this.halfW = def.halfW;
    this.halfH = def.halfH;
    this.friction = def.friction;
    this.restitution = def.restitution;
    this.linearDamping = def.linearDamping;
    this.angularDamping = def.angularDamping;
    this.isStatic = def.isStatic ?? false;
    this.tag = def.tag ?? '';

    if (this.isStatic) {
      this.mass = 0;
      this.invMass = 0;
      this.inertia = 0;
      this.invInertia = 0;
    } else {
      const { mass, inertia } = computeMassInertia(def);
      this.mass = mass;
      this.inertia = inertia;
      this.invMass = 1 / mass;
      this.invInertia = 1 / inertia;
    }
  }

  /** World-space area used for buoyancy/drag approximations. */
  get area(): number {
    return shapeArea(this.shape, this.halfW, this.halfH);
  }
}

export function shapeArea(shape: ShapeKind, halfW: number, halfH: number): number {
  switch (shape) {
    case 'box':
      return 4 * halfW * halfH;
    case 'circle':
      return Math.PI * halfH * halfH;
    case 'capsule':
      return 4 * halfW * halfH + Math.PI * halfH * halfH;
  }
}

function computeMassInertia(def: BodyDef): { mass: number; inertia: number } {
  const area = shapeArea(def.shape, def.halfW, def.halfH);
  const mass = Math.max(area * def.density, 1e-4);
  let inertia: number;
  switch (def.shape) {
    case 'circle':
      inertia = 0.5 * mass * def.halfH * def.halfH;
      break;
    default: {
      // Bounding-box approximation for boxes and capsules.
      const w = def.shape === 'capsule' ? 2 * (def.halfW + def.halfH) : 2 * def.halfW;
      const h = 2 * def.halfH;
      inertia = (mass * (w * w + h * h)) / 12;
      break;
    }
  }
  return { mass, inertia: Math.max(inertia, 1e-4) };
}

export interface RevoluteJointDef {
  bodyA: Body;
  bodyB: Body;
  localAnchorA: Vec2;
  localAnchorB: Vec2;
  referenceAngle: number;
  enableMotor: boolean;
  motorSpeed: number;
  maxMotorTorque: number;
  enableLimit: boolean;
  lowerAngle: number;
  upperAngle: number;
  tag?: string;
}

export class RevoluteJoint {
  bodyA: Body;
  bodyB: Body;
  localAnchorA: Vec2;
  localAnchorB: Vec2;
  referenceAngle: number;
  enableMotor: boolean;
  motorSpeed: number;
  maxMotorTorque: number;
  enableLimit: boolean;
  lowerAngle: number;
  upperAngle: number;
  readonly tag: string;

  // Solver scratch.
  private rA: Vec2 = v2();
  private rB: Vec2 = v2();
  private motorImpulse = 0;
  private lowerImpulse = 0;
  private upperImpulse = 0;

  constructor(def: RevoluteJointDef) {
    this.bodyA = def.bodyA;
    this.bodyB = def.bodyB;
    this.localAnchorA = { ...def.localAnchorA };
    this.localAnchorB = { ...def.localAnchorB };
    this.referenceAngle = def.referenceAngle;
    this.enableMotor = def.enableMotor;
    this.motorSpeed = def.motorSpeed;
    this.maxMotorTorque = def.maxMotorTorque;
    this.enableLimit = def.enableLimit;
    this.lowerAngle = def.lowerAngle;
    this.upperAngle = def.upperAngle;
    this.tag = def.tag ?? '';
  }

  /** Current joint angle (bodyB relative to bodyA minus reference). */
  get angle(): number {
    return this.bodyB.angle - this.bodyA.angle - this.referenceAngle;
  }

  prepare(): void {
    this.rA = rotateVec(this.localAnchorA, this.bodyA.angle);
    this.rB = rotateVec(this.localAnchorB, this.bodyB.angle);
    this.motorImpulse = 0;
    this.lowerImpulse = 0;
    this.upperImpulse = 0;
  }

  solveVelocity(dt: number): void {
    const a = this.bodyA;
    const b = this.bodyB;
    const invIA = a.invInertia;
    const invIB = b.invInertia;

    // Motor: drive relative angular velocity toward motorSpeed.
    if (this.enableMotor) {
      const invMassAng = invIA + invIB;
      if (invMassAng > 0) {
        const cdot = b.angularVelocity - a.angularVelocity - this.motorSpeed;
        let impulse = -cdot / invMassAng;
        const maxImpulse = this.maxMotorTorque * dt;
        const old = this.motorImpulse;
        this.motorImpulse = clamp(old + impulse, -maxImpulse, maxImpulse);
        impulse = this.motorImpulse - old;
        a.angularVelocity -= invIA * impulse;
        b.angularVelocity += invIB * impulse;
      }
    }

    // Angle limits.
    if (this.enableLimit) {
      const invMassAng = invIA + invIB;
      if (invMassAng > 0) {
        const jointAngle = this.angle;
        // Lower limit.
        {
          const c = jointAngle - this.lowerAngle;
          const cdot = b.angularVelocity - a.angularVelocity;
          let impulse = (-cdot - Math.min(c, 0) * 0.2 * (1 / dt)) / invMassAng;
          const old = this.lowerImpulse;
          this.lowerImpulse = Math.max(old + impulse, 0);
          impulse = this.lowerImpulse - old;
          a.angularVelocity -= invIA * impulse;
          b.angularVelocity += invIB * impulse;
        }
        // Upper limit.
        {
          const c = this.upperAngle - jointAngle;
          const cdot = a.angularVelocity - b.angularVelocity;
          let impulse = (-cdot - Math.min(c, 0) * 0.2 * (1 / dt)) / invMassAng;
          const old = this.upperImpulse;
          this.upperImpulse = Math.max(old + impulse, 0);
          impulse = this.upperImpulse - old;
          a.angularVelocity += invIA * impulse;
          b.angularVelocity -= invIB * impulse;
        }
      }
    }

    // Point-to-point positional constraint (2x2).
    const rA = this.rA;
    const rB = this.rB;
    const vpA = add(a.velocity, crossSV(a.angularVelocity, rA));
    const vpB = add(b.velocity, crossSV(b.angularVelocity, rB));
    const cdot = sub(vpB, vpA);

    const mA = a.invMass;
    const mB = b.invMass;
    const k11 = mA + mB + invIA * rA.y * rA.y + invIB * rB.y * rB.y;
    const k12 = -invIA * rA.x * rA.y - invIB * rB.x * rB.y;
    const k22 = mA + mB + invIA * rA.x * rA.x + invIB * rB.x * rB.x;
    const impulse = solve22(k11, k12, k12, k22, -cdot.x, -cdot.y);

    a.velocity = sub(a.velocity, scale(impulse, mA));
    a.angularVelocity -= invIA * cross(rA, impulse);
    b.velocity = add(b.velocity, scale(impulse, mB));
    b.angularVelocity += invIB * cross(rB, impulse);
  }

  /** Positional drift correction (Baumgarte-free split step). */
  solvePosition(): void {
    const a = this.bodyA;
    const b = this.bodyB;
    const rA = rotateVec(this.localAnchorA, a.angle);
    const rB = rotateVec(this.localAnchorB, b.angle);
    const c = sub(add(b.position, rB), add(a.position, rA));
    const mA = a.invMass;
    const mB = b.invMass;
    const invIA = a.invInertia;
    const invIB = b.invInertia;
    const k11 = mA + mB + invIA * rA.y * rA.y + invIB * rB.y * rB.y;
    const k12 = -invIA * rA.x * rA.y - invIB * rB.x * rB.y;
    const k22 = mA + mB + invIA * rA.x * rA.x + invIB * rB.x * rB.x;
    const impulse = solve22(k11, k12, k12, k22, -c.x, -c.y);
    a.position = sub(a.position, scale(impulse, mA));
    a.angle -= invIA * cross(rA, impulse);
    b.position = add(b.position, scale(impulse, mB));
    b.angle += invIB * cross(rB, impulse);
  }
}

function rotateVec(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export interface Terrain {
  /** Ground surface height at world x. */
  height(x: number): number;
  /** Unit surface normal (pointing up out of the ground) at world x. */
  normal(x: number): Vec2;
}

/** Flat ground at y = 0. */
export const flatTerrain: Terrain = {
  height: () => 0,
  normal: () => ({ x: 0, y: 1 }),
};

export interface WaterModel {
  level: number;
  /** Fluid density used for buoyancy (relative to creature densities). */
  density: number;
  /** Linear drag coefficient for submerged bodies. */
  linearDrag: number;
  /** Angular drag coefficient for submerged bodies. */
  angularDrag: number;
  /** Horizontal current velocity applied to submerged bodies. */
  current: number;
}

interface Contact {
  body: Body;
  bodyIndex: number;
  rax: number;
  ray: number;
  normal: Vec2;
  tangent: Vec2;
  separation: number; // negative = penetration
  massN: number;
  massT: number;
  restitution: number;
  friction: number;
  point: Vec2;
}

export interface WorldConfig {
  gravity: Vec2;
  terrain: Terrain;
  water?: WaterModel;
  velocityIterations?: number;
  positionIterations?: number;
}

const MAX_LINEAR_SPEED = 120;
const MAX_ANGULAR_SPEED = 120;
const SLOP = 0.005;
const BAUMGARTE = 0.2;

export class World {
  readonly bodies: Body[] = [];
  readonly joints: RevoluteJoint[] = [];
  gravity: Vec2;
  terrain: Terrain;
  water?: WaterModel;
  velocityIterations: number;
  positionIterations: number;
  /** Set true if the simulation produced non-finite state (irrecoverable). */
  exploded = false;
  lastContacts: ContactInfo[] = [];

  constructor(config: WorldConfig) {
    this.gravity = { ...config.gravity };
    this.terrain = config.terrain;
    this.water = config.water;
    this.velocityIterations = config.velocityIterations ?? 12;
    this.positionIterations = config.positionIterations ?? 4;
  }

  addBody(def: BodyDef): Body {
    const body = new Body(def);
    this.bodies.push(body);
    return body;
  }

  addJoint(def: RevoluteJointDef): RevoluteJoint {
    const joint = new RevoluteJoint(def);
    this.joints.push(joint);
    return joint;
  }

  /** Advance the simulation by one fixed timestep. */
  step(dt: number): void {
    if (this.exploded) return;

    // 1. Integrate forces (gravity, damping, fluid) into velocities.
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      body.velocity = add(body.velocity, scale(this.gravity, dt));

      if (this.water) {
        this.applyFluid(body, dt);
      }

      // Exponential damping.
      body.velocity = scale(body.velocity, 1 / (1 + dt * body.linearDamping));
      body.angularVelocity /= 1 + dt * body.angularDamping;
    }

    // 2. Generate ground contacts.
    const contacts = this.generateContacts();

    // 3. Prepare joints.
    for (const joint of this.joints) joint.prepare();

    // 4. Velocity iterations.
    for (let i = 0; i < this.velocityIterations; i++) {
      for (const joint of this.joints) joint.solveVelocity(dt);
      for (const c of contacts) this.solveContactVelocity(c, dt);
    }

    // 5. Integrate positions.
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      // Clamp velocities defensively.
      const sp = Math.hypot(body.velocity.x, body.velocity.y);
      if (sp > MAX_LINEAR_SPEED) body.velocity = scale(body.velocity, MAX_LINEAR_SPEED / sp);
      body.angularVelocity = clamp(body.angularVelocity, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED);

      body.position = add(body.position, scale(body.velocity, dt));
      body.angle += body.angularVelocity * dt;
    }

    // 6. Position correction for joints.
    for (let i = 0; i < this.positionIterations; i++) {
      for (const joint of this.joints) joint.solvePosition();
    }

    // 7. NaN / explosion guard.
    for (const body of this.bodies) {
      if (
        !Number.isFinite(body.position.x) ||
        !Number.isFinite(body.position.y) ||
        !Number.isFinite(body.angle)
      ) {
        this.exploded = true;
        return;
      }
    }

    this.lastContacts = contacts.map((c) => ({
      point: c.point,
      normal: c.normal,
      bodyIndex: c.bodyIndex,
    }));
  }

  private applyFluid(body: Body, dt: number): void {
    const water = this.water!;
    const depth = water.level - body.position.y;
    if (depth <= -body.halfH) return; // fully above water
    // Approximate submerged fraction across the body's vertical extent.
    const submerged = clamp((depth + body.halfH) / (2 * body.halfH), 0, 1);
    if (submerged <= 0) return;
    const displaced = body.area * submerged;
    // Buoyancy opposes gravity (educational approximation, not true CFD).
    const buoyForce = -this.gravity.y * water.density * displaced;
    body.velocity.y += buoyForce * body.invMass * dt;
    // Drag toward the current velocity.
    const relVx = body.velocity.x - water.current;
    body.velocity.x -= relVx * water.linearDrag * submerged * dt;
    body.velocity.y -= body.velocity.y * water.linearDrag * submerged * dt;
    body.angularVelocity -= body.angularVelocity * water.angularDrag * submerged * dt;
  }

  private generateContacts(): Contact[] {
    const contacts: Contact[] = [];
    for (let bi = 0; bi < this.bodies.length; bi++) {
      const body = this.bodies[bi];
      body.contactCount = 0;
      if (body.isStatic) continue;
      const points = contactCandidates(body);
      for (const local of points) {
        const world = add(body.position, rotateVec(local.p, body.angle));
        const gy = this.terrain.height(world.x);
        const gn = this.terrain.normal(world.x);
        const surfacePt = { x: world.x, y: gy };
        // Signed distance of the candidate point above the surface along normal.
        const distance = dot(sub(world, surfacePt), gn) - local.r;
        if (distance >= 0) continue;
        const contactPoint =
          local.r > 0 ? sub(world, scale(gn, local.r)) : world;
        const c = this.buildContact(body, bi, contactPoint, gn, distance);
        contacts.push(c);
        body.contactCount++;
      }
    }
    return contacts;
  }

  private buildContact(
    body: Body,
    bodyIndex: number,
    point: Vec2,
    normal: Vec2,
    separation: number,
  ): Contact {
    const r = sub(point, body.position);
    const tangent = { x: -normal.y, y: normal.x };
    const rnA = cross(r, normal);
    const rtA = cross(r, tangent);
    const massN = 1 / (body.invMass + body.invInertia * rnA * rnA);
    const massT = 1 / (body.invMass + body.invInertia * rtA * rtA);
    return {
      body,
      bodyIndex,
      rax: r.x,
      ray: r.y,
      normal,
      tangent,
      separation,
      massN,
      massT,
      restitution: body.restitution,
      friction: body.friction,
      point,
    };
  }

  private solveContactVelocity(c: Contact, dt: number): void {
    const body = c.body;
    const r = { x: c.rax, y: c.ray };
    // Relative velocity at contact point.
    const vp = add(body.velocity, crossSV(body.angularVelocity, r));
    const vn = dot(vp, c.normal);
    const bias = -BAUMGARTE * (1 / dt) * Math.min(0, c.separation + SLOP);
    // Normal impulse (non-penetration, non-negative accumulation not tracked
    // across iterations for ground contacts; clamp per-iteration result).
    let jn = c.massN * (-vn + bias + -c.restitution * Math.min(vn, 0));
    if (jn < 0) jn = 0;
    const pn = scale(c.normal, jn);
    body.velocity = add(body.velocity, scale(pn, body.invMass));
    body.angularVelocity += body.invInertia * cross(r, pn);

    // Friction impulse.
    const vp2 = add(body.velocity, crossSV(body.angularVelocity, r));
    const vt = dot(vp2, c.tangent);
    let jt = c.massT * -vt;
    const maxFriction = c.friction * jn;
    jt = clamp(jt, -maxFriction, maxFriction);
    const pt = scale(c.tangent, jt);
    body.velocity = add(body.velocity, scale(pt, body.invMass));
    body.angularVelocity += body.invInertia * cross(r, pt);
  }

  /** Centre of mass of all dynamic bodies. */
  centerOfMass(): Vec2 {
    let mx = 0;
    let my = 0;
    let m = 0;
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      mx += body.position.x * body.mass;
      my += body.position.y * body.mass;
      m += body.mass;
    }
    if (m === 0) return v2();
    return { x: mx / m, y: my / m };
  }
}

/** Local contact candidate points for a shape, with an effective radius. */
function contactCandidates(body: Body): { p: Vec2; r: number }[] {
  switch (body.shape) {
    case 'box':
      return [
        { p: { x: -body.halfW, y: -body.halfH }, r: 0 },
        { p: { x: body.halfW, y: -body.halfH }, r: 0 },
        { p: { x: body.halfW, y: body.halfH }, r: 0 },
        { p: { x: -body.halfW, y: body.halfH }, r: 0 },
      ];
    case 'circle':
      return [{ p: { x: 0, y: 0 }, r: body.halfH }];
    case 'capsule':
      return [
        { p: { x: -body.halfW, y: 0 }, r: body.halfH },
        { p: { x: body.halfW, y: 0 }, r: body.halfH },
        { p: { x: 0, y: 0 }, r: body.halfH },
      ];
  }
}
