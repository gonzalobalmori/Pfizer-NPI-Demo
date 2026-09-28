/*
 * Open issues (#v-alerts) — ported verbatim from the click-through's markup and
 * CSS classes (.al-lens / .wl / .filt / .fb2 / .hb / .al-wrap / .al / .cat /
 * .wo / .slp / .al-go). Static headings and labels are copied word-for-word;
 * every row and count is fed by the live PortfolioService.openIssues c3Action.
 *
 * Every open exception across the portfolio, whoever owns it — sorted worst
 * first. Clicking a row opens the finding behind it (§5). Timestamps absolute.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import Glyph from '@/components/Brand/Glyph';
import { getOpenIssues } from '@/api/portfolio';
import { fmtEuro } from '@/lib/format';
import type { OpenIssues, IssueRow, WaitingOn } from '@/types/portfolio';
import { labelFor } from '@/productLabel';
import { pharma } from '@/pharmaText';

type WaitingFilter = 'all' | 'you' | 'other' | 'agent' | 'authority';
type ImpactFilter = 'all' | 'ct' | 'rk' | 'ok';

/* the waiting-on class the prototype puts on the .wo chip */
const WO_CLASS: Record<WaitingOn, 'you' | 'other' | 'agent' | 'authority'> = {
  YOU: 'you',
  PERSON: 'other',
  AGENT: 'agent',
  AUTHORITY: 'authority',
};
/* the lens filter each waiting-on bucket answers to */
const WO_FILTER: Record<WaitingOn, WaitingFilter> = {
  YOU: 'you',
  PERSON: 'other',
  AGENT: 'agent',
  AUTHORITY: 'authority',
};
/* impact category → the label shown in the .cat chip */
const CAT_LABEL: Record<'ct' | 'rk' | 'ok', string> = {
  ct: 'Blocking a gate',
  rk: 'Consuming float',
  ok: 'Monitored',
};

