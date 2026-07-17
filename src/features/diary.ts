/** Deterministic evolution-diary summaries from real metric deltas. */

import type { CreatureGenome } from '../engine/genome/types';
import type { GenerationSummary } from '../engine/evolution/types';

const MUTATION_LABELS: Record<string, string> = {
  'add-segment': 'added body segments',
  'remove-segment': 'removed segments',
  'duplicate-branch': 'duplicated a branch',
  'mirror-branch': 'mirrored a limb',
  'segment-dimensions': 'reshaped segments',
  'joint-limits': 'retuned joint limits',
  'motor-strength': 'adjusted motor strength',
  'controller-weights': 'tuned neural weights',
  'controller-frequency': 'shifted its rhythm',
};

/** Build a one- or two-sentence diary entry, or null if nothing notable. */
export function makeDiaryEntry(
  prev: GenerationSummary | undefined,
  cur: GenerationSummary,
  champion: CreatureGenome,
): string | null {
  const gen = cur.generation;
  if (!prev) {
    return `Generation ${gen} established a baseline with best fitness ${cur.best.toFixed(
      1,
    )} across ${cur.speciesCount} species.`;
  }

  const bestDelta = cur.best - prev.best;
  const distDelta = cur.bestDistance - prev.bestDistance;
  const parts: string[] = [];

  if (bestDelta > 0.5) {
    parts.push(
      `Generation ${gen} improved best fitness by ${bestDelta.toFixed(1)} to ${cur.best.toFixed(1)}`,
    );
  } else if (bestDelta <= 0.01) {
    parts.push(`Generation ${gen} held its ground at fitness ${cur.best.toFixed(1)}`);
  } else {
    parts.push(`Generation ${gen} edged forward to fitness ${cur.best.toFixed(1)}`);
  }

  if (Math.abs(distDelta) > 0.3) {
    parts.push(
      distDelta > 0
        ? `the champion travelled ${distDelta.toFixed(1)}m further`
        : `distance fell back by ${Math.abs(distDelta).toFixed(1)}m`,
    );
  }

  // Highlight the dominant structural mutation this generation.
  const structural = Object.entries(cur.mutationCounts)
    .filter(([type]) => type !== 'controller-weights')
    .sort((a, b) => b[1] - a[1])[0];
  if (structural && structural[1] >= 3 && MUTATION_LABELS[structural[0]]) {
    parts.push(`the population ${MUTATION_LABELS[structural[0]]}`);
  }

  if (cur.diversity - prev.diversity > 0.15) {
    parts.push('behavioural diversity rose');
  } else if (prev.diversity - cur.diversity > 0.15) {
    parts.push('the population converged');
  }

  const segCount = champion.segments.length;
  const sentence = parts.join(', ') + '.';
  const detail = ` The leading design now uses ${segCount} segment${segCount === 1 ? '' : 's'}.`;
  return sentence + (bestDelta > 0.5 ? detail : '');
}
