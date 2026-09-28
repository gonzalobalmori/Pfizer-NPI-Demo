/*
 * Milestone replan (#v-cascade) — SCENARIO 1: connected milestone management +
 * dynamic cascade replan. An outside authority (the FDA) moves a launch's
 * clearance date; the platform fans the impact across every downstream
 * commitment — manufacturing schedule, launch stock deployment, commercial comms,
 * carrying cost — auto-adjusting what it safely can and surfacing only the items
 * that genuinely need a human. The screen IS the exception dashboard Jordan/George
 * gets: "N auto-adjusted, M require a human decision."
 *
 * Every figure is live from the backend CascadeReplanService (plan / cascadeReplan
 * / resolveImpact / reset) — no mock data. Prototype CSS classes are reused
 * (.vhd/.btn/.kgrid/.kc/.pnl/.dt/.pill) so it reads as part of the same app.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import {
  getCascadePlan,
  runCascadeReplan,
  resolveCascadeImpact,
  resetCascade,
  Velsipity_LAUNCH_ID,
} from '@/api/cascade';
import { fmtDate, fmtEuro } from '@/lib/format';
import type { CascadePlan, CascadeItem } from '@/types/portfolio';
import Glyph from '@/components/Brand/Glyph';
import DomainIcon from '@/components/Brand/DomainIcon';

/* The six-week FDA slip the scenario describes, applied against the milestone
 * baseline (2026-11-02 → 2026-12-14 = +42 days). Kept here so the "book the slip"
 * button is a single, explicit gesture the presenter controls. */
const SLIP_TARGET_ISO = '2026-12-14';

function AutoItem({ item }: { item: CascadeItem }) {
  const adjusted = item.status === 'AUTO_ADJUSTED';
  return (
    <div className="cs-item" data-item={item.id}>
      <div className="cs-item-h">
        <DomainIcon domain={item.domain} className="cs-ic" />
        <div className="cs-item-hx">
          <div className="cs-item-t">{item.targetLabel}</div>
          <div className="cs-item-d">{item.domainLabel}</div>
        </div>
        <span className={`pill ${adjusted ? 'g' : 'z'}`}>
          {adjusted ? 'Auto-adjusted' : 'Pending'}
        </span>
      </div>
      {item.detail && <p className="cs-item-p">{item.detail}</p>}
      {adjusted && item.autoAction && (
        <div className="cs-auto">
          <span className="cs-auto-lbl">What the platform did</span>
          <span className="cs-auto-tx">{item.autoAction}</span>
        </div>
      )}
    </div>
  );
}

