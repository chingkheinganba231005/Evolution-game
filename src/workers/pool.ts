/**
 * Evaluation worker pool with progress reporting, cancellation, crash recovery
 * and a single-thread fallback. Deterministic results are guaranteed because
 * each job carries its own seed and the caller re-associates results by index.
 */

import { evaluate } from '../engine/simulate';
import { resolveEnvironment } from '../engine/environments/index';
import type { EnvKind, PresetId } from '../engine/environments/types';
import type { CreatureGenome } from '../engine/genome/types';
import type { EvalJobRequest, EvalJobResult, WorkerResponse } from './protocol';

export interface EvalTask {
  genome: CreatureGenome;
  seed: number;
  sampleFps?: number;
}

export interface PoolConfig {
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  duration: number;
  workerCount: number;
}

export interface PoolStats {
  completed: number;
  total: number;
  evalsPerSecond: number;
  workerCount: number;
  usingWorkers: boolean;
}

function canUseWorkers(): boolean {
  // A standalone single-file build has no separate worker asset to load.
  if (import.meta.env?.VITE_FORCE_SINGLE_THREAD === '1') return false;
  return typeof Worker !== 'undefined';
}

/** Suggested worker count reserving a core for the UI. */
export function suggestedWorkerCount(): number {
  const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(8, hc - 1));
}

interface PendingJob {
  index: number;
  task: EvalTask;
  resolve: (r: EvalJobResult) => void;
}

export class EvaluationPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: PendingJob[] = [];
  private inFlight = new Map<number, { worker: Worker; job: PendingJob }>();
  private jobCounter = 0;
  private cancelled = false;
  private readonly useWorkers: boolean;

  constructor(private config: PoolConfig) {
    this.useWorkers = canUseWorkers() && config.workerCount > 0;
    if (this.useWorkers) {
      for (let i = 0; i < config.workerCount; i++) {
        this.spawnWorker();
      }
    }
  }

  get usingWorkers(): boolean {
    return this.useWorkers;
  }

  get activeWorkers(): number {
    return this.workers.length;
  }

  private spawnWorker(): void {
    try {
      const worker = new Worker(new URL('./evaluation.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(worker, e.data);
      worker.onerror = () => this.onWorkerCrash(worker);
      this.workers.push(worker);
      this.idle.push(worker);
    } catch {
      // Worker construction failed; fallback path will handle jobs.
    }
  }

  private onWorkerCrash(worker: Worker): void {
    // Requeue any in-flight job on this worker and replace it.
    for (const [jobId, entry] of this.inFlight) {
      if (entry.worker === worker) {
        this.inFlight.delete(jobId);
        this.queue.unshift(entry.job);
      }
    }
    this.workers = this.workers.filter((w) => w !== worker);
    this.idle = this.idle.filter((w) => w !== worker);
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    if (!this.cancelled && this.workers.length < this.config.workerCount) {
      this.spawnWorker();
      this.pump();
    }
  }

  private onMessage(worker: Worker, msg: WorkerResponse): void {
    if (msg.type === 'ready') return;
    if (msg.type === 'result' || msg.type === 'error') {
      const entry = this.inFlight.get(msg.jobId);
      if (!entry) return;
      this.inFlight.delete(msg.jobId);
      this.idle.push(worker);
      if (msg.type === 'result') {
        entry.job.resolve(msg.result);
      } else {
        entry.job.resolve(failedResult(msg.message));
      }
      this.pump();
    }
  }

  private pump(): void {
    if (this.cancelled) return;
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      const jobId = this.jobCounter++;
      this.inFlight.set(jobId, { worker, job });
      const req: EvalJobRequest = {
        type: 'evaluate',
        jobId,
        genome: job.task.genome,
        env: this.config.env,
        weights: this.config.weights,
        seed: job.task.seed,
        duration: this.config.duration,
        sampleFps: job.task.sampleFps ?? 0,
      };
      worker.postMessage(req);
    }
  }

  /** Evaluate a batch of tasks, preserving input order. */
  async evaluateBatch(
    tasks: EvalTask[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<EvalJobResult[]> {
    this.cancelled = false;
    const results = new Array<EvalJobResult>(tasks.length);
    let completed = 0;

    if (!this.useWorkers || this.workers.length === 0) {
      // Single-thread fallback: evaluate synchronously, yielding periodically.
      for (let i = 0; i < tasks.length; i++) {
        if (this.cancelled) break;
        results[i] = this.evaluateInline(tasks[i]);
        completed++;
        onProgress?.(completed, tasks.length);
        if (i % 4 === 0) await Promise.resolve();
      }
      return results;
    }

    await new Promise<void>((resolve) => {
      for (let i = 0; i < tasks.length; i++) {
        const index = i;
        this.queue.push({
          index,
          task: tasks[i],
          resolve: (r) => {
            results[index] = r;
            completed++;
            onProgress?.(completed, tasks.length);
            if (completed === tasks.length || this.cancelled) resolve();
          },
        });
      }
      this.pump();
      if (tasks.length === 0) resolve();
    });

    return results;
  }

  private evaluateInline(task: EvalTask): EvalJobResult {
    try {
      const env = resolveEnvironment(this.config.env.kind, this.config.env.preset);
      const r = evaluate({
        genome: task.genome,
        env,
        weights: this.config.weights,
        seed: task.seed,
        duration: this.config.duration,
        sampleFps: task.sampleFps ?? 0,
      });
      return {
        fitness: r.fitness,
        descriptors: r.descriptors,
        distance: r.distance,
        energy: r.energy,
        stability: r.stability,
        maxHeight: r.maxHeight,
        failure: r.failure,
        replay: r.replay,
      };
    } catch (err) {
      return failedResult(err instanceof Error ? err.message : String(err));
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.queue = [];
  }

  updateConfig(config: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  dispose(): void {
    this.cancel();
    for (const w of this.workers) {
      try {
        w.terminate();
      } catch {
        /* ignore */
      }
    }
    this.workers = [];
    this.idle = [];
  }
}

function failedResult(message: string): EvalJobResult {
  return {
    fitness: -1000,
    descriptors: {
      segmentCount: 0,
      averageSpeed: 0,
      energyEfficiency: 0,
      stability: 0,
      bodyLength: 0,
      maxHeight: 0,
      dutyCycle: 0,
      periodicity: 0,
      symmetry: 0,
    },
    distance: 0,
    energy: 0,
    stability: 0,
    maxHeight: 0,
    failure: message,
  };
}
