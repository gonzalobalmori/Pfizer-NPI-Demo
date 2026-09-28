/*
 * Agent control tower (#v-tower) — ported verbatim from the click-through's
 * markup and CSS classes (.sb-r / .sbb / .ph-hd / .tbkpi / .tbkc / .tbflt-r /
 * .tbfb / .tbbd / .tbcol / .tbiz / .tbnw / .tbwk / .lg-wrap / .lg-r). Static
 * headings and labels are copied word-for-word; every figure is fed by the
 * live ExecutionService.liveBoard / .activityLog c3Actions.
 *
 * This is the FLEET-wide board and log (§2.2 / §2.3). It is NEVER merged with
 * the user's own decision history — that lives on the separate My actions
 * screen (§6). Timestamps are always absolute (fmtDateTime), never elapsed.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getLiveBoard, getActivityLog } from '@/api/execution';
import { fmtDateTime } from '@/lib/format';
import type {
  LiveBoard,
  ActivityLog,
  BoardCard,
  BoardColumn,
  ChainStep,
  Outcome,
} from '@/types/execution';

/* outcome → the prototype's short class used on the "now" strip and cards */
const OUT_CLASS: Record<Outcome, 'you' | 'held' | 'auto' | 'run'> = {
  USER: 'you',
  HELD: 'held',
  AUTO: 'auto',
  RUNNING: 'run',
};
/* the kicker on each card's "what is happening now" block */
const NWK: Record<'you' | 'held' | 'auto' | 'run', string> = {
  you: 'Your call',
  held: 'Waiting on a person',
  auto: 'Done',
  run: 'Working now',
};
/* The log's outcome pill — [label, class]. This is a log of what the AGENTS
   did, so the pill says whether that action ran on its own or needed a human,
   NOT whose call it is. USER = the agent did the work and the chain then
   stopped for a human decision; HELD = it routed out to another person; AUTO =
   the fleet closed it end to end with no human; RUNNING = still mid-task. */
const LED: Record<string, [string, string]> = {
  USER: ['stopped for a human', 'you'],
  HELD: ['handed to a human', 'held'],
  AUTO: ['autonomous', ''],
  RUNNING: ['in progress', 'run'],
};

/* Seed agent names already carry the word "agent" (e.g. "Line Monitor agent"),
   whereas the prototype's AL map holds the bare lane ("Line Monitor") and appends
   " agent" in markup. Normalise so we render it exactly once either way. */
function agentLabel(name: string | null): string {
  if (!name || name === 'You') return 'you';
  const n = name.trim();
  return /agent$/i.test(n) ? n : `${n} agent`;
}
/* the bare lane name, for the log where "agent" is a separate styled <em>. */
function agentBase(name: string | null): string {
  return (name ?? '').replace(/\s*agent$/i, '').trim();
}

