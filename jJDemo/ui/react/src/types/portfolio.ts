/*
 * View-model interfaces for the non-Execution screens (§5). These mirror, field
 * for field, the JSON shapes returned by the backend PortfolioService read
 * methods (and the LaunchControlMetrics figures the Cockpit reads through it).
 */

export type Health = 'ON_PLAN' | 'AT_RISK' | 'OFF_TRACK' | 'LAUNCHED' | 'PRE_MARKET';
export type PhaseState = 'closed' | 'live' | 'queued';
export type GateStatus = 'ok' | 'late' | 'no';
export type MlStatus = 'ok' | 'rk' | 'ct';
export type WaitingOn = 'YOU' | 'PERSON' | 'AGENT' | 'AUTHORITY';
/* How the next step depends on someone — the axis that separates schedule time
 * you can still pull in (SELF/TEAM/AGENT = your own org, agents included) from a
 * fixed wait on an outside body (REGULATOR). */
export type Dependency = 'SELF' | 'TEAM' | 'AGENT' | 'REGULATOR';

/* ── Cockpit KPIs (from LaunchControlMetrics) ─────────────────────── */
export interface GateReadinessKpi {
  metric: string;
  value: number;
  unit: string;
  target: number;
  /* No trend field: `deltaPts` was removed from LaunchControlMetrics because it was
     a constant masquerading as a 30-day measurement. `byLaunch` is the real spread. */
  byLaunch: { launch: string; gate: string; met: number; total: number; pct: number }[];
}
export interface LaunchHealthKpi {
  metric: string;
  total: number;
  /** In-flight launches — every status except LAUNCHED. This is the cockpit "N active" headline. */
  active: number;
  /** The three reconciled buckets the cockpit renders. onPlan folds PRE_MARKET into on-track,
   *  so onPlan + atRisk + offTrack === active and matches the portfolio at-risk / off-track counts. */
  rollup: { onPlan: number; atRisk: number; offTrack: number; launched: number };
  byStatus: Record<string, { count: number; launches: string[] }>;
}
export interface RevenueKpi {
  metric: string;
  value: number;
  unit: string;
  /* `delta30d` removed — see the note on GateReadinessKpi.byLaunch. */
  pctOfPortfolio: number;
  portfolioBase: number;
  byLaunch: { launch: string; exposure: number }[];
}
export interface SlipKpi {
  metric: string;
  value: number;
  unit: string;
  target: number;
  worst: number;
  /* the average is over gates that actually SLIPPED (slipDays > 0), matching the
     gates the portfolio surfaces; the two counts keep the denominator honest so
     the card can read "N of M open gates have slipped". */
  slippedGates: number;
  openGates: number;
  byGate: { gate: string; launch: string | null; slipDays: number }[];
}

/* One market's derived phase/gate position for a launch (Scope C): where that
 * market sits on the launch's gate train once shifted by its first-ship delta.
 * COLOUR RULE: `mlStatus` (the market launch's own ok/rk/ct) is the shared tone
 * source across the cockpit, timeline and market tab — so a market reads the
 * same colour everywhere. `gateStatus` is secondary content only. */
export interface MarketGate {
  marketCode: string | null;
  marketName: string | null;
  marketTier: 'LAUNCH' | 'REGISTRATION' | null;
  firstShipQuarter: string | null;
  phaseCode: string | null;
  gateCode: string | null;
  gateName: string | null;
  gateForecastQuarter: string | null;
  /* the projected gate dates (lead-gate dates shifted by the market's quarter
     offset) — used to position the per-market gate on the SAME date axis the
     lead train uses, so a small slip renders a visible baseline→forecast bar */
  gateBaselineDate: string | null;
  gateForecastDate: string | null;
  /* the projected lead-gate status (secondary content; NOT used for tone) */
  gateStatus: GateStatus;
  /* the lead gate's slip in days (shifted markets inherit it as an estimate) */
  slipDays: number | null;
  /* the market launch's OWN status — the single shared tone source */
  mlStatus: MlStatus;
  reimbursementStatus: string | null;
  isLead: boolean;
  live: boolean;
}
export interface AttentionRow {
  launchId: string;
  device: string;
  shortName: string | null;
  franchise: string | null;
  phaseCode: string | null;
  phaseName: string | null;
  health: Health;
  revenueAtRisk: number | null;
  leadMarket: string | null;
  nextGateCode: string | null;
  nextGateName: string | null;
  /* per-market phase/gate spread — a launch can be at different gates per market
     (US ahead of France); the cockpit shows this instead of a single market. */
  marketGates: MarketGate[];
  exposureCause: string | null;
}
export interface GateClosingRow {
  launchId: string | null;
  device: string | null;
  shortName: string | null;
  gateCode: string;
  gateName: string;
  baselineDate: string | null;
  forecastDate: string | null;
  slipDays: number | null;
  status: GateStatus;
  criteriaMet: number;
  criteriaTotal: number;
}
export interface Cockpit {
  kpis: {
    gateReadiness: GateReadinessKpi;
    launchHealth: LaunchHealthKpi;
    revenueExposed: RevenueKpi;
    scheduleDiscipline: SlipKpi;
  };
  attention: AttentionRow[];
  gatesClosing: GateClosingRow[];
  phaseModel: PhaseModelStep[];
}

