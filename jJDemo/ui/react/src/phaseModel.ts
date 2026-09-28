/*
 * The nine NPI phases, owned by the UI.
 *
 * WHY THIS EXISTS: same reason as productLabel.ts — the C3 environment the demo
 * runs from may be on an older backend that still returns the six-phase ladder.
 * The phase track is the centrepiece of the portfolio table, so rather than
 * require a re-seed before it reads correctly, the UI normalises whatever the
 * backend sends onto the full nine.
 *
 * This is additive and non-destructive: where the backend supplies a phase, its
 * state is used verbatim. Missing phases are inferred from the launch's current
 * phase, which is the only thing that can be said about them.
 */

export type PhaseState = 'closed' | 'live' | 'queued';

export interface PhaseSlot {
  code: string;
  name: string;
  short: string;
  state: PhaseState;
}

/* Full names as specified; `short` is what fits the table header. */
export const PHASE_MODEL: { code: string; name: string; short: string }[] = [
  { code: 'P1', name: 'Portfolio & Launch Strategy', short: 'Strategy' },
  { code: 'P2', name: 'NPL Initiation & Planning', short: 'Planning' },
  { code: 'P3', name: 'Drug Substance (DS) Readiness', short: 'DS' },
  { code: 'P4', name: 'Drug Product (DP) Readiness', short: 'DP' },
  { code: 'P5', name: 'Finished Product Readiness', short: 'Finished' },
  { code: 'P6', name: 'Launch Readiness & Market Enablement', short: 'Readiness' },
  { code: 'P7', name: 'Global Launch Execution', short: 'Execution' },
  { code: 'P8', name: 'Market Launch', short: 'Launch' },
  { code: 'P9', name: 'Post-Launch Monitoring & Continuous Improvement', short: 'Post-launch' },
];

/** The header axis: one entry per phase, abbreviated. */
export const PHASE_AXIS = PHASE_MODEL.map((p) => ({ code: p.code, short: p.short }));

const BY_CODE = new Map(PHASE_MODEL.map((p) => [p.code, p]));

/** The full phase name for a code, falling back to the backend's own label. */
export function phaseNameFor(code?: string | null, fallback?: string | null): string {
  return (code ? BY_CODE.get(code)?.name : undefined) ?? fallback ?? '';
}

interface BackendPhase {
  code: string;
  name?: string | null;
  state?: string | null;
}

const ordinal = (code?: string | null): number => {
  const n = code ? parseInt(code.replace(/\D/g, ''), 10) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Project the backend's phases onto all nine slots.
 *
 * A phase the backend knows about keeps its own state. One it does not is
 * inferred against `currentPhaseCode`: earlier phases are closed, the current
 * one is live, later ones are queued.
 */
export function normalizePhases(
  backendPhases: BackendPhase[] | null | undefined,
  currentPhaseCode?: string | null,
): PhaseSlot[] {
  const supplied = new Map<string, BackendPhase>();
  for (const p of backendPhases ?? []) if (p?.code) supplied.set(p.code, p);

  /* Prefer the backend's own live phase over the passed-in code — on an older
     backend the two can disagree, and the phase list is the more direct claim. */
  const liveFromList = (backendPhases ?? []).find((p) => p?.state === 'live')?.code;
  const current = ordinal(liveFromList ?? currentPhaseCode);

  return PHASE_MODEL.map((model) => {
    const hit = supplied.get(model.code);
    let state: PhaseState;
    if (hit?.state === 'closed' || hit?.state === 'live' || hit?.state === 'queued') {
      state = hit.state;
    } else {
      const n = ordinal(model.code);
      state = current === 0 ? 'queued' : n < current ? 'closed' : n === current ? 'live' : 'queued';
    }
    return { code: model.code, name: model.name, short: model.short, state };
  });
}
