/// <reference lib="webworker" />
/** Evaluation worker: runs a genome in an environment and returns fitness. */

import { evaluate } from '../engine/simulate';
import { resolveEnvironment } from '../engine/environments/index';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>): void => {
  const msg = e.data;
  if (msg.type === 'init') {
    post({ type: 'ready' });
    return;
  }
  if (msg.type === 'evaluate') {
    try {
      const env = resolveEnvironment(msg.env.kind, msg.env.preset);
      const r = evaluate({
        genome: msg.genome,
        env,
        weights: msg.weights,
        seed: msg.seed,
        duration: msg.duration,
        sampleFps: msg.sampleFps,
      });
      post({
        type: 'result',
        jobId: msg.jobId,
        result: {
          fitness: r.fitness,
          descriptors: r.descriptors,
          distance: r.distance,
          energy: r.energy,
          stability: r.stability,
          maxHeight: r.maxHeight,
          failure: r.failure,
          replay: r.replay,
        },
      });
    } catch (err) {
      post({
        type: 'error',
        jobId: msg.jobId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

post({ type: 'ready' });
