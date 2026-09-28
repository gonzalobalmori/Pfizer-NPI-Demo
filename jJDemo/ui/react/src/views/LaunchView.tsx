/*
 * Launch drill-down · Overview (#v-launch) — ported verbatim from the
 * click-through's markup and CSS (.ld-top / .ld-tabs / .ld-strip / .ld-grid /
 * .ld-rail / .ld-main / .cr / .ch / .msr). Static headings, the left-rail facts
 * and the downstream/timeline panels are copied word-for-word; the header, the
 * fact strip and the gate-readiness criteria are fed by the live
 * PortfolioService.launchRecord c3Action for the launch carried in `param`.
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getLaunchRecord } from '@/api/portfolio';
import { fmtEuro, fmtDateYear, fmtGate } from '@/lib/format';
import type { LaunchRecord, RecordGate, MlStatus } from '@/types/portfolio';
import Glyph from '@/components/Brand/Glyph';
import MlDot from '@/components/Brand/MlDot';
import { labelFor, factFor } from '@/productLabel';
import { pharma, gateName } from '@/pharmaText';
import { phaseNameFor } from '@/phaseModel';

/* MarketLaunch.status → the pill colour class (shared tone source: same field
 * the Cockpit rows and Market tab colour by, so a market reads the same colour
 * on every tab). ct = blocks/red, rk = at-risk/amber, ok = on-plan/green. */
function mlPill(s: MlStatus): 'r' | 'a' | 'g' {
  if (s === 'ct') return 'r';
  if (s === 'rk') return 'a';
  return 'g';
}
function mlLabel(s: MlStatus): string {
  if (s === 'ct') return 'off track';
  if (s === 'rk') return 'at risk';
  return 'on plan';
}

