/*
 * Portfolio (§5) — one screen, four lenses over the same nine launches:
 *   • Product      — one row per launch, phase blocks + gate markers, worst first
 *   • Market       — the 22 markets sized by launch count, coloured by status,
 *                    plus a per-quarter first-ship timeline
 *   • Business unit— the segment → franchise → launch rollup
 *   • Timeline     — baseline vs forecast per gate, with the slip between them
 * Switching lens must not reset the period filter (handled in-page via state).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtEuro, fmtDateYear } from '@/lib/format';
import {
  HealthDot,
  PhaseTrack,
  GateMarkers,
  SlipPill,
  MlStatusDot,
} from '@/components/portfolio/HealthTag';
import {
  getPortfolioProduct,
  getPortfolioMarket,
  getPortfolioBusinessUnit,
  getPortfolioTimeline,
} from '@/api/portfolio';
import type {
  ProductLens,
  MarketLens,
  BusinessUnitLens,
  TimelineLens,
} from '@/types/portfolio';

type Lens = 'product' | 'market' | 'bu' | 'timeline';

const LENSES: { id: Lens; label: string }[] = [
  { id: 'product', label: 'Product' },
  { id: 'market', label: 'Market' },
  { id: 'bu', label: 'Business unit' },
  { id: 'timeline', label: 'Timeline' },
];

export default function Portfolio() {
  const [lens, setLens] = useState<Lens>('product');
  const [product, setProduct] = useState<ProductLens | null>(null);
  const [market, setMarket] = useState<MarketLens | null>(null);
  const [bu, setBu] = useState<BusinessUnitLens | null>(null);
  const [timeline, setTimeline] = useState<TimelineLens | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, b, t] = await Promise.all([
        getPortfolioProduct(),
        getPortfolioMarket(),
        getPortfolioBusinessUnit(),
        getPortfolioTimeline(),
      ]);
      setProduct(p);
      setMarket(m);
      setBu(b);
      setTimeline(t);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the portfolio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <h1 className="text-2xl font-semibold text-primary">Portfolio</h1>
        <p className="mt-1 text-sm text-secondary">The same nine launches, four ways. Always sorted worst first.</p>
      </header>

      {/* Lens switcher */}
      <div className="mb-5 inline-flex rounded-lg border border-weak bg-secondary/40 p-1">
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLens(l.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              lens === l.id ? 'bg-primary text-primary shadow-sm' : 'text-secondary hover:text-primary',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <>
          {lens === 'product' && product && <ProductLensView data={product} />}
          {lens === 'market' && market && <MarketLensView data={market} />}
          {lens === 'bu' && bu && <BusinessUnitLensView data={bu} />}
          {lens === 'timeline' && timeline && <TimelineLensView data={timeline} />}
        </>
      )}
    </div>
  );
}

