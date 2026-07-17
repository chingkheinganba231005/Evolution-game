import { describe, it, expect } from 'vitest';
import { createStarter } from './builder/starters';
import { resolveEnvironment, defaultWeights } from './environments/index';
import { evaluate } from './simulate';
import { sampleReplay } from './replay/index';
import { defaultEvolutionConfig } from './evolution/types';
import { runEvolution } from './evolution/algorithm';

const env = resolveEnvironment('running', 'beginner');
const weights = defaultWeights(env);

describe('evaluate', () => {
  it('is deterministic: same genome + seed => identical fitness', () => {
    const g = createStarter('worm', 1);
    const a = evaluate({ genome: g, env, weights, seed: 42, duration: 4 });
    const b = evaluate({ genome: g, env, weights, seed: 42, duration: 4 });
    expect(a.fitness).toBe(b.fitness);
    expect(a.distance).toBe(b.distance);
    expect(a.breakdown.total).toBe(b.breakdown.total);
  });

  it('returns finite fitness and no explosion for all starters', () => {
    for (const id of ['worm', 'biped', 'quadruped', 'hopper', 'star', 'snake'] as const) {
      const g = createStarter(id, 2);
      const r = evaluate({ genome: g, env, weights, seed: 1, duration: 4 });
      expect(Number.isFinite(r.fitness)).toBe(true);
    }
  });

  it('captures a replay that can be sampled', () => {
    const g = createStarter('biped', 1);
    const r = evaluate({ genome: g, env, weights, seed: 1, duration: 3, sampleFps: 30 });
    expect(r.replay).toBeDefined();
    expect(r.replay!.frames.length).toBeGreaterThan(10);
    const pose = sampleReplay(r.replay!, 0, 1.0);
    expect(Number.isFinite(pose.x)).toBe(true);
    expect(Number.isFinite(pose.angle)).toBe(true);
  });
});

describe('evolution', () => {
  it('produces identical summaries for the same seed (reproducible)', () => {
    const ancestor = createStarter('worm', 7);
    const config = defaultEvolutionConfig(7, { kind: 'running', preset: 'beginner' }, weights);
    config.populationSize = 20;
    config.duration = 4;
    const ev = (g: typeof ancestor) => {
      const r = evaluate({ genome: g, env, weights, seed: config.seed, duration: config.duration });
      return { fitness: r.fitness, descriptors: r.descriptors, distance: r.distance, energy: r.energy, stability: r.stability };
    };
    const run1 = runEvolution(ancestor, config, 5, ev);
    const run2 = runEvolution(ancestor, config, 5, ev);
    expect(run1.summaries).toEqual(run2.summaries);
    expect(run1.champion.fitness).toBe(run2.champion.fitness);
  });

  it('genuinely improves fitness over generations (elitism => non-decreasing best)', () => {
    const ancestor = createStarter('worm', 3);
    const config = defaultEvolutionConfig(3, { kind: 'running', preset: 'beginner' }, weights);
    config.populationSize = 30;
    config.duration = 5;
    const ev = (g: typeof ancestor) => {
      const r = evaluate({ genome: g, env, weights, seed: config.seed, duration: config.duration });
      return { fitness: r.fitness, descriptors: r.descriptors, distance: r.distance, energy: r.energy, stability: r.stability };
    };
    const { summaries } = runEvolution(ancestor, config, 10, ev);
    const first = summaries[0].best;
    const last = summaries[summaries.length - 1].best;
    // Best fitness must never decrease (elitism), and should strictly improve.
    for (let i = 1; i < summaries.length; i++) {
      expect(summaries[i].best).toBeGreaterThanOrEqual(summaries[i - 1].best - 1e-9);
    }
    expect(last).toBeGreaterThan(first);
  }, 30_000);
});
