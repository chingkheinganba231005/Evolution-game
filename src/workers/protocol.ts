/** Typed message protocol between the UI and evaluation workers. */

import type { CreatureGenome, BehaviourDescriptors } from '../engine/genome/types';
import type { EnvKind, PresetId } from '../engine/environments/types';

export interface EvalJobRequest {
  type: 'evaluate';
  jobId: number;
  genome: CreatureGenome;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  seed: number;
  duration: number;
  /** Replay sample rate; 0 = no replay (population evaluation). */
  sampleFps: number;
}

export interface InitRequest {
  type: 'init';
}

export type WorkerRequest = EvalJobRequest | InitRequest;

export interface EvalJobResult {
  fitness: number;
  descriptors: BehaviourDescriptors;
  distance: number;
  energy: number;
  stability: number;
  maxHeight: number;
  failure: string | null;
  /** Present only when sampleFps > 0. */
  replay?: unknown;
}

export interface ResultMessage {
  type: 'result';
  jobId: number;
  result: EvalJobResult;
}

export interface ReadyMessage {
  type: 'ready';
}

export interface ErrorMessage {
  type: 'error';
  jobId: number;
  message: string;
}

export type WorkerResponse = ResultMessage | ReadyMessage | ErrorMessage;
