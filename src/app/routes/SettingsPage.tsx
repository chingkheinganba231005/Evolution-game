import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import { clearAllData, estimateStorage, isPersistent } from '../../db/index';
import { suggestedWorkerCount } from '../../workers/pool';
import { Panel, Toggle, Labeled } from '../../components/ui';

export function SettingsPage(): React.ReactElement {
  const settings = useSettingsStore();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void estimateStorage().then(setStorage);
    void isPersistent().then(setPersistent);
  }, []);

  const wipe = async (): Promise<void> => {
    await clearAllData();
    setConfirming(false);
    void estimateStorage().then(setStorage);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-slate-100">Settings</h1>

      <Panel title="Appearance">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Theme</span>
            <div className="ml-auto flex rounded-lg bg-black/20 p-0.5">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => settings.update({ theme: t })}
                  className={`rounded px-3 py-1 text-xs capitalize ${
                    settings.theme === t ? 'bg-specimen/20 text-specimen' : 'text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Reduce motion"
            checked={settings.reducedMotion}
            onChange={(v) => settings.update({ reducedMotion: v })}
          />
          <Toggle
            label="Colour-blind-friendly rendering"
            checked={settings.colorBlind}
            onChange={(v) => settings.update({ colorBlind: v })}
          />
        </div>
      </Panel>

      <Panel title="Performance">
        <div className="space-y-3">
          <Labeled
            label={`Worker threads: ${settings.workerCount === 0 ? `auto (${suggestedWorkerCount()})` : settings.workerCount}`}
            hint="Number of parallel evaluation workers. 0 = auto (reserves a core for the UI)."
          >
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={settings.workerCount}
              onChange={(e) => settings.update({ workerCount: parseInt(e.target.value) })}
            />
          </Labeled>
          <Toggle
            label="Show developer performance overlay"
            checked={settings.showPerfOverlay}
            onChange={(v) => settings.update({ showPerfOverlay: v })}
          />
          <p className="text-[11px] text-slate-500">
            Detected hardware concurrency: {typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || '—' : '—'} cores.
          </p>
        </div>
      </Panel>

      <Panel title="Storage">
        <div className="space-y-2 text-sm text-slate-400">
          <div>
            Persistence:{' '}
            <span className={persistent ? 'text-specimen' : 'text-signal-amber'}>
              {persistent === null ? '…' : persistent ? 'IndexedDB available' : 'In-memory fallback (data lost on reload)'}
            </span>
          </div>
          {storage && storage.quota > 0 && (
            <div className="mono text-xs text-slate-500">
              Using {(storage.usage / 1e6).toFixed(1)}MB of {(storage.quota / 1e6).toFixed(0)}MB
            </div>
          )}
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-signal-rose">Delete all experiments, creatures and settings?</span>
              <button className="btn-danger" onClick={wipe}>
                Yes, wipe
              </button>
              <button className="btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setConfirming(true)}>
              Reset all local data
            </button>
          )}
        </div>
      </Panel>

      <Panel title="About">
        <p className="text-xs leading-relaxed text-slate-500">
          Creature Evolution Lab is fully local-first: no accounts, no analytics, no network requests.
          Everything runs and is stored in your browser. Export your experiments to back them up.
        </p>
      </Panel>
    </div>
  );
}