export default function LaunchView() {
  const { param, open } = useNav();
  const [record, setRecord] = useState<LaunchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The finding to hand to Execution when the user hits "Resolve". A launch's
  // blocking issue (category 'ct') is preferred; otherwise its first open issue.
  const [resolveFindingId, setResolveFindingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!param) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setResolveFindingId(null);
      try {
        const rec = await getLaunchRecord(param);
        if (!cancelled) setRecord(rec);
        // Derive this launch's blocking open issue so "Resolve" opens its
        // resolution workspace in Execution. Prefer a gate-blocking finding
        // (category 'ct'); otherwise the first open issue. Falls back to the
        // launch's own workflow board when there are no open issues.
        const openRows = rec.issues.rows.filter((r) => r.open);
        const blocking = openRows.find((r) => r.category === 'ct') ?? openRows[0] ?? null;
        if (!cancelled) setResolveFindingId(blocking?.findingId ?? null);
      } catch (err) {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Failed to load the launch record.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [param]);

  if (!param) {
    return <div className="view on v-msg">Select a launch from the Cockpit or Portfolio.</div>;
  }
  if (error) {
    return <div className="view on v-msg v-err">{error}</div>;
  }
  if (loading) {
    return <div className="view on v-msg">Loading…</div>;
  }
  if (!record) {
    return <div className="view on v-msg">Select a launch from the Cockpit or Portfolio.</div>;
  }

  const o = record.overview;
  const gates = o.gates;
  const nextGate: RecordGate | null =
    gates.find((g) => g.phaseCode === o.currentPhase) ?? gates.find((g) => g.status !== 'ok') ?? gates[0] ?? null;
  const met = nextGate ? nextGate.criteria.filter((c) => c.met).length : 0;
  const total = nextGate ? nextGate.criteria.length : 0;
  const slipText = nextGate && nextGate.slipDays != null ? `+${nextGate.slipDays}d` : '—';

  // Derive the US/EU regulatory pathways from the live route rather than
  // hardcoding Berobenatide's NDA/MAA (fixes the PF-3945 biologic/small-molecule mismatch).
  // Supplement/variation forms are tested before their base form, since
  // "NDA supplement" also contains "NDA".
  const route = factFor(o, 'regulatoryRoute', o.regulatoryRoute);
  const usPathway = route.includes('BLA supplement') ? 'BLA supplement'
    : route.includes('NDA supplement') ? 'NDA supplement'
    : route.includes('BLA') ? 'BLA'
    : route.includes('505(b)(2)') ? '505(b)(2)'
    : route.includes('NDA') ? 'NDA' : '—';
  const euPathway = route.includes('Type II variation') ? 'Type II variation · EMA'
    : route.includes('MAA') ? 'MAA · EMA/CHMP' : '—';

  // Per-market rollout (Scope C) for this launch — the same derived data the
  // Cockpit rows and timeline sub-rows use, so delays are attributable to a
  // specific country and every tab agrees on each market's status/colour.
  const marketGates = o.marketGates ?? [];
  const hasMarketGates = marketGates.length > 0;

  // Wave-1 markets, lead market first (manager: "if lead market is US, US first").
  // Prefer the real per-market rollout; fall back to the canonical wave.
  const WAVE_BASE = ['DE', 'FR', 'UK', 'ES'];
  const lead = o.leadMarketCode ?? null;
  const wave1 = hasMarketGates
    ? marketGates.map((m) => m.marketCode).filter((c): c is string => !!c).slice(0, 6)
    : lead
      ? [lead, ...WAVE_BASE.filter((m) => m !== lead)].slice(0, 4)
      : WAVE_BASE;

  // Open-issue counts + rows come straight from the backend (Finding-driven), so
  // every product's issue table reflects its own findings and an on-plan launch
  // with no open findings reads clean.
  const openIssueCount = record.issues.openCount;
  const blockingCount = record.issues.blockingCount;
  // The card is titled "Open issues on this launch" and sits under a counter
  // that shows openIssueCount — so it must list ONLY genuinely-open findings
  // (USER / HELD / RUNNING). Resolved (AUTO) findings are excluded here so an
  // ON_PLAN launch such as JAVELIN — whose only finding is resolved — reads
  // clean everywhere: 0 in the counter, empty card, and absent from the
  // portfolio-wide Open Issues list. This keeps the same product consistent
  // across the cockpit, its detail, and the open-issues view.
  const issueRows = record.issues.rows.filter((r) => r.open);
  const hasIssues = issueRows.length > 0;

  // Downstream impact cascade — data-driven from the gate ladder. It only makes
  // sense when the next gate is actually slipping, so an on-plan / launched
  // programme shows nothing here (manager: "tables appear only when they make
  // sense"). The rows are the still-open gates from the next gate onward, each
  // reading baseline → forecast; the first slipping gate is the direct hit, any
  // further slipping gate is a downstream warning, and a gate holding its
  // baseline reads "held".
  const nextGateIdx = nextGate ? gates.findIndex((g) => g.code === nextGate.code) : -1;
  const downstreamGates = nextGateIdx >= 0 ? gates.slice(nextGateIdx) : [];
  const showDownstream = !!(nextGate && nextGate.slipDays && nextGate.slipDays > 0) && downstreamGates.length > 0;

  // Workstream bar tone from the live completion %: green >=85, amber >=60, red below.
  const wsTone = (pct: number | null): string => {
    if (pct == null) return 'a';
    if (pct >= 85) return 'g';
    if (pct >= 60) return 'a';
    return 'r';
  };

  // Tab badges reflect real counts (manager: "(3)" is meaningless when there's
  // nothing pending / no documents). Workflow badge = exceptions (at risk + late);
  // Documents badge = document count. Hidden when zero.
  const st = record.workflow.statusTally;
  const exceptionCount = (st.rk ?? 0) + (st.late ?? 0);
  const docCount = record.documents.total;

  return (
    <div className="view on" id="v-launch">

      <div className="ld-top">
        <button className="bk" type="button" onClick={() => open('portfolio')}><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg><span className="bk-lbl">Back</span></button>
        <div>
          <div className="ld-n">{labelFor(o)}</div>
          <div className="ld-s">
            {[
              factFor(o, 'franchise', o.franchise),
              factFor(o, 'segment', o.segment),
              factFor(o, 'modality', o.modality),
              route,
              `lead market ${o.leadMarketCode ?? o.leadMarket ?? ''}`.trim(),
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="h-sp"></div>
        {factFor(o, 'segment', o.segment) ? <span className="pill z" style={{ alignSelf: 'center', marginRight: 8 }} title="Business unit">{factFor(o, 'segment', o.segment)}</span> : null}
        <button
          className="btn s"
          type="button"
          title="Open this launch's resolution workspace in Execution"
          onClick={() => (resolveFindingId ? open('issue', resolveFindingId) : open('flow', param))}
        >
          <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
          Resolve</button>
        <button
          className="btn p"
          type="button"
          title="Escalate to the Launch Board"
          onClick={() => (resolveFindingId ? open('issue', resolveFindingId) : open('alerts'))}
        >
          <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          Escalate</button>
      </div>

      <div className="ld-tabs">
        <button className="ld-tb on" type="button" onClick={() => open('launch', param)}>Overview</button>
        <button className="ld-tb" type="button" onClick={() => open('flow', param)}>Workflow detail{exceptionCount ? <span className="bdg r" id="ld-fb">{exceptionCount}</span> : null}</button>
        <button className="ld-tb" type="button" onClick={() => open('docs', param)}>Documents{docCount ? <span className="bdg a">{docCount}</span> : null}</button>
      </div>
      <div className="ld-strip">
        <div className="ld-t"><div className="ld-tv" id="ld-phase">{o.currentPhase}</div><div className="ld-tl">Current phase<br />{phaseNameFor(o.currentPhase, o.currentPhaseName)}</div></div>
        <div className="ld-t"><div className="ld-tv" id="ld-gate">{nextGate?.code}</div><div className="ld-tl">Next gate<br />{gateName(nextGate?.code, nextGate?.name)}</div></div>
        <div className="ld-t"><div className="ld-tv mono" id="ld-date">{fmtDateYear(nextGate?.forecastDate ?? null)}</div><div className="ld-tl">Forecast date<br />baseline {fmtDateYear(nextGate?.baselineDate ?? null)}</div></div>
        <div className="ld-t"><div className="ld-tv r" id="ld-slip">{slipText}</div><div className="ld-tl">Slip<br />{record.issues.recoverableDays > 0 ? `${record.issues.recoverableDays}d recoverable by acting` : 'zero float on path'}</div></div>
        <div className="ld-t"><div className="ld-tv r" id="ld-rev">{fmtEuro(o.revenueAtRisk)}</div><div className="ld-tl">Revenue at risk<br />of {fmtEuro(o.launchValue)} launch value</div></div>
        <div className="ld-t"><div className="ld-tv" id="ld-iss">{openIssueCount}</div><div className="ld-tl">Open issues<br />{blockingCount} blocking the gate</div></div>
      </div>

      <div className="ld-grid">

        {/* LEFT RAIL */}
        <div className="ld-rail">
          <div className="ld-card">
            <div className="ld-ct">Product</div>
            <div className="ld-kv"><span>Modality</span><b>{factFor(o, 'modality', o.modality) || '—'}</b></div>
            <div className="ld-kv"><span>Indication</span><b>{factFor(o, 'indication') || '—'}</b></div>
            <div className="ld-kv"><span>Development phase</span><b>{factFor(o, 'developmentPhase') || '—'}</b></div>
            <div className="ld-kv"><span>Est. launch</span><b>{factFor(o, 'estimatedLaunch') || '—'}</b></div>
            <div className="ld-kv"><span>US pathway</span><b>{usPathway}</b></div>
            <div className="ld-kv"><span>EU pathway</span><b>{euPathway}</b></div>
            <div className="ld-kv"><span>Fill-finish</span><b>{factFor(o, 'fillFinishRoute', o.fillFinishRoute) || '—'}</b></div>
            <div className="ld-kv"><span>Manufacture</span><b>{factFor(o, 'manufactureSite', o.manufactureSite) || '—'}</b></div>
            <div className="ld-kv"><span>Dossier status</span><b>{o.health === 'LAUNCHED' ? 'Closed' : 'Open'}</b></div>
          </div>

          <div className="ld-card">
            <div className="ld-ct">Launch scope</div>
            <div className="ld-kv"><span>Markets, wave 1</span><b>{wave1.join(' · ')}</b></div>
            <div className="ld-kv"><span>Registrations filed</span><b>{o.registrationsFiled ?? 0} of {o.registrationsTotal ?? 0}</b></div>
            <div className="ld-kv"><span>Launch build</span><b>{(o.launchBuildUnits ?? 0).toLocaleString()} units</b></div>
            <div className="ld-kv"><span>Field force</span><b>{o.fieldForceCertified ?? 0} certified / {o.fieldForceTotal ?? 0}</b></div>
            <div className="ld-kv"><span>payer listings</span><b>{o.vacApprovalsFiled ?? 0} of {o.vacApprovalsTotal ?? 0} accounts</b></div>
          </div>

          {o.criticalSupply && o.criticalSupply.length > 0 ? (
            <div className="ld-card" id="ld-supply">
              <div className="ld-ct">Critical supply</div>
              {o.criticalSupply.map((cs) => (
                <div className="ld-sup" data-supplier={cs.supplierId ?? undefined} key={`${cs.partName}-${cs.supplierId}`}>
                  <div className="ld-kv">
                    <span>{pharma(cs.partName)}</span>
                    <b>{pharma(cs.supplierName) || '—'}</b>
                  </div>
                  <div className="ld-sup-m">
                    {cs.sourcingMode === 'SINGLE_SOURCE' ? 'Single-source' : cs.sourcingMode}
                    {cs.frozenAtGate ? ` · frozen at ${cs.frozenAtGate}` : ''}
                    {cs.sharedAcross > 1 ? ` · shared across ${cs.sharedAcross} launches` : ''}
                  </div>
                  {cs.siblings.length > 0 ? (
                    <div className="ld-sup-sib">
                      <span className="ld-sup-sl">Same part, same supplier:</span>
                      {cs.siblings.map((s) => (
                        <button
                          type="button"
                          className="ld-sup-lk"
                          data-launch={s.launchId}
                          key={s.launchId}
                          onClick={() => open('launch', s.launchId)}
                        >
                          {labelFor(s)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="ld-card">
            <div className="ld-ct">Workstream readiness</div>
            {o.workstreams.filter((w) => w.pct != null).map((w) => {
              const tone = wsTone(w.pct);
              return (
                <div className="ld-ws" key={w.label}><span className="wsn">{w.label === 'R&D / Design' ? <>R&amp;D / Design</> : w.label}</span>
                  <div className="bar-t"><div className={`bar-f ${tone}`} style={{ width: `${w.pct}%` }}></div></div>
                  <span className={`wsv${tone === 'g' ? '' : ` ${tone}`}`}>{w.pct}%</span></div>
              );
            })}
            {o.workstreams.every((w) => w.pct == null) ? (
              <div className="ld-note">No workstream activity recorded for this launch yet.</div>
            ) : null}
          </div>
        </div>

        {/* MAIN */}
        <div className="ld-main">

          <div className="ld-card">
            <div className="ld-hrow">
              <div><div className="ld-ct" style={{ margin: 0 }}>Gate readiness — {fmtGate(nextGate?.code, gateName(nextGate?.code, nextGate?.name))}</div></div>
              <div className="ld-gr"><span className="ld-grv" id="ld-grv">{met}</span><span className="ld-grt">of {total} met</span></div>
            </div>
            {(nextGate?.criteria ?? []).map((c, i) => (
              <div className={`cr${c.met ? '' : ' bad'}`} key={i}>{/* met/unmet was `✓`/`✗` (U+2713/U+2717) — both tofu in Noto Sans. The
                    tone on .cx says the same thing, and .crn names the criterion, so
                    the mark stays a secondary cue. */}
                <span className={`cx ${c.met ? 'ok' : 'no'}`}>
                  <Glyph name={c.met ? 'check' : 'close'} className="sm" />
                </span>
                <div className="crb"><div className="crn">{pharma(c.name)}</div>
                  {c.outstandingReason ? <div className="crm">{pharma(c.outstandingReason)}</div> : null}</div>
                {c.met ? <span className="pill g">Met</span> : <button className="btn p sm" type="button">Resolve</button>}</div>
            ))}
          </div>

          {hasMarketGates ? (
            <div className="ld-card">
              <div className="ld-ct">Market rollout — where each country stands</div>
              <table className="dt" style={{ margin: '-4px -16px -16px', width: 'calc(100% + 32px)' }}>
                <tbody>
                  {marketGates.map((m) => {
                    const where = m.live
                      ? 'Live in market'
                      : m.gateCode
                        ? fmtGate(m.gateCode, m.gateName ?? '')
                        : m.phaseCode ?? '—';
                    return (
                      <tr key={`${m.marketCode}-${m.gateCode ?? 'live'}`}>
                        <td>
                          <div className="nm">
                            <MlDot status={m.mlStatus} label={m.marketName ?? m.marketCode} className="mg-dot-in" />
                            {m.marketName ?? m.marketCode}
                            {m.isLead ? <span className="mg-lead" style={{ marginLeft: 6 }}>lead</span> : null}
                          </div>
                          <div className="sub">
                            {where}
                            {m.slipDays && m.slipDays > 0 && !m.live ? ` · +${m.slipDays}d slip` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`pill ${mlPill(m.mlStatus)}`}>{mlLabel(m.mlStatus)}</span>
                          {m.firstShipQuarter ? (
                            <div className="sub mono" style={{ marginTop: '3px' }}>
                              first ship {m.firstShipQuarter}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="ld-two">
            {showDownstream ? (
            <div className="ld-card">
              <div className="ld-ct">Downstream impact if {nextGate?.code} slips</div>
              {downstreamGates.map((g, i) => {
                const slipping = !!(g.slipDays && g.slipDays > 0);
                // First slipping gate is the direct hit; later slipping gates are
                // downstream warnings; a gate holding baseline reads neutral.
                const dot = !slipping ? '' : i === 0 ? 'hit' : 'warn';
                /* The node's state in words. `hit` and `warn` are both solid
                   discs distinguished by a halo ring (see `.chd` in
                   prototype.css); the date change beside them reads the same for
                   either, so without this the difference between "the gate the
                   slip lands on" and "a gate that slips as a consequence" was
                   carried by hue alone. */
                const dotTitle =
                  dot === 'hit'
                    ? 'Directly hit by the slip'
                    : dot === 'warn'
                      ? 'Slips as a downstream consequence'
                      : 'Holds its baseline';
                /* A node, not a string, so the baseline→forecast arrow can be a
                   drawn glyph — `→` is tofu in Noto Sans. */
                const change: React.ReactNode =
                  g.baselineDate && g.forecastDate && slipping ? (
                    <>
                      {fmtDateYear(g.baselineDate)} <Glyph name="arrow-right" className="sm" />{' '}
                      {fmtDateYear(g.forecastDate)}
                    </>
                  ) : g.forecastDate ? (
                    `${fmtDateYear(g.forecastDate)} · held`
                  ) : (
                    'Held'
                  );
                return (
                  <div className="ch" key={g.code}>
                    <span className={`chd${dot ? ` ${dot}` : ''}`} title={dotTitle} />
                    <div><div className="chn">{fmtGate(g.code, g.name)}</div>
                      <div className="chm mono">{change}</div></div>
                  </div>
                );
              })}
            </div>
            ) : null}

            <div className="ld-card">
              <div className="ld-ct">Open issues on this launch</div>
              {hasIssues ? (
              <table className="dt" style={{ margin: '-4px -16px -16px', width: 'calc(100% + 32px)' }}>
                <tbody>
                  {issueRows.map((r) => {
                    const pillCls = !r.open ? 'z' : r.category === 'ct' ? 'r' : 'a';
                    const pillTxt = !r.open ? 'resolved' : r.category === 'ct' ? 'blocks gate' : 'decision open';
                    const meta = [r.displayId, r.detectedBy].filter(Boolean).join(' · ');
                    return (
                      <tr key={r.findingId} style={!r.open ? { opacity: 0.6, cursor: 'default' } : { cursor: 'pointer' }}
                        onClick={r.open ? () => open('issue', r.findingId) : undefined}>
                        <td><div className="nm">{pharma(r.headline)}</div>
                          {meta ? <div className="sub">{meta}</div> : null}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`pill ${pillCls}`}>{pillTxt}</span>
                          {r.exposure ? <div className="sub mono" style={{ marginTop: '3px' }}>{fmtEuro(r.exposure)}</div> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              ) : (
                <div className="sub" style={{ marginTop: 4 }}>No open issues — this launch is clean.</div>
              )}
            </div>
          </div>

          <div className="ld-card">
            <div className="ld-ct">Gate schedule for this launch</div>
            <table className="dt" style={{ margin: '-4px -16px -16px', width: 'calc(100% + 32px)' }}>
              <tbody>
                {gates.map((g) => (
                  <tr key={g.code}>
                    <td><div className="nm">{fmtGate(g.code, g.name)}</div>
                      <div className="sub">baseline {fmtDateYear(g.baselineDate)}</div></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`pill ${g.status === 'ok' ? 'g' : g.status === 'late' ? 'r' : 'z'}`}>
                        {g.status === 'ok' ? 'closed' : g.status === 'late' ? 'at risk' : 'pending'}
                      </span>
                      <div className="sub mono" style={{ marginTop: '3px' }}>
                        {fmtDateYear(g.forecastDate)}{g.slipDays ? ` · +${g.slipDays}d` : ''}
                      </div>
                    </td>
                  </tr>
                ))}
                {gates.length === 0 ? (
                  <tr><td colSpan={2}><div className="sub">No gate records for this launch.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
