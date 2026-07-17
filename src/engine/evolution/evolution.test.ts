import { describe, it, expect } from 'vitest';
import { Rng } from '../random/prng';
import { createStarter } from '../builder/starters';
import { validateGenome } from '../genome/validate';
import { CONSTRAINTS } from '../genome/constraints';
import { mutateGenome } from './mutation';
import { crossover } from './crossover';
import {
  tournamentSelect,
  rankPopulation,
  selectElites,
  eliteCount,
} from './selection';
import { MapElitesArchive, DESCRIPTOR_AXES } from './mapelites';
import type { Individual } from './types';
import { DEFAULT_MUTATION } from './types';
import type { BehaviourDescriptors } from '../genome/types';

const emptyDescriptors: BehaviourDescriptors = {
  segmentCount: 3,
  averageSpeed: 1,
  energyEfficiency: 1,
  stability: 0.5,
  bodyLength: 1,
  maxHeight: 0.5,
  dutyCycle: 0.5,
  periodicity: 0.3,
  symmetry: 0.9,
};

describe('mutation', () => {
  it('always yields a valid, bounded genome', () => {
    const ancestor = createStarter('biped', 1);
    const rng = new Rng('mut');
    for (let i = 0; i < 200; i++) {
      const child = mutateGenome(ancestor, DEFAULT_MUTATION, rng, 1);
      expect(validateGenome(child).valid).toBe(true);
      expect(child.segments.length).toBeLessThanOrEqual(CONSTRAINTS.maxSegments);
      for (const s of child.segments) {
        expect(s.halfW).toBeGreaterThanOrEqual(CONSTRAINTS.minHalf - 1e-9);
        expect(s.halfW).toBeLessThanOrEqual(CONSTRAINTS.maxHalf + 1e-9);
      }
      expect(child.parentIds).toContain(ancestor.id);
    }
  });

  it('is deterministic for a fixed rng seed', () => {
    const ancestor = createStarter('worm', 5);
    const a = mutateGenome(ancestor, DEFAULT_MUTATION, new Rng('x'), 2);
    const b = mutateGenome(ancestor, DEFAULT_MUTATION, new Rng('x'), 2);
    expect(a.segments.length).toBe(b.segments.length);
    expect(a.controller.weights).toEqual(b.controller.weights);
    expect(a.controller.frequency).toBe(b.controller.frequency);
  });

  it('add and remove segment operations keep validity', () => {
    const rng = new Rng('struct');
    const cfg = { ...DEFAULT_MUTATION, addSegmentRate: 1, removeSegmentRate: 0 };
    let g = createStarter('minimal', 1);
    for (let i = 0; i < 20; i++) {
      g = mutateGenome(g, cfg, rng, i);
      expect(validateGenome(g).valid).toBe(true);
    }
    const removeCfg = { ...DEFAULT_MUTATION, addSegmentRate: 0, removeSegmentRate: 1 };
    for (let i = 0; i < 20; i++) {
      g = mutateGenome(g, removeCfg, rng, i);
      expect(validateGenome(g).valid).toBe(true);
    }
  });
});

describe('crossover', () => {
  it('produces a valid child from two parents', () => {
    const a = createStarter('biped', 1);
    const b = createStarter('biped', 2);
    const rng = new Rng('cx');
    for (let i = 0; i < 50; i++) {
      const child = crossover(a, b, rng, 1);
      expect(validateGenome(child).valid).toBe(true);
      expect(child.parentIds).toEqual([a.id, b.id]);
    }
  });

  it('falls back gracefully for incompatible topologies', () => {
    const a = createStarter('worm', 1);
    const b = createStarter('star', 1);
    const child = crossover(a, b, new Rng('cx2'), 1);
    expect(validateGenome(child).valid).toBe(true);
  });
});

describe('selection', () => {
  function pop(fitnesses: number[]): Individual[] {
    return fitnesses.map((f) => ({
      genome: createStarter('minimal', f),
      fitness: f,
      evaluated: true,
    }));
  }

  it('ranks by descending fitness', () => {
    const ranked = rankPopulation(pop([1, 5, 3, 2, 4]));
    expect(ranked.map((r) => r.fitness)).toEqual([5, 4, 3, 2, 1]);
  });

  it('elitism preserves the top individuals', () => {
    const ranked = rankPopulation(pop([1, 5, 3, 2, 4]));
    const elites = selectElites(ranked, eliteCount(5, 0.4));
    expect(elites.map((e) => e.fitness)).toEqual([5, 4]);
  });

  it('tournament tends to pick fitter individuals', () => {
    const p = pop([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const rng = new Rng('t');
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += tournamentSelect(p, 4, rng).fitness;
    // Expected value with tournament size 4 is well above the mean (4.5).
    expect(sum / n).toBeGreaterThan(6);
  });
});

describe('MAP-Elites', () => {
  it('keeps the higher-fitness occupant per cell', () => {
    const archive = new MapElitesArchive(DESCRIPTOR_AXES[0], DESCRIPTOR_AXES[1]);
    const g1 = createStarter('minimal', 1);
    const g2 = createStarter('minimal', 2);
    const d = { ...emptyDescriptors };
    expect(archive.consider(g1, 10, d)).toBe(true);
    expect(archive.consider(g2, 5, d)).toBe(false); // same cell, lower fitness
    expect(archive.consider(g2, 20, d)).toBe(true); // same cell, higher fitness
    expect(archive.size).toBe(1);
    const cell = archive.all()[0];
    expect(cell.fitness).toBe(20);
  });

  it('serialises and deserialises', () => {
    const archive = new MapElitesArchive(DESCRIPTOR_AXES[0], DESCRIPTOR_AXES[1]);
    archive.consider(createStarter('minimal', 1), 10, emptyDescriptors);
    const restored = MapElitesArchive.deserialize(archive.serialize());
    expect(restored.size).toBe(1);
    expect(restored.all()[0].fitness).toBe(10);
  });
});
