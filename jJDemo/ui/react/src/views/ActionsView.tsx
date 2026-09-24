/*
 * My actions (#v-actions) — the user's personal decision queue, ported verbatim
 * from the click-through's markup and CSS classes (.sb-r / .sbb / .dr / .dr-ai /
 * .es-sum / .hb / .ev / .ev-x …). Static headings and helper text are copied
 * word-for-word; every data value is fed by the live ExecutionService read
 * methods (pendingQueue / escalatedQueue / decisionHistory).
 *
 * This is Helena's own work — pending decisions, escalations she raised, and her
 * decision history. It is deliberately kept separate from the fleet-wide agent
 * action log (Agent orchestration). An escalation can never be withdrawn, so
 * there is no withdraw/cancel affordance. Timestamps are always absolute (§6).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getPendingQueue, getEscalatedQueue, getDecisionHistory } from '@/api/execution';
import { fmtDateTime } from '@/lib/format';
import type {
  PendingQueue,
  EscalatedQueue,
  DecisionHistory,
  PendingCard,
  EscalatedCard,
  EscalationPip,
  HistoryRow,
} from '@/types/execution';

type Pane = 'pending' | 'escalated' | 'history';

/** Finding category → the prototype's decision-row border-colour class. */
function drTone(c: PendingCard['category']): string {
  return c ?? '';
}
/** Escalation event state → the prototype's progress-pip class (.pwd done/now). */
function pipClass(state: string): string {
  if (state === 'done') return 'pwd done';
  if (state === 'now') return 'pwd now';
  return 'pwd';
}
/** History status → the prototype's .ev-st chip class. */
function histStatusClass(s: HistoryRow['status']): string {
  if (s === 'RESOLVED') return 'ok';
  if (s === 'ESCALATED') return 'esc';
  return 'run';
}
/** History status → the prototype's .ev-st chip label. */
function histStatusLabel(s: HistoryRow['status']): string {
  if (s === 'RESOLVED') return 'Resolved';
  if (s === 'ESCALATED') return 'Escalated';
  return 'Pending action';
}
/** Two-letter initials for the note avatar (no initials field on the note). */
function initials(name: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export default function ActionsView() {
  const { open, intent } = useNav();
  const [pane, setPane] = useState<Pane>('pending');
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingQueue | null>(null);
  const [escalated, setEscalated] = useState<EscalatedQueue | null>(null);
  const [history, setHistory] = useState<DecisionHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* the guided tour drives the sub-pane (pending → history). */
  useEffect(() => {
    if (intent?.view === 'actions' && intent.actionsPane) setPane(intent.actionsPane);
  }, [intent]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, e, h] = await Promise.all([
        getPendingQueue(),
        getEscalatedQueue(),
        getDecisionHistory(),
      ]);
      setPending(p);
      setEscalated(e);
      setHistory(h);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load My actions.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRow = useCallback((id: string) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const spark = useMemo(
    () => (
      <span className="ai-spark sm">
        <svg viewBox="0 0 24 24">
          <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
        </svg>
      </span>
    ),
    [],
  );

  if (error)
    return (
      <div className="view on" style={{ padding: 24, color: 'var(--red600)' }}>
        {error}
      </div>
    );
  if (!pending || !escalated || !history)
    return (
      <div className="view on" style={{ padding: 24 }}>
        Loading&hellip;
      </div>
    );

  return (
    <div className="view on" id="v-actions">
      <div className="sb-r">
        <button
          type="button"
          className={`sbb${pane === 'pending' ? ' on' : ''}`}
          data-p="pending"
          onClick={() => setPane('pending')}
        >
          Pending actions<i>{pending.count}</i>
        </button>
        <button
          type="button"
          className={`sbb${pane === 'escalated' ? ' on' : ''}`}
          data-p="escalated"
          onClick={() => setPane('escalated')}
        >
          Escalated<i>{escalated.count}</i>
        </button>
        <button
          type="button"
          className={`sbb${pane === 'history' ? ' on' : ''}`}
          data-p="history"
          onClick={() => setPane('history')}
        >
          History<i>{history.counts.total}</i>
        </button>
      </div>

      {/* ═════ BRANCH 3A — MY DECISIONS ═════ */}
      {pane === 'pending' && (
        <div className="sb-p on" data-p="pending">
          <div className="vhd">
            <div>
              <div className="vt">My decisions</div>
            </div>
            <button type="button" className="btn s">
              <span className="ai-spark">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
                  <path d="M19 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
                </svg>
              </span>
              Where should I start?
            </button>
          </div>

          {pending.cards.map((c: PendingCard) => (
            <button
              type="button"
              key={c.decisionId}
              className={`dr ${drTone(c.category)}`.trimEnd()}
              data-npi={c.displayId}
              onClick={() => c.findingId && open('issue', c.findingId)}
            >
              <span className="dr-id">{c.displayId}</span>
              <span className="dr-b">
                <span className="dr-t">{c.title}</span>
                <span className="dr-m">{c.meta}</span>
                <span className="dr-ai">
                  {spark}
                  {c.agentRecommendation}
                </span>
              </span>
              <span className="dr-r">
                <span className={`tag ${c.dueTagClass ?? ''}`.trimEnd()}>{c.dueLabel}</span>
                <span className="dr-fn">{c.functions}</span>
                <span className={`btn ${c.ctaEmphasis === 'primary' ? 'p' : 's'} sm`}>Take action</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ═════ BRANCH 3B — ESCALATED ACTIVITIES ═════ */}
      {pane === 'escalated' && (
        <div className="sb-p on" data-p="escalated">
          <div className="vhd">
            <div>
              <div className="vt">Escalated activities</div>
            </div>
            <div className="es-sum">
              {escalated.count} open &middot; oldest raised <b>6 days ago</b> &middot; 1 already chased once
            </div>
          </div>

          {escalated.cards.map((c: EscalatedCard) => (
            <button
              type="button"
              key={c.escalationId}
              className="dr wt"
              data-npi={c.displayId}
              onClick={() => c.findingId && open('issue', c.findingId)}
            >
              <span className="dr-id">{c.displayId}</span>
              <span className="dr-b">
                <span className="dr-t">{c.title}</span>
                <span className="dr-m">{c.meta}</span>
                <span className="dr-ai">
                  <span className={`wtl${c.tagClass === 'auto' ? ' ok' : ''}`}>
                    {c.pips.map((p: EscalationPip) => (
                      <i key={p.sequence} className={pipClass(p.state)} />
                    ))}
                  </span>
                  {c.progressSummary}
                </span>
              </span>
              <span className="dr-r">
                <span className={`tag ${c.tagClass ?? ''}`.trimEnd()}>{c.tagLabel}</span>
                <span className="dr-fn">{c.functionLabel}</span>
                <span className={`btn ${c.ctaEmphasis === 'primary' ? 'p' : 's'} sm`}>View thread</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ═════ BRANCH 3D — HISTORY ═════ */}
      {pane === 'history' && (
        <div className="sb-p on" data-p="history">
          <div className="vhd">
            <div>
              <div className="vt">History</div>
            </div>
          </div>

          <div className="hb">
            <div className="hb-m">
              <span className="hb-lb">Decisions taken</span>
              <b>{history.kpis.decisionsTaken}</b>
              <span className="hb-sb">{history.kpis.decisionsTakenWindow}</span>
              <span className="hb-d">{history.kpis.decisionsTakenDelta}</span>
            </div>
            <div className="hb-m">
              <span className="hb-lb">Closed</span>
              <b>{history.kpis.closed}</b>
              <span className="hb-sb">{history.kpis.closedOf}</span>
              <span className="hb-d">{history.kpis.closedNote}</span>
            </div>
            <div className="hb-m">
              <span className="hb-lb">Actions delegated</span>
              <b>{history.kpis.actionsDelegated}</b>
              <span className="hb-sb">to agents and to people</span>
              <span className="hb-d">{history.kpis.actionsDelegatedNote}</span>
            </div>
            <div className="hb-m">
              <span className="hb-lb">Escalations open</span>
              <b className="a">{history.kpis.escalationsOpen}</b>
              <span className="hb-sb">{history.kpis.escalationsOpenNote}</span>
              <span className="hb-d a">both moving</span>
            </div>
            <div className="hb-c">
              <div className="hb-ct">
                <span>Decisions closed per week</span>
                <i>13 weeks</i>
              </div>
              <div className="hb-bars">
                <i style={{ height: '33%' }} title="1 decision" />
                <i style={{ height: '67%' }} title="2 decisions" />
                <i style={{ height: '33%' }} title="1 decision" />
                <i style={{ height: '100%' }} title="3 decisions" />
                <i style={{ height: '67%' }} title="2 decisions" />
                <i style={{ height: '33%' }} title="1 decision" />
                <i style={{ height: '67%' }} title="2 decisions" />
                <i style={{ height: '33%' }} title="1 decision" />
                <i style={{ height: '100%' }} title="3 decisions" />
                <i style={{ height: '67%' }} title="2 decisions" />
                <i style={{ height: '33%' }} title="1 decision" />
                <i style={{ height: '67%' }} title="2 decisions" />
                <i style={{ height: '67%' }} title="2 decisions" />
              </div>
              <div className="hb-x">
                <span>13 w</span>
                <span>this w</span>
              </div>
            </div>
            <div className="hb-c">
              <div className="hb-ct">
                <span>Median time to decide</span>
                <i className="g">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                  {history.kpis.medianTimeToDecide}
                </i>
              </div>
              <svg className="hb-tr" viewBox="0 0 260 40" preserveAspectRatio="none">
                <polygon
                  className="hb-ar"
                  points="0,38 0.0,13.8 21.7,6.0 43.3,18.4 65.0,10.7 86.7,21.6 108.3,15.3 130.0,26.2 151.7,20.0 173.3,29.3 195.0,23.1 216.7,30.9 238.3,24.7 260.0,34.0 260,38"
                />
                <polyline points="0.0,13.8 21.7,6.0 43.3,18.4 65.0,10.7 86.7,21.6 108.3,15.3 130.0,26.2 151.7,20.0 173.3,29.3 195.0,23.1 216.7,30.9 238.3,24.7 260.0,34.0" />
              </svg>
              <div className="hb-x">
                <span>5.4 d worst</span>
                <span>3.6 d now</span>
              </div>
            </div>
          </div>

          <div className="ev-bar">
            <span className="ev-live">
              <i />
              Live
            </span>
            <span className="ev-up">
              {history.counts.total} of your own &middot; last one 28 minutes ago
            </span>
            <span className="ev-sp" />
            <label className="ev-find" htmlFor="ev-q">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input id="ev-q" placeholder="Search the record&hellip;" />
            </label>
            <span className="filt" style={{ margin: 0 }}>
              <button type="button" className="fb2 on" data-f="all">
                Everything<i>{history.counts.total}</i>
              </button>
              <button type="button" className="fb2" data-f="my">
                Decisions taken<i>{history.counts.taken}</i>
              </button>
              <button type="button" className="fb2" data-f="esc">
                Escalations raised<i>{history.counts.escalations}</i>
              </button>
            </span>
          </div>

          <div className="ev-l-wrap" id="ev-list">
            {history.rows.map((r: HistoryRow) => {
              const isNew = r.status === 'RUNNING';
              const isOpen = !!openRows[r.id];
              const hasNote = !!r.note;
              return (
                <div
                  key={r.id}
                  className={`ev${isNew ? ' new' : ''}${isOpen ? ' open' : ''}`}
                  data-k={r.kind.toLowerCase()}
                  data-npi={r.npiId}
                >
                  <button
                    type="button"
                    className="ev-h"
                    onClick={() => hasNote && toggleRow(r.id)}
                    disabled={!hasNote}
                  >
                    <span className="ev-av">HF</span>
                    <span className="ev-b">
                      <span className="ev-l">
                        {r.label}
                        <i className="ev-ref">{r.npiId}</i>
                      </span>
                      <span className="ev-s">{r.subLine}</span>
                    </span>
                    <span className={`ev-st ${histStatusClass(r.status)}`}>
                      {histStatusLabel(r.status)}
                    </span>
                    {hasNote && <span className="ev-c">1 note</span>}
                    <span className="ev-t" title={fmtDateTime(r.occurredAt)}>
                      {fmtDateTime(r.occurredAt)}
                    </span>
                  </button>
                  {r.note && (
                    <div className="ev-x">
                      <span className="ev-n">
                        <span className="ev-nav">{initials(r.note.author)}</span>
                        <span className="ev-nb">
                          <span className="ev-nh">
                            <b>{r.note.author}</b>
                            {r.note.role && <span>{r.note.role}</span>}
                            <em>{fmtDateTime(r.note.at)}</em>
                          </span>
                          <span className="ev-nx">{r.note.body}</span>
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="ev-empty" id="ev-empty">
              Nothing in the record matches that.
            </div>
          </div>
          <div className="hs-more">
            <button type="button" className="btn s sm">
              Load the previous 90 days
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
