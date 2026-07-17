/** Real-time single-creature simulation for the viewport (main thread). */

import { buildController, type ControllerRuntime } from './controllers';
import { observe, actuate } from './creature-runtime';
import { buildCreature, type CreatureInstance } from './physics/creature';
import { World } from './physics/world';
import type { CreatureGenome } from './genome/types';
import type { ResolvedEnvironment } from './environments/types';

const DT = 1 / 120;

export interface BodySnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
  shape: 'box' | 'circle' | 'capsule';
  halfW: number;
  halfH: number;
  hue: number;
  contact: boolean;
  vx: number;
  vy: number;
}

export class LiveSim {
  readonly world: World;
  readonly creature: CreatureInstance;
  private controller: ControllerRuntime;
  private inputs: number[];
  private speedLimits: number[];
  private accumulator = 0;
  time = 0;
  finished = false;

  constructor(
    readonly genome: CreatureGenome,
    readonly env: ResolvedEnvironment,
  ) {
    this.world = new World({ gravity: env.gravity, terrain: env.terrain, water: env.water });
    this.creature = buildCreature(this.world, genome, {
      x: env.spawnX,
      clearance: env.spawnClearance,
    });
    this.controller = buildController(genome);
    this.controller.reset();
    this.inputs = new Array<number>(genome.controller.inputCount).fill(0);
    this.speedLimits = genome.joints.map((j) => j.motorSpeedLimit);
  }

  /** Advance by real elapsed seconds using a fixed-step accumulator. */
  advance(realDt: number, speed: number): void {
    if (this.world.exploded) return;
    this.accumulator += realDt * speed;
    // Cap accumulated steps to avoid spiral-of-death on slow frames.
    const maxSteps = 40;
    let steps = 0;
    while (this.accumulator >= DT && steps < maxSteps) {
      this.fixedStep();
      this.accumulator -= DT;
      steps++;
    }
    if (steps === maxSteps) this.accumulator = 0;
  }

  /** Advance exactly one fixed timestep. */
  stepOnce(): void {
    if (this.world.exploded) return;
    this.fixedStep();
  }

  private fixedStep(): void {
    observe(this.creature, this.inputs);
    const outputs = this.controller.step(this.inputs, this.time);
    actuate(this.creature, outputs, this.speedLimits);
    this.world.step(DT);
    this.time += DT;
    const com = this.world.centerOfMass();
    if (!this.finished && com.x >= this.env.finishX) this.finished = true;
  }

  reset(): void {
    // Rebuild is cheapest and most correct for determinism.
  }

  snapshot(): BodySnapshot[] {
    const out: BodySnapshot[] = [];
    for (const seg of this.genome.segments) {
      const body = this.creature.bodies.get(seg.id);
      if (!body) continue;
      out.push({
        id: seg.id,
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
        shape: seg.shape,
        halfW: seg.halfW,
        halfH: seg.halfH,
        hue: seg.hue,
        contact: body.contactCount > 0,
        vx: body.velocity.x,
        vy: body.velocity.y,
      });
    }
    return out;
  }

  centerOfMass(): { x: number; y: number } {
    return this.world.centerOfMass();
  }
}
