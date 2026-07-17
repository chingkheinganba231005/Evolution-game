import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, Swords, FlaskConical, Trophy } from 'lucide-react';
import { listHof, deleteHofEntry, saveHofEntry } from '../../db/index';
import type { HallOfFameEntry } from '../../db/types';
import { useArenaStore } from '../../stores/arena-store';
import { useLabStore } from '../../stores/lab-store';
import { exportCreature } from '../../features/io';
import { SimulationViewport } from '../../features/simulation/SimulationViewport';
import { EmptyState } from '../../components/ui';

export function GalleryPage(): React.ReactElement {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const addToArena = useArenaStore((s) => s.add);
  const setAncestor = useLabStore((s) => s.setAncestor);

  const refresh = (): void => {
    void listHof().then(setEntries);
  };
  useEffect(refresh, []);

  const remove = async (id: string): Promise<void> => {
    await deleteHofEntry(id);
    refresh();
  };

  const rename = async (entry: HallOfFameEntry, name: string): Promise<void> => {
    await saveHofEntry({ ...entry, name });
    refresh();
  };

  const openInLab = (entry: HallOfFameEntry): void => {
    setAncestor(entry.genome);
    navigate('/lab');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Trophy className="text-signal-amber" size={20} />
        <h1 className="text-lg font-semibold text-slate-100">Hall of Fame &amp; Gallery</h1>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No creatures saved yet">
          Evolve a champion in the Lab and add it to the Hall of Fame, or export/import{' '}
          <code>.creature.json</code> files.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div key={entry.id} className="glass flex flex-col gap-2 p-3">
              <div className="h-40 overflow-hidden rounded-lg bg-black/40">
                <SimulationViewport genome={entry.genome} env={entry.env} compact autoPlay />
              </div>
              <input
                className="input"
                defaultValue={entry.name}
                onBlur={(e) => e.target.value !== entry.name && void rename(entry, e.target.value)}
                aria-label="Creature name"
              />
              <div className="mono flex justify-between text-[10px] text-slate-500">
                <span>{entry.env.kind}</span>
                <span className="text-specimen">fit {entry.fitness.toFixed(1)}</span>
                <span>{entry.genome.segments.length} segs</span>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost flex-1 !px-2" onClick={() => openInLab(entry)} title="Open in Lab">
                  <FlaskConical size={13} />
                </button>
                <button
                  className="btn-ghost flex-1 !px-2"
                  onClick={() => addToArena(entry.genome, entry.name)}
                  title="Add to Arena"
                >
                  <Swords size={13} />
                </button>
                <button className="btn-ghost flex-1 !px-2" onClick={() => exportCreature(entry.genome)} title="Export">
                  <Download size={13} />
                </button>
                <button className="btn-danger flex-1 !px-2" onClick={() => remove(entry.id)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
