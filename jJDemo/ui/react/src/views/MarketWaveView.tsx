/*
 * Demand and market-wave change (#v-wave) — SCENARIO 2.
 *
 * "Eight weeks before packaging, Commercial increases demand for a priority
 *  market and changes the required SKU or pack mix. Existing supply, site and CMO
 *  capacity, packaging components and logistics cannot support every market as
 *  planned. The team must compare a constrained launch, inventory reallocation,
 *  added capacity and market-wave resequencing; make a governed decision; and
 *  update all affected plans, owners, sites, partners and market commitments."
 *
 * Five governed steps, in the order the sentence puts them:
 *
 *   1  Assess the constraints — capacity (internal + CMO), components, cold chain
 *   2  Compare four options  — constrain / reallocate / add capacity / resequence
 *   3  Project the book      — market-by-market, before anyone signs
 *   4  Decide                — Commercial or Governance signature, Part 11 trail
 *   5  Commit                — every plan, owner, site, partner and commitment
 *
 * Every figure is live from MarketWaveService. There is no fallback data: a
 * failing call surfaces as an error in the view.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import {
  DEMAND_CHANGE_ID,
  getDemandPlan,
  assessConstraints,
  evaluateWaveOptions,
  previewWaveAllocation,
  decideWave,
  commitWave,
  resetWave,
} from '@/api/scenarios';
import type {
  DemandPlan,
  WaveAllocation,
  DemandStage,
  CapacityLane,
  ComponentRow,
} from '@/types/scenarios';
import { fmtDate, fmtEuro } from '@/lib/format';
import StepRail, { type StepDef } from '@/components/scenario/StepRail';
import OptionCard from '@/components/scenario/OptionCard';
import Glyph from '@/components/Brand/Glyph';

/*
 * Who signs. The service refuses any signer who does not hold a Commercial or
 * Governance function, because reallocating doses between markets is a
 * cross-market trade-off rather than a Quality call. Two people on the roster
 * qualify, and the choice between them is the point: T. Bergmann (Commercial)
 * *raised* the request, so having him approve it would make the request its own
 * authority. The signature goes to George Hall, Global NPI Lead (Governance) —
 * the one person who owns the launch across all nine markets rather than the one
 * market asking for more.
 */
const WAVE_SIGNER = 'seed_person_hf';
const SIGN_RATIONALE =
  'Approved at the launch S&OP review on the scored comparison: the recommended option ' +
  'serves the largest share of the incremental demand without breaching a tender window, ' +
  'and the resulting plan changes are accepted by the affected market and site owners.';

const STEPS: StepDef[] = [
  {
    label: 'Constraints',
    hint: 'Test the uplift and the pack-mix change against capacity, components and cold chain.',
    action: 'Assess the constraints',
  },
  {
    label: 'Options',
    hint: 'Score the four responses on the same axes: doses, slip, cost and markets kept whole.',
    action: 'Compare the four options',
  },
  {
    label: 'Project',
    hint: 'Preview an option to see the market-by-market book it would produce.',
    action: null,
  },
  {
    label: 'Decide',
    hint: 'Approve one option at the launch S&OP review with a Part 11 signature.',
    action: null,
  },
  {
    label: 'Commit',
    hint: 'Update every affected plan, owner, site, partner and market commitment.',
    action: 'Commit the plan changes',
  },
];

/** Backend stage → rail position. The rail follows the data, never local state. */
const STAGE_STEP: Record<DemandStage, number> = {
  RAISED: 0,
  CONSTRAINTS_ASSESSED: 1,
  OPTIONS_EVALUATED: 2,
  DECIDED: 4,
  COMMITTED: 5,
};

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

/*
 * The chip form of the binding constraint. The service returns both a key and the
 * full sentence; the chip takes the key because a chip cannot hold a sentence, and
 * the sentence is shown in full below it where there is room to read it.
 */
const CONSTRAINT_WORDS: Record<string, string> = {
  COMPONENT_LEAD_TIME: 'Component lead time',
  PACK_CAPACITY: 'Packaging capacity',
  COMPONENTS: 'Packaging components',
  COLD_CHAIN: 'Cold-chain logistics',
  NONE: 'Nothing binds',
};

