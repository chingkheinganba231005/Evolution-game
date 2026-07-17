/** Arena competitor roster (shared between Gallery and Arena). */

import { create } from 'zustand';
import type { CreatureGenome } from '../engine/genome/types';
import type { EnvKind, PresetId } from '../engine/environments/types';
import { cloneGenome } from '../engine/genome/serialize';

export interface Competitor {
  id: string;
  name: string;
  hue: number;
  genome: CreatureGenome;
}

interface ArenaState {
  competitors: Competitor[];
  env: { kind: EnvKind; preset: PresetId };
  add(genome: CreatureGenome, name?: string): void;
  remove(id: string): void;
  clear(): void;
  setEnv(kind: EnvKind, preset: PresetId): void;
}

const HUES = [170, 30, 260, 340, 95, 200, 50, 300];

export const useArenaStore = create<ArenaState>((set, get) => ({
  competitors: [],
  env: { kind: 'running', preset: 'standard' },
  add: (genome, name) => {
    if (get().competitors.length >= 8) return;
    const hue = HUES[get().competitors.length % HUES.length];
    set((s) => ({
      competitors: [
        ...s.competitors,
        {
          id: `cmp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
          name: name ?? genome.name,
          hue,
          genome: cloneGenome(genome),
        },
      ],
    }));
  },
  remove: (id) => set((s) => ({ competitors: s.competitors.filter((c) => c.id !== id) })),
  clear: () => set({ competitors: [] }),
  setEnv: (kind, preset) => set({ env: { kind, preset } }),
}));
