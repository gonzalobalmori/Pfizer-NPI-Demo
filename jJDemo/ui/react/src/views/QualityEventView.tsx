/*
 * Quality disruption (#v-quality) — SCENARIO 1.
 *
 * "A launch batch is placed on hold after visual inspection identifies a
 *  stopper-related defect. The launch ecosystem must determine the scope,
 *  evaluate recovery and supply options, protect priority markets, make the
 *  necessary Quality and launch decisions, and coordinate the approved response."
 *
 * The screen is that sentence, in order, as five governed steps:
 *
 *   1  Determine the scope      — sweep every batch filled from the suspect lot
 *   2  Evaluate the options     — recovery and supply, scored on the same axes
 *   3  Protect priority markets — allocate clean + recovered stock by priority
 *   4  Make the decision        — Quality signature, 21 CFR Part 11 trail
 *   5  Coordinate the response  — disposition, CAPA, owned actions per function
 *
 * Every figure is live from QualityDisruptionService. There is no fallback data:
 * a failing call surfaces as an error in the view.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import {
  QUALITY_EVENT_ID,
  getQualityPlan,
  determineScope,
  evaluateQualityOptions,
  previewQualityAllocation,
  decideQuality,
  coordinateQuality,
  resetQuality,
} from '@/api/scenarios';
import type {
  QualityPlan,
  QualityAllocationPreview,
  QualityStage,
  AllocationRow,
} from '@/types/scenarios';
import { fmtDate, fmtEuro } from '@/lib/format';
import StepRail, { type StepDef } from '@/components/scenario/StepRail';
import OptionCard from '@/components/scenario/OptionCard';
import Glyph from '@/components/Brand/Glyph';

/* The Quality signature of record for this event. A. Kowalski holds the Quality
 * function, which the service requires for a batch-disposition decision. */
const QUALITY_SIGNER = 'seed_person_ak';
const SIGN_RATIONALE =
  'Approved on the scored comparison: the recommended option protects the priority ' +
  'markets inside their tender windows at the lowest residual risk, and the residual ' +
  'exposure is accepted and recorded against the CAPA.';

const STEPS: StepDef[] = [
  {
    label: 'Scope',
    hint: 'Sweep every batch filled from the suspect stopper lot and total the exposure.',
    action: 'Determine the scope',
  },
  {
    label: 'Options',
    hint: 'Score the recovery and supply options against the expiry and tender clocks.',
    action: 'Evaluate the options',
  },
  {
    label: 'Markets',
    hint: 'Preview an option to see which priority markets it protects, and which go short.',
    action: null,
  },
  {
    label: 'Decision',
    hint: 'Approve one option under the Quality Council with a Part 11 signature.',
    action: null,
  },
  {
    label: 'Coordinate',
    hint: 'Disposition the batches, raise the CAPA and issue the owned actions.',
    action: 'Coordinate the response',
  },
];

/** Backend stage → rail position. The rail follows the data, never local state. */
const STAGE_STEP: Record<QualityStage, number> = {
  RAISED: 0,
  SCOPED: 1,
  OPTIONS_EVALUATED: 2,
  DECIDED: 4,
  COORDINATED: 5,
};

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

