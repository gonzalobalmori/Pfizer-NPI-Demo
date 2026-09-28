/*
 * The five-step rail both scenarios run on. Each scenario is a governed
 * sequence — scope/assess, evaluate, project, decide, coordinate/commit — and
 * the rail is the presenter's place in it: which step is live, which are done,
 * and the single button that advances to the next one.
 *
 * The rail is driven by the backend stage, never by local UI state, so refreshing
 * the page or resetting the scenario always shows the true position.
 */

import React from 'react';

export interface StepDef {
  /** Short label on the rail, e.g. "Scope". */
  label: string;
  /** What this step does, shown when it is the live one. */
  hint: string;
  /** Label for the button that runs this step. Null when the step is not run by a single click. */
  action: string | null;
}

interface StepRailProps {
  steps: StepDef[];
  /** Zero-based index of the live step. Equals steps.length when the run is complete. */
  current: number;
  busy: boolean;
  /** Runs the live step. Not rendered when the live step has no single-click action. */
  onRun: () => void;
  onReset: () => void;
  /** True once the whole sequence has been run, which turns the rail into a summary. */
  complete: boolean;
}

export default function StepRail({
  steps,
  current,
  busy,
  onRun,
  onReset,
  complete,
}: StepRailProps) {
  const live = current < steps.length ? steps[current] : null;

  return (
    <div className="sr">
      <ol className="sr-steps">
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'live' : 'next';
          return (
            <li key={s.label} className={`sr-step ${state}`} data-step={i + 1}>
              <span className="sr-dot">{i < current ? '✓' : i + 1}</span>
              <span className="sr-lbl">{s.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="sr-act">
        {live?.hint && <span className="sr-hint">{live.hint}</span>}
        {complete && <span className="sr-hint sr-done">Run complete — every step is recorded.</span>}
        {live?.action && (
          <button type="button" className="btn p" disabled={busy} onClick={onRun} id="sr-run">
            {busy ? 'Working…' : live.action}
          </button>
        )}
        <button type="button" className="btn s" disabled={busy} onClick={onReset} id="sr-reset">
          Reset scenario
        </button>
      </div>
    </div>
  );
}
