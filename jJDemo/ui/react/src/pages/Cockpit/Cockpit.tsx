/*
 * Pipeline Cockpit (§5) — the portfolio view Helena puts on screen in a review.
 * Four computed KPIs (gate readiness · launch health · revenue exposed ·
 * schedule discipline), then two panels: launches needing attention (worst
 * first) and gates closing in the next 120 days. Nothing here is personal — her
 * own work lives in My Actions. Every figure is derived by the backend.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, TrendingUp, ChevronRight, AlertTriangle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtEuro, fmtDateYear, fmtPhase } from '@/lib/format';
import { HealthTag, ProgressBar } from '@/components/portfolio/HealthTag';
import { getCockpit } from '@/api/portfolio';
import type { Cockpit as CockpitData } from '@/types/portfolio';

export default function Cockpit() {
  const navigate = useNavigate();
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCockpit());
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the cockpit.');
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
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-primary">Pipeline Cockpit</h1>
        <p className="mt-1 max-w-3xl text-sm text-secondary">
          Portfolio status — the view you put on screen in a review. Your own decisions and escalations live in
          My Actions.
        </p>
      </header>

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <KpiRow data={data} />

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Launches needing attention */}
            <section className="c3-card rounded-lg border border-weak bg-primary p-5">
              <h2 className="text-sm font-semibold text-primary">Launches needing attention</h2>
              <p className="mb-3 text-xs text-secondary">Worst first — click a launch to open its record.</p>
              <div className="flex flex-col divide-y divide-[color:var(--color-border-weak)]">
                {data.attention.map((a) => (
                  <button
                    key={a.launchId}
                    type="button"
                    onClick={() => navigate(`/launch/${encodeURIComponent(a.launchId)}`)}
                    className="flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                  >
                    <AlertTriangle
                      className={cn(
                        'size-4 shrink-0',
                        a.health === 'OFF_TRACK' ? 'text-danger' : 'text-warning',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-primary">{a.device}</div>
                      <div className="truncate text-xs text-secondary">
                        {a.franchise}
                        {a.phaseName ? ` · ${fmtPhase(a.phaseCode, a.phaseName)}` : ''}
                      </div>
                    </div>
                    <HealthTag health={a.health} />
                    <div className="w-20 text-right text-sm font-semibold text-danger">
                      {fmtEuro(a.revenueAtRisk)}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-secondary" />
                  </button>
                ))}
              </div>
            </section>

            {/* Gates closing in 120 days */}
            <section className="c3-card rounded-lg border border-weak bg-primary p-5">
              <h2 className="text-sm font-semibold text-primary">Gates closing in the next 120 days</h2>
              <p className="mb-3 text-xs text-secondary">
                Readiness = criteria met — click to open the launch.
              </p>
              <div className="flex flex-col divide-y divide-[color:var(--color-border-weak)]">
                {data.gatesClosing.map((g, i) => (
                  <button
                    key={`${g.gateCode}-${i}`}
                    type="button"
                    onClick={() => g.launchId && navigate(`/launch/${encodeURIComponent(g.launchId)}`)}
                    className="flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                      {g.gateCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-primary">{g.gateName}</div>
                      <div className="truncate text-xs text-secondary">
                        {g.shortName} · {fmtDateYear(g.forecastDate)}
                      </div>
                    </div>
                    <div className="w-28">
                      {g.criteriaTotal > 0 ? (
                        <>
                          <div className="mb-1 text-right text-xs text-secondary">
                            {g.criteriaMet}/{g.criteriaTotal} met
                          </div>
                          <ProgressBar
                            value={g.criteriaMet}
                            total={g.criteriaTotal}
                            tone={g.status === 'no' ? 'danger' : g.status === 'late' ? 'warning' : 'success'}
                          />
                        </>
                      ) : (
                        // No criteria captured for this gate yet — show the slip instead of a
                        // misleading "0/0 met" bar.
                        <div className="text-right text-xs text-secondary">
                          {g.slipDays && g.slipDays > 0 ? `+${g.slipDays}d slip` : 'criteria pending'}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function KpiRow({ data }: { data: CockpitData }) {
  const r = data.kpis.gateReadiness;
  const h = data.kpis.launchHealth;
  const rev = data.kpis.revenueExposed;
  const s = data.kpis.scheduleDiscipline;

  const onPlan = h.byStatus.ON_PLAN?.count ?? 0;
  const atRisk = h.byStatus.AT_RISK?.count ?? 0;
  const offTrack = h.byStatus.OFF_TRACK?.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Gate readiness */}
      <KpiCard title="Portfolio gate readiness">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-primary">{Math.round(r.value)}</span>
          <span className="text-lg text-secondary">%</span>
        </div>
        <Delta down value={`${Math.abs(r.deltaPts)} pts`} note="vs last month" />
        <Footer left={`Target ${r.target}%`} right={`${h.total} active · ${onPlan} on plan`} />
      </KpiCard>

      {/* Launch health */}
      <KpiCard title="Launch health">
        <div className="flex items-baseline gap-3">
          <Stat value={onPlan} label="on plan" tone="success" />
          <Stat value={atRisk} label="at risk" tone="warning" />
          <Stat value={offTrack} label="off track" tone="danger" />
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full">
          <span className="bg-success" style={{ flex: onPlan || 0.01 }} />
          <span className="bg-warning" style={{ flex: atRisk || 0.01 }} />
          <span className="bg-danger" style={{ flex: offTrack || 0.01 }} />
        </div>
        <Footer left={`${h.total} launches`} right="" />
      </KpiCard>

      {/* Revenue exposed */}
      <KpiCard title="Revenue exposed">
        <div className="flex items-baseline gap-1">
          <span className="text-lg text-secondary">€</span>
          <span className="text-3xl font-semibold text-danger">{(rev.value / 1_000_000).toFixed(1)}</span>
          <span className="text-lg text-secondary">M</span>
        </div>
        <Delta up value={fmtEuro(rev.delta30d)} note="in the last 30 days" />
        <Footer left={`${rev.pctOfPortfolio}% of pipeline value`} right={`${fmtEuro(rev.portfolioBase)} total`} />
      </KpiCard>

      {/* Schedule discipline */}
      <KpiCard title="Schedule discipline">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-danger">{Math.round(s.value)}</span>
          <span className="text-lg text-secondary">days</span>
        </div>
        <div className="mt-1 text-xs text-secondary">Average slip at gate close</div>
        <Footer left={`Target ≤ ${s.target} days`} right={`worst ${s.worst} days`} />
      </KpiCard>
    </div>
  );
}

function KpiCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="c3-card flex flex-col rounded-lg border border-weak bg-primary p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">{title}</div>
      {children}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'success' | 'warning' | 'danger' }) {
  const cls = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-danger';
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-2xl font-semibold', cls)}>{value}</span>
      <span className="text-[10px] text-secondary">{label}</span>
    </div>
  );
}

function Delta({ up, down, value, note }: { up?: boolean; down?: boolean; value: string; note: string }) {
  return (
    <div className={cn('mt-1 flex items-center gap-1 text-xs', up ? 'text-danger' : down ? 'text-warning' : 'text-secondary')}>
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      <span className="font-medium">{value}</span>
      <span className="text-secondary">{note}</span>
    </div>
  );
}

function Footer({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-secondary">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
