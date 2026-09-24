/*
 * Small presentational tags shared across the Execution branch — severity
 * tags, outcome chips and category dots. Colour tokens follow the C3 design
 * system (danger / warning / success / accent).
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { Outcome, Category } from '@/types/execution';

const SEVERITY: Record<string, string> = {
  crit: 'bg-danger-weak text-danger border-danger',
  risk: 'bg-warning-weak text-warning border-warning',
  auto: 'bg-success-weak text-success border-success',
};

export function SeverityTag({ label, kind }: { label: string; kind: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        SEVERITY[kind] ?? 'bg-secondary text-secondary border-weak',
      )}
    >
      {label}
    </span>
  );
}

const OUTCOME_META: Record<Outcome, { label: string; cls: string }> = {
  USER: { label: 'Your decision', cls: 'bg-danger-weak text-danger border-danger' },
  HELD: { label: 'Held by a person', cls: 'bg-warning-weak text-warning border-warning' },
  AUTO: { label: 'Closed by the fleet', cls: 'bg-success-weak text-success border-success' },
  RUNNING: { label: 'Working now', cls: 'bg-accent-weak text-accent border-accent' },
};

export function OutcomeChip({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null;
  const m = OUTCOME_META[outcome];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', m.cls)}>
      {m.label}
    </span>
  );
}

const CATEGORY_META: Record<Category, { label: string; cls: string }> = {
  ct: { label: 'Blocking a gate', cls: 'bg-danger' },
  rk: { label: 'Consuming float', cls: 'bg-warning' },
  ok: { label: 'Monitored', cls: 'bg-success' },
};

export function CategoryDot({ category }: { category: Category | null }) {
  if (!category) return null;
  const m = CATEGORY_META[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-secondary" title={m.label}>
      <span className={cn('inline-block size-2 rounded-full', m.cls)} />
      {m.label}
    </span>
  );
}