/* ── capacity lanes: internal lines, CMOs, packaging partners ─────── */
function LaneTable({ lanes }: { lanes: CapacityLane[] }) {
  return (
    <div className="pnl" id="w-lanes">
      <div className="pnl-h">
        <div>
          <div className="pnl-t">Capacity — sites, CMOs and packaging partners</div>
          <div className="pnl-s">
            Headroom is what is left after what is already committed · a lane is only usable if it is
            qualified for this launch <i>and</i> free before packaging starts
          </div>
        </div>
      </div>
      <table className="dt sc-dt">
        <thead>
          <tr>
            <th>Lane</th>
            <th>Operation</th>
            <th className="n">Capacity/wk</th>
            <th className="n">Committed/wk</th>
            <th className="n">Headroom/wk</th>
            <th className="n">In window</th>
            <th>Available</th>
            <th>Usable</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map((l) => (
            <tr key={l.id} data-lane={l.id}>
              <td>
                <div className="nm">{l.name}</div>
                <div className="sub">
                  {titleCase(l.sourceKind ?? '')}
                  {l.siteName ? ` · ${l.siteName}` : ''}
                </div>
              </td>
              <td>
                <div className="nm">{titleCase(l.operation)}</div>
                <div className="sub">{l.presentation ?? 'any presentation'}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(l.dosesPerWeek)}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(l.committedDosesPerWeek)}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(l.headroomPerWeek)}</div>
              </td>
              <td className="n">
                <div className={`nm mono${l.usableInWindow ? '' : ' sc-dim'}`}>
                  {l.usableInWindow ? fmtNum(l.headroomInWindow) : '0'}
                </div>
                <div className="sub">€{l.costPerThousandDoses}/k doses</div>
              </td>
              <td>
                <div className="nm mono">{l.availableFrom ? fmtDate(l.availableFrom) : 'now'}</div>
                {!l.qualifiedForLaunch && (
                  <div className="sub">{l.qualificationLeadDays}d to qualify</div>
                )}
              </td>
              <td>
                {l.usableInWindow ? (
                  <span className="pill g">Usable</span>
                ) : (
                  <span className="pill z">
                    {l.qualifiedForLaunch ? 'Free too late' : 'Unqualified'}
                  </span>
                )}
                {l.regulatoryVariationRequired && <div className="sub">variation needed</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── packaging components: the limit money cannot move ────────────── */
function ComponentTable({ rows, runwayDays }: { rows: ComponentRow[]; runwayDays: number }) {
  return (
    <div className="pnl" id="w-components">
      <div className="pnl-h">
        <div>
          <div className="pnl-t">Packaging components</div>
          <div className="pnl-s">
            Free stock plus anything that lands in time · a lead time longer than the {runwayDays}-day
            runway cannot be bought at any price
          </div>
        </div>
      </div>
      <table className="dt sc-dt">
        <thead>
          <tr>
            <th>Component</th>
            <th>Supplier</th>
            <th className="n">On hand</th>
            <th className="n">Free</th>
            <th className="n">On order</th>
            <th className="n">Lead time</th>
            <th className="n">Supports</th>
            <th>Sourcing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} data-component={c.partNo}>
              <td>
                <div className="nm">{c.name}</div>
                <div className="sub">
                  {c.partNo} · {c.presentation ?? 'any'} · {c.unitsPerDose}/dose
                </div>
              </td>
              <td>
                <div className="nm">{c.supplierName}</div>
                <div className="sub">
                  {c.inRegulatoryDossier ? 'in dossier' : 'not in dossier'}
                </div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(c.onHandUnits)}</div>
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(c.freeUnits)}</div>
              </td>
              <td className="n">
                <div className={`nm mono${c.onOrderUnits > 0 && !c.onOrderArrivesInTime ? ' sc-neg' : ''}`}>
                  {c.onOrderUnits > 0 ? fmtNum(c.onOrderUnits) : '—'}
                </div>
                {c.onOrderUnits > 0 && (
                  <div className="sub">
                    {c.onOrderArrivesInTime
                      ? `lands ${fmtDate(c.onOrderArrival)}`
                      : `too late (${fmtDate(c.onOrderArrival)})`}
                  </div>
                )}
              </td>
              <td className="n">
                <div className={`nm mono${c.leadTimeWithinRunway ? '' : ' sc-neg'}`}>
                  {c.leadTimeDays}d
                </div>
                {!c.leadTimeWithinRunway && <div className="sub">past the runway</div>}
              </td>
              <td className="n">
                <div className="nm mono">{fmtNum(c.supportableDoses)}</div>
                <div className="sub">doses</div>
              </td>
              <td>
                {c.singleSource ? (
                  <span className="pill a">Single source</span>
                ) : (
                  <span className="pill g">{c.dualSourced ? 'Dual sourced' : 'Multi source'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketWaveView() {
  const { intent } = useNav();
  const [plan, setPlan] = useState<DemandPlan | null>(null);
  const [proj, setProj] = useState<WaveAllocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDemandPlan(DEMAND_CHANGE_ID)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(typeof err === 'string' ? err : 'Failed to load the demand change.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stage = plan?.change.stage ?? 'RAISED';
  const step = STAGE_STEP[stage];
  const decided = stage === 'DECIDED' || stage === 'COMMITTED';

  const runStep = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const id = plan.change.id;
      let next: DemandPlan;
      if (stage === 'RAISED') next = await assessConstraints(id);
      else if (stage === 'CONSTRAINTS_ASSESSED') next = await evaluateWaveOptions(id);
      else if (stage === 'DECIDED') next = await commitWave(id);
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
      const p = await resetWave(plan.change.id);
      setPlan(p);
      setProj(null);
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
        const pv = await previewWaveAllocation(plan.change.id, optionId);
        setProj(pv);
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
        const p = await decideWave(plan.change.id, optionId, WAVE_SIGNER, SIGN_RATIONALE);
        setPlan(p);
        setProj(null);
      } catch (err) {
        setError(typeof err === 'string' ? err : 'The decision was refused.');
      } finally {
        setBusy(false);
      }
    },
    [plan],
  );

  /* The guided tour can drive this view to a given step. */
  const driveStep = intent?.waveStep;
  const driveSeq = intent?.seq;
  useEffect(() => {
    if (driveStep == null || !plan || busy) return;
    if (step >= driveStep) return;
    let cancelled = false;
    const advance = async () => {
      setBusy(true);
      try {
        const id = plan.change.id;
        let p: DemandPlan = plan;
        if (p.change.stage === 'RAISED' && driveStep >= 1) p = await assessConstraints(id);
        if (p.change.stage === 'CONSTRAINTS_ASSESSED' && driveStep >= 2) {
          p = await evaluateWaveOptions(id);
        }
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

  const selectedOption = useMemo(
    () => plan?.options.find((o) => o.id === proj?.optionId) ?? null,
    [plan, proj],
  );

  if (error && !plan) return <div className="view on v-msg v-err">{error}</div>;
  if (!plan) return <div className="view on v-msg">Loading the demand change…</div>;

  const c = plan.change;
  const k = plan.constraints;
  const s = plan.summary;
  const assessed = step >= 1;
  const mixChanged = c.requestedPresentation !== c.baselinePresentation;

  /* Either the projection under a previewed option, or the committed book. */
  const bookRows = proj
    ? proj.rows
    : plan.markets.map((m) => ({
        commitmentId: m.commitmentId,
        marketCode: m.marketCode,
        marketName: m.marketName,
        regulatoryBody: m.regulatoryBody,
        priorityRank: m.priorityRank,
        priorityTier: m.priorityTier,
        committedDoses: m.committedDoses,
        revisedDoses: m.revisedDoses,
        wave: m.wave,
        revisedWave: m.revisedWave,
        firstShipDate: m.firstShipDate,
        revisedFirstShipDate: m.revisedFirstShipDate,
        slipDays: 0,
        revenuePerDose: m.revenuePerDose,
        contractPenalty: m.contractPenalty,
        tenderDeadline: m.tenderDeadline,
        tenderBreached: false,
        isTarget: m.isTarget,
        inContestedWindow: false,
        state: m.status,
        note: null as string | null,
      }));

  return (
    <div className="view on" id="v-wave">
      <div className="vhd">
        <div>
          <div className="vt">Demand and market-wave change</div>
          <div className="vs">
            {c.requestNo} · {c.launchName} · requested by {c.requestedByName} ({c.requestedByFunction}
            ) on {fmtDate(c.requestedAt)} · {c.weeksBeforePackaging} weeks before packaging starts{' '}
            {fmtDate(c.packagingStartDate)}
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
        complete={stage === 'COMMITTED'}
      />

      {/* what Commercial asked for · whether it can be built */}
      <div className="two sc-two">
        <div className="pnl" id="w-ask">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">What Commercial is asking for</div>
              <div className="pnl-s">
                {c.marketCode} — {c.marketName} · {c.regulatoryBody}
              </div>
            </div>
            <div className="h-sp" />
            <span className="pill a">+{c.upliftPercent}%</span>
          </div>
          <div className="sc-body">
            <div className="sc-grid">
              <div className="sc-kv">
                <span className="sc-kv-v">{fmtNum(c.baselineDoses)}</span>
                <span className="sc-kv-l">committed doses</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v">{fmtNum(c.requestedDoses)}</span>
                <span className="sc-kv-l">now requested</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v a">+{fmtNum(c.upliftDoses)}</span>
                <span className="sc-kv-l">incremental doses</span>
              </div>
              <div className="sc-kv">
                <span className="sc-kv-v">{fmtEuro(c.incrementalRevenue)}</span>
                <span className="sc-kv-l">revenue at stake</span>
              </div>
            </div>
            {mixChanged && (
              <div className="sc-mix">
                <span className="cs-auto-lbl">And the pack mix changes</span>
                <div className="sc-mix-r">
                  <span className="sc-mix-o">
                    <b>{c.baselinePresentation}</b>
                    <i>{c.baselineSku}</i>
                  </span>
                  <Glyph name="arrow-right" />
                  <span className="sc-mix-n">
                    <b>{c.requestedPresentation}</b>
                    <i>{c.requestedSku}</i>
                  </span>
                </div>
              </div>
            )}
            {c.rationale && <p className="sc-p">{c.rationale}</p>}
          </div>
        </div>

        <div className="pnl" id="w-constraints">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">What the supply chain can actually do</div>
              <div className="pnl-s">
                {assessed
                  ? `${k.runwayDays} days — ${k.weeks.toFixed(1)} weeks — of runway before packaging starts`
                  : 'Not yet assessed — run step 1'}
              </div>
            </div>
            {assessed && (
              <>
                <div className="h-sp" />
                <span className={`pill ${k.bindingKind === 'NONE' ? 'g' : 'r'}`}>
                  {CONSTRAINT_WORDS[k.bindingKind] ?? titleCase(k.bindingKind)}
                </span>
              </>
            )}
          </div>
          <div className="sc-body">
            {assessed ? (
              <>
                {/* The finding in full. The chip above is its key; this is the
                    sentence, which is what a planner actually has to repeat. */}
                <div className="sc-bind">
                  <span className="cs-auto-lbl">What binds first</span>
                  <span className="cs-auto-tx">{k.bindingConstraint}</span>
                </div>
                <div className="sc-grid">
                  <div className="sc-kv">
                    <span className="sc-kv-v">{fmtNum(k.servableUplift)}</span>
                    <span className="sc-kv-l">of the uplift is servable</span>
                  </div>
                  <div className="sc-kv">
                    <span className="sc-kv-v r">{fmtNum(k.upliftGap)}</span>
                    <span className="sc-kv-l">doses short</span>
                  </div>
                  <div className="sc-kv">
                    <span className="sc-kv-v">{fmtNum(k.capacityGapPerWeek)}</span>
                    <span className="sc-kv-l">gap per week</span>
                  </div>
                  <div className="sc-kv">
                    <span className="sc-kv-v">€{k.convCostPerDose.toFixed(2)}</span>
                    <span className="sc-kv-l">marginal conversion/dose</span>
                  </div>
                </div>
                <div className="sc-esc">
                  <div className={`sc-esc-i ${c.capacityShortfall ? 'on' : ''}`}>
                    <Glyph name={c.capacityShortfall ? 'diamond' : 'check'} />
                    <span>
                      Fill headroom is {fmtNum(k.fillHeadroomInWindow)} doses over the window but
                      packaging headroom is only {fmtNum(k.packHeadroomInWindow)} — packaging, not
                      filling, is the internal bottleneck
                    </span>
                  </div>
                  <div className={`sc-esc-i ${c.componentShortfall ? 'on' : ''}`}>
                    <Glyph name={c.componentShortfall ? 'diamond' : 'check'} />
                    <span>
                      {c.componentShortfall
                        ? `Components support ${fmtNum(k.componentCeilingDoses)} doses — ${k.bindingComponent} binds, ${fmtNum(c.componentGapUnits)} units short`
                        : `Components support ${fmtNum(k.componentCeilingDoses)} doses, enough for the request`}
                    </span>
                  </div>
                  <div className={`sc-esc-i ${c.logisticsShortfall ? 'on' : ''}`}>
                    <Glyph name={c.logisticsShortfall ? 'diamond' : 'check'} />
                    <span>
                      Cold chain supports {fmtNum(k.coldChainDoses)} doses
                      {k.coldChain ? ` on ${fmtNum(k.coldChain.freeUnits)} free ${k.coldChain.name}` : ''}
                    </span>
                  </div>
                  <div className="sc-esc-i on">
                    <Glyph name="arrow-branch" />
                    <span>{k.packMixNote}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="sc-p sc-dim">
                Step 1 tests the request against every constraint at once: internal fill and
                packaging headroom over the runway, CMO and packaging-partner lanes including whether
                they are qualified in time, each packaging component against its lead time, and the
                cold-chain shippers.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* the four options the spec names */}
      {plan.options.length > 0 && (
        <div className="pnl sc-opnl" id="w-options">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">
                Constrained launch · inventory reallocation · added capacity · wave resequencing
              </div>
              <div className="pnl-s">
                {s.feasibleOptionCount} of {s.optionCount} are executable inside the{' '}
                {k.runwayDays}-day runway · scored on the change each one creates, not on the book it
                inherits
              </div>
            </div>
            {decided && c.approvedOptionLabel && (
              <>
                <div className="h-sp" />
                <span className="pill g">Decided: {c.approvedOptionLabel}</span>
              </>
            )}
          </div>
          <div className="oc-grid">
            {plan.options.map((o) => (
              <OptionCard
                key={o.id}
                option={o}
                selected={proj?.optionId === o.id}
                decided={decided}
                onSelect={onSelect}
                onDecide={step >= 2 && !decided ? onDecide : undefined}
                busy={busy}
                decideLabel="Approve — launch S&amp;OP"
              />
            ))}
          </div>
        </div>
      )}

      {/* the decision record, once signed */}
      {decided && (
        <div className="pnl" id="w-decision">
          <div className="pnl-h">
            <div>
              <div className="pnl-t">Decision record</div>
              <div className="pnl-s">21 CFR Part 11 — signed, attributable and reason-coded</div>
            </div>
            <div className="h-sp" />
            {c.commitmentsUpdated && (
              <span className="pill g">{c.updatedCommitmentCount} commitments revised</span>
            )}
          </div>
          <div className="sc-body">
            <dl className="sc-dl">
              <div className="sc-dr">
                <dt>Approved</dt>
                <dd>
                  <b>{c.approvedOptionLabel}</b>
                </dd>
              </div>
              <div className="sc-dr">
                <dt>Authority</dt>
                <dd>{c.decisionAuthority}</dd>
              </div>
              <div className="sc-dr">
                <dt>Signed</dt>
                <dd>
                  {c.decidedByName} · {fmtDate(c.decidedAt)}
                </dd>
              </div>
              <div className="sc-dr">
                <dt>Rationale</dt>
                <dd>{c.decisionRationale}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* the book: every market, with whatever the option changes */}
      <div className="pnl" id="w-book">
        <div className="pnl-h">
          <div>
            <div className="pnl-t">Market commitments</div>
            <div className="pnl-s">
              {selectedOption
                ? `Projected under: ${selectedOption.label}`
                : c.commitmentsUpdated
                  ? 'The book as committed by the decision'
                  : `${s.marketCount} markets, ${fmtNum(s.bookDoses)} doses, ${fmtEuro(s.bookRevenue)} — as committed today`}
            </div>
          </div>
        </div>
        <table className="dt sc-dt">
          <thead>
            <tr>
              <th>#</th>
              <th>Market</th>
              <th className="n">Committed</th>
              <th className="n">Revised</th>
              <th>Wave</th>
              <th>First ship</th>
              <th>Tender</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {bookRows.map((r) => {
              const doseDelta = r.revisedDoses - r.committedDoses;
              const waveMoved = !!r.revisedWave && r.revisedWave !== r.wave;
              return (
                <tr
                  key={r.commitmentId}
                  data-market={r.marketCode ?? ''}
                  className={r.isTarget ? 'res' : undefined}
                >
                  <td>
                    <div className="nm mono">{r.priorityRank}</div>
                  </td>
                  <td>
                    <div className="nm">
                      {r.marketCode} &mdash; {r.marketName}
                      {r.isTarget && <span className="pill a sc-inl">requesting</span>}
                    </div>
                    <div className="sub">
                      {r.priorityTier} · {r.regulatoryBody}
                    </div>
                  </td>
                  <td className="n">
                    <div className="nm mono">{fmtNum(r.committedDoses)}</div>
                  </td>
                  <td className="n">
                    <div
                      className={`nm mono${doseDelta > 0 ? ' sc-pos' : doseDelta < 0 ? ' sc-neg' : ''}`}
                    >
                      {fmtNum(r.revisedDoses)}
                    </div>
                    {doseDelta !== 0 && (
                      <div className="sub">
                        {doseDelta > 0 ? '+' : ''}
                        {fmtNum(doseDelta)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={`nm${waveMoved ? ' sc-neg' : ''}`}>
                      {waveMoved ? `${r.wave} → ${r.revisedWave}` : (r.wave ?? '—')}
                    </div>
                    {r.inContestedWindow && <div className="sub">in contested window</div>}
                  </td>
                  <td>
                    <div className={`nm mono${r.slipDays > 0 ? ' sc-neg' : ''}`}>
                      {fmtDate(r.revisedFirstShipDate ?? r.firstShipDate)}
                    </div>
                    {r.slipDays > 0 && <div className="sub">+{r.slipDays} days</div>}
                  </td>
                  <td>
                    {r.tenderDeadline ? (
                      <>
                        <div className={`nm mono${r.tenderBreached ? ' sc-neg' : ''}`}>
                          {fmtDate(r.tenderDeadline)}
                        </div>
                        <div className="sub">
                          {r.tenderBreached ? 'breached' : 'held'}
                          {r.contractPenalty ? ' · penalty' : ''}
                        </div>
                      </>
                    ) : (
                      <div className="sub">no tender</div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`pill ${
                        r.state === 'INCREASED' || r.state === 'UNCHANGED' || r.state === 'CONFIRMED'
                          ? 'g'
                          : r.state === 'CONSTRAINED' || r.state === 'REDUCED'
                            ? 'a'
                            : r.state === 'DEFERRED'
                              ? 'r'
                              : 'z'
                      }`}
                    >
                      {titleCase(r.state)}
                    </span>
                    {r.note && <div className="sub sc-wrap">{r.note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {proj && (
        <div className="sc-pv" id="w-preview">
          <span className="cs-auto-lbl">Under this option</span>
          <span className="cs-auto-tx">
            {proj.summary.targetCode} takes {fmtNum(proj.summary.targetRevised)} doses —{' '}
            {fmtNum(proj.summary.upliftServed)} of the {fmtNum(c.upliftDoses)}-dose request served,{' '}
            {fmtNum(proj.summary.upliftShort)} short · {proj.summary.marketsWhole} markets whole,{' '}
            {proj.summary.marketsImpacted} changed, {proj.summary.tendersBreached} tenders breached ·
            max slip {proj.summary.maxSlipDays} days · {fmtEuro(proj.summary.incrementalRevenue)} of
            incremental revenue for {fmtEuro(proj.summary.extraCost)} of added cost
            {proj.summary.reallocatedDoses > 0
              ? ` · ${fmtNum(proj.summary.reallocatedDoses)} doses reallocated`
              : ''}
            {proj.summary.resequencedMarkets > 0
              ? ` · ${proj.summary.resequencedMarkets} markets resequenced`
              : ''}
          </span>
        </div>
      )}

      {assessed && (
        <>
          <LaneTable lanes={k.lanes} />
          <ComponentTable rows={k.components} runwayDays={k.runwayDays} />
        </>
      )}
    </div>
  );
}
