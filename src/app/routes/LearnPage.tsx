import React from 'react';

const SECTIONS = [
  {
    title: 'Genomes',
    body: 'Every creature is described by a versioned, serialisable genome: a tree of body segments, the motorised revolute joints connecting them, and a controller (a rhythmic Central Pattern Generator or a tiny neural network). Genomes are validated and repaired before simulation so mutations can never produce a broken body.',
  },
  {
    title: 'Mutation',
    body: 'Offspring differ from parents through bounded Gaussian perturbations: segment sizes, densities, friction, joint limits and motor strengths shift slightly, while structural mutations add, remove, duplicate or mirror limbs. Controller weights, oscillator frequency and phase offsets are nudged too. Every change is recorded so a lineage can be explained.',
  },
  {
    title: 'Selection',
    body: 'Tournament selection repeatedly picks the fittest of a few random individuals, favouring good designs while preserving variety. Elitism copies the very best creatures unchanged into the next generation, so a discovered solution is never lost.',
  },
  {
    title: 'Fitness',
    body: 'Fitness is a transparent weighted sum of components — distance, speed, stability, energy, finish bonus and penalties. Composite objectives prevent reward exploits: rewarding raw velocity alone invites unstable launches, so it is balanced with sustained progress and staying upright.',
  },
  {
    title: 'Neural controllers',
    body: 'The MLP controller reads normalised observations (body orientation and velocity, joint angles, ground-contact sensors, target direction) and outputs a desired velocity for each motor. An optional recurrent hidden state gives it a short memory. It is implemented directly in TypeScript and evaluated allocation-free inside the physics loop.',
  },
  {
    title: 'Diversity, novelty & MAP-Elites',
    body: 'Optimising for one number tends to collapse a population onto a single trick. The Diversity Lab keeps a MAP-Elites archive: a grid over two behavioural descriptors (e.g. speed vs. segment count) where each cell stores the best creature found for that niche. This preserves many qualitatively different high performers, not just one optimum.',
  },
  {
    title: 'Determinism & physics',
    body: 'A custom impulse-based 2D rigid-body engine runs at a fixed 1/120s timestep with a seeded random generator. The same genome, environment, objective and seed always produce identical results, which is what makes reproducible experiments and fair arena races possible. Rendering interpolates between physics frames and never feeds back into the simulation.',
  },
];

export function LearnPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">How evolution works here</h1>
        <p className="mt-1 text-sm text-slate-400">
          A short field guide to the ideas behind the lab. You don't need any of this to run an
          experiment — but it helps explain what you're watching.
        </p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="glass p-4">
          <h2 className="mb-1 text-sm font-semibold text-specimen">{s.title}</h2>
          <p className="text-sm leading-relaxed text-slate-300">{s.body}</p>
        </section>
      ))}
      <section className="glass p-4">
        <h2 className="mb-1 text-sm font-semibold text-specimen">Challenge ideas</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
          <li>Travel 10 metres with at most three segments.</li>
          <li>Cross the track using minimal energy (raise the energy penalty).</li>
          <li>Evolve five distinct high-performing species with the Diversity Lab.</li>
          <li>Adapt to a harder preset mid-run and watch the population recover.</li>
        </ul>
      </section>
    </div>
  );
}
