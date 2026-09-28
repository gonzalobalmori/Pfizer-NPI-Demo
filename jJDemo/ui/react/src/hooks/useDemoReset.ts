/*
 * Reset every scenario action to its seeded baseline once per page load (R-TR-15).
 *
 * Why this exists: the demo's actions write real, persisted state. Approving NPI-0417
 * re-baselines a gate, releases €18.4M of exposure, dispatches 21 tasks and appends a
 * CTD entry — so after one walkthrough the app stayed settled, the Approve button was
 * replaced by an outcome line, and a second run was refused by the service-layer guard
 * ("Approve runs once"). A refresh now returns the app to its opening state.
 *
 * ── The ordering constraint ────────────────────────────────────────────────────
 * The reset MUST complete before any view fetches, or a page reads rows the reset is
 * still rewriting and renders post-approval values that then never refresh. So this is
 * a GATE, not a side effect: `ready` stays false until the reset settles, and the shell
 * renders nothing data-bound until it flips. The whole point is to serialise the two.
 *
 * ── Why once per page load, not once per mount ─────────────────────────────────
 * The promise is module-level, so it is shared by every caller and survives remounts
 * (React StrictMode double-invokes effects in development; navigating between tabs
 * remounts views). A per-component guard would fire the reset again mid-session and
 * wipe an approval the user had just made while they were still looking at it.
 *
 * ── Failure policy ────────────────────────────────────────────────────────────
 * A failed reset resolves rather than rejects, and the app still boots. The reset is a
 * demo convenience; if it fails the worst case is stale scenario state, which is
 * strictly better than a blank screen. The error is surfaced via `error` so the shell
 * can show a non-blocking notice instead of hiding it.
 */

import { useEffect, useState } from 'react';
import { resetDecision } from '@/api/execution';
import { resetQuality, resetWave, QUALITY_EVENT_ID, DEMAND_CHANGE_ID } from '@/api/scenarios';
import { resetCascade, Velsipity_FDA_MILESTONE_ID } from '@/api/cascade';

export interface DemoResetState {
  /** True once the reset has settled — successfully or not. Views must wait for it. */
  ready: boolean;
  /** Set when one or more branches failed to reset. Non-blocking. */
  error: string | null;
}

/**
 * Reset all four scenario branches. Each is independent, so they run concurrently and
 * are settled individually — one branch failing must not prevent the others from
 * rewinding, which would leave the demo half-reset.
 */
async function runReset(): Promise<string | null> {
  const branches: Array<[string, () => Promise<unknown>]> = [
    // Execution: every USER-held decision (the Approve flow on the issue page).
    ['decisions', () => resetDecision()],
    ['quality', () => resetQuality(QUALITY_EVENT_ID)],
    ['market wave', () => resetWave(DEMAND_CHANGE_ID)],
    ['cascade', () => resetCascade(Velsipity_FDA_MILESTONE_ID)],
  ];

  const results = await Promise.allSettled(branches.map(([, run]) => run()));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? branches[i][0] : null))
    .filter((n): n is string => n !== null);

  if (failed.length === 0) return null;
  return `Could not reset: ${failed.join(', ')}. The app is showing whatever state those scenarios were left in.`;
}

/* Module-level so the reset happens once per page load and is shared by all callers. */
let resetPromise: Promise<string | null> | null = null;

function resetOnce(): Promise<string | null> {
  if (!resetPromise) resetPromise = runReset();
  return resetPromise;
}

/**
 * Gate app startup on the demo reset. Returns `{ready:false}` until it settles; the
 * shell must not render data-bound views before then.
 */
export function useDemoReset(): DemoResetState {
  const [state, setState] = useState<DemoResetState>({ ready: false, error: null });

  useEffect(() => {
    let alive = true;
    resetOnce().then((error) => {
      // Guard against setting state after unmount (StrictMode mounts twice).
      if (alive) setState({ ready: true, error });
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export default useDemoReset;
