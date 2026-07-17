/** Hall of Fame helpers. */

import { saveHofEntry } from '../../db/index';
import type { HallOfFameEntry, HofCategory } from '../../db/types';
import type { CreatureGenome } from '../../engine/genome/types';
import type { EnvKind, PresetId } from '../../engine/environments/types';
import type { ReplayData } from '../../engine/replay/index';
import { cloneGenome } from '../../engine/genome/serialize';

export async function addToHallOfFame(params: {
  genome: CreatureGenome;
  fitness: number;
  distance: number;
  env: { kind: EnvKind; preset: PresetId };
  category: HofCategory;
  replay: ReplayData | null;
  name?: string;
}): Promise<HallOfFameEntry> {
  const entry: HallOfFameEntry = {
    id: `hof_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: params.name ?? params.genome.name,
    notes: '',
    category: params.category,
    genome: cloneGenome(params.genome),
    fitness: params.fitness,
    distance: params.distance,
    env: params.env,
    createdAt: Date.now(),
    replay: params.replay,
  };
  await saveHofEntry(entry);
  return entry;
}

export const HOF_CATEGORIES: { id: HofCategory; label: string }[] = [
  { id: 'highest', label: 'Highest fitness' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'efficient', label: 'Most efficient' },
  { id: 'stable', label: 'Most stable' },
  { id: 'simplest', label: 'Simplest' },
  { id: 'strangest', label: 'Strangest' },
  { id: 'favourite', label: 'Favourite' },
];
