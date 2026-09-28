/*
 * Pipeline Cockpit (#v-cockpit) — ported verbatim from the click-through's
 * markup and CSS classes (.vhd / .kgrid / .kc / .two / .pnl / .dt / .bar /
 * .pill). Static headings and labels are copied word-for-word; every figure is
 * fed by the live PortfolioService.cockpit c3Action (user's "keep live C3 data"
 * choice). Nothing here is personal to George — that lives in My work.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import KpiDistribution, { type KpiDatum } from '@/components/Brand/KpiDistribution';
import MlDot from '@/components/Brand/MlDot';
import type { Cockpit, GateClosingRow, Health, MlStatus, TimeImpact } from '@/types/portfolio';
import { labelFor } from '@/productLabel';

/*
 * Time-recovery chart palette. Recharts needs real colour values (it writes
 * `fill` into the SVG), so these cannot be `var(--…)` references — but they must
 * stay in lockstep with the tokens, hence the token name on each line:
 *   green = schedule days you win back by acting (SELF/TEAM/AGENT)
 *   grey  = a fixed wait on an outside authority (REGULATOR) that acting
 *           faster cannot compress — inert by design, so it is the one series
 *           allowed to read as grey.
 */
const REC_GREEN = '#15803D'; // --st-ok
const REG_GREY = '#8493AB'; // --s5 / --g500

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
 * One attention line = ONE LAUNCH, with the markets needing attention listed
 * inside it.
 *
 * This was previously one row per launch × market, which is the grain the data
 * does NOT support and it produced a table that misled three ways at once:
 *   1. Five rows for Berobenatide were byte-identical apart from the market code —
 *      same status, same 47d slip, same G3 gate — because the backend gives every
 *      flagged market of a launch the same gate projection. Four of the five rows
 *      carried no information.
 *   2. `revenueAtRisk` is a LAUNCH-level figure (Launch.revenueAtRisk), so
 *      repeating it per market made the €M column sum to ~€106M against a real
 *      portfolio exposure of €40.6M. A column that does not sum to its own total
 *      is worse than no column.
 *   3. Eighteen rows for five launches pushed the genuinely distinct launches
 *      below the fold, so the panel's own question — which launches need me? —
 *      got harder to answer the more markets a launch had.
 *
 * The launch grain fixes all three: €M appears once per launch so the column
 * reconciles, and the markets stay visible as chips (the real per-market fact is
 * *which* markets are affected, which the chips show without repeating a row).
 * The user's rule still holds — on-plan markets are dropped, never shown.
 */
