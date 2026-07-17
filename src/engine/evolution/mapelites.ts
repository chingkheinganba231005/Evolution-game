/** MAP-Elites quality-diversity archive. */

import type { BehaviourDescriptors, CreatureGenome } from '../genome/types';

export type DescriptorKey = keyof BehaviourDescriptors;

export interface DescriptorAxis {
  key: DescriptorKey;
  label: string;
  min: number;
  max: number;
  bins: number;
}

export interface ArchiveCell {
  x: number;
  y: number;
  fitness: number;
  genomeId: string;
  genome: CreatureGenome;
  descriptors: BehaviourDescriptors;
}

export const DESCRIPTOR_AXES: DescriptorAxis[] = [
  { key: 'segmentCount', label: 'Segment count', min: 1, max: 12, bins: 12 },
  { key: 'averageSpeed', label: 'Average speed', min: 0, max: 5, bins: 12 },
  { key: 'energyEfficiency', label: 'Energy efficiency', min: 0, max: 5, bins: 12 },
  { key: 'stability', label: 'Stability', min: 0, max: 1, bins: 12 },
  { key: 'bodyLength', label: 'Body length', min: 0, max: 4, bins: 12 },
  { key: 'maxHeight', label: 'Max height', min: 0, max: 4, bins: 12 },
  { key: 'dutyCycle', label: 'Contact duty cycle', min: 0, max: 1, bins: 12 },
  { key: 'periodicity', label: 'Movement periodicity', min: 0, max: 1, bins: 12 },
  { key: 'symmetry', label: 'Symmetry', min: 0, max: 1, bins: 12 },
];

export function binIndex(axis: DescriptorAxis, value: number): number {
  const t = (value - axis.min) / (axis.max - axis.min);
  const idx = Math.floor(t * axis.bins);
  return idx < 0 ? 0 : idx >= axis.bins ? axis.bins - 1 : idx;
}

export class MapElitesArchive {
  private cells = new Map<string, ArchiveCell>();
  constructor(
    public axisX: DescriptorAxis,
    public axisY: DescriptorAxis,
  ) {}

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Attempt to insert; keeps the higher-fitness occupant. Returns true if stored. */
  consider(
    genome: CreatureGenome,
    fitness: number,
    descriptors: BehaviourDescriptors,
  ): boolean {
    if (!Number.isFinite(fitness)) return false;
    const x = binIndex(this.axisX, descriptors[this.axisX.key]);
    const y = binIndex(this.axisY, descriptors[this.axisY.key]);
    const k = this.key(x, y);
    const existing = this.cells.get(k);
    if (existing && existing.fitness >= fitness) return false;
    this.cells.set(k, { x, y, fitness, genomeId: genome.id, genome, descriptors });
    return true;
  }

  get(x: number, y: number): ArchiveCell | undefined {
    return this.cells.get(this.key(x, y));
  }

  all(): ArchiveCell[] {
    return [...this.cells.values()];
  }

  get size(): number {
    return this.cells.size;
  }

  /** Coverage fraction of the archive grid. */
  coverage(): number {
    return this.cells.size / (this.axisX.bins * this.axisY.bins);
  }

  /** Sample a filled cell's genome (deterministic given index). */
  sampleByIndex(i: number): ArchiveCell | undefined {
    const arr = this.all();
    if (arr.length === 0) return undefined;
    return arr[i % arr.length];
  }

  serialize(): SerializedArchive {
    return {
      axisX: this.axisX,
      axisY: this.axisY,
      cells: this.all().map((c) => ({
        x: c.x,
        y: c.y,
        fitness: c.fitness,
        genome: c.genome,
        descriptors: c.descriptors,
      })),
    };
  }

  static deserialize(data: SerializedArchive): MapElitesArchive {
    const archive = new MapElitesArchive(data.axisX, data.axisY);
    for (const c of data.cells) {
      archive.cells.set(`${c.x},${c.y}`, {
        x: c.x,
        y: c.y,
        fitness: c.fitness,
        genomeId: c.genome.id,
        genome: c.genome,
        descriptors: c.descriptors,
      });
    }
    return archive;
  }
}

export interface SerializedArchive {
  axisX: DescriptorAxis;
  axisY: DescriptorAxis;
  cells: {
    x: number;
    y: number;
    fitness: number;
    genome: CreatureGenome;
    descriptors: BehaviourDescriptors;
  }[];
}
