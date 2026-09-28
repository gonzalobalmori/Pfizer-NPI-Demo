/*
 * API bridge for the Milestone-replan screen (SCENARIO 1 — connected milestone
 * management / dynamic cascade replan). Every call goes to the backend
 * CascadeReplanService via c3Action; there is no local/mock data. A failing call
 * surfaces to the caller.
 */

import { c3Action } from '@/c3Action';
import type { CascadePlan } from '@/types/portfolio';

/** The scenario the screen opens on when nothing has been picked yet. */
export const PF3945_LAUNCH_ID = 'seed_launch_pf3945_obesity';
export const PF3945_FDA_MILESTONE_ID = 'seed_milestone_pf3945_obesity_fda';

/** One row in the scenario picker. */
export interface CascadeScenario {
  id: string;
  displayId: string | null;
  authority: string | null;
  milestoneName: string | null;
  launchId: string | null;
  product: string | null;
  baselineDate: string | null;
  currentDate: string | null;
  slipDays: number | null;
  status: string | null;
}

/**
 * Every replan scenario the environment holds.
 *
 * The screen lists these rather than hard-coding one milestone id: a hard-coded
 * id also breaks whenever the seed is renamed, which is exactly what left this
 * screen blank.
 */
export const getCascadeScenarios = (): Promise<{ scenarios: CascadeScenario[] }> =>
  c3Action('CascadeReplanService', 'scenarios', []);

/** Read the current replan dashboard for a launch (defaults server-side when null). */
export const getCascadePlan = (launchId: string | null = PF3945_LAUNCH_ID): Promise<CascadePlan | null> =>
  c3Action('CascadeReplanService', 'plan', [launchId]);

/** Read the dashboard for a specific milestone. */
export const getCascadePlanFor = (milestoneId: string): Promise<CascadePlan | null> =>
  c3Action('CascadeReplanService', 'planFor', [milestoneId]);

/** Run the cascade: move the authority's date, auto-adjust what is safe, surface what needs a human. */
export const runCascadeReplan = (milestoneId: string, newDateIso: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'cascadeReplan', [milestoneId, newDateIso]);

/** Record a human decision on one impact item. */
export const resolveCascadeImpact = (itemId: string, optionLabel: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'resolveImpact', [itemId, optionLabel]);

/** Restore the milestone + items to their pre-slip baseline (repeatable demo). */
export const resetCascade = (milestoneId: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'reset', [milestoneId]);