interface AttnMarket {
  code: string | null;
  name: string | null;
  isLead: boolean;
  mlStatus: MlStatus;
}
interface AttnRow {
  key: string;
  launchId: string;
  product: string;
  franchise: string | null;
  phaseCode: string | null;
  phaseName: string | null;
  gateCode: string | null;
  gateName: string | null;
  slipDays: number | null;
  /** Worst status across the flagged markets — drives the row's single tone. */
  mlStatus: MlStatus;
  health: Health;
  revenueAtRisk: number | null;
  markets: AttnMarket[];
  /** Markets modelled on this launch but on plan — counted, not listed. */
  onPlanMarkets: number;
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

/*
 * Bar labels for the days-at-stake chart.
 *
 * Only ONE number is printed per bar unless the bar is genuinely SPLIT between
 * recoverable and authority-bound days. The total always sits at the bar end; the
 * green segment is labelled inside it only when a grey segment exists to tell it
 * apart from. Without that test four of five rows printed the same number twice
 * about 8px apart ("35d 35d", "13d 13d", "8d 8d", "5d 5d"), which reads as a
 * rendering fault rather than as data. Only Berobenatide is really split (25 green +
 * 45 grey = 70), so only Berobenatide gets the inside label; every bar still shows
 * the full breakdown on hover.
 *
 * This is written as a `valueAccessor` rather than a `formatter` because Recharts
 * only passes the row entry to the accessor — and only when `dataKey` is absent
 * (`value = isNil(dataKey) ? valueAccessor(entry, index) : getValueByDataKey(...)`,
 * LabelList.js). A `formatter` receives the resolved value alone, so the sibling
 * field needed for this decision is not reachable there.
 */
interface LabelEntry {
  payload?: TimeImpactDatum;
}
/** Inside-bar label: recoverable days, but only on a genuinely split bar. */
function recLabel(entry: LabelEntry): string {
  const d = entry?.payload;
  if (!d || !(d.recoverableDays > 0)) return '';
  return d.regulatorDays > 0 ? `${d.recoverableDays}d` : '';
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

  /*
   * KPI micro-chart data. Each is the KPI's OWN breakdown as returned by the
   * backend — no invented series (R-BASE-03). Memoised because the parent
   * re-renders on every nav change and these sort in place. They sit above the
   * early returns below because hooks must run unconditionally.
   */
  const readinessDist: KpiDatum[] = useMemo(() => {
    const rows = data?.kpis.gateReadiness.byLaunch ?? [];
    return [...rows]
      .sort((a, b) => a.pct - b.pct) // worst readiness first
      .map((x) => ({
        label: `${x.launch} · ${x.gate}`,
        value: x.pct,
        display: `${x.met}/${x.total} criteria met (${Math.round(x.pct)}%)`,
      }));
  }, [data]);

  const exposureDist: KpiDatum[] = useMemo(() => {
    const rows = data?.kpis.revenueExposed.byLaunch ?? [];
    return [...rows]
      .sort((a, b) => b.exposure - a.exposure) // largest exposure first
      .map((x) => ({ label: x.launch, value: x.exposure, display: `€${em(x.exposure)}M exposed` }));
  }, [data]);

  const slipDist: KpiDatum[] = useMemo(() => {
    const rows = data?.kpis.scheduleDiscipline.byGate ?? [];
    return [...rows]
      .sort((a, b) => b.slipDays - a.slipDays) // worst slip first
      .map((x) => ({
        label: `${x.launch ?? 'Portfolio'} · ${x.gate}`,
        value: x.slipDays,
        display: `+${x.slipDays} days late`,
      }));
  }, [data]);

  /* Sub-headline facts for the KPI cards, derived from the SAME breakdowns the
     micro-charts plot — so the words under a card always describe the bars above
     it. These replaced two hard-coded "trend" deltas; see the notes at each card. */
  const readinessBelow = useMemo(() => {
    const target = data?.kpis.gateReadiness.target;
    if (target == null) return 0;
    return readinessDist.filter((d) => d.value < target).length;
  }, [readinessDist, data]);

  /* Share of total exposure held by the single largest launch (the list is already
     sorted largest-first). Null when there is nothing to divide by. */
  const topExposureShare = useMemo(() => {
    if (exposureDist.length === 0) return null;
    const total = exposureDist.reduce((n, d) => n + d.value, 0);
    if (total <= 0) return null;
    return Math.round((exposureDist[0].value / total) * 100);
  }, [exposureDist]);

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!data) return <div className="view on v-msg">Loading…</div>;

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
   * One row per launch that needs attention, carrying only the markets whose OWN
   * status is rk/ct — a market on plan is not, by definition, "needing
   * attention", so it is counted but never listed. A launch with markets
   * modelled but all on-plan is dropped entirely; a launch with no per-market
   * rollout falls back to its launch-level figures so nothing disappears.
   * Ordered off-track before at-risk, then by slip.
   */
  const ML_ATTN_RANK: Record<MlStatus, number> = { ct: 0, rk: 1, ok: 2 };
  const attnRows: AttnRow[] = data.attention.flatMap((a) => {
    const gates = a.marketGates ?? [];
    const flagged = gates.filter((m) => m.mlStatus === 'ct' || m.mlStatus === 'rk');

    if (flagged.length > 0) {
      /* Worst status and worst slip across the flagged markets. The launch's own
         gate projection is taken from the worst market so the Gate column names
         the gate that is actually holding, not an average. */
      const worst = flagged.reduce((acc, m) =>
        ML_ATTN_RANK[m.mlStatus] < ML_ATTN_RANK[acc.mlStatus] ? m : acc, flagged[0]);
      const maxSlip = flagged.reduce((n, m) => Math.max(n, m.slipDays ?? 0), 0);
      return [{
        key: a.launchId,
        launchId: a.launchId,
        product: labelFor(a),
        franchise: a.franchise,
        phaseCode: worst.phaseCode ?? a.phaseCode,
        phaseName: a.phaseName,
        gateCode: worst.live ? null : worst.gateCode,
        gateName: worst.live ? 'live in market' : worst.gateName,
        slipDays: maxSlip > 0 ? maxSlip : null,
        mlStatus: worst.mlStatus,
        health: a.health,
        revenueAtRisk: a.revenueAtRisk,
        markets: flagged.map((m) => ({
          code: m.marketCode, name: m.marketName, isLead: m.isLead, mlStatus: m.mlStatus,
        })),
        onPlanMarkets: gates.length - flagged.length,
      }];
    }

    if (gates.length === 0) {
      return [{
        key: a.launchId,
        launchId: a.launchId,
        product: labelFor(a),
        franchise: a.franchise,
        phaseCode: a.phaseCode,
        phaseName: a.phaseName,
        gateCode: a.nextGateCode,
        gateName: a.nextGateName,
        slipDays: null,
        mlStatus: (a.health === 'OFF_TRACK' ? 'ct' : 'rk') as MlStatus,
        health: a.health,
        revenueAtRisk: a.revenueAtRisk,
        markets: a.leadMarket
          ? [{ code: a.leadMarket, name: null, isLead: true, mlStatus: (a.health === 'OFF_TRACK' ? 'ct' : 'rk') as MlStatus }]
          : [],
        onPlanMarkets: 0,
      }];
    }
    return [];
  });
  attnRows.sort((x, y) => {
    const byStatus = ML_ATTN_RANK[x.mlStatus] - ML_ATTN_RANK[y.mlStatus];
    if (byStatus !== 0) return byStatus;
    return (y.slipDays ?? 0) - (x.slipDays ?? 0);
  });
  /* The €M column now sums to a real number, so state it — a table whose column
     reconciles to the portfolio headline is the point of the re-grain. */
  const attnExposure = attnRows.reduce((n, r) => n + (r.revenueAtRisk ?? 0), 0);
  const attnMarketCount = attnRows.reduce((n, r) => n + r.markets.length, 0);
  /* Shared denominator for the slip bars — the worst slip on the panel. */
  const maxAttnSlip = attnRows.reduce((n, r) => Math.max(n, r.slipDays ?? 0), 0);

