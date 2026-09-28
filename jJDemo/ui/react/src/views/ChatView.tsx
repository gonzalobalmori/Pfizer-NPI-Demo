/*
 * NPI Copilot (#v-chat) — ported verbatim from the click-through's markup and
 * CSS classes (.cq-wrap / .cq-thread / .cq-hi / .cq-sug / .cq-s / .cq-foot /
 * .cq-chips / .cq-in / .ai-spark / .cq-send / .cq-note / .cq-u / .cq-a / .cq-p /
 * .cq-ev / .cq-pl / .cq-rec / .cq-act). Static text is copied word-for-word;
 * the greeting, suggestion prompts and answers are fed by the live
 * ExecutionService.copilot c3Action (§2.5).
 *
 * The Copilot has two MODES, chosen with a segmented control at the top:
 *   • Ask            — the grounded Q&A copilot (default). Selecting a canned
 *                      prompt reveals its stored answer — no live LLM. A prompt
 *                      the copilot cannot ground gets the designed refusal, shown
 *                      VERBATIM from copilot.refusal and NEVER softened (§6).
 *   • End-of-day log — the conversational capture assistant (EodCapture): the
 *                      owner dumps or is guided through what happened today; each
 *                      signal becomes a draft Finding they confirm, which lands
 *                      on the Agent tower and Open issues (signalSource='eod-log').
 *
 * Each mode keeps its own state, so switching back and forth never loses an
 * in-progress thread or capture.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getCopilot } from '@/api/execution';
import type {
  CopilotData,
  CopilotPromptVm,
  CopilotAnswer,
  EodCommittedFinding,
} from '@/types/execution';
import EodCapture from '@/components/EodCapture';
import Glyph from '@/components/Brand/Glyph';
import GlyphText from '@/components/Brand/GlyphText';

type CopilotMode = 'ask' | 'eod';

/* the four opening groups carry a small glyph in the prototype; keyed by the
   group label so the suggestion cards keep their icons. */
const GROUP_ICON: Record<string, string> = {
  'Guide me through it': 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  'Diagnose a launch': 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35',
  'Follow the agents': 'M4 17l6-6 4 4 6-8 M14 7h6v6',
  'Slice the portfolio': 'M3 6h18M7 12h10M10 18h4',
};
const DEFAULT_ICON = 'M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z';