/* ── Product lens ─────────────────────────────────────────────────── */
function ProductLensView({ data }: { data: ProductLens }) {
  const navigate = useNavigate();
  return (
    <div className="c3-card overflow-hidden rounded-lg border border-weak bg-primary">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_minmax(0,1.5fr)_auto_auto] items-center gap-4 border-b border-weak bg-secondary/50 px-4 py-2 text-xs font-medium text-secondary">
        <span>Launch</span>
        <span>Phase progress</span>
        <span>Gates</span>
        <span>Next gate</span>
        <span className="text-right">Slip</span>
        <span className="text-right">At risk</span>
      </div>
      {data.rows.map((r) => {
        const nextGate = r.gates.find((g) => g.status !== 'ok') ?? r.gates[r.gates.length - 1];
        return (
          <button
            key={r.launchId}
            type="button"
            onClick={() => navigate(`/launch/${encodeURIComponent(r.launchId)}`)}
            className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_minmax(0,1.5fr)_auto_auto] items-center gap-4 border-b border-weak px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/40"
          >
            <div className="flex min-w-0 items-center gap-2">
              <HealthDot health={r.health} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-primary">{r.device}</div>
                <div className="truncate text-xs text-secondary">
                  {r.franchise} · {r.deviceClass}
                </div>
              </div>
            </div>
            <PhaseTrack phases={r.phases} />
            <GateMarkers gates={r.gates} />
            <div className="min-w-0">
              <div className="truncate text-sm text-primary">{fmtDateYear(nextGate?.forecastDate ?? null)}</div>
              <div className="truncate text-xs text-secondary">
                {nextGate ? `${nextGate.code} ${nextGate.name}` : '—'}
              </div>
            </div>
            <div className="text-right">
              <SlipPill slipDays={nextGate?.slipDays ?? null} health={r.health} />
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className={cn('text-sm font-semibold', r.revenueAtRisk ? 'text-danger' : 'text-secondary')}>
                {r.revenueAtRisk ? fmtEuro(r.revenueAtRisk) : '—'}
              </span>
              <ChevronRight className="size-4 text-secondary" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Market lens ──────────────────────────────────────────────────── */
function MarketLensView({ data }: { data: MarketLens }) {
  const [view, setView] = useState<'map' | 'timeline'>('map');
  const launchMarkets = data.markets.filter((m) => m.tier === 'LAUNCH');
  const regMarkets = data.markets.filter((m) => m.tier === 'REGISTRATION');

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-weak bg-secondary/40 p-1">
        <button
          type="button"
          onClick={() => setView('map')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'map' ? 'bg-primary text-primary shadow-sm' : 'text-secondary hover:text-primary',
          )}
        >
          Global footprint
        </button>
        <button
          type="button"
          onClick={() => setView('timeline')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            view === 'timeline' ? 'bg-primary text-primary shadow-sm' : 'text-secondary hover:text-primary',
          )}
        >
          Quarter timeline
        </button>
      </div>

      {view === 'map' ? (
        <div className="c3-card rounded-lg border border-weak bg-primary p-5">
          <h2 className="text-sm font-semibold text-primary">Launch markets</h2>
          <p className="mb-4 text-xs text-secondary">
            Bubble size = number of launches · colour = worst rollout status. {data.markets.length} markets in two tiers.
          </p>
          {/* Launch markets as sized bubbles */}
          <div className="flex flex-wrap gap-3">
            {launchMarkets.map((m) => {
              const size = 40 + m.launchCount * 8;
              return (
                <div
                  key={m.code}
                  title={`${m.name} · ${m.launchCount} launches · ${m.regulatoryBody ?? ''}`}
                  className="flex flex-col items-center gap-1"
                  style={{ width: size }}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full border text-sm font-semibold text-primary-foreground',
                      m.rollupStatus === 'ct'
                        ? 'bg-danger border-danger'
                        : m.rollupStatus === 'rk'
                          ? 'bg-warning border-warning'
                          : 'bg-success border-success',
                    )}
                    style={{ width: size, height: size }}
                  >
                    {m.launchCount}
                  </div>
                  <span className="text-xs font-medium text-primary">{m.code}</span>
                </div>
              );
            })}
          </div>

          {/* Registration markets */}
          <div className="mt-6 border-t border-weak pt-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">
              Registration markets
            </div>
            <div className="flex flex-wrap gap-2">
              {regMarkets.map((m) => (
                <span
                  key={m.code}
                  title={`${m.name} · ${m.regulatoryBody ?? ''}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-weak bg-secondary/40 px-2.5 py-1 text-xs text-secondary"
                >
                  <span className="inline-block size-1.5 rounded-full bg-secondary" />
                  {m.code}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="c3-card overflow-hidden rounded-lg border border-weak bg-primary">
          <div className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_auto] gap-3 border-b border-weak bg-secondary/50 px-4 py-2 text-xs font-medium text-secondary">
            <span>Market</span>
            {data.timeline.slice(0, 5).map((q) => (
              <span key={q.quarter} className="text-center">
                {q.quarter}
              </span>
            ))}
            <span className="text-right">Launches</span>
          </div>
          {launchMarkets.map((m) => (
            <div
              key={m.code}
              className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_auto] items-center gap-3 border-b border-weak px-4 py-3 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <MlStatusDot status={m.rollupStatus} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-primary">
                    {m.code} {m.name}
                  </div>
                  <div className="truncate text-xs text-secondary">{m.regulatoryBody}</div>
                </div>
              </div>
              {data.timeline.slice(0, 5).map((q) => {
                const hits = m.launches.filter((l) => l.firstShipQuarter === q.quarter);
                return (
                  <div key={q.quarter} className="flex flex-col items-center gap-1">
                    {hits.map((l, i) => (
                      <span
                        key={i}
                        title={l.launch ?? ''}
                        className={cn(
                          'w-full truncate rounded px-1 py-0.5 text-center text-[10px] font-medium',
                          l.status === 'ct'
                            ? 'bg-danger-weak text-danger'
                            : l.status === 'rk'
                              ? 'bg-warning-weak text-warning'
                              : 'bg-success-weak text-success',
                        )}
                      >
                        {l.launch}
                      </span>
                    ))}
                  </div>
                );
              })}
              <div className="text-right text-sm font-semibold text-primary">{m.launchCount}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Business unit lens ───────────────────────────────────────────── */
function BusinessUnitLensView({ data }: { data: BusinessUnitLens }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-5">
      {data.segments.map((s) => (
        <section key={s.segment} className="c3-card rounded-lg border border-weak bg-primary p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-primary">{s.segment}</h2>
              <p className="text-xs text-secondary">
                {s.revenueScale}
                {s.growthRate ? ` · ${Math.round(s.growthRate * 100)}% growth` : ''} · {s.launchCount} launches
              </p>
            </div>
            <div className="text-sm font-semibold text-danger">
              {s.revenueAtRisk ? `${fmtEuro(s.revenueAtRisk)} at risk` : 'no exposure'}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {s.franchises.map((f) => (
              <div key={f.franchise} className="rounded-lg border border-weak bg-secondary/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">{f.franchise}</span>
                  <span className="text-xs text-secondary">{f.launchCount}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {f.launches.map((l) => (
                    <button
                      key={l.launchId}
                      type="button"
                      onClick={() => navigate(`/launch/${encodeURIComponent(l.launchId)}`)}
                      className="flex items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-secondary/60"
                    >
                      <HealthDot health={l.health} />
                      <span className="min-w-0 flex-1 truncate text-xs text-primary">
                        {l.shortName ?? l.device}
                      </span>
                      {l.revenueAtRisk ? (
                        <span className="text-xs font-medium text-danger">{fmtEuro(l.revenueAtRisk)}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Timeline lens ────────────────────────────────────────────────── */
function TimelineLensView({ data }: { data: TimelineLens }) {
  const navigate = useNavigate();
  return (
    <div className="c3-card rounded-lg border border-weak bg-primary p-5">
      <h2 className="text-sm font-semibold text-primary">Every gate on one timeline</h2>
      <p className="mb-4 text-xs text-secondary">
        Baseline versus today&apos;s forecast — the bar between them is the slip. Worst first.
      </p>
      <div className="flex flex-col gap-3">
        {data.rows.map((r) => (
          <button
            key={r.launchId}
            type="button"
            onClick={() => navigate(`/launch/${encodeURIComponent(r.launchId)}`)}
            className="rounded-lg border border-weak p-3 text-left transition-colors hover:bg-secondary/40"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <HealthDot health={r.health} />
              <span className="text-sm font-medium text-primary">{r.device}</span>
              <span className="text-xs text-secondary">{r.franchise}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.gates.map((g) => (
                <div
                  key={g.code}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
                    g.status === 'ok'
                      ? 'border-weak bg-secondary/40 text-secondary'
                      : g.status === 'no'
                        ? 'border-danger bg-danger-weak text-danger'
                        : 'border-warning bg-warning-weak text-warning',
                  )}
                >
                  <span className="font-semibold">{g.code}</span>
                  {g.baselineDate && g.slipDays ? (
                    <span>
                      {fmtDateYear(g.baselineDate)} → {fmtDateYear(g.forecastDate)}
                      <span className="ml-1 font-semibold">+{g.slipDays}d</span>
                    </span>
                  ) : (
                    <span>{fmtDateYear(g.forecastDate)}</span>
                  )}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
