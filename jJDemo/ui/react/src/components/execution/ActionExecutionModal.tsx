/*
 * The execution sheet for one action-plan task.
 *
 * Three modes, because the action plan offers three paths and each needs a
 * different confirmation:
 *
 *   agent  — dispatch to the named agent. Shows the guardrail it runs inside and
 *            the write it will make, so "within guardrails" is a stated boundary
 *            rather than a reassuring phrase.
 *   self   — execute it yourself. Shows the transaction in the source system and
 *            the fields being written, then records the receipt.
 *   assign — hand it to a colleague. Searchable, because a 14-person list is
 *            already too long to scan and a real one is far longer.
 *
 * Built on the existing `.pk` picker styling rather than a new dialog library,
 * so it matches the rest of the app without new CSS vocabulary.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Glyph from '@/components/Brand/Glyph';
import type { RunMode } from '@/execution/actionRuntime';
import { referenceFor } from '@/execution/actionRuntime';

/** The app's agent mark — same 4-point spark the action rows and copilot use. */
function Spark() {
  return (
    <svg viewBox="0 0 24 24" className="ai-spark">
      <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
    </svg>
  );
}

export interface Assignee {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export interface ExecTarget {
  taskId: string;
  name: string;
  owner: string;
  detail: string;
  system: string;
  writeBack: string;
}

interface Props {
  mode: RunMode;
  target: ExecTarget;
  people: Assignee[];
  onClose: () => void;
  onConfirm: (mode: RunMode, assignee?: Assignee, note?: string) => void;
}

export default function ActionExecutionModal({ mode, target, people, onClose, onConfirm }: Props) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Assignee | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Escape closes, and the search field takes focus on open — a picker you have
     to click into before typing is slower than the list it replaced. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (mode === 'assign') searchRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.role.toLowerCase().includes(q)
      || p.initials.toLowerCase().includes(q));
  }, [people, query]);

  const reference = referenceFor(target.taskId, target.system);

  const title = mode === 'agent' ? 'Dispatch to agent'
    : mode === 'self' ? 'Execute in the source system'
      : 'Assign to a colleague';

  const cta = mode === 'agent' ? 'Dispatch and write'
    : mode === 'self' ? 'Execute the write'
      : 'Assign';

  const canConfirm = mode === 'assign' ? !!picked && !busy : !busy;

  const confirm = () => {
    if (!canConfirm) return;
    setBusy(true);
    onConfirm(mode, picked ?? undefined, note.trim() || undefined);
  };

  return (
    <>
      <div className="pk-scrim on" onClick={onClose} />
      <div className="pk on" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pk-h">
          <div className="pk-c">
            <b>{mode === 'assign' ? 'Assignment' : 'Write-back'}</b>
            <span>{target.taskId}</span>
            <button type="button" className="pk-x" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="pk-t">{title}</div>
          <div className="pk-a">{target.name}</div>
        </div>

        {/* What the write actually is. Shown in every mode — including assign,
            because the person receiving it needs to know what they are taking
            on and in which system. */}
        <div className="pk-kv">
          <div>
            <span>System of record</span>
            <b>{target.system || '—'}</b>
          </div>
          <div>
            <span>Transaction</span>
            <b>{target.writeBack || '—'}</b>
          </div>
          <div>
            <span>Will return</span>
            <b>{reference}</b>
            <i>on success</i>
          </div>
        </div>

        <div className="pk-b">
          {mode === 'agent' ? (
            <>
              <div className="pk-lt">Runs as</div>
              <ul>
                <li><b>{target.owner}</b> — {target.detail}</li>
                <li>The write is logged against your approval, with the agent named as executor.</li>
                <li>Reversible for 24 hours; after that it needs a new decision.</li>
              </ul>
              <div className="pk-rec">
                <Spark />
                <div>
                  <i>Guardrail</i>
                  <p>
                    The agent may write <b>{target.writeBack}</b> in <b>{target.system}</b> and
                    nothing else. Anything outside that comes back to you as a decision.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {mode === 'self' ? (
            <>
              <div className="pk-lt">You are about to write</div>
              <ul>
                <li><b>{target.system}</b> — {target.writeBack}</li>
                <li>Executed as <b>you</b>, under your own credentials and authority.</li>
                <li>The reference returned is written back onto this action for the audit trail.</li>
              </ul>
              <div className="pk-lt">Note for the record (optional)</div>
              <textarea
                className="pk-note-in"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you executed this yourself rather than dispatching it…"
              />
            </>
          ) : null}

          {mode === 'assign' ? (
            <>
              <div className="pk-lt">Search colleagues</div>
              <input
                ref={searchRef}
                className="pk-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, role or initials…"
                aria-label="Search colleagues"
              />
              <div className="pk-people">
                {matches.length === 0 ? <div className="pk-empty">No colleague matches “{query}”.</div> : null}
                {matches.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`pk-person${picked?.id === p.id ? ' on' : ''}`}
                    onClick={() => setPicked(p)}
                  >
                    <span className="pk-av">{p.initials}</span>
                    <span className="pk-pn"><b>{p.name}</b><em>{p.role}</em></span>
                    {picked?.id === p.id ? <Glyph name="check" className="sm" /> : null}
                  </button>
                ))}
              </div>
              <div className="pk-lt">Note for the assignee (optional)</div>
              <textarea
                className="pk-note-in"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What they need to know to pick this up…"
              />
            </>
          ) : null}
        </div>

        <div className="pk-f">
          <span className="pk-note">
            {mode === 'assign'
              ? 'Assigning does not execute the write — the assignee does that.'
              : 'Recorded against the approved decision.'}
          </span>
          <button type="button" className="btn s sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn p sm" onClick={confirm} disabled={!canConfirm}>
            {busy ? 'Working…' : cta}
          </button>
        </div>
      </div>
    </>
  );
}
