/*
 * Strategic Decisions (§5) — deliberately out of scope for this demo. The
 * prototype shows this branch as a placeholder so the navigation reads true to
 * the full product without pretending the capability is built. We say so plainly
 * (§6: don't dress up what isn't there) and list the four decision classes that
 * would live here.
 */

import React from 'react';
import { Compass, TrendingUp, Scale, Layers, GitBranch } from 'lucide-react';

const CARDS = [
  {
    icon: TrendingUp,
    title: 'Portfolio prioritisation',
    body: 'Rank launches for constrained capital, clinical, and regulatory capacity — which programmes accelerate, which hold.',
  },
  {
    icon: Scale,
    title: 'Go / no-go at gates',
    body: 'Structured recommendation and rationale at each phase gate, with the trade-offs a launch board would weigh.',
  },
  {
    icon: Layers,
    title: 'Market sequencing',
    body: 'Order of market entry across the 22 registration and launch markets given reimbursement and tender windows.',
  },
  {
    icon: GitBranch,
    title: 'Scenario planning',
    body: 'Model the downstream effect of a slip, a supply constraint, or a competitor move before it lands.',
  },
];

export default function StrategicDecisions() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Compass className="size-6 text-accent" />
          Strategic Decisions
        </h1>
      </header>

      <div className="mb-6 rounded-lg border border-accent bg-accent-weak p-4">
        <p className="text-sm text-accent">
          This branch is out of scope for the current demo. The Execution branch — My Actions, Orchestration and the
          Copilot — is fully working; strategic decision support is shown here only so the navigation reflects the
          complete product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="c3-card rounded-lg border border-weak bg-primary p-5 opacity-80">
              <div className="mb-2 flex items-center gap-2">
                <Icon className="size-5 text-secondary" />
                <h2 className="text-sm font-semibold text-primary">{c.title}</h2>
              </div>
              <p className="text-sm text-secondary">{c.body}</p>
              <div className="mt-3 inline-flex rounded-full border border-weak bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-secondary">
                Not built in this demo
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
