/** Dexie (IndexedDB) persistence with a graceful in-memory fallback. */

import Dexie, { type Table } from 'dexie';
import type { AppSettings, HallOfFameEntry, StoredExperiment } from './types';
import { DEFAULT_SETTINGS } from './types';

class LabDatabase extends Dexie {
  experiments!: Table<StoredExperiment, string>;
  hallOfFame!: Table<HallOfFameEntry, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('creature-evolution-lab');
    this.version(1).stores({
      experiments: 'id, name, updatedAt',
      hallOfFame: 'id, category, fitness, createdAt',
      settings: 'id',
    });
  }
}

let db: LabDatabase | null = null;
let dbAvailable = true;

function getDb(): LabDatabase | null {
  if (!dbAvailable) return null;
  if (db) return db;
  try {
    db = new LabDatabase();
    return db;
  } catch {
    dbAvailable = false;
    return null;
  }
}

// In-memory fallback stores (used if IndexedDB is unavailable).
const memExperiments = new Map<string, StoredExperiment>();
const memHof = new Map<string, HallOfFameEntry>();
let memSettings: AppSettings = { ...DEFAULT_SETTINGS };

export async function isPersistent(): Promise<boolean> {
  return getDb() !== null;
}

export async function saveExperiment(exp: StoredExperiment): Promise<void> {
  const d = getDb();
  if (!d) {
    memExperiments.set(exp.id, exp);
    return;
  }
  try {
    await d.experiments.put(exp);
  } catch {
    memExperiments.set(exp.id, exp);
  }
}

export async function listExperiments(): Promise<StoredExperiment[]> {
  const d = getDb();
  if (!d) return [...memExperiments.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    return await d.experiments.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [...memExperiments.values()];
  }
}

export async function getExperiment(id: string): Promise<StoredExperiment | undefined> {
  const d = getDb();
  if (!d) return memExperiments.get(id);
  try {
    return await d.experiments.get(id);
  } catch {
    return memExperiments.get(id);
  }
}

export async function deleteExperiment(id: string): Promise<void> {
  const d = getDb();
  if (!d) {
    memExperiments.delete(id);
    return;
  }
  try {
    await d.experiments.delete(id);
  } catch {
    memExperiments.delete(id);
  }
}

export async function saveHofEntry(entry: HallOfFameEntry): Promise<void> {
  const d = getDb();
  if (!d) {
    memHof.set(entry.id, entry);
    return;
  }
  try {
    await d.hallOfFame.put(entry);
  } catch {
    memHof.set(entry.id, entry);
  }
}

export async function listHof(): Promise<HallOfFameEntry[]> {
  const d = getDb();
  if (!d) return [...memHof.values()].sort((a, b) => b.createdAt - a.createdAt);
  try {
    return await d.hallOfFame.orderBy('createdAt').reverse().toArray();
  } catch {
    return [...memHof.values()];
  }
}

export async function deleteHofEntry(id: string): Promise<void> {
  const d = getDb();
  if (!d) {
    memHof.delete(id);
    return;
  }
  try {
    await d.hallOfFame.delete(id);
  } catch {
    memHof.delete(id);
  }
}

export async function getSettings(): Promise<AppSettings> {
  const d = getDb();
  if (!d) return memSettings;
  try {
    const s = await d.settings.get('app');
    return s ?? DEFAULT_SETTINGS;
  } catch {
    return memSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  memSettings = settings;
  const d = getDb();
  if (!d) return;
  try {
    await d.settings.put(settings);
  } catch {
    /* fallback already updated */
  }
}

export async function clearAllData(): Promise<void> {
  memExperiments.clear();
  memHof.clear();
  memSettings = { ...DEFAULT_SETTINGS };
  const d = getDb();
  if (!d) return;
  try {
    await Promise.all([d.experiments.clear(), d.hallOfFame.clear(), d.settings.clear()]);
  } catch {
    /* ignore */
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
    } catch {
      return null;
    }
  }
  return null;
}