const Spark = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
  </svg>
);
const Arrow = () => (
  <svg viewBox="0 0 24 24">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

/* mode-selector glyphs */
const ASK_ICON = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
const EOD_ICON = 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';

interface ChatTurn {
  id: string;
  question: string;
  answer: CopilotAnswer | null; // null → designed refusal
}

export default function ChatView() {
  const { intent } = useNav();
  const [data, setData] = useState<CopilotData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CopilotMode>('ask');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [seq, setSeq] = useState(0);
  /* committed-findings confirmation for the EOD mode, kept on this view so it
     survives a mode switch (its own state, separate from the chat thread). */
  const [eodCommitted, setEodCommitted] = useState<EodCommittedFinding[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getCopilot());
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the copilot.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* the guided tour resets the thread and asks a canned prompt by id — the
     prototype's cqReset(); cqAsk('berobenatide_obesity'). It always lands in Ask mode. */
  useEffect(() => {
    if (intent?.view !== 'chat' || !intent.chatAsk || !data) return;
    const p = data.prompts.find((x) => x.id.toLowerCase() === intent.chatAsk!.toLowerCase());
    if (!p) return;
    setMode('ask');
    setInput('');
    setTurns([{ id: `cqa-tour-${intent.seq}`, question: p.question, answer: p.answer }]);
  }, [intent, data]);

  const nextId = () => {
    const id = `cqa${seq}`;
    setSeq((s) => s + 1);
    return id;
  };

  const askPrompt = (p: CopilotPromptVm) => {
    setTurns((t) => [...t, { id: nextId(), question: p.question, answer: p.answer }]);
  };

  const send = () => {
    const q = input.trim();
    if (!q || !data) return;
    /* ground only against the known prompts; anything else gets the refusal */
    const match = data.prompts.find(
      (p) => p.question.toLowerCase() === q.toLowerCase() || q.toLowerCase().includes(p.id.toLowerCase()),
    );
    setTurns((t) => [...t, { id: nextId(), question: q, answer: match ? match.answer : null }]);
    setInput('');
  };

  const reset = () => {
    setTurns([]);
    setInput('');
  };

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!data) return <div className="view on v-msg">Loading&hellip;</div>;

  const home = turns.length === 0;

  return (
    <div className="view on" id="v-chat">
      {/* mode selector — Ask (grounded Q&A) vs End-of-day log (capture) */}
      <div className="cq-modes" role="tablist" aria-label="Copilot mode">
        {([
          { m: 'ask' as const, label: 'Ask', sub: 'Grounded answers about launches, gates & agents', icon: ASK_ICON },
          { m: 'eod' as const, label: 'End-of-day log', sub: 'Tell me what happened — I capture it as findings', icon: EOD_ICON },
        ]).map((opt) => {
          const on = mode === opt.m;
          return (
            <button
              key={opt.m}
              type="button"
              role="tab"
              aria-selected={on}
              className={`cq-mode${on ? ' on' : ''}`}
              onClick={() => setMode(opt.m)}
            >
              <span className="cq-mode-ic">
                <svg viewBox="0 0 24 24">
                  <path d={opt.icon} />
                </svg>
              </span>
              <span className="cq-mode-tx">
                <b>{opt.label}</b>
                <em>{opt.sub}</em>
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'ask' ? (
        <div className={`cq-wrap${home ? ' home' : ''}`} id="cq-wrap">
          <div className="cq-thread" id="cq-thread">
            {home ? (
              <div className="cq-hi">
                <span className="ai-spark">
                  <Spark />
                </span>
                <h2>
                  Hi George. <span>What do you want to work through?</span>
                </h2>
                <p><GlyphText text={data.greeting.body} /></p>
              </div>
            ) : (
              turns.map((t) => (
                <React.Fragment key={t.id}>
                  <div className="cq-u">
                    <span>{t.question}</span>
                  </div>
                  <div className="cq-a" id={t.id}>
                    <span className="cq-av">
                      <Spark />
                    </span>
                    <span className="cq-ab">
                      <span className="cq-who">
                        NPI COPILOT<em>{t.answer ? 'grounded in the launch record' : ''}</em>
                      </span>
                      {t.answer ? <AnswerBody answer={t.answer} /> : <Refusal refusal={data.refusal} />}
                    </span>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>

          <div className="cq-foot">
            <div className="cq-chips" id="cq-chips">
              {home ? null : (
                <button type="button" className="cq-ch" onClick={reset}>
                  Start over
                </button>
              )}
            </div>
            <div className="cq-in">
              <span className="ai-spark">
                <Spark />
              </span>
              {/* Was four inline style properties hand-rolling the
                  screen-reader-only idiom; `.sr-t` in prototype.css is the same
                  clip, with clip-path for browsers that dropped `clip`. */}
              <label htmlFor="cq-input" className="sr-t">
                Ask about any launch, gate, market or agent
              </label>
              <input
                id="cq-input"
                placeholder="Ask about any launch, gate, market or agent&hellip;"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
              />
              <button type="button" className="cq-send" onClick={send} title="Send">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="cq-note">
              Grounded in the launch plan, the 107 activities, the agent log and the supplier and market
              data. Nothing here is a guess.
            </div>
          </div>

          <div className="cq-sug" id="cq-sug">
            {home
              ? data.groups.flatMap((g) =>
                  g.prompts.map((p) => (
                    <button type="button" className="cq-s" key={p.id} onClick={() => askPrompt(p)}>
                      <span className="cq-si">
                        <svg viewBox="0 0 24 24">
                          <path d={GROUP_ICON[g.label] ?? DEFAULT_ICON} />
                        </svg>
                      </span>
                      <span className="cq-sb">
                        <b>{p.question}</b>
                        {/* Backend prose — one seeded subtitle is a handoff chain
                            ("Line monitor → Quality → Sourcing → Planning → you"),
                            i.e. four tofu boxes before this. */}
                        <em><GlyphText text={p.subtitle} /></em>
                      </span>
                    </button>
                  )),
                )
              : null}
          </div>
        </div>
      ) : (
        <EodMode
          committed={eodCommitted}
          onCommitted={(created) => setEodCommitted((prev) => [...created, ...prev])}
        />
      )}
    </div>
  );
}

/*
 * End-of-day capture mode. Wraps the shared EodCapture panel with the copilot's
 * framing prose and a running list of what has been committed this session
 * (each links into its resolution workspace).
 */
function EodMode({
  committed,
  onCommitted,
}: {
  committed: EodCommittedFinding[];
  onCommitted: (created: EodCommittedFinding[]) => void;
}) {
  const { open } = useNav();
  return (
    <div className="cq-eod" style={{ maxWidth: 820, margin: '0 auto', padding: '8px 16px 24px' }}>
      <div className="cq-hi" style={{ textAlign: 'left', paddingBottom: 8 }}>
        <span className="ai-spark">
          <Spark />
        </span>
        <h2 style={{ marginBottom: 4 }}>
          Log your end of day. <span>What happened?</span>
        </h2>
        <p>
          Free dump or let me guide you through your open work. I&apos;ll structure each signal into a
          draft; you confirm, and it lands on the Agent tower and Open issues as a real finding — no
          form to fill in.
        </p>
      </div>

      <EodCapture onCommitted={onCommitted} />

      {committed.length > 0 && (
        <div className="cap-l">
          <div className="cap-lt">Captured this session ({committed.length})</div>
          <div className="cap-ll">
            {committed.map((c) => (
              <button key={c.id} type="button" className="cap-i" onClick={() => open('issue', c.id)}>
                <b>{c.displayId}</b> &mdash; {c.headline}{' '}
                <i>
                  open <Glyph name="arrow-right" className="sm" />
                </i>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Refusal({ refusal }: { refusal: { prose: string; hint: string } }) {
  return (
    <>
      <div className="cq-p">{refusal.prose}</div>
      <div className="cq-p" style={{ color: 'var(--g600)', fontSize: 12 }}>
        {refusal.hint}
      </div>
    </>
  );
}

function AnswerBody({ answer }: { answer: CopilotAnswer }) {
  return (
    <>
      {/* Every field below is backend prose, so each goes through GlyphText
          rather than being interpolated raw. One seeded `steps[].body` already
          contains "G3 moves 04 Nov → 21 Dec if you do nothing" — a tofu box in
          the middle of the copilot's central recommendation. Wrapping the whole
          answer (not just that one field) is the point: the copilot's text is
          authored content that changes, and a bare {t} silently breaks the next
          time an author writes an arrow. GlyphText returns the string untouched
          when there is nothing to substitute. */}
      {answer.prose?.map((t, i) => (
        <div className="cq-p" key={`p${i}`}>
          <GlyphText text={t} />
        </div>
      ))}

      {answer.evidence && answer.evidence.length > 0 && (
        <div className="cq-ev">
          {answer.evidence.map((r, i) => (
            <div className="cq-evr" key={`e${i}`}>
              <span><GlyphText text={r.label} /></span>
              <b><GlyphText text={r.value} /></b>
            </div>
          ))}
        </div>
      )}

      {answer.steps && answer.steps.length > 0 && (
        <div className="cq-pl">
          {answer.steps.map((s, i) => (
            <div className="cq-pr" key={`s${i}`}>
              <span className="cq-pn">{i + 1}</span>
              <span className="cq-pb">
                <b><GlyphText text={s.title} /></b>
                <em><GlyphText text={s.body} /></em>
              </span>
              <span className={`cq-pt${s.flag === 'a' ? ' a' : ''}`}>{s.when}</span>
            </div>
          ))}
        </div>
      )}

      {answer.prose2?.map((t, i) => (
        <div className="cq-p" key={`p2${i}`}>
          <GlyphText text={t} />
        </div>
      ))}

      {answer.rec && (
        <div className="cq-rec">
          <div className="cq-rl">What I would do</div>
          <div className="cq-rt"><GlyphText text={answer.rec} /></div>
          <div className="cq-rw">
            {answer.why?.map((w, i) => (
              <div key={`w${i}`}><GlyphText text={w} /></div>
            ))}
          </div>
          <div className="cq-cf"><GlyphText text={answer.confidence} /></div>
        </div>
      )}

      {answer.actions && answer.actions.length > 0 && (
        <div className="cq-act">
          {answer.actions.map((a, i) => (
            <button type="button" className={`cq-b ${a.style}`} key={`a${i}`}>
              {a.label}
              <Arrow />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
