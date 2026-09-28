/*
 * "Reset demo" — put every scenario back to its opening state.
 *
 * WHY THIS EXISTS: the demo's actions write persisted state. Approving a
 * decision, cascading a milestone, disposition a quality event — each one
 * settles, and a settled scenario cannot be presented again. There was a reset,
 * but it only ran once per page load, so the only way to rewind was to know to
 * refresh. Before presenting you need a deliberate, visible way to put the
 * problems back.
 *
 * It confirms first. A mis-click mid-presentation that silently rewound the
 * scenario the audience was looking at would be worse than no button, so the
 * first click asks and the second commits.
 *
 * On failure it does NOT reload: reloading over a failed reset would present
 * stale state as fresh, which is the one outcome worth avoiding here.
 */

import React, { useState } from 'react';
import { resetAllAndReload } from '@/hooks/useDemoReset';

export default function ResetDemoButton() {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'working' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPhase('working');
    setError(null);
    const err = await resetAllAndReload();
    /* On success the page reloads, so reaching here means it failed. */
    if (err) {
      setError(err);
      setPhase('failed');
    }
  };

  if (phase === 'failed') {
    return (
      <div className="h-rs-wrap">
        <button type="button" className="h-rs bad" onClick={run} title={error ?? undefined}>
          Reset failed — retry
        </button>
        <span className="h-rs-err">{error}</span>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="h-rs-wrap">
        <span className="h-rs-q">Put all scenarios back to their opening state?</span>
        <button type="button" className="h-rs go" onClick={run}>Reset</button>
        <button type="button" className="h-rs" onClick={() => setPhase('idle')}>Cancel</button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="h-rs"
      disabled={phase === 'working'}
      onClick={() => setPhase('confirm')}
      title="Rewind every scenario so the demo can be presented again"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M3 4v5h5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {phase === 'working' ? 'Resetting…' : 'Reset demo'}
    </button>
  );
}
