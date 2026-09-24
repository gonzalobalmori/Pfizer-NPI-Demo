/*
 * API bridge for the Milestone-replan screen (SCENARIO 1 — connected milestone
 * management / dynamic cascade replan). Every call goes to the backend
 * CascadeReplanService via c3Action; there is no local/mock data. A failing call
 * surfaces to the caller.
 */

import { c3Action } from '@/c3Action';
import type { CascadePlan } from '@/types/portfolio';

/** The default anchor launch/milestone for the scenario (OTTAVA robotic platform, FDA clearance). */
export const OTTAVA_LAUNCH_ID = 'seed_launch_ottava';
export const OTTAVA_FDA_MILESTONE_ID = 'seed_milestone_ottava_fda';

/** Read the current replan dashboard for a launch (defaults to OTTAVA server-side when null). */
export const getCascadePlan = (launchId: string | null = OTTAVA_LAUNCH_ID): Promise<CascadePlan | null> =>
  c3Action('CascadeReplanService', 'plan', [launchId]);

/** Run the cascade: move the authority's date, auto-adjust what is safe, surface what needs a human. */
export const runCascadeReplan = (milestoneId: string, newDateIso: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'cascadeReplan', [milestoneId, newDateIso]);

/** Record a human decision on one impact item. */
export const resolveCascadeImpact = (itemId: string, optionLabel: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'resolveImpact', [itemId, optionLabel]);

/** Restore the milestone + items to their pre-slip baseline (repeatable demo). */
export const resetCascade = (milestoneId: string): Promise<CascadePlan> =>
  c3Action('CascadeReplanService', 'reset', [milestoneId]);
