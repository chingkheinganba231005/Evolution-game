import { describe, it, expect } from 'vitest';
import { createStarter } from '../builder/starters';
import { validateGenome, repairGenome, ensureValid } from './validate';
import { parseCreatureFile, serializeCreature, migrateGenome, cloneGenome } from './serialize';
import { controllerDims, mlpParamCounts } from '../controllers';
import { CONSTRAINTS } from './constraints';

describe('genome validation', () => {
  it('all starters are valid', () => {
    for (const id of ['worm', 'biped', 'quadruped', 'hopper', 'star', 'snake', 'minimal'] as const) {
      const g = createStarter(id, 1);
      const res = validateGenome(g);
      expect(res.valid, `${id}: ${res.issues.map((i) => i.message).join(', ')}`).toBe(true);
    }
  });

  it('random starters are valid across seeds', () => {
    for (let s = 0; s < 25; s++) {
      const g = createStarter('random', s);
      expect(validateGenome(g).valid).toBe(true);
    }
  });

  it('detects disconnected islands', () => {
    const g = createStarter('quadruped', 1);
    g.segments[2].parentId = 'does-not-exist';
    expect(validateGenome(g).valid).toBe(false);
  });

  it('repairs an over-sized genome down to the segment cap', () => {
    const g = createStarter('snake', 1);
    // Force too many segments by duplicating.
    while (g.segments.length <= CONSTRAINTS.maxSegments + 3) {
      const last = g.segments[g.segments.length - 1];
      g.segments.push({ ...last, id: `x${g.segments.length}`, parentId: last.id });
    }
    const repaired = repairGenome(g, 1);
    expect(repaired).not.toBeNull();
    expect(repaired!.segments.length).toBeLessThanOrEqual(CONSTRAINTS.maxSegments);
    expect(validateGenome(repaired!).valid).toBe(true);
  });

  it('controller weight sizes match architecture', () => {
    const g = createStarter('random', 4);
    if (g.controller.type === 'mlp') {
      const counts = mlpParamCounts(g.controller);
      expect(g.controller.weights.length).toBe(counts.weights);
      expect(g.controller.biases.length).toBe(counts.biases);
    }
    const dims = controllerDims(g);
    expect(g.controller.outputCount).toBe(dims.outputCount);
    expect(g.controller.inputCount).toBe(dims.inputCount);
  });
});

describe('serialisation & migration', () => {
  it('round-trips a genome through the file format', () => {
    const g = createStarter('biped', 3);
    const file = serializeCreature(g);
    const text = JSON.stringify(file);
    const parsed = parseCreatureFile(text);
    expect(parsed.segments.length).toBe(g.segments.length);
    expect(parsed.joints.length).toBe(g.joints.length);
    expect(parsed.controller.type).toBe(g.controller.type);
  });

  it('migrates a v1 genome by filling defaults', () => {
    const g = cloneGenome(createStarter('worm', 1));
    const v1 = JSON.parse(JSON.stringify(g)) as Record<string, unknown>;
    v1.version = 1;
    for (const s of v1.segments as Record<string, unknown>[]) {
      delete s.groundSensor;
    }
    const migrated = migrateGenome(v1);
    expect(migrated.version).toBeGreaterThanOrEqual(2);
    for (const s of migrated.segments) expect(typeof s.groundSensor).toBe('boolean');
  });

  it('rejects malformed imports safely', () => {
    expect(() => parseCreatureFile('not json')).toThrow();
    expect(() => parseCreatureFile('{}')).toThrow();
    expect(() => parseCreatureFile(JSON.stringify({ kind: 'creature', genome: { segments: [] } }))).toThrow();
  });

  it('ensureValid returns a usable genome', () => {
    const g = createStarter('star', 2);
    const ok = ensureValid(g, 2);
    expect(ok).not.toBeNull();
  });
});