const Tick = () => (
  <svg viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Dot = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
  </svg>
);
const Chv = () => (
  <svg viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const Arrw = () => (
  <svg viewBox="0 0 24 24">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const OSpark = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
  </svg>
);

export default function TowerView() {
  const { open, intent } = useNav();
  const [pane, setPane] = useState<'live' | 'past'>('live');
  const [franchise, setFranchise] = useState('all');
  const [market, setMarket] = useState('all');
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [log, setLog] = useState<ActivityLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* cosmetic transport controls — the prototype animated the board; here the
     board is a live snapshot, so these only reflect their own label state. */
  const [speed, setSpeed] = useState(1);
  const [live, setLive] = useState(true);

  /* per-card "show the detail" state, keyed by findingId */
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, l] = await Promise.all([
        getLiveBoard(franchise, market),
        getActivityLog(franchise, market),
      ]);
      setBoard(b);
      setLog(l);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the control tower.');
    }
  }, [franchise, market]);

  useEffect(() => {
    load();
  }, [load]);

  /* the guided tour drives the sub-pane, the franchise filter and which finding
     card is expanded — all atomically off the nav intent. */
  useEffect(() => {
    if (intent?.view !== 'tower') return;
    if (intent.towerPane) setPane(intent.towerPane);
    if (intent.towerFranchise) setFranchise(intent.towerFranchise);
    if (intent.towerOpenCard) {
      const card = intent.towerOpenCard;
      setOpenCards((prev) => {
        if (prev.has(card)) return prev;
        const next = new Set(prev);
        next.add(card);
        return next;
      });
    }
  }, [intent]);

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!board || !log) return <div className="view on v-msg">Loading&hellip;</div>;

  const k = board.kpis;
  const findingWord = k.findingCount === 1 ? 'finding and ' : 'findings and ';
  const productWord = k.productCount === 1 ? 'product' : 'products';
  const kpis: { label: string; value: number; cClass: string; sub: string; k: string }[] = [
    {
      label: 'Agent actions on the board',
      value: k.actionsOnBoard,
      cClass: 'p',
      sub: `across ${k.findingCount} ${findingWord}${k.productCount} ${productWord}`,
      k: 'pur',
    },
    { label: 'Working right now', value: k.workingNow, cClass: '', sub: 'agents mid-task, nothing needed from you', k: '' },
    { label: 'Your decision', value: k.yourDecision, cClass: 'r', sub: 'the fleet has done the work and stopped', k: 'hot' },
    { label: 'Held by a person', value: k.heldByPerson, cClass: 'a', sub: 'routed out and waiting on a human', k: 'amb' },
    { label: 'Closed by the fleet', value: k.closedByFleet, cClass: 'g', sub: 'no human was involved', k: 'grn' },
  ];

  const renderFilters = () => (
    <>
      <span className="tbflt-l">Franchise</span>
      {board.filters.franchises.map((f) => (
        <button
          key={f}
          type="button"
          className={`tbfb${f === franchise ? ' on' : ''}`}
          data-f={f}
          onClick={() => setFranchise(f)}
        >
          {f === 'all' ? 'All' : f}
        </button>
      ))}
      <span className="tbflt-sp" />
      <span className="tbflt-l">Market</span>
      {board.filters.markets.map((m) => (
        <button
          key={m}
          type="button"
          className={`tbfb${m === market ? ' on' : ''}`}
          onClick={() => setMarket(m)}
        >
          {m === 'all' ? 'All' : m}
        </button>
      ))}
    </>
  );

  return (
    <div className="view on" id="v-tower">
      <div className="sb-r">
        <button
          type="button"
          className={`sbb${pane === 'live' ? ' on' : ''}`}
          data-p="live"
          onClick={() => setPane('live')}
        >
          Live<i className="dot" />
        </button>
        <button
          type="button"
          className={`sbb${pane === 'past' ? ' on' : ''}`}
          data-p="past"
          onClick={() => setPane('past')}
        >
          Activity log<i>{log.actionCount}</i>
        </button>
      </div>

      {/* ── LIVE pane ── */}
      <div className={`sb-p${pane === 'live' ? ' on' : ''}`} data-p="live">
        <div className="vhd">
          <div>
            <div className="vt">Agent control tower</div>
          </div>
        </div>

        <div className="ph-hd">
          <div className="ph-ctl">
            <button
              type="button"
              className={`tbcb${speed === 1 ? '' : ' on'}`}
              id="sp"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            >
              {speed}&times;
            </button>
            <button
              type="button"
              className={live ? 'ph-lv' : 'ph-lv off'}
              id="ph-lv"
              onClick={() => setLive((v) => !v)}
            >
              <i />
              <span id="ph-lvt">{live ? 'Live' : 'Paused'}</span>
            </button>
          </div>
        </div>

        <div className="tbkpi" id="kpi">
          {kpis.map((kpi) => (
            <div className={`tbkc ${kpi.k}`} key={kpi.label}>
              <div className="tbkc-l">{kpi.label}</div>
              <div className={`tbkc-v ${kpi.cClass}`}>{kpi.value}</div>
              <div className="tbkc-s">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="tbflt-r" id="fl">
          {renderFilters()}
        </div>

        <div className="tbbd" id="bd">
          {board.columns.map((col) => (
            <ColumnView key={col.code} col={col} openCards={openCards} onToggle={toggleCard} onOpen={open} />
          ))}
        </div>
      </div>

      {/* ── ACTIVITY LOG pane ── */}
      <div className={`sb-p${pane === 'past' ? ' on' : ''}`} data-p="past">
        <div className="vhd">
          <div>
            <div className="vt">What the fleet has executed</div>
          </div>
        </div>
        <div className="tbflt-r" id="hfl">
          {renderFilters()}
        </div>
        <div className="lg-wrap">
          <div className="lg-hd">
            <span className="lg-n">
              <b>{log.actionCount}</b> actions executed by <b>{log.agentCount}</b> agents
            </span>
            <span className="lg-l">Newest first</span>
          </div>
          <div className="lg-b" id="lg-b">
            {log.rows.length ? (
              log.rows.map((r, i) => {
                const led = r.outcome ? LED[r.outcome] : undefined;
                return (
                  <button
                    type="button"
                    className="lg-r"
                    key={`${r.findingId}-${i}`}
                    data-npi={r.displayId ?? undefined}
                    onClick={() => open('issue', r.findingId)}
                  >
                    <span className="lg-t">{fmtDateTime(r.occurredAt)}</span>
                    <span className="lg-ag">
                      <span className="lg-av">
                        <OSpark />
                      </span>
                      <span className="lg-an">
                        {agentBase(r.agent)}
                        <em>agent</em>
                      </span>
                    </span>
                    <span className="lg-b2">
                      <span className="lg-v">{r.verb}</span>
                      {r.detail ? <span className="lg-d">{r.detail}</span> : null}
                    </span>
                    <span className="lg-tg">
                      {r.product}
                      {r.otherProductCount > 0 ? ` +${r.otherProductCount}` : ''}
                      <em>
                        {r.phaseCode} &middot; {r.franchise}
                      </em>
                    </span>
                    <span className="lg-o">
                      <span className={`lg-p ${led ? led[1] : ''}`}>{led ? led[0] : 'done'}</span>
                      <span className="lg-id">{r.displayId}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="lg-e">No action matches this filter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnView({
  col,
  openCards,
  onToggle,
  onOpen,
}: {
  col: BoardColumn;
  openCards: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (view: 'issue', param: string) => void;
}) {
  return (
    <div className={`tbcol ${col.state === 'live' ? 'live' : ''}`}>
      <div className="tbch">
        <div className="tbch-p">
          <b>{col.code}</b>
          <em>{col.state}</em>
        </div>
        <div className="tbch-n">{col.name}</div>
        <div className="tbch-c">
          {col.cards.length ? (
            <>
              {col.running} being worked
              {col.onYou ? (
                <>
                  {' '}
                  &middot; <b>{col.onYou} on you</b>
                </>
              ) : null}
            </>
          ) : (
            'nothing open'
          )}
        </div>
      </div>
      <div className="tbcb-b">
        {col.cards.length ? (
          col.cards.map((c) => (
            <CardView key={c.findingId} card={c} open={openCards.has(c.findingId)} onToggle={onToggle} onOpen={onOpen} />
          ))
        ) : (
          <div className="tbcol-empty">
            Nothing found here.
            <br />
            Gate signed, activities closed.
          </div>
        )}
      </div>
    </div>
  );
}

function CardView({
  card,
  open,
  onToggle,
  onOpen,
}: {
  card: BoardCard;
  open: boolean;
  onToggle: (id: string) => void;
  onOpen: (view: 'issue', param: string) => void;
}) {
  const out = card.outcome ? OUT_CLASS[card.outcome] : 'run';
  const cur: ChainStep | null = card.steps.length ? card.steps[card.steps.length - 1] : null;
  const completed = card.steps.filter((s) => s.completed).length;
  const total = card.steps.length;
  const pct = out === 'run' && total ? Math.round((completed / total) * 100) : 100;

  const products = card.products.slice(0, 2);
  const moreProducts = card.products.length > 2 ? card.products.length - 2 : 0;
  const markets = card.marketCodes.slice(0, 3);

  return (
    <div className={`tbiz ${out}${open ? ' open' : ''}`} id={`c-${card.findingId}`}>
      {/* 1 · what is happening now */}
      <div className="tbnw">
        <div className="tbnw-l">
          <span className="tbnw-k">{NWK[out]}</span>
          <span className="tbnw-t">{card.displayId}</span>
        </div>
        <div className="tbnw-a">{cur ? cur.verb : card.headline}</div>
        <div className="tbnw-w">
          {out === 'you' ? (
            <>the fleet stopped here &mdash; {cur ? cur.detail : ''}</>
          ) : out === 'held' ? (
            cur ? cur.detail : ''
          ) : (
            <>
              <b>{agentLabel(cur ? cur.agent : null)}</b> &middot; {cur ? cur.detail : ''}
            </>
          )}
        </div>
        {out === 'auto' ? null : (
          <div className="tbnw-b">
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* the toggle */}
      <button type="button" className="tbiz-x" onClick={() => onToggle(card.findingId)}>
        {open ? 'Hide the detail' : 'Show the detail'}
        <em>
          &nbsp;&middot;&nbsp;{completed} of {total} steps done
        </em>
        <Chv />
      </button>

      {/* 2 · what it came from, and what it hits */}
      <div className="tbcx">
        <div className="tbcx-l">What was found</div>
        <div className="tbcx-f">{card.found}</div>
        <div className="tbcx-im">
          {products.map((p) => (
            <span className="tbpk" key={p}>
              {p}
            </span>
          ))}
          {moreProducts ? <span className="tbpk more">+{moreProducts}</span> : null}
          {markets.map((m) => (
            <span className="tbpk mk" key={m}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* 3 · the work, verb by verb */}
      <div className="tbwk">
        {card.steps.map((s, i) => {
          const last = i === card.steps.length - 1;
          const st = !last
            ? s.completed
              ? 'done'
              : 'wait'
            : out === 'you'
              ? 'you'
              : out === 'auto'
                ? 'done'
                : s.completed
                  ? 'done'
                  : 'now';
          return (
            <div className={`tbwr ${st}`} key={`${card.findingId}-${s.sequence}-${i}`}>
              <span className="tbwr-i">{st === 'done' ? <Tick /> : <Dot />}</span>
              <span className="tbwr-b">
                <span className="tbwr-v">{s.verb}</span>
                <span className="tbwr-w">
                  {agentLabel(s.agent)}
                  {s.detail ? ` · ${s.detail}` : ''}
                </span>
              </span>
              <span className="tbwr-t">{fmtDateTime(s.occurredAt)}</span>
            </div>
          );
        })}
      </div>

      {/* 4 · one step deeper: open the finding the chain came from */}
      {card.chainId ? (
        <div className="tbft">
          <button type="button" onClick={() => onOpen('issue', card.findingId)}>
            See the chain the fleet ran
            <Arrw />
          </button>
        </div>
      ) : null}
    </div>
  );
}
