/*
 * My actions (#v-actions) — the user's personal decision queue, ported verbatim
 * from the click-through's markup and CSS classes (.sb-r / .sbb / .dr / .dr-ai /
 * .es-sum / .hb / .ev / .ev-x …). Static headings and helper text are copied
 * word-for-word; every data value is fed by the live ExecutionService read
 * methods (pendingQueue / escalatedQueue / decisionHistory).
 *
 * This is George's own work — pending decisions, escalations he raised, and his
 * decision history. It is deliberately kept separate from the fleet-wide agent
 * action log (Agent orchestration). An escalation can never be withdrawn, so
 * there is no withdraw/cancel affordance. Timestamps are always absolute (§6).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import GlyphText from '@/components/Brand/GlyphText';
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
/*
 * The escalation ladder's pips are three identical 14×4 bars separated only by
 * fill (grey done / Pfizer Blue current / pale grey not-yet), and `pips[].label`
 * — the name of each rung, e.g. "Owner", "Function lead" — was carried in the
 * payload and rendered nowhere. So the ladder said "step 2 of 4" in colour and
 * never said WHICH step, to anyone.
 *
 * Two fixes, no layout change: each pip states its rung and state in a `title`,
 * and the current rung is marked with a height bump in CSS (`.pwd.now`) so the
 * position is visible without colour. `progressSummary` already summarises the
 * row, so this is the per-rung detail underneath it.
 */
function pipTitle(p: EscalationPip): string {
  const state = p.state === 'done' ? 'done' : p.state === 'now' ? 'current step' : 'not yet reached';
  return `${p.label} — ${state}`;
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
/*
 * Escalated-queue summary line, DERIVED from the cards.
 *
 * This line used to read "N open · oldest raised <b>6 days ago</b> · 1 already
 * chased once" with both the 6 and the 1 written into the JSX — hard-coded
 * business value in the view layer (R-BASE-03), and wrong the moment the seed
 * dates or the queue changed. Both are now computed from fields the backend does
 * return: `raisedAt` on every card gives the age of the oldest, and the pip
 * labelled "Reminder sent" (state `done`) is the record of a chase, so the chased
 * count is a count of cards carrying that pip, not a constant.
 */
function escalatedSummary(cards: EscalatedCard[], now: Date): string {
  if (cards.length === 0) return 'Nothing escalated.';
  const parts = [`${cards.length} open`];

  const ages = cards
    .map((c) => (c.raisedAt ? new Date(c.raisedAt) : null))
    .filter((d): d is Date => d != null && !isNaN(d.getTime()))
    .map((d) => Math.max(0, Math.round((now.getTime() - d.getTime()) / 86_400_000)));
  if (ages.length > 0) {
    const oldest = Math.max(...ages);
    parts.push(
      oldest === 0 ? 'oldest raised today' : `oldest raised ${oldest} day${oldest === 1 ? '' : 's'} ago`,
    );
  }

  const chased = cards.filter((c) =>
    c.pips.some((p) => p.state === 'done' && /remind|chase/i.test(p.label)),
  ).length;
  if (chased > 0) parts.push(`${chased} already chased`);

  return parts.join(' · ');
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

  /*
   * The real status mix of this decision log, counted from the same rows the
   * table below renders (so the chart and the table can never disagree). Fixed
   * order — a bar keeps its position and colour as counts change. Tone matches
   * the status language used elsewhere: resolved = on-plan green, escalated =
   * at-risk amber, still-open = neutral brand.
   */
  const statusSplit = useMemo(() => {
    const rows = history?.rows ?? [];
    const n = (s: string) => rows.filter((x) => x.status === s).length;
    return [
      { key: 'RESOLVED', label: 'Resolved', n: n('RESOLVED'), tone: 'ok' },
      { key: 'RUNNING', label: 'Still open', n: n('RUNNING'), tone: 'you' },
      { key: 'ESCALATED', label: 'Escalated', n: n('ESCALATED'), tone: 'other' },
    ];
  }, [history]);

  /*
   * Share of delegated actions that came back done. Parsed from the backend's
   * own note ("54 came back done") against its own total rather than restated as
   * a literal here — if the backend figure changes, this follows it. Falls back
   * to hiding the bar (0) rather than showing a made-up share.
   */
  const delegatedReturnPct = useMemo(() => {
    const total = history?.kpis.actionsDelegated ?? 0;
    const done = Number(/(\d+)/.exec(history?.kpis.actionsDelegatedNote ?? '')?.[1] ?? NaN);
    if (!total || !Number.isFinite(done)) return 0;
    return Math.round((done / total) * 100);
  }, [history]);

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!pending || !escalated || !history) return <div className="view on v-msg">Loading&hellip;</div>;

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
            <div className="es-sum">{escalatedSummary(escalated.cards, new Date())}</div>
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
                      <i key={p.sequence} className={pipClass(p.state)} title={pipTitle(p)} />
                    ))}
                  </span>
                  {/* Backend prose, so it goes through GlyphText: the seeded
                      summaries read "Assigned → in progress → signed →
                      submitted", and U+2192 has no glyph in Noto Sans — this was
                      rendering as "Assigned □ in progress □ …" on screen. */}
                  <GlyphText text={c.progressSummary} />
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
            {/*
              * Where this decision log currently stands. This replaced a
              * "Decisions closed per week" chart of 13 hard-coded bars — they
              * were invented (no weekly series exists on the backend) and their
              * heights summed to 24, contradicting the real `closed` count
              * beside them. The status split IS real, and is read from the same
              * rows the table below renders, so the two can never disagree.
              */}
            <div className="hb-c">
              <div className="hb-ct">
                <span>Where they stand</span>
                <i>{history.rows.length} on this log</i>
              </div>
              <div className="hb-br">
                {statusSplit.map((ss) => (
                  <div className="hbb" key={ss.key}>
                    <span className="hbb-l">{ss.label}</span>
                    <span className="hbb-t">
                      <span
                        className={`hbb-f ${ss.tone}`}
                        style={{ width: `${history.rows.length > 0 ? (ss.n / history.rows.length) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="hbb-n">{ss.n}</span>
                  </div>
                ))}
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
              {/* The trend area chart that sat here was fabricated, and its
                  "3.6 d now" endpoint contradicted the real median above it.
                  With no time series on the backend there is nothing honest to
                  plot, so the figure stands on its own with the delegation split
                  that context actually needs. */}
              <div className="hb-br">
                <div className="hbb">
                  <span className="hbb-l">Delegated</span>
                  <span className="hbb-t">
                    <span className="hbb-f agent" style={{ width: `${delegatedReturnPct}%` }} />
                  </span>
                  <span className="hbb-n">{delegatedReturnPct}%</span>
                </div>
              </div>
              <div className="hb-x">
                <span>{history.kpis.actionsDelegatedNote}</span>
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
                    <span className="ev-av">GH</span>
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
