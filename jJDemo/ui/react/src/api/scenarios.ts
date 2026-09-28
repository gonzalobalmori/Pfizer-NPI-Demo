/*
 * API bridge for the two guided scenarios. Every call goes to a backend service
 * through c3Action; there is no local or mock data anywhere in this file. A
 * failing call propagates to the caller, which surfaces it in the view — there
 * is deliberately no fallback, so a broken wire is visible rather than hidden.
 *
 *   SCENARIO 1 — quality disruption      → QualityDisruptionService
 *   SCENARIO 2 — demand / market wave    → MarketWaveService
 */

import { c3Action } from '@/c3Action';
import type {
  QualityPlan,
  QualityAllocationPreview,
  DemandPlan,
  WaveAllocation,
} from '@/types/scenarios';

/* ── Scenario 1 — quality disruption ──────────────────────────────── */

/** The stopper-defect hold on the Sasanlimab launch that opens Scenario 1. */
export const QUALITY_EVENT_ID = 'seed_qe_berobenatide_t2d_stopper';

/** Read the quality dashboard at whatever stage the event has reached. */
export const getQualityPlan = (eventId: string = QUALITY_EVENT_ID): Promise<QualityPlan | null> =>
  c3Action('QualityDisruptionService', 'plan', [eventId]);

/** Step 1 — sweep every batch filled from the suspect lot and total the exposure. */
export const determineScope = (eventId: string = QUALITY_EVENT_ID): Promise<QualityPlan> =>
  c3Action('QualityDisruptionService', 'determineScope', [eventId]);

/** Step 2 — score the recovery and supply options against the expiry clock. */
export const evaluateQualityOptions = (eventId: string = QUALITY_EVENT_ID): Promise<QualityPlan> =>
  c3Action('QualityDisruptionService', 'evaluateOptions', [eventId]);

/**
 * Step 3 — project which markets an option can protect. Pure preview unless
 * {@code commit} is true, which persists the allocation to the commitments.
 */
export const previewQualityAllocation = (
  eventId: string,
  optionId: string,
  commit = false,
): Promise<QualityAllocationPreview> =>
  c3Action('QualityDisruptionService', 'allocation', [eventId, optionId, commit]);

/** Step 4 — the governed Quality decision, with a Part 11 electronic signature. */
export const decideQuality = (
  eventId: string,
  optionId: string,
  signerId: string,
  rationale: string,
): Promise<QualityPlan> =>
  c3Action('QualityDisruptionService', 'decide', [eventId, optionId, signerId, rationale]);

/** Step 5 — coordinate the approved response: disposition, CAPA, owned actions. */
export const coordinateQuality = (eventId: string = QUALITY_EVENT_ID): Promise<QualityPlan> =>
  c3Action('QualityDisruptionService', 'coordinate', [eventId]);

/** Restore the pre-hold baseline so the scenario can be presented again. */
export const resetQuality = (eventId: string = QUALITY_EVENT_ID): Promise<QualityPlan> =>
  c3Action('QualityDisruptionService', 'reset', [eventId]);

/* ── Scenario 2 — demand and market-wave change ───────────────────── */

/** Commercial's uplift + pack-mix request on the Berobenatide launch. */
export const DEMAND_CHANGE_ID = 'seed_dchg_berobenatide_obesity_de';

/** Read the demand-change dashboard at whatever stage the request has reached. */
export const getDemandPlan = (changeId: string = DEMAND_CHANGE_ID): Promise<DemandPlan | null> =>
  c3Action('MarketWaveService', 'plan', [changeId]);

/** Step 1 — test the uplift against capacity, components and cold chain. */
export const assessConstraints = (changeId: string = DEMAND_CHANGE_ID): Promise<DemandPlan> =>
  c3Action('MarketWaveService', 'assessConstraints', [changeId]);

/** Step 2 — score the four options: constrain, reallocate, add capacity, resequence. */
export const evaluateWaveOptions = (changeId: string = DEMAND_CHANGE_ID): Promise<DemandPlan> =>
  c3Action('MarketWaveService', 'evaluateOptions', [changeId]);

/** Step 3 — project the market-by-market plan one option would produce. */
export const previewWaveAllocation = (changeId: string, optionId: string): Promise<WaveAllocation> =>
  c3Action('MarketWaveService', 'allocation', [changeId, optionId]);

/** Step 4 — the governed Commercial/Governance decision, with a Part 11 signature. */
export const decideWave = (
  changeId: string,
  optionId: string,
  signerId: string,
  rationale: string,
): Promise<DemandPlan> =>
  c3Action('MarketWaveService', 'decide', [changeId, optionId, signerId, rationale]);

/** Step 5 — update every affected plan, owner, site, partner and commitment. */
export const commitWave = (changeId: string = DEMAND_CHANGE_ID): Promise<DemandPlan> =>
  c3Action('MarketWaveService', 'commit', [changeId]);

/** Restore the pre-request baseline so the scenario can be presented again. */
export const resetWave = (changeId: string = DEMAND_CHANGE_ID): Promise<DemandPlan> =>
  c3Action('MarketWaveService', 'reset', [changeId]);
