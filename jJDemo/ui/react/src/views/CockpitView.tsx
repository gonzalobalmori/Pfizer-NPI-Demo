/*
 * Pipeline Cockpit (#v-cockpit) — ported verbatim from the click-through's
 * markup and CSS classes (.vhd / .kgrid / .kc / .two / .pnl / .dt / .bar /
 * .pill). Static headings and labels are copied word-for-word; every figure is
 * fed by the live PortfolioService.cockpit c3Action (user's "keep live C3 data"
 * choice). Nothing here is personal to Helena — that lives in My work.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNav } from '@/nav/NavContext';
import { getCockpit, getTimeImpact } from '@/api/portfolio';
import { fmtDate, fmtGate } from '@/lib/format';
import type { Cockpit, GateClosingRow, Health, MlStatus, TimeImpact } from '@/types/portfolio';

/* Time-recovery chart palette — pulled from the app tokens so the chart reads as
 * part of the cockpit: green = schedule days you can win back by acting
 * (SELF/TEAM/AGENT); grey = a fixed wait on an outside authority (REGULATOR)
 * that acting faster cannot compress. */
const REC_GREEN = '#15803D'; // --ok
const REG_GREY = '#A39992'; // --g500

function gateTone(s: GateClosingRow['status']): 'r' | 'a' | '' {
  if (s === 'no') return 'r';
  if (s === 'late') return 'a';
  return '';
}
/** €M with one decimal, no trailing .0 — matches the mono figures in the tables. */
function em(v: number | null): string {
  if (v == null) return '—';
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, '');
}
/*
 * MarketLaunch.status → the r/a/'' colour class. THIS is the single shared tone
 * source across the cockpit, timeline and market tab: a market reads the same
 * colour everywhere (ct = critical/red, rk = at-risk/amber, ok = green/neutral).
 * The derived gate/phase (Scope C) is content only — it never drives colour.
 */
function mlStatusTone(s: MlStatus): 'r' | 'a' | '' {
  if (s === 'ct') return 'r';
  if (s === 'rk') return 'a';
  return '';
}

/*
 * One flattened attention line = a launch × a single market that NEEDS
 * ATTENTION. The user's rule: "solo que salgan los que tienen slip, los demás no
 * porque no need attention" — so we only emit markets whose OWN status
 * (MarketLaunch.status) is at-risk (rk) or off-track (ct); on-plan (ok) markets
 * are dropped. Each line carries the product, the market's phase + gate, and its
 * slip, coloured by mlStatus (the single shared tone source). Launches with no
 * per-market rollout modelled fall back to a single launch-level line.
 */
interface FlatAttnRow {
  key: string;
  launchId: string;
  device: string;
  franchise: string | null;
  marketCode: string | null;
  marketName: string | null;
  isLead: boolean;
  phaseCode: string | null;
  phaseName: string | null;
  gateCode: string | null;
  gateName: string | null;
  slipDays: number | null;
  mlStatus: MlStatus;
  health: Health;
  revenueAtRisk: number | null;
}

/** Days-until, from an ISO forecast date to "now" (rendered under the date). */
function daysUntil(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  return `${diff} days`;
}

/* One chart datum per launch — the two stacked segments plus the label/meta the
 * axis and tooltip read. */
interface TimeImpactDatum {
  launchId: string;
  label: string;
  recoverableDays: number;
  regulatorDays: number;
  daysAtStake: number;
  pctRecoverable: number;
}

/* Inside-bar label for the green (recoverable) segment — hidden when 0 so a
 * purely authority-bound launch (ETHICON) shows no green tag. */
function fmtRecLabel(value: React.ReactNode): string {
  const n = typeof value === 'number' ? value : Number(value);
  return n > 0 ? `${n}d` : '';
}
/* End-of-bar label showing the launch's TOTAL days at stake (green + grey). */
function fmtTotalLabel(value: React.ReactNode): string {
  const n = typeof value === 'number' ? value : Number(value);
  return n > 0 ? `${n}d` : '';
}

