/*
 * Shared presentational helpers for the non-Execution screens (§5): health
 * badges, phase tracks, gate markers and slip pills. Colour tokens follow the
 * C3 design system (danger / warning / success / accent). The status vocabulary
 * matches the prototype: off-track/blocking → danger, at-risk/float → warning,
 * on-plan/complete → success.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { Health, PhaseState, GateStatus, MlStatus } from '@/types/portfolio';

const HEALTH_META: Record<Health, { label: string; cls: string; dot: string }> = {
  OFF_TRACK: { label: 'Off track', cls: 'bg-danger-weak text-danger border-danger', dot: 'bg-danger' },
  AT_RISK: { label: 'At risk', cls: 'bg-warning-weak text-warning border-warning', dot: 'bg-warning' },
  ON_PLAN: { label: 'On plan', cls: 'bg-success-weak text-success border-success', dot: 'bg-success' },
  LAUNCHED: { label: 'Launched', cls: 'bg-secondary text-secondary border-weak', dot: 'bg-secondary' },
  PRE_MARKET: { label: 'Pre-market', cls: 'bg-accent-weak text-accent border-accent', dot: 'bg-accent' },
};

export function HealthTag({ health }: { health: Health }) {
  const m = HEALTH_META[health] ?? HEALTH_META.ON_PLAN;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium', m.cls)}>
      <span className={cn('inline-block size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function HealthDot({ health, className }: { health: Health; className?: string }) {
  const m = HEALTH_META[health] ?? HEALTH_META.ON_PLAN;
  return <span className={cn('inline-block size-2.5 rounded-full', m.dot, className)} title={m.label} />;
}

/* A phase track — six blocks P1–P6 coloured by state. */
const PHASE_STATE_CLS: Record<PhaseState, string> = {
  closed: 'bg-success',
  live: 'bg-accent',
  queued: 'bg-secondary',
};
export function PhaseTrack({
  phases,
}: {
  phases: { code: string; name: string; state: PhaseState }[];
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label="Phase progress">
      {phases.map((p) => (
        <span
          key={p.code}
          title={`${p.code} · ${p.name} · ${p.state}`}
          className={cn('h-2 flex-1 rounded-sm', PHASE_STATE_CLS[p.state])}
        />
      ))}
    </div>
  );
}

/* Gate markers G1–G5 coloured by status. */
const GATE_STATUS_CLS: Record<GateStatus, string> = {
  ok: 'bg-success text-primary-foreground',
  late: 'bg-warning text-primary-foreground',
  no: 'bg-danger text-primary-foreground',
};
export function GateMarkers({
  gates,
}: {
  gates: { code: string; status: GateStatus; slipDays: number | null }[];
}) {
  return (
    <div className="flex items-center gap-1">
      {gates.map((g) => (
        <span
          key={g.code}
          title={`${g.code} · ${g.status}${g.slipDays ? ` · +${g.slipDays}d` : ''}`}
          className={cn(
            'flex size-5 items-center justify-center rounded-full text-[9px] font-semibold',
            GATE_STATUS_CLS[g.status],
          )}
        >
          {g.code.replace('G', '')}
        </span>
      ))}
    </div>
  );
}

/* A slip pill — "+47d" red / "+9d" red / "+21d" amber, or a neutral float label. */
export function SlipPill({ slipDays, health }: { slipDays: number | null; health?: Health }) {
  if (!slipDays || slipDays <= 0) {
    return <span className="text-xs text-secondary">on plan</span>;
  }
  const danger = health === 'OFF_TRACK' || slipDays >= 30;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold',
        danger ? 'bg-danger-weak text-danger' : 'bg-warning-weak text-warning',
      )}
    >
      +{slipDays}d
    </span>
  );
}

/* Market/rollout status dot. */
const ML_STATUS_CLS: Record<MlStatus, string> = {
  ct: 'bg-danger',
  rk: 'bg-warning',
  ok: 'bg-success',
};
export function MlStatusDot({ status, className }: { status: MlStatus | null; className?: string }) {
  if (!status) return <span className={cn('inline-block size-2.5 rounded-full bg-secondary', className)} />;
  return <span className={cn('inline-block size-2.5 rounded-full', ML_STATUS_CLS[status], className)} />;
}

/* A labelled progress bar (readiness / completion). */
export function ProgressBar({
  value,
  total,
  tone = 'accent',
}: {
  value: number;
  total: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const toneCls =
    tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : tone === 'danger' ? 'bg-danger' : 'bg-accent';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <span className={cn('block h-full rounded-full', toneCls)} style={{ width: `${pct}%` }} />
    </div>
  );
}
