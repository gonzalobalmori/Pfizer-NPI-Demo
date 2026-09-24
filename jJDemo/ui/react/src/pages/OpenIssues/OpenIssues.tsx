/*
 * Open Issues (§5) — the live findings across the portfolio, sorted worst
 * first. Two independent filters: who it is waiting on (you / a person / an
 * agent / an authority) and how much it bites (blocking / float / monitored,
 * derived from the finding category). The stat band shows the split that never
 * lies — the counts come straight from the backend (getOpenIssues) so this page
 * always agrees with the Execution queues. Clicking a row opens the launch
 * record; a finding that needs a decision routes into the Resolution branch.
 *
 * Each row names the gate it puts at risk (the gate that closes the finding's
 * phase) and that gate's slip — the SAME gate the resolution workspace and the
 * finding card show, so "gate at risk" reconciles across every view. The gate
 * slip (schedule position) is a DISTINCT figure from the finding's days-at-stake
 * (its own critical-path cost), so the two columns are labelled separately.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, User, Bot, UserCircle2, Landmark, Zap, Lock } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtEuro, fmtDateTime, fmtPhase } from '@/lib/format';
import { getOpenIssues } from '@/api/portfolio';
import type { OpenIssues as OpenIssuesData, IssueRow, WaitingOn } from '@/types/portfolio';

type WaitingFilter = 'ALL' | WaitingOn;
type ImpactFilter = 'ALL' | 'ct' | 'rk' | 'ok';

const WAITING_META: Record<WaitingOn, { label: string; icon: typeof User; cls: string }> = {
  YOU: { label: 'You', icon: UserCircle2, cls: 'text-danger' },
  PERSON: { label: 'A person', icon: User, cls: 'text-warning' },
  AGENT: { label: 'An agent', icon: Bot, cls: 'text-accent' },
  AUTHORITY: { label: 'A regulatory authority', icon: Landmark, cls: 'text-secondary' },
};

const IMPACT_META: Record<'ct' | 'rk' | 'ok', { label: string; cls: string }> = {
  ct: { label: 'Blocking', cls: 'bg-danger-weak text-danger border-danger' },
  rk: { label: 'Float', cls: 'bg-warning-weak text-warning border-warning' },
  ok: { label: 'Monitored', cls: 'bg-secondary text-secondary border-weak' },
};

export default function OpenIssues() {
  const navigate = useNavigate();
  const [data, setData] = useState<OpenIssuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<WaitingFilter>('ALL');
  const [impact, setImpact] = useState<ImpactFilter>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getOpenIssues());
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load open issues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (waiting !== 'ALL' && r.waitingOn !== waiting) return false;
      if (impact !== 'ALL' && r.category !== impact) return false;
      return true;
    });
  }, [data, waiting, impact]);

  /* Portfolio time-recovery totals — the same split the Cockpit chart shows, kept
     in sync because both read the enriched findings. recoverableDays = days you
     win back by acting; regulatorDays = a fixed wait on an outside authority. */
  const timeTotals = useMemo(() => {
    if (!data) return { atStake: 0, recoverable: 0, regulator: 0, pct: 0 };
    const t = data.rows.reduce(
      (acc, r) => {
        acc.atStake += r.daysAtStake ?? 0;
        acc.recoverable += r.recoverableDays ?? 0;
        acc.regulator += r.regulatorDays ?? 0;
        return acc;
      },
      { atStake: 0, recoverable: 0, regulator: 0 },
    );
    const pct = t.atStake > 0 ? Math.round((100 * t.recoverable) / t.atStake) : 0;
    return { ...t, pct };
  }, [data]);

  const openIssue = (r: IssueRow) => {
    // A finding awaiting your decision routes into the Resolution branch;
    // everything else opens the launch it belongs to.
    if (r.waitingOn === 'YOU' && r.outcome === 'USER') {
      navigate(`/resolve/${encodeURIComponent(r.findingId)}`);
    } else if (r.launchId) {
      navigate(`/launch/${encodeURIComponent(r.launchId)}`);
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-primary">Open Issues</h1>
        <p className="mt-1 text-sm text-secondary">
          Every live finding across the portfolio. Sorted by the schedule time you can win back — the
          ones you can accelerate sit at the top; the ones waiting on an authority sit at the bottom.
        </p>
      </header>

      {loading || !data ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <>
          {/* Stat band — who the next step waits on. AUTHORITY findings are the
              ones acting faster cannot move. */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Open" value={data.total} tone="neutral" active={waiting === 'ALL'} onClick={() => setWaiting('ALL')} />
            <StatCard label="On you" value={data.counts.YOU} tone="danger" active={waiting === 'YOU'} onClick={() => setWaiting('YOU')} />
            <StatCard label="On a person" value={data.counts.PERSON} tone="warning" active={waiting === 'PERSON'} onClick={() => setWaiting('PERSON')} />
            <StatCard label="On an agent" value={data.counts.AGENT} tone="accent" active={waiting === 'AGENT'} onClick={() => setWaiting('AGENT')} />
            <StatCard label="On an authority" value={data.counts.AUTHORITY} tone="neutral" active={waiting === 'AUTHORITY'} onClick={() => setWaiting('AUTHORITY')} />
          </div>

          {/* Time-recovery strip — of all the schedule days these findings hold,
              how many you can win back by acting vs. a fixed wait on an authority.
              Reconciles with the Cockpit chart (same enriched findings). */}
          {timeTotals.atStake > 0 ? (
            <div className="mb-5 rounded-lg border border-weak bg-primary p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm text-primary">
                  <span className="font-semibold">{timeTotals.atStake} days</span> at stake across open issues ·{' '}
                  <span className="font-semibold text-success">{timeTotals.recoverable} days ({timeTotals.pct}%)</span>{' '}
                  recoverable by acting ·{' '}
                  <span className="font-semibold text-secondary">{timeTotals.regulator} days</span> waiting on an authority
                </div>
              </div>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-success" style={{ width: `${timeTotals.pct}%` }} />
                <div className="h-full bg-muted-foreground/40" style={{ width: `${100 - timeTotals.pct}%` }} />
              </div>
            </div>
          ) : null}

          {/* Impact filter */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-secondary">Impact</span>
            {(['ALL', 'ct', 'rk', 'ok'] as ImpactFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setImpact(f)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  impact === f
                    ? 'border-accent bg-accent-weak text-accent'
                    : 'border-weak text-secondary hover:text-primary',
                )}
              >
                {f === 'ALL' ? 'All' : IMPACT_META[f].label}
              </button>
            ))}
            <span className="ml-auto text-xs text-secondary">
              {rows.length} of {data.total} shown
            </span>
          </div>

          {/* Issue table */}
          <div className="c3-card overflow-hidden rounded-lg border border-weak bg-primary">
            <div className="grid grid-cols-[auto_minmax(0,3fr)_minmax(0,1.3fr)_auto_auto_auto_auto_auto] items-center gap-4 border-b border-weak bg-secondary/50 px-4 py-2 text-xs font-medium text-secondary">
              <span>Impact</span>
              <span>Finding</span>
              <span>Launch</span>
              <span>Gate at risk</span>
              <span>Waiting on</span>
              <span>Time impact</span>
              <span className="text-right">Exposure</span>
              <span className="text-right">Detected</span>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-secondary">No issues match these filters.</div>
            ) : (
              rows.map((r) => {
                const w = WAITING_META[r.waitingOn];
                const WIcon = w.icon;
                const impactMeta = r.category ? IMPACT_META[r.category] : IMPACT_META.ok;
                return (
                  <button
                    key={r.findingId}
                    type="button"
                    onClick={() => openIssue(r)}
                    className="grid w-full grid-cols-[auto_minmax(0,3fr)_minmax(0,1.3fr)_auto_auto_auto_auto_auto] items-center gap-4 border-b border-weak px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/40"
                  >
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        impactMeta.cls,
                      )}
                    >
                      {impactMeta.label}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">
                        {r.displayId ? <span className="text-secondary">{r.displayId} · </span> : null}
                        {r.headline ?? r.description ?? 'Untitled finding'}
                      </div>
                      <div className="truncate text-xs text-secondary">
                        {r.phaseCode ? `${fmtPhase(r.phaseCode, r.phaseName)} · ` : ''}
                        {r.detectedBy ? `detected by ${r.detectedBy}` : ''}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-primary">{r.shortName ?? r.device ?? '—'}</div>
                      <div className="truncate text-xs text-secondary">{r.franchise ?? ''}</div>
                    </div>
                    <GateAtRiskCell row={r} />
                    <div className={cn('flex items-center gap-1.5 text-xs font-medium', w.cls)}>
                      <WIcon className="size-3.5" />
                      {r.waitingOnLabel ?? w.label}
                    </div>
                    <TimeImpactCell row={r} />
                    <div className="text-right text-sm font-semibold text-danger">
                      {r.exposure ? fmtEuro(r.exposure) : '—'}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs text-secondary">
                      {fmtDateTime(r.detectedAt)}
                      <ChevronRight className="size-4" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

/*
 * Time-impact cell — the days this finding is holding on the critical path, and
 * whether acting can win them back. `recoverable` (from the backend) is true when
 * the whole cost is accelerable by your own org (SELF / TEAM / AGENT); an
 * AUTHORITY finding is a fixed wait (FDA / Notified Body / reimbursement) that
 * acting faster cannot compress.
 */
function TimeImpactCell({ row }: { row: IssueRow }) {
  const days = row.daysAtStake ?? 0;
  if (days <= 0) {
    return <span className="text-xs text-secondary">—</span>;
  }
  const accelerable = row.recoverable;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-primary">{days}d</span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          accelerable
            ? 'bg-success-weak text-success border-success'
            : 'bg-secondary text-secondary border-weak',
        )}
      >
        {accelerable ? <Zap className="size-3" /> : <Lock className="size-3" />}
        {accelerable ? 'You can accelerate' : 'Waiting on authority'}
      </span>
    </div>
  );
}

