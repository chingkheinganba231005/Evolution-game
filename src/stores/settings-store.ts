/** App settings store (theme, performance, accessibility). */

import { create } from 'zustand';
import { getSettings, saveSettings } from '../db/index';
import { DEFAULT_SETTINGS, type AppSettings } from '../db/types';
import { setWorkerCountOverride } from './lab-store';

interface SettingsState extends AppSettings {
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<AppSettings>): void;
}

function applyTheme(theme: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

function applyReducedMotion(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', on);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const s = await getSettings();
    applyTheme(s.theme);
    applyReducedMotion(s.reducedMotion);
    setWorkerCountOverride(s.workerCount);
    set({ ...s, loaded: true });
  },

  update: (patch) => {
    const next = { ...get(), ...patch } as SettingsState;
    if (patch.theme) applyTheme(patch.theme);
    if (patch.reducedMotion !== undefined) applyReducedMotion(patch.reducedMotion);
    if (patch.workerCount !== undefined) setWorkerCountOverride(patch.workerCount);
    set(patch);
    const toStore: AppSettings = {
      id: 'app',
      theme: next.theme,
      workerCount: next.workerCount,
      reducedMotion: next.reducedMotion,
      colorBlind: next.colorBlind,
      defaultDuration: next.defaultDuration,
      sampleFps: next.sampleFps,
      showPerfOverlay: next.showPerfOverlay,
    };
    void saveSettings(toStore);
  },
}));