/* Recharts tooltip payload is loosely typed; narrow to the fields we read. */
interface TiTooltipProps {
  active?: boolean;
  payload?: { payload: TimeImpactDatum }[];
}
function TimeImpactTooltip({ active, payload }: TiTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="ti-tip">
      <div className="ti-tip-t">{d.label}</div>
      <div className="ti-tip-r">
        <span className="ti-sw" style={{ background: REC_GREEN }} />
        <span>{d.recoverableDays}d you can recover by acting</span>
      </div>
      <div className="ti-tip-r">
        <span className="ti-sw" style={{ background: REG_GREY }} />
        <span>{d.regulatorDays}d waiting on an authority (fixed)</span>
      </div>
      <div className="ti-tip-ft">
        {d.daysAtStake}d at stake · {d.pctRecoverable}% recoverable
      </div>
    </div>
  );
}

export default function CockpitView() {
  const { open } = useNav();
  const [data, setData] = useState<Cockpit | null>(null);
  const [timeImpact, setTimeImpact] = useState<TimeImpact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cockpit, ti] = await Promise.all([getCockpit(), getTimeImpact()]);
      setData(cockpit);
      setTimeImpact(ti);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the cockpit.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="view on" style={{ padding: 24, color: 'var(--red600)' }}>{error}</div>;
  if (!data) return <div className="view on" style={{ padding: 24 }}>Loading…</div>;

  const r = data.kpis.gateReadiness;
  const h = data.kpis.launchHealth;
  const rev = data.kpis.revenueExposed;
  const s = data.kpis.scheduleDiscipline;

  /* Reconciled headline figures come from the backend rollup so the card sums to
     its own header and matches the portfolio at-risk / off-track counts:
       active = onPlan + atRisk + offTrack (LAUNCHED programs have left launch control). */
  const active = h.active ?? 0;
  const onPlan = h.rollup?.onPlan ?? 0;
  const atRisk = h.rollup?.atRisk ?? 0;
  const offTrack = h.rollup?.offTrack ?? 0;
  const offLaunch = h.byStatus.OFF_TRACK?.launches?.[0] ?? '—';

  /*
   * Flatten each launch into ONE LINE PER MARKET THAT NEEDS ATTENTION. Keep only
   * markets whose own status is rk/ct (drop on-plan ones) — a market on plan is
   * not, by definition, "needing attention". A launch with markets modelled but
   * all on-plan is dropped entirely; a launch with no per-market rollout falls
   * back to a single launch-level line so nothing silently disappears. Ordered
   * off-track before at-risk, then by slip.
   */
  const ML_ATTN_RANK: Record<MlStatus, number> = { ct: 0, rk: 1, ok: 2 };
  const flatRows: FlatAttnRow[] = data.attention.flatMap((a) => {
    const flagged = (a.marketGates ?? []).filter((m) => m.mlStatus === 'ct' || m.mlStatus === 'rk');
    if (flagged.length > 0) {
      return flagged.map((m) => ({
        key: `${a.launchId}-${m.marketCode ?? 'x'}`,
        launchId: a.launchId,
        device: a.device,
        franchise: a.franchise,
        marketCode: m.marketCode,
        marketName: m.marketName,
        isLead: m.isLead,
        phaseCode: m.phaseCode,
        phaseName: null,
        gateCode: m.live ? null : m.gateCode,
        gateName: m.live ? 'live in market' : m.gateName,
        slipDays: m.slipDays,
        mlStatus: m.mlStatus,
        health: a.health,
        revenueAtRisk: a.revenueAtRisk,
      }));
    }
    // No per-market rollout modelled — keep the launch as a single line.
    if ((a.marketGates ?? []).length === 0) {
      return [{
        key: a.launchId,
        launchId: a.launchId,
        device: a.device,
        franchise: a.franchise,
        marketCode: a.leadMarket,
        marketName: null,
        isLead: true,
        phaseCode: a.phaseCode,
        phaseName: a.phaseName,
        gateCode: a.nextGateCode,
        gateName: a.nextGateName,
        slipDays: null,
        mlStatus: a.health === 'OFF_TRACK' ? 'ct' : 'rk',
        health: a.health,
        revenueAtRisk: a.revenueAtRisk,
      }];
    }
    return [];
  });
  flatRows.sort((x, y) => {
    const byStatus = ML_ATTN_RANK[x.mlStatus] - ML_ATTN_RANK[y.mlStatus];
    if (byStatus !== 0) return byStatus;
    return (y.slipDays ?? 0) - (x.slipDays ?? 0);
  });

  /* Time-recovery chart data — one bar per launch that is holding schedule time,
     worst-first (the backend already sorts byLaunch that way). */
  const tiRows: TimeImpactDatum[] = (timeImpact?.byLaunch ?? []).map((b) => ({
    launchId: b.launchId,
    label: b.shortName ?? b.device,
    recoverableDays: b.recoverableDays,
    regulatorDays: b.regulatorDays,
    daysAtStake: b.daysAtStake,
    pctRecoverable: b.pctRecoverable,
  }));
  const tiTotals = timeImpact?.totals ?? null;
  const chartHeight = Math.max(150, tiRows.length * 30 + 22);

  return (
    <div className="view on" id="v-cockpit">
      <div className="vhd">
        <div>
          <div className="vt">Pipeline Cockpit</div>
        </div>
      </div>

      <div className="kgrid">
        {/* Portfolio gate readiness */}
        <div className="kc">
          <div className="kc-t">Portfolio gate readiness</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className="kc-v">{Math.round(r.value)}</span>
              <span className="kc-u">%</span>
            </div>
            <svg className="spark" viewBox="0 0 84 30" preserveAspectRatio="none">
              <polyline points="0,9 14,7 28,11 42,10 56,16 70,20 84,21" className="sl a" />
              <circle cx="84" cy="21" r="2.6" className="sd a" />
            </svg>
          </div>
          <div className="kc-delta down">
            &#9660; {Math.abs(r.deltaPts)} pts <em>vs last month</em>
          </div>
          <div className="kc-ft">
            <span>Target {r.target}%</span>
            <span>
              <b>{active}</b> active &middot; <b>{onPlan}</b> on plan
            </span>
          </div>
        </div>

        {/* Launch health */}
        <div className="kc">
          <div className="kc-t">Launch health</div>
          <div className="kc-hero">
            <div className="kc-split">
              <div className="ks">
                <b className="g">{onPlan}</b>
                <span>on plan</span>
              </div>
              <div className="ks">
                <b className="a">{atRisk}</b>
                <span>at risk</span>
              </div>
              <div className="ks">
                <b className="r">{offTrack}</b>
                <span>off track</span>
              </div>
            </div>
          </div>
          <div className="kc-stack">
            <span className="kb g" style={{ flex: onPlan || 0.01 }} />
            <span className="kb a" style={{ flex: atRisk || 0.01 }} />
            <span className="kb r" style={{ flex: offTrack || 0.01 }} />
          </div>
          <div className="kc-ft">
            <span>
              Off track: <b>{offLaunch}</b>
            </span>
            <span>{active} active launches</span>
          </div>
        </div>

        {/* Revenue exposed */}
        <div className="kc">
          <div className="kc-t">Revenue exposed</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className="kc-u pre">&euro;</span>
              <span className="kc-v r">{em(rev.value)}</span>
              <span className="kc-u">M</span>
            </div>
            <svg className="spark" viewBox="0 0 84 30" preserveAspectRatio="none">
              <polyline points="0,24 14,22 28,23 42,18 56,14 70,8 84,5" className="sl r" />
              <circle cx="84" cy="5" r="2.6" className="sd r" />
            </svg>
          </div>
          <div className="kc-delta up r">
            &#9650; &euro;{em(rev.delta30d)}M <em>in the last 30 days</em>
          </div>
          <div className="kc-ft">
            <span>{rev.pctOfPortfolio}% of pipeline value</span>
            <span>&euro;{em(rev.portfolioBase)}M total</span>
          </div>
        </div>

        {/* Schedule discipline */}
        <div className="kc">
          <div className="kc-t">Schedule discipline</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className="kc-v r">{Math.round(s.value)}</span>
              <span className="kc-u">days</span>
            </div>
            <svg className="spark" viewBox="0 0 84 30" preserveAspectRatio="none">
              <rect x="1" y="22" width="9" height="8" className="sb" />
              <rect x="13" y="19" width="9" height="11" className="sb" />
              <rect x="25" y="23" width="9" height="7" className="sb" />
              <rect x="37" y="14" width="9" height="16" className="sb a" />
              <rect x="49" y="10" width="9" height="20" className="sb a" />
              <rect x="61" y="6" width="9" height="24" className="sb r" />
              <rect x="73" y="3" width="9" height="27" className="sb r" />
            </svg>
          </div>
          <div className="kc-delta down">
            Avg slip across {s.slippedGates} slipped {s.slippedGates === 1 ? 'launch' : 'launches'}
          </div>
          <div className="kc-ft">
            <span>Target &le; {s.target} days</span>
            <span>
              worst <b>{s.worst}</b> days
            </span>
          </div>
        </div>
      </div>

      {/* Where the schedule time is — recoverable by acting vs. a fixed wait on
          an outside authority. This is the critical-path message made concrete:
          the green length is time you win back by working faster; the grey is a
          regulatory wait (FDA, Notified Body, reimbursement) that acting cannot
          compress. Same open findings as the Open-issues list, so it reconciles. */}
      {tiTotals && tiRows.length > 0 ? (
        <div className="pnl ti-pnl">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Where you can recover schedule time</div>
              <div className="pnl-s">
                Green = days you win back by acting · grey = a fixed wait on an authority that accelerating won&apos;t move
              </div>
            </div>
            <div className="ti-lgd">
              <span className="ti-lgi"><span className="ti-sw" style={{ background: REC_GREEN }} /> Recoverable by acting</span>
              <span className="ti-lgi"><span className="ti-sw" style={{ background: REG_GREY }} /> Waiting on authority</span>
            </div>
          </div>
          <div className="ti-body">
            {/* Three headline figures stacked on the left as soft stat cards — the
                total at stake (neutral), the green share you can pull in, and the
                grey fixed wait on an authority. Numbers only; the chart carries
                the per-issue detail. */}
            <div className="ti-kpis">
              <div className="ti-card">
                <div className="ti-card-v">{tiTotals.daysAtStake}<span className="ti-card-u">d</span></div>
                <div className="ti-card-l">At stake</div>
              </div>
              <div className="ti-card rec">
                <div className="ti-card-v">{tiTotals.recoverableDays}<span className="ti-card-u">d</span></div>
                <div className="ti-card-l">Recoverable by acting</div>
              </div>
              <div className="ti-card reg">
                <div className="ti-card-v">{tiTotals.regulatorDays}<span className="ti-card-u">d</span></div>
                <div className="ti-card-l">Waiting on an authority</div>
              </div>
            </div>
            {/* Per-launch chart to the right, titled, with the recoverable days
                labelled inside the green segment and the total at the bar end. */}
            <div className="ti-chart">
              <div className="ti-chart-t">Days at stake by issue</div>
              <div className="ti-chart-c" style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={tiRows}
                    margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid horizontal={false} stroke="var(--g150,var(--g100))" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--g500)' }}
                      axisLine={false}
                      tickLine={false}
                      unit="d"
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fontSize: 11.5, fill: 'var(--g700)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <Tooltip cursor={{ fill: 'var(--g100)' }} content={<TimeImpactTooltip />} />
                    <Bar
                      dataKey="recoverableDays"
                      stackId="t"
                      fill={REC_GREEN}
                      radius={[3, 0, 0, 3]}
                      onClick={(d: TimeImpactDatum) => d?.launchId && open('launch', d.launchId)}
                      cursor="pointer"
                    >
                      <LabelList
                        dataKey="recoverableDays"
                        position="insideRight"
                        formatter={fmtRecLabel}
                        fill="#fff"
                        fontSize={11}
                        fontWeight={700}
                      />
                    </Bar>
                    <Bar
                      dataKey="regulatorDays"
                      stackId="t"
                      fill={REG_GREY}
                      radius={[0, 3, 3, 0]}
                      onClick={(d: TimeImpactDatum) => d?.launchId && open('launch', d.launchId)}
                      cursor="pointer"
                    >
                      <LabelList
                        dataKey="daysAtStake"
                        position="right"
                        formatter={fmtTotalLabel}
                        fill="var(--g600)"
                        fontSize={11}
                        fontWeight={650}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* NPI phase / gate / milestone map — defines, on the first page, what
          the phases are, their names, the gate that closes each, and the key
          regulatory milestones (Submission Filed at G3, FDA Approved at G4). */}
      {data.phaseModel && data.phaseModel.length ? (
        <div className="pm-band">
          <div className="pm-h">
            <div className="pm-t">The NPI launch flow</div>
          </div>
          <div className="pm-flow">
            {data.phaseModel.map((p, i) => (
              <div className="pm-step" key={p.code}>
                <div className="pm-row">
                  <div className="pm-ph" title={p.full}>
                    <div className="pc">{p.code} · {p.short}</div>
                    <div className="pn">{p.full}</div>
                  </div>
                  {i < data.phaseModel.length - 1 ? (
                    <div className="pm-g">
                      <span className="gc">{p.gate}</span>
                      <div className="gn">{p.gateName}</div>
                    </div>
                  ) : null}
                </div>
                <div className="pm-ms">
                  {p.milestone ? <span className="ms-chip">{p.milestone}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="two">
        {/* Launches needing attention */}
        <div className="pnl">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Markets needing attention</div>
              <div className="pnl-s">One line per market with slip · on-plan markets hidden · click to open the launch</div>
            </div>
          </div>
          <table className="dt atn-t">
            <thead>
              <tr>
                <th>Launch</th>
                <th>Market</th>
                <th>Gate</th>
                <th>Slip</th>
                <th className="n">&euro;M</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="sub" style={{ padding: '6px 0' }}>No markets with slip — every market is on plan.</div>
                  </td>
                </tr>
              ) : (
                flatRows.map((f) => {
                  const tone = mlStatusTone(f.mlStatus);
                  const slipText = f.slipDays && f.slipDays > 0 ? `+${f.slipDays}d` : f.mlStatus === 'ct' ? 'off track' : 'at risk';
                  return (
                    <tr key={f.key} onClick={() => open('launch', f.launchId)}>
                      <td>
                        <div className="nm">{f.device}</div>
                        <div className="sub">{f.franchise}{f.phaseCode ? ` · ${f.phaseCode}` : ''}</div>
                      </td>
                      <td>
                        <div className="atn-mk-cell">
                          <span className={`mg-dot ${f.mlStatus}`} aria-hidden />
                          <b>{f.marketCode ?? '—'}</b>
                          {f.isLead ? <span className="mg-lead">lead</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="nm">{f.gateCode ?? (f.gateName ?? '—')}</div>
                        {f.gateCode && f.gateName ? <div className="sub">{f.gateName}</div> : null}
                      </td>
                      <td>
                        <div className="bar">
                          <div className="bar-t">
                            <div className={`bar-f ${tone}`} style={{ width: f.mlStatus === 'ct' ? '100%' : '45%' }} />
                          </div>
                          <span className={`bar-v ${tone}`}>{slipText}</span>
                        </div>
                      </td>
                      <td className="n">
                        <b
                          className="mono"
                          style={{
                            color: tone === 'r' ? 'var(--red600)' : tone === 'a' ? 'var(--amber)' : 'inherit',
                            fontWeight: 750,
                          }}
                        >
                          {em(f.revenueAtRisk)}
                        </b>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Gates closing in the next 120 days */}
        <div className="pnl">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Gates closing in the next 120 days</div>
              <div className="pnl-s">Readiness = criteria met · click to see which are still open</div>
            </div>
          </div>
          <table className="dt">
            <thead>
              <tr>
                <th>Gate</th>
                <th>Launch</th>
                <th>Date</th>
                <th>Readiness</th>
                <th>Open criteria</th>
              </tr>
            </thead>
            <tbody>
              {data.gatesClosing.map((g: GateClosingRow, i: number) => {
                const tone = gateTone(g.status);
                const pct = g.criteriaTotal ? Math.round((100 * g.criteriaMet) / g.criteriaTotal) : 0;
                const openCount = Math.max(0, g.criteriaTotal - g.criteriaMet);
                return (
                  <tr key={`${g.gateCode}-${i}`} onClick={() => g.launchId && open('launch', g.launchId)}>
                    <td>
                      <div className="nm">
                        {fmtGate(g.gateCode, g.gateName)}
                      </div>
                      <div className="sub">Go / No-Go</div>
                    </td>
                    <td>
                      <div className="nm">{g.shortName ?? g.device}</div>
                    </td>
                    <td>
                      <div className="nm mono">{fmtDate(g.forecastDate)}</div>
                      <div className="sub">{daysUntil(g.forecastDate)}</div>
                    </td>
                    <td>
                      <div className="bar">
                        <div className="bar-t">
                          <div className={`bar-f ${tone}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`bar-v ${tone}`}>
                          {g.criteriaMet}/{g.criteriaTotal}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${tone}`}>{openCount ? `${openCount} open` : 'ready'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
