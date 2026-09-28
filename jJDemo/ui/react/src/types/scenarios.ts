/*
 * View-model interfaces for the two guided scenarios. These mirror, field for
 * field, the JSON shapes returned by QualityDisruptionService (Scenario 1 —
 * quality disruption) and MarketWaveService (Scenario 2 — demand and
 * market-wave change). Nothing here is invented: every field is produced by a
 * backend method, so a change to a service signature shows up as a type error
 * rather than as an undefined at runtime.
 */

/* ── shared ───────────────────────────────────────────────────────── */

/** Where an option stands once a decision has been taken. */
export type OptionStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RULED_OUT';

/**
 * One comparable response option. Both scenarios score their options on the
 * same axes — doses, days, cost, revenue, markets — which is what makes the
 * cards commensurable rather than four paragraphs of prose.
 */
export interface ScenarioOptionRow {
  id: string;
  label: string;
  optionKind: string;
  sortOrder: number;
  description: string | null;
  dosesServed: number;
  dosesLost: number;
  /** Schedule impact in days: positive slips a committed date. */
  dayImpact: number;
  /** Calendar days to execute, checked against the clock the scenario runs on. */
  executionDays: number;
  incrementalCost: number;
  revenueProtected: number;
  revenueLost: number;
  marketsProtected: number;
  marketsImpacted: number;
  protectedMarkets: string | null;
  impactedMarkets: string | null;
  /** False when a constraint rules the option out; see {@link infeasibleReason}. */
  feasible: boolean;
  infeasibleReason: string | null;
  regulatoryImpact: boolean;
  regulatoryDetail: string | null;
  residualRisk: string | null;
  /** Composite 0–100 score. Advisory — a person still signs. */
  score: number;
  recommended: boolean;
  status: OptionStatus;
  capacitySourceName?: string | null;
}

/* ── Scenario 1: quality disruption ───────────────────────────────── */

export type QualityStage =
  | 'RAISED'
  | 'SCOPED'
  | 'OPTIONS_EVALUATED'
  | 'DECIDED'
  | 'COORDINATED';

export interface QualityEventHeader {
  id: string;
  eventNo: string;
  launchId: string | null;
  launchName: string | null;
  siteName: string | null;
  siteLocation: string | null;
  defectDescription: string;
  defectCategory: string | null;
  detectionMethod: string | null;
  severity: string | null;
  raisedAt: string | null;
  raisedByName: string | null;
  stage: QualityStage;
  /** Scope totals — null/zero until determineScope has run. */
  scopeBatchCount: number;
  scopeDoses: number;
  scopeMarketCount: number;
  scopeRevenueAtRisk: number;
  recallAssessmentRequired: boolean;
  regulatoryNotificationRequired: boolean;
  approvedOptionId: string | null;
  approvedOptionLabel: string | null;
  decisionAuthority: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionRationale: string | null;
  coordinationComplete: boolean;
  coordinationActionCount: number;
  capaRef: string | null;
  /** The inspection reject limit (ppm) batch disposition is judged against. */
  actionLimitPpm: number;
}

/** The suspect component lot — the common cause that links the held batches. */
export interface ComponentLotInfo {
  id: string;
  lotNo: string;
  componentName: string | null;
  supplierName: string | null;
  singleSource: boolean;
  defectRatePpm: number;
  quantityRemaining: number;
  acceptanceStatus: string | null;
}

export interface FillBatchRow {
  id: string;
  batchNo: string;
  siteName: string | null;
  presentation: string | null;
  doseCount: number;
  fillDate: string | null;
  expiryDate: string | null;
  state: string;
  disposition: string | null;
  dispositionByName: string | null;
  holdReason: string | null;
  lotNo: string | null;
  /** True when this batch was filled from the suspect lot. */
  fromSuspectLot: boolean;
  inspectionRejectPpm: number;
  /** True when the batch's reject rate exceeds the action limit. */
  overActionLimit: boolean;
}

/** One market's position under a given supply allocation. */
export interface AllocationRow {
  commitmentId: string;
  marketCode: string | null;
  marketName: string | null;
  regulatoryBody: string | null;
  priorityRank: number;
  priorityTier: string | null;
  committedDoses: number;
  allocatedDoses: number;
  shortfallDoses: number;
  revenuePerDose: number;
  revenueProtected: number;
  revenueLost: number;
  firstShipDate: string | null;
  tenderDeadline: string | null;
  contractPenalty: boolean;
  /** True when supply arrives after this market's tender window closes. */
  missedWindow: boolean;
  state: string;
}

