import React, { useState } from 'react';
import { getArchive } from '../../stores/lab-store';
import type { CreatureGenome } from '../../engine/genome/types';
import type { ArchiveCell } from '../../engine/evolution/mapelites';

export function MapElitesHeatmap({
  version,
  onSelect,
}: {
  version: number;
  onSelect: (genome: CreatureGenome) => void;
}): React.ReactElement {
  const archive = getArchive();
  const [hover, setHover] = useState<ArchiveCell | null>(null);
  void version; // re-render trigger

  if (!archive) {
    return <div className="text-xs text-slate-500">Enable Diversity Lab to build a MAP-Elites archive.</div>;
  }

  const cells = archive.all();
  const fitnesses = cells.map((c) => c.fitness);
  const min = fitnesses.length ? Math.min(...fitnesses) : 0;
  const max = fitnesses.length ? Math.max(...fitnesses) : 1;
  const span = max - min || 1;

  const grid: (ArchiveCell | null)[][] = Array.from({ length: archive.axisY.bins }, () =>
    new Array(archive.axisX.bins).fill(null),
  );
  for (const c of cells) grid[c.y][c.x] = c;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{archive.axisX.label} →</span>
        <span>{cells.length} filled · {(archive.coverage() * 100).toFixed(0)}% coverage</span>
      </div>
      <div className="flex gap-1">
        <div className="flex items-center">
          <span className="rotate-180 text-[10px] text-slate-500 [writing-mode:vertical-rl]">
            {archive.axisY.label} →
          </span>
        </div>
        <div
          className="grid flex-1 gap-px rounded bg-black/30 p-px"
          style={{ gridTemplateColumns: `repeat(${archive.axisX.bins}, minmax(0,1fr))` }}
        >
          {grid
            .slice()
            .reverse()
            .map((row, ry) =>
              row.map((cell, cx) => {
                const t = cell ? (cell.fitness - min) / span : 0;
                return (
                  <button
                    key={`${ry}-${cx}`}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => cell && onSelect(cell.genome)}
                    aria-label={cell ? `Cell fitness ${cell.fitness.toFixed(1)}` : 'Empty cell'}
                    className="aspect-square rounded-[2px] transition-transform hover:scale-110"
                    style={{
                      background: cell
                        ? `hsl(${170 - t * 40}, 70%, ${25 + t * 45}%)`
                        : 'rgba(255,255,255,0.03)',
                    }}
                  />
                );
              }),
            )}
        </div>
      </div>
      {hover && (
        <div className="mono rounded bg-black/30 p-1.5 text-[10px] text-slate-300">
          fitness {hover.fitness.toFixed(1)} · {archive.axisX.label} {hover.descriptors[archive.axisX.key].toFixed(2)} ·{' '}
          {archive.axisY.label} {hover.descriptors[archive.axisY.key].toFixed(2)}
        </div>
      )}
    </div>
  );
}