export default function AlertsView() {
  const { open } = useNav();
  const [data, setData] = useState<OpenIssues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<WaitingFilter>('all');
  const [impact, setImpact] = useState<ImpactFilter>('all');

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getOpenIssues());
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load open issues.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      const woF = WO_FILTER[r.waitingOn];
      if (waiting !== 'all' && woF !== waiting) return false;
      if (impact !== 'all' && r.category !== impact) return false;
      return true;
    });
  }, [data, waiting, impact]);

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!data) return <div className="view on v-msg">Loading&hellip;</div>;

  const total = data.total;
  const youN = data.counts.YOU ?? 0;
  const otherN = data.counts.PERSON ?? 0;
  const agentN = data.counts.AGENT ?? 0;
  const authorityN = data.counts.AUTHORITY ?? 0;

  const ctN = data.rows.filter((r) => r.category === 'ct').length;
  const rkN = data.rows.filter((r) => r.category === 'rk').length;
  const okN = data.rows.filter((r) => r.category === 'ok').length;

  /*
   * The holder split, in a FIXED order (never re-sorted by size) so a bar keeps
   * its position and colour as the data changes — re-ranking on every refresh is
   * what makes a dashboard unreadable. Tone follows who must act: "you" is the
   * one the user can clear personally, an authority is an unmovable wait.
   */
  const holderSplit: { key: WaitingFilter; label: string; n: number; tone: string }[] = [
    { key: 'you', label: 'You', n: youN, tone: 'you' },
    { key: 'other', label: 'Someone else', n: otherN, tone: 'other' },
    { key: 'agent', label: 'An agent', n: agentN, tone: 'agent' },
    { key: 'authority', label: 'An authority', n: authorityN, tone: 'authority' },
  ];

  /* Every roll-up below reads the SERVER-computed totals (PortfolioService.
     openIssues.totals), NOT a local re-sum of the visible rows. This is the fix
     for the reconciliation bug: the page used to sum rows itself, so a filtered
     view or a differing grain drifted from the Cockpit. Now:
       exposedTotal    — the canonical "Revenue exposed" (Σ open Finding.exposure);
                         equals the Cockpit revenueExposed KPI by construction.
       ctExposure      — the gate-blocking subset, shown as "of €X exposed".
       daysAtStake / recoverableDays / regulatorDays — identical to the Cockpit
                         time-recovery chart and the Time-impact view. */
  const t = data.totals;
  const exposedTotal = t.exposureOpen;
  const ctExposure = t.exposureBlocking;
  const launchCount = t.launchCount;
  const daysAtStake = t.daysAtStake;
  const recoverableDays = t.recoverableDays;
  const regulatorDays = t.regulatorDays;
  const pctRecoverable = t.pctRecoverable;

  return (
    <div className="view on" id="v-alerts">
      <div className="vhd">
        <div>
          <div className="vt">Open issues</div>
        </div>
      </div>

      <div className="al-lens">
        <button type="button" className={`wl${waiting === 'all' ? ' on' : ''}`} onClick={() => setWaiting('all')}>
          <i />All<b>{total}</b>
        </button>
        <button type="button" className={`wl you${waiting === 'you' ? ' on' : ''}`} onClick={() => setWaiting('you')}>
          <i />Waiting on you<b>{youN}</b>
        </button>
        <button type="button" className={`wl other${waiting === 'other' ? ' on' : ''}`} onClick={() => setWaiting('other')}>
          <i />Waiting on someone else<b>{otherN}</b>
        </button>
        <button type="button" className={`wl agent${waiting === 'agent' ? ' on' : ''}`} onClick={() => setWaiting('agent')}>
          <i />Agent handling it<b>{agentN}</b>
        </button>
        <button type="button" className={`wl authority${waiting === 'authority' ? ' on' : ''}`} onClick={() => setWaiting('authority')}>
          <i />Waiting on an authority<b>{authorityN}</b>
        </button>
      </div>

      <div className="filt" style={{ margin: '0 0 12px' }}>
        <span className="filt-l">Impact</span>
        <button type="button" className={`fb2${impact === 'all' ? ' on' : ''}`} onClick={() => setImpact('all')}>
          All
        </button>
        <button type="button" className={`fb2${impact === 'ct' ? ' on' : ''}`} onClick={() => setImpact('ct')}>
          Blocking a gate &middot; {ctN}
        </button>
        <button type="button" className={`fb2${impact === 'rk' ? ' on' : ''}`} onClick={() => setImpact('rk')}>
          Consuming float &middot; {rkN}
        </button>
        <button type="button" className={`fb2${impact === 'ok' ? ' on' : ''}`} onClick={() => setImpact('ok')}>
          Monitored &middot; {okN}
        </button>
      </div>

      <div className="hb">
        <div className="hb-m">
          <span className="hb-lb">Open exceptions</span>
          <b>{total}</b>
          <span className="hb-sb">across {launchCount} launches</span>
          <span className="hb-d">{youN} waiting on you</span>
        </div>
        <div className="hb-m">
          <span className="hb-lb">Revenue exposed</span>
          <b className="r">{exposedTotal > 0 ? fmtEuro(exposedTotal) : '—'}</b>
          <span className="hb-sb">{ctExposure > 0 ? `${fmtEuro(ctExposure)} blocking a gate` : 'exposure pending'}</span>
          <span className="hb-d r">{ctN} of {total} block a gate</span>
        </div>
        <div className="hb-m">
          <span className="hb-lb">Recoverable by acting</span>
          <b className="g">{recoverableDays} d</b>
          <span className="hb-sb">{pctRecoverable}% of {daysAtStake} d at stake</span>
          <span className="hb-d g">you can pull in</span>
        </div>
        <div className="hb-m">
          <span className="hb-lb">Waiting on an authority</span>
          <b>{regulatorDays} d</b>
          {/* The authorities a drug launch actually waits on: FDA in the US,
              EMA/CHMP in the EU, then payer/reimbursement. */}
          <span className="hb-sb">FDA &middot; EMA &middot; payer</span>
          <span className="hb-d">acting won&apos;t move it</span>
        </div>
        {/*
          * Who is actually holding these exceptions. This replaced an 8-week
          * "trend" area chart whose polyline coordinates, its "peak 15" and its
          * "8 w ago · 14" endpoint were all hard-coded in the view — no backend
          * field feeds a weekly history, so the trend could not be made true
          * (R-BASE-03). The holder split IS real (openIssues.counts) and answers
          * the more useful question: is this queue mine to clear or someone
          * else's? Bars are labelled and ordered, so colour carries nothing
          * alone.
          */}
        <div className="hb-c hb-w">
          <div className="hb-ct">
            <span>Who is holding them</span>
            <i>{total} open</i>
          </div>
          <div className="hb-br">
            {holderSplit.map((hs) => (
              <button
                type="button"
                key={hs.key}
                className={`hbb${waiting === hs.key ? ' on' : ''}`}
                onClick={() => setWaiting(hs.key)}
                title={`${hs.label} — ${hs.n} of ${total}; click to filter`}
              >
                <span className="hbb-l">{hs.label}</span>
                <span className="hbb-t">
                  <span className={`hbb-f ${hs.tone}`} style={{ width: `${total > 0 ? (hs.n / total) * 100 : 0}%` }} />
                </span>
                <span className="hbb-n">{hs.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="al-wrap">
        <table className="al">
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="l">Issue</th>
              <th className="l">Impact</th>
              <th className="l">Launch</th>
              <th className="l">Waiting on</th>
              <th className="l">Time impact</th>
              <th className="n">Slip</th>
              <th className="n">&euro;M</th>
              <th className="l" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <AlertRow key={r.findingId} row={r} onOpen={() => open('issue', r.findingId)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertRow({ row, onOpen }: { row: IssueRow; onOpen: () => void }) {
  const cat = row.category ?? 'ok';
  const wo = WO_CLASS[row.waitingOn];
  const catTone = cat === 'ct' ? 'r' : cat === 'rk' ? 'a' : '';
  return (
    <tr className={cat} data-npi={row.displayId} onClick={onOpen}>
      <td className="l">
        <span className="al-id">{row.displayId}</span>
        <span className="al-t">{pharma(row.headline)}</span>
        <span className="al-rc">{pharma(row.description)}</span>
      </td>
      <td className="l">
        <span className={`cat ${cat}`}>{CAT_LABEL[cat]}</span>
      </td>
      <td className="l">
        <b>{labelFor(row)}</b>
        <span className="sub">{row.franchise}</span>
      </td>
      <td className="l">
        <span className={`wo ${wo}`}>{row.waitingOnLabel}</span>
        <span className="sub">{row.phaseName}</span>
      </td>
      <td className="l">
        <TimeImpactChip row={row} />
      </td>
      <td className="n">
        <GateSlipChip row={row} tone={catTone} />
      </td>
      <td className="n">
        <b className={`mono ${catTone}`}>{row.exposure != null ? fmtEuro(row.exposure) : '—'}</b>
      </td>
      <td className="l">
        {/* The call-to-action reflects who owns the next step, so the word never
            contradicts the "Waiting on" column:
            · AUTHORITY — the next step is with an outside body (FDA / Notified
              Body / payer); acting can't pull it in, so it's read-only "View detail".
            · AGENT — an agent is actively resolving it (outcome RUNNING); nothing is
              pending on the user, so it offers "View progress", never "Resolve".
            · everyone else — a call the user (or a named person) owes → "Resolve". */}
        <span className="al-go">
          {row.waitingOn === 'AUTHORITY' ? 'View detail' : row.waitingOn === 'AGENT' ? 'View progress' : 'Resolve'}{' '}
          <Glyph name="arrow-right" className="sm" />
        </span>
      </td>
    </tr>
  );
}

/*
 * Time-impact chip — the calendar days this finding is holding on the critical
 * path and whether acting can win them back. `recoverable` (from the backend) is
 * true when the whole cost is accelerable by your own org (SELF / TEAM / AGENT);
 * an AUTHORITY finding is a fixed wait (FDA / CHMP rapporteur / reimbursement) that
 * acting faster cannot compress — the message the user asked to surface.
 */
function TimeImpactChip({ row }: { row: IssueRow }) {
  const days = row.daysAtStake ?? 0;
  if (days <= 0) {
    return <span className="ti-c-none">no schedule impact</span>;
  }
  return (
    <div className="ti-c">
      <b className={`ti-c-d ${row.recoverable ? 'g' : ''}`}>{days} d</b>
      <span className={`ti-c-b ${row.recoverable ? 'rec' : 'reg'}`}>
        {row.recoverable ? 'You can accelerate' : 'Waiting on authority'}
      </span>
    </div>
  );
}

/*
 * Gate-slip chip (the "Slip" column) — the schedule slip of the gate this finding
 * puts at risk (the gate that closes the finding's phase), from the backend
 * gateAtRisk projection. This is the SAME gate the resolution workspace and the
 * finding card name, so "gate at risk" reconciles across every view. The gate
 * slip (how far the gate has moved on the calendar) is deliberately DISTINCT from
 * the finding's own days-at-stake in the Time-impact column: a gate can be 47
 * days late while a single finding on it holds only 6.
 */
function GateSlipChip({ row, tone }: { row: IssueRow; tone: string }) {
  const g = row.gateAtRisk;
  if (!g) return <span className="slp n">—</span>;
  const late = g.status === 'late' && (g.slipDays ?? 0) > 0;
  return (
    <span className={`slp ${late ? tone || 'a' : 'n'}`}>
      {g.code}
      {late ? ` +${g.slipDays}d` : g.status === 'no' ? ' · not met' : ' · on plan'}
    </span>
  );
}