/** Tone for a market's allocation state. */
function stateTone(state: string): string {
  if (state === 'PROTECTED') return 'g';
  if (state === 'CONSTRAINED') return 'a';
  if (state === 'MISSED_WINDOW') return 'r';
  return 'z';
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

/* ── which markets keep their doses ────────────────────────────────── */
function MarketTable({
  rows,
  basis,
  previewLabel,
}: {
  rows: AllocationRow[];
  basis: 'CLEAN_STOCK_ONLY' | 'COMMITTED';
  previewLabel: string | null;
}) {
  return (
    <div className="pnl" id="q-markets">
      <div className="pnl-h">
        <div>
          <div className="pnl-t">Priority markets</div>
          <div className="pnl-s">
            {previewLabel
              ? `Projected under: ${previewLabel}`
              : basis === 'COMMITTED'
                ? 'The allocation committed by the decision'
                : 'Exposure from clean stock alone, in priority order'}
          </div>
        </div>
      </div>
      <table className="dt sc-dt">
        <thead>
          <tr>
            <th>#</th>
            <th>Market</th>
            <th className="n">Committed</th>
            <th className="n">Allocated</th>
            <th className="n">Short</th>
            <th className="n">Revenue lost</th>
            <th>Tender window</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.commitmentId} data-market={r.marketCode ?? ''}>
              <td>
                <div className="nm mono">{r.priorityRank}</div>
              </td>
              <td>
                <div className="nm">
                  {r.marketCode} &mdash; {r.marketName}
                </div>
                <div className="sub">
                  {r.priorityTier} · {r.regulatoryBody}
                </div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(r.committedDoses)}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(r.allocatedDoses)}</div>
              </td>
              <td className="n">
                <div className={`nm mono${r.shortfallDoses > 0 ? ' sc-neg' : ''}`}>
                  {r.shortfallDoses > 0 ? fmtNum(r.shortfallDoses) : '—'}
                </div>
              </td>
              <td className="n">
                <div className={`nm mono${r.revenueLost > 0 ? ' sc-neg' : ''}`}>
                  {r.revenueLost > 0 ? fmtEuro(r.revenueLost) : '—'}
                </div>
              </td>
              <td>
                {r.tenderDeadline ? (
                  <>
                    <div className={`nm mono${r.missedWindow ? ' sc-neg' : ''}`}>
                      {fmtDate(r.tenderDeadline)}
                    </div>
                    <div className="sub">
                      {r.missedWindow ? 'closes before supply' : 'open'}
                      {r.contractPenalty ? ' · penalty clause' : ''}
                    </div>
                  </>
                ) : (
                  <div className="sub">no tender</div>
                )}
              </td>
              <td>
                <span className={`pill ${stateTone(r.state)}`}>
                  {r.state === 'MISSED_WINDOW' ? 'Window missed' : titleCase(r.state)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── which batches are held, and why ──────────────────────────────── */
function BatchTable({ plan }: { plan: QualityPlan }) {
  const limit = plan.event.actionLimitPpm;
  return (
    <div className="pnl" id="q-batches">
      <div className="pnl-h">
        <div>
          <div className="pnl-t">Fill batches</div>
          <div className="pnl-s">
            Inspection reject rate against the {fmtNum(limit)} ppm action limit · a batch is held for
            the lot it was filled from, not only for how it tested on its own
          </div>
        </div>
      </div>
      <table className="dt sc-dt">
        <thead>
          <tr>
            <th>Batch</th>
            <th>Site</th>
            <th className="n">Doses</th>
            <th>Filled</th>
            <th>Stopper lot</th>
            <th className="n">Reject ppm</th>
            <th>State</th>
            <th>Disposition</th>
          </tr>
        </thead>
        <tbody>
          {plan.batches.map((b) => (
            <tr key={b.id} data-batch={b.batchNo}>
              <td>
                <div className="nm mono">{b.batchNo}</div>
                <div className="sub">{b.presentation}</div>
              </td>
              <td>
                <div className="nm">{b.siteName}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(b.doseCount)}</div>
              </td>
              <td>
                <div className="nm mono">{fmtDate(b.fillDate)}</div>
                <div className="sub">exp {fmtDate(b.expiryDate)}</div>
              </td>
              <td>
                <div className={`nm mono${b.fromSuspectLot ? ' sc-neg' : ''}`}>
                  {b.lotNo ?? '—'}
                </div>
                {b.fromSuspectLot && <div className="sub">suspect lot</div>}
              </td>
              <td className="n">
                <div className={`nm mono${b.overActionLimit ? ' sc-neg' : ''}`}>
                  {fmtNum(b.inspectionRejectPpm)}
                </div>
                {b.overActionLimit && <div className="sub">over limit</div>}
              </td>
              <td>
                <span
                  className={`pill ${b.state === 'HOLD' ? 'r' : b.state === 'RELEASED' ? 'g' : 'z'}`}
                >
                  {titleCase(b.state)}
                </span>
              </td>
              <td>
                {b.disposition ? (
                  <>
                    <span className={`pill ${b.disposition === 'RELEASE' ? 'g' : 'r'}`}>
                      {titleCase(b.disposition)}
                    </span>
                    {b.dispositionByName && <div className="sub">{b.dispositionByName}</div>}
                  </>
                ) : (
                  <span className="sub">pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QualityEventView() {
  const { intent } = useNav();
  const [plan, setPlan] = useState<QualityPlan | null>(null);
  const [preview, setPreview] = useState<QualityAllocationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getQualityPlan(QUALITY_EVENT_ID)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(typeof err === 'string' ? err : 'Failed to load the quality event.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stage = plan?.event.stage ?? 'RAISED';
  const step = STAGE_STEP[stage];
  const decided = stage === 'DECIDED' || stage === 'COORDINATED';

  /* Run whichever step the rail says is live. The stage in the returned bundle
   * moves the rail on, so the button always does the next real thing. */
  const runStep = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const id = plan.event.id;
      let next: QualityPlan;
      if (stage === 'RAISED') next = await determineScope(id);
      else if (stage === 'SCOPED') next = await evaluateQualityOptions(id);
      else if (stage === 'DECIDED') next = await coordinateQuality(id);
      else return;
      setPlan(next);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'That step could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [plan, stage]);

  const doReset = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const p = await resetQuality(plan.event.id);
      setPlan(p);
      setPreview(null);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }, [plan]);

  const onSelect = useCallback(
    async (optionId: string) => {
      if (!plan) return;
      setBusy(true);
      setError(null);
      try {
        const pv = await previewQualityAllocation(plan.event.id, optionId, false);
        setPreview(pv);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'Could not project that option.');
      } finally {
        setBusy(false);
      }
    },
    [plan],
  );

  const onDecide = useCallback(
    async (optionId: string) => {
      if (!plan) return;
      setBusy(true);
      setError(null);
      try {
        /* Commit the allocation the decision rests on, then sign it — so the
         * market commitments and the signature describe the same plan. */
        await previewQualityAllocation(plan.event.id, optionId, true);
        const p = await decideQuality(plan.event.id, optionId, QUALITY_SIGNER, SIGN_RATIONALE);
        setPlan(p);
        setPreview(null);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'The decision was refused.');
      } finally {
        setBusy(false);
      }
    },
    [plan],
  );

  /* The guided tour can drive this view to a given step. */
  const driveStep = intent?.qualityStep;
  const driveSeq = intent?.seq;
  useEffect(() => {
    if (driveStep == null || !plan || busy) return;
    if (step >= driveStep) return;
    let cancelled = false;
    const advance = async () => {
      setBusy(true);
      try {
        const id = plan.event.id;
        let p: QualityPlan = plan;
        if (p.event.stage === 'RAISED' && driveStep >= 1) p = await determineScope(id);
        if (p.event.stage === 'SCOPED' && driveStep >= 2) p = await evaluateQualityOptions(id);
        if (!cancelled) setPlan(p);
      } catch (err) {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Could not advance the scenario.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    advance();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveStep, driveSeq]);

  const rows = useMemo<AllocationRow[]>(
    () => preview?.rows ?? plan?.allocation ?? [],
    [preview, plan],
  );
  const selectedOption = useMemo(
    () => plan?.options.find((o) => o.id === preview?.optionId) ?? null,
    [plan, preview],
  );

  if (error && !plan) return <div className="view on v-msg v-err">{error}</div>;
  if (!plan) return <div className="view on v-msg">Loading the quality event…</div>;

  const e = plan.event;
  const s = plan.summary;
  const lot = plan.componentLot;
  const scoped = step >= 1;

  return (
    <div className="view on" id="v-quality">
      <div className="vhd">
        <div>
          <div className="vt">Quality disruption — batch hold</div>
          <div className="vs">
            {e.eventNo} · {e.launchName} · {e.siteName}
            {e.siteLocation ? `, ${e.siteLocation}` : ''} · raised by {e.raisedByName} on{' '}
            {fmtDate(e.raisedAt)}
          </div>
        </div>
      </div>

      {error && <div className="cs-hint sc-err">{error}</div>}

      <StepRail
        steps={STEPS}
        current={step}
        busy={busy}
        onRun={runStep}
        onReset={doReset}
        complete={stage === 'COORDINATED'}
      />

      {/* what the inspector found · what the hold reaches */}
      <div className="two sc-two">
        <div className="pnl" id="q-defect">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">What visual inspection found</div>
              <div className="pnl-s">
                {titleCase(e.detectionMethod ?? '')} · {titleCase(e.defectCategory ?? '')}
              </div>
            </div>
            <div className="h-sp" />
            <span className={`pill ${e.severity === 'CRITICAL' ? 'r' : 'a'}`}>
              {titleCase(e.severity ?? '')}
            </span>
          </div>
          <div className="sc-body">
            <p className="sc-p">{e.defectDescription}</p>
            {lot && (
              <dl className="sc-dl">
                <div className="sc-dr">
                  <dt>Suspect lot</dt>
                  <dd>
                    <b className="mono">{lot.lotNo}</b> — {lot.componentName}
                  </dd>
                </div>
                <div className="sc-dr">
                  <dt>Supplier</dt>
                  <dd>
                    {lot.supplierName}
                    {lot.singleSource && <span className="pill r sc-inl">Single source</span>}
                  </dd>
                </div>
                <div className="sc-dr">
                  <dt>Lot defect rate</dt>
                  <dd>
                    <b className="mono">{fmtNum(lot.defectRatePpm)} ppm</b> against a{' '}
                    {fmtNum(e.actionLimitPpm)} ppm action limit
                  </dd>
                </div>
                <div className="sc-dr">
                  <dt>Lot remaining</dt>
                  <dd className="mono">
                    {fmtNum(lot.quantityRemaining)} units · {titleCase(lot.acceptanceStatus ?? '')}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>

        <div className="pnl" id="q-scope">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Scope of the hold</div>
              <div className="pnl-s">
                {scoped
                  ? 'Every batch filled from the suspect lot, and what it was going to serve'
                  : 'Not yet determined — run step 1'}
              </div>
            </div>
          </div>
          <div className="sc-body">
            <div className="sc-grid">
              <div className="sc-kv">
                <span className="sc-kv-v">{scoped ? e.scopeBatchCount : '—'}</span>
                <span className="sc-kv-l">batches held</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v">{scoped ? fmtNum(e.scopeDoses) : '—'}</span>
                <span className="sc-kv-l">doses on hold</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v">{scoped ? e.scopeMarketCount : '—'}</span>
                <span className="sc-kv-l">markets touched</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v r">{scoped ? fmtEuro(e.scopeRevenueAtRisk) : '—'}</span>
                <span className="sc-kv-l">revenue at risk</span>
              </div>
            </div>
            {scoped && (
              <div className="sc-esc">
                <div className={`sc-esc-i ${e.recallAssessmentRequired ? 'on' : ''}`}>
                  <Glyph name={e.recallAssessmentRequired ? 'diamond' : 'check'} />
                  <span>
                    {e.recallAssessmentRequired
                      ? `Recall assessment required — ${fmtNum(s.releasedFromSuspectLot)} doses from the suspect lot are already released to market`
                      : 'No released stock from the suspect lot, so no recall assessment'}
                  </span>
                </div>
                <div className={`sc-esc-i ${e.regulatoryNotificationRequired ? 'on' : ''}`}>
                  <Glyph name={e.regulatoryNotificationRequired ? 'diamond' : 'check'} />
                  <span>
                    {e.regulatoryNotificationRequired
                      ? 'Regulatory notification required before the response can be executed'
                      : 'No regulatory notification triggered'}
                  </span>
                </div>
                <div className="sc-esc-i">
                  <Glyph name="dot" />
                  <span>
                    {fmtNum(s.cleanDoses)} doses of clean stock against {fmtNum(s.committedDoses)}{' '}
                    committed — {fmtNum(s.uncoveredDoses)} uncovered across {s.marketCount} markets,{' '}
                    {s.marketsProtectedFromCleanStock} of which clean stock alone can keep whole
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* the scored options */}
      {plan.options.length > 0 && (
        <div className="pnl sc-opnl" id="q-options">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Recovery and supply options</div>
              <div className="pnl-s">
                {s.feasibleOptionCount} of {s.optionCount} can be executed inside the expiry and
                tender clocks · each scored on doses, days, cost and markets kept whole
              </div>
            </div>
            {decided && e.approvedOptionLabel && (
              <>
                <div className="h-sp" />
                <span className="pill g">Decided: {e.approvedOptionLabel}</span>
              </>
            )}
          </div>
          <div className="oc-grid">
            {plan.options.map((o) => (
              <OptionCard
                key={o.id}
                option={o}
                selected={preview?.optionId === o.id}
                decided={decided}
                onSelect={onSelect}
                onDecide={step >= 2 && !decided ? onDecide : undefined}
                busy={busy}
                decideLabel="Approve — Quality Council"
              />
            ))}
          </div>
        </div>
      )}

      {/* the decision record, once signed */}
      {decided && (
        <div className="pnl" id="q-decision">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Decision record</div>
              <div className="pnl-s">21 CFR Part 11 — signed, attributable and reason-coded</div>
            </div>
            <div className="h-sp" />
            {e.capaRef && <span className="pill g mono">{e.capaRef}</span>}
          </div>
          <div className="sc-body">
            <dl className="sc-dl">
              <div className="sc-dr">
                <dt>Approved</dt>
                <dd>
                  <b>{e.approvedOptionLabel}</b>
                </dd>
              </div>
              <div className="sc-dr">
                <dt>Authority</dt>
                <dd>{e.decisionAuthority}</dd>
              </div>
              <div className="sc-dr">
                <dt>Signed</dt>
                <dd>
                  {e.decidedByName} · {fmtDate(e.decidedAt)}
                </dd>
              </div>
              <div className="sc-dr">
                <dt>Rationale</dt>
                <dd>{e.decisionRationale}</dd>
              </div>
              {e.coordinationComplete && (
                <div className="sc-dr">
                  <dt>Coordinated</dt>
                  <dd>
                    {e.coordinationActionCount} owned actions issued across Quality, Supply Chain,
                    Regulatory, Commercial, Market Access and Logistics — each with a named owner and
                    a due date
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      <MarketTable
        rows={rows}
        basis={plan.allocationBasis}
        previewLabel={selectedOption ? selectedOption.label : null}
      />

      {preview && (
        <div className="sc-pv" id="q-preview">
          <span className="cs-auto-lbl">Under this option</span>
          <span className="cs-auto-tx">
            {fmtNum(preview.summary.servedDoses)} doses served, {preview.summary.marketsProtected}{' '}
            markets kept whole, {preview.summary.marketsConstrained} constrained,{' '}
            {preview.summary.marketsDeferred} deferred
            {preview.summary.marketsMissedWindow > 0
              ? `, ${preview.summary.marketsMissedWindow} past their tender close`
              : ''}
            {preview.readyDate ? ` · stock ready ${fmtDate(preview.readyDate)}` : ''} ·{' '}
            {fmtEuro(preview.summary.revenueLost)} of revenue forgone
          </span>
        </div>
      )}

      <BatchTable plan={plan} />
    </div>
  );
}