export interface QualitySummary {
  batchCount: number;
  heldBatchCount: number;
  heldDoses: number;
  cleanDoses: number;
  releasedFromSuspectLot: number;
  committedDoses: number;
  committedRevenue: number;
  marketCount: number;
  uncoveredDoses: number;
  revenueAtRisk: number;
  marketsProtectedFromCleanStock: number;
  marketsAtRisk: number;
  optionCount: number;
  feasibleOptionCount: number;
}

export interface QualityPlan {
  event: QualityEventHeader;
  componentLot: ComponentLotInfo | null;
  batches: FillBatchRow[];
  options: ScenarioOptionRow[];
  allocation: AllocationRow[];
  /**
   * Which basis the allocation table is on: the hypothetical exposure from clean
   * stock before a decision, or what was actually committed after one.
   */
  allocationBasis: 'CLEAN_STOCK_ONLY' | 'COMMITTED';
  summary: QualitySummary;
}

/**
 * What {@code QualityDisruptionService#allocation} returns — a projection, not a
 * commitment, unless it was called with {@code commit: true} (in which case
 * {@link #committed} is set and the market commitments have been written).
 *
 * Field names here follow the service exactly: it returns {@code availableDoses}
 * and does not return an {@code optionKind}, so neither is renamed or invented on
 * this side. Getting that wrong is silent — an interface can promise a field the
 * wire never carries, and it reads as {@code undefined} rather than as an error.
 */
export interface QualityAllocationPreview {
  eventId: string;
  optionId: string;
  optionLabel: string;
  /** Doses the chosen option makes available — what the priority order divides up. */
  availableDoses: number;
  readyDate: string | null;
  rows: AllocationRow[];
  committed: boolean;
  summary: {
    marketsProtected: number;
    marketsConstrained: number;
    marketsDeferred: number;
    marketsMissedWindow: number;
    servedDoses: number;
    unservedDoses: number;
    revenueProtected: number;
    revenueLost: number;
  };
}

/* ── Scenario 2: demand and market-wave change ────────────────────── */

export type DemandStage =
  | 'RAISED'
  | 'CONSTRAINTS_ASSESSED'
  | 'OPTIONS_EVALUATED'
  | 'DECIDED'
  | 'COMMITTED';

export interface DemandChangeHeader {
  id: string;
  requestNo: string;
  launchId: string | null;
  launchName: string | null;
  marketCode: string | null;
  marketName: string | null;
  regulatoryBody: string | null;
  requestedByName: string | null;
  requestedByFunction: string | null;
  requestedAt: string | null;
  /** The clock: weeks of runway before packaging starts. */
  weeksBeforePackaging: number;
  packagingStartDate: string | null;
  baselineDoses: number;
  requestedDoses: number;
  upliftDoses: number;
  upliftPercent: number;
  baselinePresentation: string | null;
  requestedPresentation: string | null;
  baselineSku: string | null;
  requestedSku: string | null;
  rationale: string | null;
  incrementalRevenue: number;
  stage: DemandStage;
  capacityShortfall: boolean;
  capacityGapDosesPerWeek: number;
  componentShortfall: boolean;
  componentGapUnits: number;
  logisticsShortfall: boolean;
  /** Which of the three limits binds first — the headline of the assessment. */
  bindingConstraint: string | null;
  approvedOptionId: string | null;
  approvedOptionLabel: string | null;
  decisionAuthority: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionRationale: string | null;
  commitmentsUpdated: boolean;
  updatedCommitmentCount: number;
}

/** One capacity lane — an internal line, a CMO or a packaging partner. */
export interface CapacityLane {
  id: string;
  name: string;
  sourceKind: string | null;
  operation: string;
  presentation: string | null;
  siteName: string | null;
  dosesPerWeek: number;
  committedDosesPerWeek: number;
  headroomPerWeek: number;
  headroomInWindow: number;
  availableFrom: string | null;
  qualifiedForLaunch: boolean;
  qualificationLeadDays: number;
  costPerThousandDoses: number;
  regulatoryVariationRequired: boolean;
  /** False when the lane is unqualified or not free before packaging starts. */
  usableInWindow: boolean;
}

