/** Genome serialisation, deserialisation and version migration. */

import { GENOME_VERSION, type CreatureGenome } from './types';
import { repairGenome } from './validate';

export interface SerializedCreatureFile {
  kind: 'creature';
  version: number;
  genome: CreatureGenome;
}

/** Serialise a single creature to a `.creature.json` payload. */
export function serializeCreature(genome: CreatureGenome): SerializedCreatureFile {
  return { kind: 'creature', version: GENOME_VERSION, genome };
}

/** Migrate a genome object of any known past version to the current schema. */
export function migrateGenome(raw: unknown): CreatureGenome {
  if (typeof raw !== 'object' || raw === null) {
    throw new GenomeParseError('Genome is not an object.');
  }
  const obj = raw as Record<string, unknown>;
  let version = typeof obj.version === 'number' ? obj.version : 1;

  const g = obj as unknown as CreatureGenome;

  // v1 -> v2: introduce ground sensors, controller recurrentSize/outputScale.
  if (version < 2) {
    for (const s of g.segments ?? []) {
      if (typeof s.groundSensor !== 'boolean') s.groundSensor = false;
      if (typeof s.restitution !== 'number') s.restitution = 0.05;
    }
    if (g.controller) {
      if (typeof g.controller.recurrentSize !== 'number') g.controller.recurrentSize = 0;
      if (typeof g.controller.outputScale !== 'number') g.controller.outputScale = 1;
      if (!Array.isArray(g.controller.amplitudes)) g.controller.amplitudes = [];
      if (!Array.isArray(g.controller.hidden)) g.controller.hidden = [];
    }
    version = 2;
  }

  g.version = GENOME_VERSION;
  if (!Array.isArray(g.parentIds)) g.parentIds = [];
  if (!Array.isArray(g.mutationHistory)) g.mutationHistory = [];
  if (typeof g.metadata !== 'object' || g.metadata === null) g.metadata = {};
  if (typeof g.createdAt !== 'number') g.createdAt = Date.now();
  if (typeof g.generation !== 'number') g.generation = 0;
  return g;
}

export class GenomeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenomeParseError';
  }
}

/**
 * Parse a `.creature.json` file. Validates structure, migrates old versions and
 * repairs the genome. Never executes imported content; only reads data.
 */
export function parseCreatureFile(text: string): CreatureGenome {
  if (text.length > 5_000_000) {
    throw new GenomeParseError('File is too large.');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GenomeParseError('File is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new GenomeParseError('File is empty or malformed.');
  }
  const obj = data as Record<string, unknown>;
  const genomeRaw = obj.kind === 'creature' && obj.genome ? obj.genome : obj;
  const migrated = migrateGenome(genomeRaw);

  if (!Array.isArray(migrated.segments) || migrated.segments.length === 0) {
    throw new GenomeParseError('Genome has no body segments.');
  }
  const repaired = repairGenome(migrated, migrated.randomSeed ?? 1);
  if (!repaired) {
    throw new GenomeParseError('Genome could not be repaired into a valid creature.');
  }
  return repaired;
}

/** Deep clone a genome via the serialisation round trip. */
export function cloneGenome(genome: CreatureGenome): CreatureGenome {
  return JSON.parse(JSON.stringify(genome)) as CreatureGenome;
}