  /* Time-recovery chart data — one bar per launch that is holding schedule time,
     worst-first (the backend already sorts byLaunch that way). */
  const tiRows: TimeImpactDatum[] = (timeImpact?.byLaunch ?? []).map((b) => ({
    launchId: b.launchId,
    label: labelFor(b),
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
            {/* Real per-launch readiness, worst-first — replaces a hard-coded
                polyline that plotted an invented trend (R-BASE-03).
                `invert={100}` because readiness is a "higher is better" percentage:
                bars plot the gap to 100% so the launches in trouble are the TALL
                ones, matching the exposure and slip cards beside it. Plotted as the
                value it drew the problem as the smallest mark on the card. */}
            <KpiDistribution
              data={readinessDist}
              threshold={r.target}
              breach="below"
              unitNoun="launch"
              invert={100}
            />
          </div>
          {/*
            * Says what the bars above actually show, NOT a month-over-month delta.
            * This line used to read "▼ 6 pts vs last month" from `deltaPts`, which
            * looks sourced but is the constant READINESS_DELTA_PTS = -6 written into
            * LaunchControlMetrics.js — no Gate, Criterion or KPI carries a dated
            * history, so nothing in this application can compute a 30-day change.
            * A hard-coded figure is no more true for being hard-coded in the
            * backend than in the view (R-BASE-03); it is only harder to spot. The
            * honest, and more useful, statement is the spread the average hides.
            */}
          <div className="kc-delta">
            {readinessBelow > 0 ? (
              <>
                <b>{readinessBelow}</b> of {readinessDist.length} {readinessDist.length === 1 ? 'launch' : 'launches'}{' '}
                <em>below the {r.target}% target</em>
              </>
            ) : (
              <>
                every launch <em>at or above the {r.target}% target</em>
              </>
            )}
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
          {/*
            * The health split as one proportional bar. Red and amber are only ΔE 2.7
            * apart under protanopia — an IRREDUCIBLE limit of this ramp (eleven ambers
            * were measured; none clears the ΔE 8 target while also holding the
            * normal-vision floor and WCAG AA). The dataviz rule permits that band ONLY
            * with secondary encoding, which is satisfied here three times over: the
            * counts are stated in words immediately above ("3 on plan · 4 at risk ·
            * 1 off track"), the segments are separated by a 3px surface gap, and each
            * carries a `title` naming its state. Colour is the redundant channel, not
            * the only one. Do not remove the labels above without also solving the
            * separation problem they license.
            */}
          <div className="kc-stack">
            <span className="kb g" style={{ flex: onPlan || 0.01 }} title={`${onPlan} on plan`} />
            <span className="kb a" style={{ flex: atRisk || 0.01 }} title={`${atRisk} at risk`} />
            <span className="kb r" style={{ flex: offTrack || 0.01 }} title={`${offTrack} off track`} />
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
            {/* Real exposure per launch — shows how concentrated the €40.6M is
                (one launch or five?), which the total alone hides. */}
            <KpiDistribution data={exposureDist} unitNoun="launch" />
          </div>
          {/* Concentration, not a fabricated 30-day rise. `delta30d` is the constant
              REVENUE_DELTA_30D = 11200000 in LaunchControlMetrics.js — see the note
              on the readiness card. What IS true and decision-relevant: how much of
              the total sits in the single worst launch. */}
          <div className="kc-delta">
            {topExposureShare != null ? (
              <>
                <b>{topExposureShare}%</b> <em>of it in {exposureDist[0].label}</em>
              </>
            ) : (
              <em>across {exposureDist.length} launches</em>
            )}
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
            {/* Real slip per slipped gate, worst-first. The headline is a mean,
                so the spread matters: 20d avg over one 47d gate and four small
                ones is a different problem from five even 20d slips. */}
            <KpiDistribution data={slipDist} threshold={s.target} breach="above" unitNoun="gate" />
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
          regulatory wait (FDA, CHMP rapporteur, reimbursement) that acting cannot
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
                    {/* Recessive, and dashed so the verticals read as a scale behind
                        the bars rather than as marks cutting across them (they paint
                        under the bars, which are drawn after). */}
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--g150,var(--g100))"
                      strokeDasharray="2 3"
                    />
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
                      {/* No `dataKey` — that is what routes this through
                          valueAccessor, which receives the whole row. */}
                      <LabelList
                        valueAccessor={recLabel}
                        position="insideRight"
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
              <div className="pnl-t">Launches needing attention</div>
              <div className="pnl-s">
                One line per launch · affected markets listed · on-plan markets hidden · click to open the launch
              </div>
            </div>
            {attnRows.length > 0 ? (
              <div className="pnl-f">
                <b className="mono">&euro;{em(attnExposure)}M</b>
                <span>exposed &middot; {attnMarketCount} markets affected</span>
              </div>
            ) : null}
          </div>
          <table className="dt atn-t">
            <thead>
              <tr>
                <th>Launch</th>
                <th>Markets affected</th>
                <th>Gate holding</th>
                <th>Worst slip</th>
                <th className="n">&euro;M</th>
              </tr>
            </thead>
            <tbody>
              {attnRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="atn-empty">No markets with slip — every market is on plan.</div>
                  </td>
                </tr>
              ) : (
                attnRows.map((f) => {
                  const tone = mlStatusTone(f.mlStatus);
                  const slipText = f.slipDays && f.slipDays > 0 ? `+${f.slipDays}d` : f.mlStatus === 'ct' ? 'off track' : 'at risk';
                  /* Bar width is the launch's slip against the WORST slip on the
                     panel, so the bars are comparable to each other instead of
                     the old fixed 100%/45% that encoded nothing. */
                  const slipPct = maxAttnSlip > 0 && f.slipDays ? Math.max(8, (f.slipDays / maxAttnSlip) * 100) : 100;
                  return (
                    <tr key={f.key} onClick={() => open('launch', f.launchId)}>
                      <td>
                        <div className="nm">{labelFor(f)}</div>
                        <div className="sub">{f.franchise}{f.phaseCode ? ` · ${f.phaseCode}` : ''}</div>
                      </td>
                      <td>
                        <div className="atn-mks">
                          {f.markets.map((m) => (
                            <span className={`atn-mk ${m.mlStatus}`} key={m.code ?? m.name ?? 'x'}
                                  title={`${m.name ?? m.code ?? 'market'}${m.isLead ? ' — lead market' : ''}`}>
                              <MlDot status={m.mlStatus} label={m.name ?? m.code ?? 'market'} />
                              {m.code ?? '—'}
                              {m.isLead ? <i>lead</i> : null}
                            </span>
                          ))}
                          {f.onPlanMarkets > 0 ? (
                            <span className="atn-mk-ok">+{f.onPlanMarkets} on plan</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="nm">{f.gateCode ?? (f.gateName ?? '—')}</div>
                        {f.gateCode && f.gateName ? <div className="sub">{f.gateName}</div> : null}
                      </td>
                      <td>
                        <div className="bar">
                          <div className="bar-t">
                            <div className={`bar-f ${tone}`} style={{ width: `${slipPct}%` }} />
                          </div>
                          <span className={`bar-v ${tone}`}>{slipText}</span>
                        </div>
                      </td>
                      <td className="n">
                        <b className={`mono atn-e ${tone}`}>{em(f.revenueAtRisk)}</b>
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
              {/*
                * TWO DIFFERENT MEASURES, TWO DIFFERENT MARKS.
                *
                * The readiness bar used to be toned by `gateTone(g.status)` — the
                * gate's SCHEDULE state (late / not met) — while its LENGTH showed
                * criteria met. So a gate with every criterion satisfied drew a
                * full-length RED bar if its date had slipped: PF-3945 at 6/6 was
                * the most alarming row on the panel while being the most ready one.
                * A mark whose length says "done" and whose colour says "critical"
                * cannot be read at all.
                *
                * Readiness now tones itself, against the SAME 85% target the
                * readiness KPI card uses (so the panel and the card agree), and the
                * schedule slip gets its own chip in the Date cell where the date it
                * qualifies already lives.
                */}
              {data.gatesClosing.map((g: GateClosingRow, i: number) => {
                const hasCriteria = g.criteriaTotal > 0;
                const pct = hasCriteria ? Math.round((100 * g.criteriaMet) / g.criteriaTotal) : 0;
                const openCount = Math.max(0, g.criteriaTotal - g.criteriaMet);
                /* Amber only below the portfolio readiness target — no second
                   threshold is invented here, and a fully-met gate reads neutral. */
                const rdTone = !hasCriteria ? '' : pct < r.target ? 'a' : '';
                const slipTone = gateTone(g.status);
                const slipped = g.status === 'late' && (g.slipDays ?? 0) > 0;
                return (
                  <tr key={`${g.gateCode}-${i}`} onClick={() => g.launchId && open('launch', g.launchId)}>
                    <td>
                      <div className="nm">
                        {fmtGate(g.gateCode, g.gateName)}
                      </div>
                      <div className="sub">Go / No-Go</div>
                    </td>
                    <td>
                      <div className="nm">{labelFor(g)}</div>
                    </td>
                    <td>
                      <div className="nm mono">{fmtDate(g.forecastDate)}</div>
                      <div className="sub">
                        {daysUntil(g.forecastDate)}
                        {slipped ? <span className={`gc-slip ${slipTone}`}>+{g.slipDays}d</span> : null}
                      </div>
                    </td>
                    <td>
                      {hasCriteria ? (
                        <div className="bar">
                          <div className="bar-t">
                            <div className={`bar-f ${rdTone}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`bar-v ${rdTone}`}>
                            {g.criteriaMet}/{g.criteriaTotal}
                          </span>
                        </div>
                      ) : (
                        <span className="gc-nc">not yet defined</span>
                      )}
                    </td>
                    <td>
                      {/* "ready" is only true when criteria EXIST and are all met —
                          0/0 is an undefined checklist, not a satisfied one. */}
                      {!hasCriteria ? (
                        <span className="pill">&mdash;</span>
                      ) : (
                        <span className={`pill ${openCount ? rdTone : ''}`}>
                          {openCount ? `${openCount} open` : 'all met'}
                        </span>
                      )}
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