/*
 * Gate-at-risk cell — the gate that closes this finding's phase, and that gate's
 * schedule slip. This is the SAME gate the resolution workspace and the finding
 * card name, so the figure reconciles across views. The gate slip (how far the
 * gate has moved on the calendar) is deliberately DISTINCT from the finding's
 * days-at-stake in the Time-impact column (that finding's own critical-path
 * cost): a gate can be 47 days late while a single finding on it holds only 6.
 */
function GateAtRiskCell({ row }: { row: IssueRow }) {
  const g = row.gateAtRisk;
  if (!g) return <span className="text-xs text-secondary">—</span>;
  const late = g.status === 'late' && (g.slipDays ?? 0) > 0;
  return (
    <div className="flex flex-col items-start">
      <span className="text-sm font-semibold text-primary">{g.code}</span>
      <span className={cn('text-[11px]', late ? 'text-danger' : 'text-secondary')}>
        {late ? `+${g.slipDays}d slip` : g.status === 'no' ? 'not yet met' : 'on plan'}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'danger' | 'warning' | 'accent';
  active: boolean;
  onClick: () => void;
}) {
  const valueCls =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-primary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'c3-card flex flex-col items-start rounded-lg border bg-primary p-4 text-left transition-colors',
        active ? 'border-accent ring-1 ring-accent' : 'border-weak hover:bg-secondary/40',
      )}
    >
      <span className={cn('text-3xl font-semibold', valueCls)}>{value}</span>
      <span className="mt-1 text-xs text-secondary">{label}</span>
    </button>
  );
}
