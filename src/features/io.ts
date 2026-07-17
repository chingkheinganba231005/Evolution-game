/** Import / export of creatures and experiments (validated, local-first). */

import { serializeCreature, parseCreatureFile, GenomeParseError } from '../engine/genome/serialize';
import { validateGenome } from '../engine/genome/validate';
import type { CreatureGenome } from '../engine/genome/types';
import type { GenerationSummary } from '../engine/evolution/types';
import type { EnvKind, PresetId } from '../engine/environments/types';
import type { ReplayData } from '../engine/replay/index';

export interface ExperimentFile {
  kind: 'evolution';
  version: number;
  name: string;
  seed: number;
  env: { kind: EnvKind; preset: PresetId };
  weights: Record<string, number>;
  ancestor: CreatureGenome;
  summaries: GenerationSummary[];
  champion: CreatureGenome | null;
  championReplay?: ReplayData | null;
}

export function download(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCreature(genome: CreatureGenome): void {
  const safeName = genome.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'creature';
  download(`${safeName}.creature.json`, serializeCreature(genome));
}

export function exportExperiment(exp: ExperimentFile, includeReplay: boolean): void {
  const payload = { ...exp };
  if (!includeReplay) payload.championReplay = null;
  const safeName = exp.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'experiment';
  download(`${safeName}.evolution.json`, payload);
}

export async function readFileText(file: File): Promise<string> {
  if (file.size > 20_000_000) throw new GenomeParseError('File is too large (max 20MB).');
  return await file.text();
}

export function importCreature(text: string): CreatureGenome {
  return parseCreatureFile(text);
}

export function importExperiment(text: string): ExperimentFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GenomeParseError('File is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) throw new GenomeParseError('Malformed experiment file.');
  const obj = data as Record<string, unknown>;
  if (obj.kind !== 'evolution') throw new GenomeParseError('Not an experiment (.evolution.json) file.');
  if (!obj.ancestor) throw new GenomeParseError('Experiment is missing an ancestor genome.');
  // Re-parse the ancestor through the creature validator/migrator.
  const ancestor = parseCreatureFile(JSON.stringify({ kind: 'creature', genome: obj.ancestor }));
  const valid = validateGenome(ancestor);
  if (!valid.valid) throw new GenomeParseError('Ancestor genome is invalid.');
  const champion =
    obj.champion && typeof obj.champion === 'object'
      ? parseCreatureFile(JSON.stringify({ kind: 'creature', genome: obj.champion }))
      : null;
  return {
    kind: 'evolution',
    version: typeof obj.version === 'number' ? obj.version : 1,
    name: typeof obj.name === 'string' ? obj.name : 'Imported experiment',
    seed: typeof obj.seed === 'number' ? obj.seed : 1,
    env: (obj.env as ExperimentFile['env']) ?? { kind: 'running', preset: 'beginner' },
    weights: (obj.weights as Record<string, number>) ?? {},
    ancestor,
    summaries: Array.isArray(obj.summaries) ? (obj.summaries as GenerationSummary[]) : [],
    champion,
    championReplay: (obj.championReplay as ReplayData) ?? null,
  };
}