/* One step of the canonical NPI phase/gate map shown on the Cockpit. */
export interface PhaseModelStep {
  code: string;
  short: string;
  full: string;
  gate: string;
  gateName: string;
  milestone: string | null;
}

/* ── Portfolio · Product lens ─────────────────────────────────────── */
export interface PhaseBlock {
  code: string;
  name: string;
  state: PhaseState;
}
export interface GateMarker {
  code: string;
  name: string;
  status: GateStatus;
  slipDays: number | null;
  baselineDate: string | null;
  forecastDate: string | null;
}
export interface ProductRow {
  launchId: string;
  device: string;
  shortName: string | null;
  franchise: string | null;
  segment: string | null;
  deviceClass: string | null;
  regulatoryRoute: string | null;
  leadMarket: string | null;
  currentPhase: string | null;
  health: Health;
  revenueAtRisk: number | null;
  firstShipDate: string | null;
  phases: PhaseBlock[];
  gates: GateMarker[];
  /* per-launch time-recovery (days) — reconciles with the Cockpit chart and the
     Open-issues band (same open-definition + timeSplitFor rule). */
  daysAtStake: number;
  recoverableDays: number;
  regulatorDays: number;
  pctRecoverable: number;
}
export interface ProductLens {
  rows: ProductRow[];
}

/* ── Portfolio · Market lens ──────────────────────────────────────── */
export interface MarketLaunchRow {
  launch: string | null;
  status: MlStatus;
  firstShipQuarter: string | null;
  reimbursementStatus: string | null;
  health: Health | null;
}
export interface MarketRow {
  code: string;
  name: string;
  regulatoryBody: string | null;
  tier: 'LAUNCH' | 'REGISTRATION';
  tenderWindows: string | null;
  wave: string | null;
  latitude: number | null;
  longitude: number | null;
  launchCount: number;
  rollupStatus: MlStatus | null;
  launches: MarketLaunchRow[];
}
export interface MarketLens {
  markets: MarketRow[];
  timeline: { quarter: string; count: number }[];
}

/* ── Portfolio · Business-unit lens ───────────────────────────────── */
export interface BuNextGate {
  code: string;
  name: string;
  forecastDate: string | null;
  slipDays: number;
}
export interface BuLaunch {
  launchId: string;
  device: string;
  shortName: string | null;
  health: Health;
  currentPhase: string | null;
  revenueAtRisk: number | null;
  readinessPct: number | null;
  scheduleFloatDays: number | null;
  nextGate: BuNextGate | null;
  openIssues: number;
  daysAtStake: number;
  recoverableDays: number;
  regulatorDays: number;
}
export interface BuFranchise {
  franchise: string;
  launchCount: number;
  revenueAtRisk: number;
  openIssues: number;
  recoverableDays: number;
  daysAtStake: number;
  healthMix: Record<string, number>;
  launches: BuLaunch[];
}
export interface BuSegment {
  segment: string;
  revenueScale: string | null;
  growthRate: number | null;
  launchCount: number;
  revenueAtRisk: number;
  recoverableDays: number;
  daysAtStake: number;
  franchises: BuFranchise[];
}
export interface BusinessUnitLens {
  segments: BuSegment[];
}

/* ── Portfolio · Timeline lens ────────────────────────────────────── */
export interface TimelineRow {
  launchId: string;
  device: string;
  shortName: string | null;
  franchise: string | null;
  leadMarket: string | null;
  health: Health;
  firstShipDate: string | null;
  gates: GateMarker[];
  /* per-market phase/gate spread — see {@link MarketGate}. Lets the timeline
     surface market divergence the single lead-market gate train hides. */
  marketGates: MarketGate[];
}
export interface TimelineLens {
  rows: TimelineRow[];
}

/* ── Open issues ──────────────────────────────────────────────────── */
/* The gate an open issue puts at risk (Gate-at-risk / Slip columns). Mirrors
   the backend gateAtRiskFor projection: the gate that closes the finding's
   phase, so it matches the resolution workspace and finding card. */
