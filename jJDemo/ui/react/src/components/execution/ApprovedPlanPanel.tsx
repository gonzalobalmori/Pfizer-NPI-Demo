/*
 * The approved plan, overseen.
 *
 * Approving used to produce a toast and then nothing — which is precisely the
 * moment a launch lead most needs to see what the approval actually set in
 * motion. This drawer answers three questions in order:
 *
 *   1. what did I commit to  — the option, signed, with its schedule and
 *      commercial consequences side by side
 *   2. what has happened since — per action: who or what ran it, which system
 *      it wrote into, and the reference that came back
 *   3. what is still open     — and it can be driven from here, so overseeing
 *      and acting are not two different screens
 *
 * Uses the existing `.scrim` / `.rw` right-drawer styling rather than new
 * chrome, so it reads as part of the resolution workspace it belongs to.
 */

import React, { useEffect } from 'react';
import Glyph from '@/components/Brand/Glyph';
import { fmtDate, fmtDateTime, fmtEuro, fmtGate } from '@/lib/format';
import type { DecisionOptionVm, WorkspaceDecision, WorkspaceGateAtRisk } from '@/types/execution';
import type { ActionRunState, RunMode } from '@/execution/actionRuntime';
import type { ExecTarget } from '@/components/execution/ActionExecutionModal';

export interface PlanRow {
  target: ExecTarget;
  agentRunnable: boolean;
  dueDate: string | null;
  run: ActionRunState | undefined;
}

interface Props {
  option: DecisionOptionVm;
  decision: WorkspaceDecision | null;
  gate: WorkspaceGateAtRisk | null;
  rows: PlanRow[];
  progress: { done: number; assigned: number; pending: number; total: number; pct: number; systemsWritten: string[] };
  onExec: (mode: RunMode, target: ExecTarget) => void;
  onClose: () => void;
}

export default function ApprovedPlanPanel({
  option, decision, gate, rows, progress, onExec, onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <aside className="rw on pl-rw" role="dialog" aria-modal="true" aria-label="Approved plan">
        <header className="pl-h">
          <div>
            <div className="rw-id">{decision?.id ?? 'Decision'} · approved plan</div>
            <div className="rw-t">{option.label ?? 'Approved option'}</div>
            {option.subLabel ? <div className="pl-sub">{option.subLabel}</div> : null}
          </div>
          <button type="button" className="rw-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        {/* 1 — what was committed. Signature first: it is what makes this a
            decision of record rather than a plan someone drew up. */}
        <div className="pl-sig">
          <Glyph name="check" className="sm" />
          <div>
            <b>Signed{decision?.approvedAt ? ` ${fmtDateTime(decision.approvedAt)}` : ''}</b>
            <span>
              21 CFR Part 11 electronic signature
              {decision?.authorityThreshold ? ` · within ${decision.authorityThreshold}` : ''}
            </span>
          </div>
        </div>

        <div className="pl-grid">
          <div>
            <span>Gate impact</span>
            <b>{option.gateImpact ?? '—'}</b>
            {gate ? <i>{fmtGate(gate.code, gate.name)}</i> : null}
          </div>
          <div>
            <span>Schedule</span>
            <b>{option.slipLabel ?? '—'}</b>
            {option.daysRecovered ? <i>{option.daysRecovered}d recovered</i> : null}
          </div>
          <div>
            <span>Cost</span>
            <b>{option.cost != null ? fmtEuro(option.cost) : '—'}</b>
          </div>
          <div>
            <span>Revenue kept</span>
            <b>{option.revenueKept != null ? fmtEuro(option.revenueKept) : '—'}</b>
          </div>
          <div>
            <span>Forfeits</span>
            <b>{option.forfeits ?? 'None'}</b>
          </div>
          <div>
            <span>Risk</span>
            <b>{option.riskBand ?? '—'}</b>
            {option.confidence ? <i>{option.confidence}</i> : null}
          </div>
        </div>

        {/* 2 — what has happened since. */}
        <div className="pl-prog">
          <div className="pl-prog-h">
            <b>{progress.done} of {progress.total}</b> actions executed
            {progress.assigned ? <span> · {progress.assigned} assigned</span> : null}
          </div>
          <div className="acts-bar"><div className="acts-fill" style={{ width: `${progress.pct}%` }} /></div>
        </div>
        {progress.systemsWritten.length ? (
          <div className="pl-sys">
            <span>Systems written</span>
            {progress.systemsWritten.map((s) => <b key={s}>{s}</b>)}
          </div>
        ) : (
          <div className="pl-sys none">
            <span>No writes yet — dispatch the agent actions or execute them yourself below.</span>
          </div>
        )}

        {/* 3 — what is still open, drivable in place. */}
        <div className="pl-body">
          {rows.map(({ target, agentRunnable, dueDate, run }) => {
            const status = run?.status ?? 'Not started';
            const done = status === 'Done';
            return (
              <div className={`pl-r${done ? ' done' : ''}`} key={target.taskId}>
                <div className="pl-r-t">
                  <b>{target.name}</b>
                  <em>{target.owner}{dueDate ? ` · due ${fmtDate(dueDate)}` : ''}</em>
                </div>
                <div className="pl-r-w">
                  <Glyph name="arrow-right" className="sm" />
                  <b>{target.system || '—'}</b>
                  <span>{target.writeBack}</span>
                </div>
                {run?.receipt ? (
                  <div className="pl-r-rc">
                    <Glyph name="check" className="sm" />
                    <b>{run.receipt.reference}</b>
                    <span>{run.receipt.actor} · {fmtDateTime(run.receipt.at)}</span>
                  </div>
                ) : run?.assignedTo ? (
                  <div className="pl-r-rc as">
                    <Glyph name="arrow-branch" className="sm" />
                    <b>{run.assignedTo}</b>
                    <span>still to execute</span>
                  </div>
                ) : (
                  <div className="pl-r-a">
                    {agentRunnable ? (
                      <>
                        <button type="button" className="btn p sm" onClick={() => onExec('agent', target)}>Ask agent</button>
                        <button type="button" className="btn s sm" onClick={() => onExec('self', target)}>Run myself</button>
                      </>
                    ) : (
                      <button type="button" className="btn s sm" onClick={() => onExec('assign', target)}>Assign</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
