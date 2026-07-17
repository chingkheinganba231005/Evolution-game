/**
 * Deterministic seeded pseudo-random number generator.
 *
 * Uses a SplitMix32 hash to expand a seed into state, then a mulberry32
 * generator for the stream. Deterministic across platforms because it relies
 * only on 32-bit integer arithmetic (via Math.imul / >>> 0) and IEEE-754
 * division — no platform-dependent Math.random.
 */

/** Hash an arbitrary string or number into a 32-bit unsigned seed. */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') {
    // Normalise numeric seeds through the string hasher for consistency.
    return hashSeed(String(seed >>> 0 === seed ? seed : Math.trunc(seed)));
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Final avalanche (splitmix32 finalizer).
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad);
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}

export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed: string | number) {
    this.seed = hashSeed(seed);
    this.state = this.seed || 1;
  }

  /** Raw next 32-bit unsigned integer (mulberry32). */
  nextUint(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextUint() / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Integer in [min, max] inclusive. */
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Standard normal (Box–Muller); mean 0, std 1. */
  gaussian(): number {
    // Avoid log(0).
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /** Gaussian with mean and standard deviation. */
  normal(mean: number, std: number): number {
    return mean + this.gaussian() * std;
  }

  /** Pick a uniformly random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** In-place Fisher–Yates shuffle. Returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Derive an independent child generator (stable given call order). */
  fork(salt: number | string = ''): Rng {
    return new Rng(`${this.seed}:${salt}:${this.nextUint()}`);
  }
}