export interface IssueGateAtRisk {
  code: string;
  name: string | null;
  status: GateStatus;
  slipDays: number | null;
  baselineDate: string | null;
  forecastDate: string | null;
}
export interface IssueRow {
  findingId: string;
  displayId: string | null;
  headline: string | null;
  description: string | null;
  category: 'ct' | 'rk' | 'ok' | null;
  outcome: 'USER' | 'HELD' | 'AUTO' | 'RUNNING' | null;
  waitingOn: WaitingOn;
  waitingOnLabel: string | null;
  /* raw dependency + the derived time split (see PortfolioService.timeSplitFor):
     recoverableDays = days you get back by acting; regulatorDays = fixed wait on
     an authority; `recoverable` = the whole cost is accelerable by you. */
  dependency: Dependency | null;
  daysAtStake: number | null;
  recoverableDays: number;
  regulatorDays: number;
  recoverable: boolean;
  /* the gate this issue puts at risk — the gate that closes the finding's phase,
     matching the resolution workspace and the finding card. Drives the
     Open-issues "Gate at risk" and "Slip" columns. */
  gateAtRisk: IssueGateAtRisk | null;
  phaseCode: string | null;
  phaseName: string | null;
  device: string | null;
  shortName: string | null;
  launchId: string | null;
  franchise: string | null;
  detectedBy: string | null;
  detectedAt: string | null;
  exposure: number | null;
  exposureCause: string | null;
}
/* Authoritative roll-ups computed server-side (PortfolioService.openIssues) so
   every screen reads the SAME figure instead of re-summing rows locally:
     exposureOpen     — the ONE canonical "Revenue exposed": Σ Finding.exposure over
                        all open findings. Equals the Cockpit revenueExposed KPI
                        (Σ Launch.revenueAtRisk) by construction.
     exposureBlocking — the gate-blocking (category 'ct') subset, shown as
                        "of €X exposed", never as a rival headline.
     daysAtStake / recoverableDays / regulatorDays / pctRecoverable — the same
                        time-recovery split timeImpact() returns. */
export interface OpenIssuesTotals {
  exposureOpen: number;
  exposureBlocking: number;
  daysAtStake: number;
  recoverableDays: number;
  regulatorDays: number;
  pctRecoverable: number;
  blockingCount: number;
  launchCount: number;
}
export interface OpenIssues {
  rows: IssueRow[];
  counts: Record<WaitingOn, number>;
  total: number;
  totals: OpenIssuesTotals;
}

/* ── Time impact (schedule recovery) ──────────────────────────────── */
export interface TimeImpactLaunch {
  launchId: string;
  device: string;
  shortName: string | null;
  health: Health;
  daysAtStake: number;
  recoverableDays: number;
  regulatorDays: number;
  pctRecoverable: number;
  findingCount: number;
}
export interface TimeImpact {
  totals: {
    daysAtStake: number;
    recoverableDays: number;
    regulatorDays: number;
    pctRecoverable: number;
    openCount: number;
  };
  byLaunch: TimeImpactLaunch[];
}

/* ── Launch record ────────────────────────────────────────────────── */
export interface GateCriterionVm {
  name: string;
  met: boolean;
  outstandingReason: string | null;
}
export interface RecordGate {
  code: string;
  name: string;
  status: GateStatus;
  slipDays: number | null;
  baselineDate: string | null;
  forecastDate: string | null;
  phaseCode: string | null;
  criteria: GateCriterionVm[];
}
export interface ActivityCard {
  id: string;
  name: string;
  status: string;
  statusCode: 'ok' | 'run' | 'rk' | 'late' | 'no' | null;
  detail: string | null;
  phaseCode: string | null;
  domainCode: string | null;
  domainName: string | null;
  autonomy: 'A' | 'R' | null;
  owner: string | null;
  ownerKind: 'AGENT' | 'PERSON' | null;
  plannedEnd: string | null;
  actualEnd: string | null;
}
export interface WorkflowColumn {
  code: string;
  name: string;
  state: PhaseState;
  activities: ActivityCard[];
  count: number;
  gate: RecordGate | null;
}
export interface DomainTally {
  code: string;
  name: string;
  count: number;
}
export interface DocumentRow {
  name: string;
  docType: string | null;
  revision: string | null;
  status: 'ok' | 'rev' | 'dft' | 'miss' | 'na';
  documentDate: string | null;
  owner: string | null;
  fileSize: string | null;
}
export interface DocumentGroup {
  code: string;
  label: string;
  documents: DocumentRow[];
}
export interface WorkstreamReadiness {
  label: string;
  pct: number | null;
  done: number;
  total: number;
}
/* One critical part on this launch's bill of materials, plus the OTHER launches
 * that draw the same part from the same supplier — the supplier concentration
 * made verifiable in the detail page. `sharedAcross` counts this launch + siblings. */