function HumanItem({
  item,
  onResolve,
  busy,
}: {
  item: CascadeItem;
  onResolve: (itemId: string, option: string) => void;
  busy: boolean;
}) {
  const resolved = item.status === 'RESOLVED';
  return (
    <div className={`cs-item hum${resolved ? ' res' : ''}`} data-item={item.id}>
      <div className="cs-item-h">
        <DomainIcon domain={item.domain} className="cs-ic" />
        <div className="cs-item-hx">
          <div className="cs-item-t">{item.targetLabel}</div>
          <div className="cs-item-d">
            {item.domainLabel}
            {item.ownerName ? ` · ${item.ownerName}` : ''}
          </div>
        </div>
        <span className={`pill ${resolved ? 'g' : 'a'}`}>
          {resolved ? 'Decided' : 'Needs a human'}
        </span>
      </div>
      {item.detail && <p className="cs-item-p">{item.detail}</p>}
      {item.decisionPrompt && <div className="cs-prompt">{item.decisionPrompt}</div>}
      {resolved ? (
        <div className="cs-resolved">
          <span className="cs-auto-lbl">Decision taken</span>
          <span className="cs-auto-tx">{item.resolvedOption}</span>
        </div>
      ) : (
        <div className="cs-opts">
          {item.decisionOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="btn s sm cs-opt"
              disabled={busy}
              onClick={() => onResolve(item.id, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CascadeView() {
  const { intent } = useNav();
  const [plan, setPlan] = useState<CascadePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await getCascadePlan(Velsipity_LAUNCH_ID);
      setPlan(p);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the replan dashboard.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* The guided tour can land here already showing the cascade result. */
  const cascadeRun = intent?.cascadeRun;
  const milestoneId = plan?.milestone.id;
  const alreadyRun = plan?.milestone.status === 'REPLANNED';
  useEffect(() => {
    if (!cascadeRun || !milestoneId || alreadyRun || busy) return;
    let cancelled = false;
    setBusy(true);
    runCascadeReplan(milestoneId, SLIP_TARGET_ISO)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err) => {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Cascade failed.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cascadeRun, milestoneId, alreadyRun, busy, intent?.seq]);

  const runCascade = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const p = await runCascadeReplan(plan.milestone.id, SLIP_TARGET_ISO);
      setPlan(p);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Cascade failed.');
    } finally {
      setBusy(false);
    }
  }, [plan]);

  const doReset = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const p = await resetCascade(plan.milestone.id);
      setPlan(p);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }, [plan]);

  const onResolve = useCallback(
    async (itemId: string, option: string) => {
      setBusy(true);
      setError(null);
      try {
        const p = await resolveCascadeImpact(itemId, option);
        setPlan(p);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Could not record the decision.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const autoItems = useMemo(
    () => (plan ? plan.items.filter((i) => i.resolution === 'AUTO') : []),
    [plan],
  );
  const humanItems = useMemo(
    () => (plan ? plan.items.filter((i) => i.resolution === 'HUMAN') : []),
    [plan],
  );

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!plan) return <div className="view on v-msg">Loading…</div>;

  const m = plan.milestone;
  const s = plan.summary;
  const slipped = m.status === 'REPLANNED' && m.slipDays > 0;

  return (
    <div className="view on" id="v-cascade">
      {/* header + primary action */}
      <div className="vhd">
        <div>
          <div className="vt">Milestone replan</div>
          <div className="vs">
            {m.launchName} · {m.authority} · {m.milestoneName}
          </div>
        </div>
        <div className="cs-actions">
          {slipped ? (
            <button type="button" className="btn s" disabled={busy} onClick={doReset}>
              Reset scenario
            </button>
          ) : (
            <button type="button" className="btn p" id="cs-run" disabled={busy} onClick={runCascade}>
              {busy ? 'Cascading…' : 'FDA slips 6 weeks — run cascade replan'}
            </button>
          )}
        </div>
      </div>

      {/* milestone + exception summary KPI band */}
      <div className="kgrid" id="cs-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kc">
          <div className="kc-t">Regulatory milestone</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className={`kc-v ${slipped ? 'r' : ''}`} style={{ fontSize: 26 }}>
                {slipped ? `+${m.slipWeeks}` : '0'}
              </span>
              <span className="kc-u">{slipped ? 'wks' : 'on track'}</span>
            </div>
          </div>
          <div className="kc-ft">
            {fmtDate(m.baselineDate)} <Glyph name="arrow-right" className="sm" /> <b>{fmtDate(m.currentDate)}</b>
            {slipped ? ` · +${m.slipDays} days` : ''}
          </div>
        </div>
        <div className="kc" id="cs-auto-kpi">
          <div className="kc-t">Auto-adjusted</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className="kc-v" style={{ fontSize: 26 }}>{s.autoAdjusted}</span>
              <span className="kc-u">of {s.total}</span>
            </div>
          </div>
          <div className="kc-ft">Re-timed by the platform, no human needed</div>
        </div>
        <div className="kc" id="cs-human-kpi">
          <div className="kc-t">Need a human decision</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className={`kc-v ${s.needDecision > 0 ? 'a' : ''}`} style={{ fontSize: 26 }}>
                {s.needDecision}
              </span>
              <span className="kc-u">open</span>
            </div>
          </div>
          <div className="kc-ft">
            {s.resolved > 0 ? <b>{s.resolved} resolved</b> : 'Exception-based decision surface'}
          </div>
        </div>
        <div className="kc">
          <div className="kc-t">Working-capital impact</div>
          <div className="kc-hero">
            <div className="kc-num">
              <span className="kc-v" style={{ fontSize: 26 }}>{fmtEuro(s.costTotal)}</span>
            </div>
          </div>
          <div className="kc-ft">Carrying cost leadership sees in real time</div>
        </div>
      </div>

      {!slipped && (
        <div className="cs-hint">
          The FDA clearance date has not moved yet. Manufacturing has built launch stock, launch stock are
          staged at the 3PL, and the field is trained for the original go-live. Press{' '}
          <b>run cascade replan</b> to see the six-week slip fan out across every downstream plan.
        </div>
      )}

      {/* the two-column exception dashboard */}
      <div className="two cs-two">
        <div className="pnl">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Auto-adjusted by the platform</div>
              <div className="pnl-s">Held, re-timed or flagged automatically — recorded, not asked</div>
            </div>
          </div>
          <div className="cs-list" id="cs-auto-list">
            {autoItems.map((it) => (
              <AutoItem key={it.id} item={it} />
            ))}
          </div>
        </div>

        <div className="pnl">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Requires a human decision</div>
              <div className="pnl-s">The judgement calls the cascade cannot make for you</div>
            </div>
          </div>
          <div className="cs-list" id="cs-human-list">
            {humanItems.map((it) => (
              <HumanItem key={it.id} item={it} onResolve={onResolve} busy={busy} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