/** One packaging component and how many doses it can actually support in time. */
export interface ComponentRow {
  id: string;
  partNo: string;
  name: string;
  componentClass: string;
  presentation: string | null;
  supplierName: string | null;
  singleSource: boolean;
  onHandUnits: number;
  allocatedUnits: number;
  freeUnits: number;
  onOrderUnits: number;
  onOrderArrival: string | null;
  onOrderArrivesInTime: boolean;
  leadTimeDays: number;
  /** False when the lead time is longer than the runway — unbuyable at any price. */
  leadTimeWithinRunway: boolean;
  unitsPerDose: number;
  unitCost: number;
  dualSourced: boolean;
  inRegulatoryDossier: boolean;
  supportableDoses: number;
}

export interface ConstraintAssessment {
  runwayDays: number;
  weeks: number;
  fillHeadroomPerWeek: number;
  fillHeadroomInWindow: number;
  packHeadroomPerWeek: number;
  packHeadroomInWindow: number;
  requestedFillHeadroomInWindow: number;
  componentCeilingDoses: number;
  bindingComponent: string | null;
  requestedComponentCeilingDoses: number;
  requestedBindingComponent: string | null;
  coldChainDoses: number;
  coldChain: {
    partNo: string;
    name: string;
    freeUnits: number;
    supportableDoses: number;
  } | null;
  servableUplift: number;
  upliftGap: number;
  capacityGapPerWeek: number;
  /**
   * The binding constraint as the sentence a planner repeats in a review — which
   * component or lane, whose supplier, and the arithmetic that makes it bind.
   */
  bindingConstraint: string;
  /** The same finding as a short key, for a chip or a filter. */
  bindingKind:
    | 'COMPONENT_LEAD_TIME'
    | 'PACK_CAPACITY'
    | 'COMPONENTS'
    | 'COLD_CHAIN'
    | 'NONE';
  /** How much of the request can be served in the presentation Commercial asked for. */
  requestedPresentationServable: number;
  packMixNote: string;
  convCostPerDose: number;
  lanes: CapacityLane[];
  components: ComponentRow[];
}

/** One market commitment, with whatever revision a committed decision wrote. */
export interface MarketCommitmentRow {
  commitmentId: string;
  marketCode: string | null;
  marketName: string | null;
  regulatoryBody: string | null;
  priorityRank: number;
  priorityTier: string | null;
  committedDoses: number;
  revisedDoses: number;
  wave: string | null;
  revisedWave: string | null;
  firstShipDate: string | null;
  revisedFirstShipDate: string | null;
  presentation: string | null;
  skuCode: string | null;
  revenuePerDose: number;
  committedRevenue: number;
  contractPenalty: boolean;
  tenderDeadline: string | null;
  status: string;
  /** True for the market whose demand changed. */
  isTarget: boolean;
}

export interface DemandSummary {
  marketCount: number;
  bookDoses: number;
  bookRevenue: number;
  upliftDoses: number;
  upliftServable: number;
  upliftGap: number;
  optionCount: number;
  feasibleOptionCount: number;
  marketsRevised: number;
}

export interface DemandPlan {
  change: DemandChangeHeader;
  constraints: ConstraintAssessment;
  options: ScenarioOptionRow[];
  markets: MarketCommitmentRow[];
  summary: DemandSummary;
}

/** One market's projected position under an option, before anyone signs. */
export interface WaveProjectionRow {
  commitmentId: string;
  marketCode: string | null;
  marketName: string | null;
  regulatoryBody: string | null;
  priorityRank: number;
  priorityTier: string | null;
  committedDoses: number;
  revisedDoses: number;
  wave: string | null;
  revisedWave: string | null;
  firstShipDate: string | null;
  revisedFirstShipDate: string | null;
  slipDays: number;
  revenuePerDose: number;
  contractPenalty: boolean;
  tenderDeadline: string | null;
  /** True when the slip pushes this market past its tender close — a forfeit, not a delay. */
  tenderBreached: boolean;
  isTarget: boolean;
  /** True when this market is packed inside the contested window. */
  inContestedWindow: boolean;
  state: string;
  note: string | null;
}

export interface WaveAllocation {
  changeId: string;
  optionId: string;
  optionLabel: string;
  optionKind: string;
  feasible: boolean;
  rows: WaveProjectionRow[];
  summary: {
    targetCode: string | null;
    targetRevised: number;
    upliftServed: number;
    upliftShort: number;
    reallocatedDoses: number;
    resequencedMarkets: number;
    totalDoses: number;
    baselineDoses: number;
    revenue: number;
    baselineRevenue: number;
    incrementalRevenue: number;
    marketsWhole: number;
    marketsImpacted: number;
    tendersBreached: number;
    maxSlipDays: number;
    extraCost: number;
  };
}