export interface CriticalSupplySibling {
  launchId: string;
  device: string;
  shortName: string | null;
}
export interface CriticalSupplyItem {
  partName: string;
  sourcingMode: 'SINGLE_SOURCE' | 'DUAL_SOURCE' | 'MULTI_SOURCE' | string;
  frozenAtGate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  sharedAcross: number;
  siblings: CriticalSupplySibling[];
}
export interface LaunchIssue {
  findingId: string;
  displayId: string | null;
  headline: string | null;
  description: string | null;
  category: 'ct' | 'rk' | 'ok' | string | null;
  outcome: string | null;
  open: boolean;
  exposure: number | null;
  exposureCause: string | null;
  dependency: Dependency | null;
  daysAtStake: number | null;
  recoverableDays: number;
  regulatorDays: number;
  recoverable: boolean;
  detectedBy: string | null;
  detectedAt: string | null;
}
export interface LaunchOverview {
  launchId: string;
  device: string;
  shortName: string | null;
  deviceClass: string | null;
  regulatoryRoute: string | null;
  franchise: string | null;
  segment: string | null;
  leadMarket: string | null;
  leadMarketCode: string | null;
  currentPhase: string | null;
  currentPhaseName: string | null;
  health: Health;
  revenueAtRisk: number | null;
  exposureCause: string | null;
  firstShipDate: string | null;
  launchValue: number | null;
  sterilisationMethod: string | null;
  manufactureSite: string | null;
  registrationsFiled: number | null;
  registrationsTotal: number | null;
  launchBuildUnits: number | null;
  fieldForceCertified: number | null;
  fieldForceTotal: number | null;
  vacApprovalsFiled: number | null;
  vacApprovalsTotal: number | null;
  workstreams: WorkstreamReadiness[];
  gates: RecordGate[];
  /* per-market phase/gate spread for this launch — see {@link MarketGate}. Lets
     the launch record attribute each gate delay to the specific market(s). */
  marketGates: MarketGate[];
  /* critical bill-of-materials parts and the sibling launches that share each one
     — surfaces the supplier concentration on the detail page. */
  criticalSupply: CriticalSupplyItem[];
  activityCount: number;
}
export interface LaunchRecord {
  overview: LaunchOverview;
  issues: {
    rows: LaunchIssue[];
    openCount: number;
    blockingCount: number;
    /* exposure + time-recovery roll-ups for this launch — reconcile with the
       launch's revenueAtRisk and with the Cockpit / Open-issues figures. */
    openExposure: number;
    blockingExposure: number;
    daysAtStake: number;
    recoverableDays: number;
    regulatorDays: number;
    pctRecoverable: number;
  };
  workflow: {
    columns: WorkflowColumn[];
    domains: DomainTally[];
    statusTally: Record<string, number>;
    autonomyTally: Record<string, number>;
    total: number;
  };
  documents: {
    groups: DocumentGroup[];
    total: number;
    missing: number;
  };
}

/* ── Cascade replan (SCENARIO 1 — connected milestone) ───────────── */
export type CascadeResolution = 'AUTO' | 'HUMAN';
export type CascadeItemStatus =
  | 'PENDING'
  | 'AUTO_ADJUSTED'
  | 'AWAITING_DECISION'
  | 'RESOLVED';

export interface CascadeMilestone {
  id: string;
  displayId: string;
  launchId: string | null;
  launchName: string | null;
  authority: string;
  milestoneName: string;
  baselineDate: string | null;
  currentDate: string | null;
  slipDays: number;
  slipWeeks: number;
  status: 'ON_TRACK' | 'SLIPPED' | 'REPLANNED';
}

export interface CascadeItem {
  id: string;
  sortOrder: number;
  domain: string;
  domainLabel: string;
  targetLabel: string;
  detail: string | null;
  resolution: CascadeResolution;
  autoAction: string | null;
  decisionPrompt: string | null;
  decisionOptions: string[];
  ownerName: string | null;
  costImpact: number;
  dayShift: number;
  status: CascadeItemStatus;
  resolvedOption: string | null;
  resolvedAt: string | null;
}

export interface CascadeSummary {
  total: number;
  autoAdjusted: number;
  needDecision: number;
  resolved: number;
  pending: number;
  costBooked: number;
  costPending: number;
  costTotal: number;
}

export interface CascadePlan {
  milestone: CascadeMilestone;
  items: CascadeItem[];
  summary: CascadeSummary;
}

/* ── Launch index ─────────────────────────────────────────────────── */
export interface LaunchIndexRow {
  launchId: string;
  device: string;
  shortName: string | null;
  franchise: string | null;
  currentPhase: string | null;
  currentPhaseName: string | null;
  health: Health;
  revenueAtRisk: number | null;
}
export interface LaunchIndex {
  rows: LaunchIndexRow[];
}
