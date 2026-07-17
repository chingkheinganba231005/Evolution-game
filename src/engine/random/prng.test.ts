import { describe, it, expect } from 'vitest';
import { Rng, hashSeed } from './prng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng('hello');
    const b = new Rng('hello');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng('seed-a');
    const b = new Rng('seed-b');
    expect(a.next()).not.toEqual(b.next());
  });

  it('numeric and string seeds hash consistently', () => {
    expect(hashSeed(42)).toEqual(hashSeed('42'));
  });

  it('produces values in [0,1)', () => {
    const r = new Rng(123);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int and intRange respect bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      expect(r.int(5)).toBeGreaterThanOrEqual(0);
      expect(r.int(5)).toBeLessThan(5);
      const v = r.intRange(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('gaussian has roughly zero mean and unit variance', () => {
    const r = new Rng('gauss');
    let sum = 0;
    let sumSq = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const g = r.gaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });

  it('shuffle is a permutation and deterministic', () => {
    const base = Array.from({ length: 30 }, (_, i) => i);
    const a = new Rng('shuf').shuffle(base.slice());
    const b = new Rng('shuf').shuffle(base.slice());
    expect(a).toEqual(b);
    expect(a.slice().sort((x, y) => x - y)).toEqual(base);
  });
});
