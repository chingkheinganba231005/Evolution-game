import { describe, it, expect } from 'vitest';
import { ENVIRONMENTS, resolveEnvironment, defaultWeights } from './index';
import type { EnvKind, PresetId } from './types';
import { createStarter } from '../builder/starters';
import { evaluate } from '../simulate';
import { binIndex, DESCRIPTOR_AXES } from '../evolution/mapelites';

const PRESETS: PresetId[] = ['beginner', 'standard', 'extreme'];

describe('environments', () => {
  it('resolves valid configuration for every kind and preset', () => {
    for (const meta of ENVIRONMENTS) {
      for (const preset of PRESETS) {
        const env = resolveEnvironment(meta.kind as EnvKind, preset);
        expect(env.components.length).toBeGreaterThan(0);
        expect(env.duration).toBeGreaterThan(0);
        expect(env.finishX).toBeGreaterThan(env.spawnX);
        expect(Object.keys(defaultWeights(env)).length).toBe(env.components.length);
      }
    }
  });

  it('produces finite, non-exploding fitness for starters in each environment', () => {
    for (const meta of ENVIRONMENTS) {
      const env = resolveEnvironment(meta.kind as EnvKind, 'standard');
      const weights = defaultWeights(env);
      for (const id of ['worm', 'biped', 'hopper'] as const) {
        const r = evaluate({ genome: createStarter(id, 1), env, weights, seed: 1, duration: 3 });
        expect(Number.isFinite(r.fitness), `${meta.kind}/${id}`).toBe(true);
        expect(Number.isFinite(r.descriptors.averageSpeed)).toBe(true);
      }
    }
  });

  it('is deterministic per environment', () => {
    const env = resolveEnvironment('lowgrav', 'standard');
    const weights = defaultWeights(env);
    const g = createStarter('quadruped', 5);
    const a = evaluate({ genome: g, env, weights, seed: 2, duration: 4 });
    const b = evaluate({ genome: g, env, weights, seed: 2, duration: 4 });
    expect(a.fitness).toBe(b.fitness);
  });
});

describe('descriptor binning', () => {
  it('clamps values into the grid range', () => {
    const axis = DESCRIPTOR_AXES[3]; // stability 0..1, 12 bins
    expect(binIndex(axis, -5)).toBe(0);
    expect(binIndex(axis, 5)).toBe(axis.bins - 1);
    expect(binIndex(axis, 0.5)).toBeGreaterThanOrEqual(0);
    expect(binIndex(axis, 0.5)).toBeLessThan(axis.bins);
  });
});
