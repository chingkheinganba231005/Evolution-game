/**
 * Evolvable creature controllers.
 *
 * Two types are supported:
 *  - `cpg`: a Central Pattern Generator. Each joint output is a sine wave with a
 *    global frequency, per-joint amplitude and per-joint phase offset. Produces
 *    understandable rhythmic gaits and is a strong baseline.
 *  - `mlp`: a tiny feed-forward neural network with an optional recurrent hidden
 *    state, tanh activations, normalised inputs and clamped outputs. Implemented
 *    directly (no ML framework) and allocation-free in the hot path.
 */

import type { ControllerGenome, CreatureGenome } from '../genome/types';

export const BASE_INPUTS = 6;

export interface ControllerDims {
  inputCount: number;
  outputCount: number;
}

/** Number of ground-contact sensors declared by the morphology. */
export function sensorCount(genome: CreatureGenome): number {
  let n = 0;
  for (const s of genome.segments) if (s.groundSensor) n++;
  return n;
}

/** Canonical controller input/output dimensions implied by a morphology. */
export function controllerDims(genome: CreatureGenome): ControllerDims {
  const joints = genome.joints.length;
  return {
    outputCount: joints,
    inputCount: BASE_INPUTS + 2 * joints + sensorCount(genome),
  };
}

/** Layer sizes for the MLP, folding recurrent state into I/O. */
export function mlpLayerSizes(c: ControllerGenome): number[] {
  const effIn = c.inputCount + c.recurrentSize;
  const effOut = c.outputCount + c.recurrentSize;
  return [effIn, ...c.hidden, effOut];
}

/** Expected flat weight / bias lengths for an MLP controller. */
export function mlpParamCounts(c: ControllerGenome): { weights: number; biases: number } {
  const sizes = mlpLayerSizes(c);
  let w = 0;
  let b = 0;
  for (let i = 0; i < sizes.length - 1; i++) {
    w += sizes[i] * sizes[i + 1];
    b += sizes[i + 1];
  }
  return { weights: w, biases: b };
}

function tanh(x: number): number {
  // Guard against overflow producing NaN.
  if (x > 20) return 1;
  if (x < -20) return -1;
  return Math.tanh(x);
}

export interface ControllerRuntime {
  /** Evaluate outputs for the given normalised inputs at time t (seconds). */
  step(inputs: number[], t: number): number[];
  reset(): void;
}

class CpgController implements ControllerRuntime {
  private readonly out: number[];
  constructor(
    private readonly gene: ControllerGenome,
    private readonly phases: number[],
  ) {
    this.out = new Array<number>(gene.outputCount).fill(0);
  }
  reset(): void {
    this.out.fill(0);
  }
  step(inputs: number[], t: number): number[] {
    const g = this.gene;
    const twoPiF = 2 * Math.PI * g.frequency;
    for (let i = 0; i < g.outputCount; i++) {
      const amp = g.amplitudes[i] ?? 1;
      const phase = this.phases[i] ?? 0;
      // Light sensory modulation from the main-body angle input (inputs[0]=sin).
      const mod = 1 + 0.15 * (inputs[0] ?? 0);
      this.out[i] = clampUnit(Math.sin(twoPiF * t + phase) * amp * mod * g.outputScale);
    }
    return this.out;
  }
}

class MlpController implements ControllerRuntime {
  private readonly sizes: number[];
  private readonly out: number[];
  private hidden: number[];
  private readonly buffers: number[][];
  constructor(private readonly gene: ControllerGenome) {
    this.sizes = mlpLayerSizes(gene);
    this.out = new Array<number>(gene.outputCount).fill(0);
    this.hidden = new Array<number>(gene.recurrentSize).fill(0);
    this.buffers = this.sizes.map((n) => new Array<number>(n).fill(0));
  }
  reset(): void {
    this.hidden.fill(0);
    this.out.fill(0);
  }
  step(inputs: number[], _t: number): number[] {
    const g = this.gene;
    const input = this.buffers[0];
    for (let i = 0; i < g.inputCount; i++) input[i] = inputs[i] ?? 0;
    for (let i = 0; i < g.recurrentSize; i++) input[g.inputCount + i] = this.hidden[i];

    let wOff = 0;
    let bOff = 0;
    for (let layer = 0; layer < this.sizes.length - 1; layer++) {
      const inN = this.sizes[layer];
      const outN = this.sizes[layer + 1];
      const src = this.buffers[layer];
      const dst = this.buffers[layer + 1];
      const isLast = layer === this.sizes.length - 2;
      for (let o = 0; o < outN; o++) {
        let sum = g.biases[bOff + o] ?? 0;
        const base = wOff + o * inN;
        for (let k = 0; k < inN; k++) {
          sum += (g.weights[base + k] ?? 0) * src[k];
        }
        dst[o] = tanh(sum);
      }
      wOff += inN * outN;
      bOff += outN;
      if (isLast) {
        for (let o = 0; o < g.outputCount; o++) {
          this.out[o] = clampUnit(dst[o] * g.outputScale);
        }
        for (let r = 0; r < g.recurrentSize; r++) {
          this.hidden[r] = dst[g.outputCount + r];
        }
      }
    }
    return this.out;
  }
}

function clampUnit(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < -1 ? -1 : x > 1 ? 1 : x;
}

/** Build a runtime controller from a genome. */
export function buildController(genome: CreatureGenome): ControllerRuntime {
  const c = genome.controller;
  if (c.type === 'cpg') {
    const phases = genome.joints.map((j) => j.phaseOffset);
    return new CpgController(c, phases);
  }
  return new MlpController(c);
}
