/*
 * End-of-day capture — the conversational capture flow, embedded INSIDE the NPI
 * Copilot thread (not a separate tab). A domain owner tells the copilot what
 * happened today and it becomes real Finding records the tower sees, with no
 * form to fill in. Two text-only modes:
 *
 *   • Free dump — type everything that happened; the backend extracts + classifies.
 *   • Guided    — answer targeted questions built from the domain's own open
 *                 gates and open findings (EodLogService.guidedPrompts).
 *
 * Extraction returns DRAFTS only (EodLogService.extractSignals). Nothing is
 * written until the owner reviews, edits and approves, then commits
 * (EodLogService.commitSignals) — the sole path that creates Findings. Committed
 * findings land as outcome='RUNNING', signalSource='eod-log'. This mirrors the
 * model invariant that a signal reaches the tower via the same Finding table
 * everything else reads, and that low-confidence items are reviewed, never
 * auto-committed. Styling uses the copilot's own class idiom + inline styles so
 * it reads as one system with the surrounding thread.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import Glyph from '@/components/Brand/Glyph';
import {
  getEodDomains,
  getEodPrompts,
  extractEodSignals,
  commitEodSignals,
} from '@/api/execution';
import type {
  EodDomain,
  EodPrompt,
  EodAnswer,
  EodDraft,
  EodCommittedFinding,
} from '@/types/execution';

type Mode = 'free' | 'guided';

const CATEGORY_LABEL: Record<string, string> = {
  ct: 'Blocking a gate',
  rk: 'Eats schedule float',
  ok: 'Monitored',
};
const KIND_LABEL: Record<string, string> = {
  blocker: 'Blocker',
  delay: 'Delay',
  risk: 'Risk',
  decision: 'Decision',
  evidence: 'Evidence',
  status: 'Status change',
};

/* A draft plus its review state (approved / discarded). */
interface ReviewDraft extends EodDraft {
  _key: string;
  approved: boolean;
}

interface EodCaptureProps {
  /* Called after findings are committed, so the copilot can close the panel
     and drop a confirmation turn into the thread. */
  onCommitted?: (findings: EodCommittedFinding[]) => void;
  onCancel?: () => void;
}

export default function EodCapture({ onCommitted, onCancel }: EodCaptureProps) {
  const { open } = useNav();

  const [domains, setDomains] = useState<EodDomain[]>([]);
  const [domain, setDomain] = useState<string>('all');
  const [mode, setMode] = useState<Mode>('free');

  const [freeText, setFreeText] = useState('');
  const [prompts, setPrompts] = useState<EodPrompt[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [engine, setEngine] = useState<string | null>(null);
  const [committed, setCommitted] = useState<EodCommittedFinding[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* domain list */
  useEffect(() => {
    let cancelled = false;
    getEodDomains()
      .then((d) => {
        if (!cancelled) setDomains(d.domains);
      })
      .catch((e) => !cancelled && setError(typeof e === 'string' ? e : 'Failed to load domains.'));
    return () => {
      cancelled = true;
    };
  }, []);

  /* guided prompts — reload when domain changes and guided mode is active */
  const loadPrompts = useCallback(async (dom: string) => {
    setError(null);
    try {
      const p = await getEodPrompts(dom);
      setPrompts(p.prompts);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Failed to load guided prompts.');
    }
  }, []);

  useEffect(() => {
    if (mode === 'guided') loadPrompts(domain);
  }, [mode, domain, loadPrompts]);

  const clearResults = () => {
    setDrafts([]);
    setEngine(null);
    setCommitted(null);
  };

  const runExtract = async () => {
    setBusy(true);
    setError(null);
    setCommitted(null);
    try {
      const guidedAnswers: EodAnswer[] =
        mode === 'guided'
          ? prompts
              .filter((p) => (answers[p.promptId] ?? '').trim().length > 0)
              .map((p) => ({
                promptId: p.promptId,
                question: p.question,
                answer: answers[p.promptId].trim(),
                launchId: p.launchId,
                phaseId: p.phaseId,
              }))
          : [];
      const text = mode === 'free' ? freeText : '';
      const res = await extractEodSignals(domain, text, guidedAnswers);
      setEngine(res.engine);
      setDrafts(
        (res.drafts ?? []).map((d, i) => ({
          ...d,
          _key: `d${i}`,
          approved: !d.needsReview, // pre-approve confident drafts; owner still confirms via commit
        })),
      );
      if ((res.drafts ?? []).length === 0) {
        setError(res.note ?? 'No signals found in that log.');
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Extraction failed.');
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<ReviewDraft>) =>
    setDrafts((ds) => ds.map((d) => (d._key === key ? { ...d, ...patch } : d)));

  const approvedCount = useMemo(() => drafts.filter((d) => d.approved).length, [drafts]);

  const commit = async () => {
    const approved = drafts.filter((d) => d.approved);
    if (approved.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const payload: EodDraft[] = approved.map((d) => ({
        kind: d.kind,
        category: d.category,
        headline: d.headline,
        description: d.description,
        launchId: d.launchId,
        launchName: d.launchName,
        phaseId: d.phaseId,
        confidence: d.confidence,
        source: d.source,
        engine: d.engine,
        needsReview: d.needsReview,
        // domain travels alongside so the backend credits the right agent
        ...({ domain } as unknown as object),
      }));
      const res = await commitEodSignals(payload);
      setCommitted(res.created);
      setDrafts([]);
      setFreeText('');
      setAnswers({});
      if (onCommitted) onCommitted(res.created);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Commit failed.');
    } finally {
      setBusy(false);
    }
  };

  const answeredCount = prompts.filter((p) => (answers[p.promptId] ?? '').trim().length > 0).length;
  const canExtract = !busy && (mode === 'free' ? freeText.trim().length > 3 : answeredCount > 0);

  return (
    <div
      className="eod-cap"
      style={{
        border: '1px solid var(--g200, #E2E8F1)',
        borderRadius: 10,
        padding: 14,
        marginTop: 8,
        background: '#fff',
      }}
    >
      {/* domain picker */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--g600)', marginBottom: 6 }}>
          Logging for
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {domains.map((d) => {
            const on = d.code === domain;
            return (
              <button
                key={d.code}
                type="button"
                onClick={() => {
                  setDomain(d.code);
                  clearResults();
                }}
                style={{
                  padding: '5px 11px',
                  borderRadius: 16,
                  border: on ? '1px solid var(--brand)' : '1px solid var(--g300, #CBD4E3)',
                  background: on ? 'var(--red500)' : '#fff',
                  color: on ? '#fff' : 'var(--g700, #495871)',
                  fontSize: 12,
                  fontWeight: on ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--g200, #E2E8F1)' }}>
        {(['free', 'guided'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              clearResults();
            }}
            style={{
              padding: '7px 13px',
              border: 'none',
              borderBottom: mode === m ? '2px solid var(--red500)' : '2px solid transparent',
              background: 'transparent',
              color: mode === m ? 'var(--brand)' : 'var(--g600)',
              fontWeight: mode === m ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {m === 'free' ? 'Free dump' : 'Guided'}
          </button>
        ))}
      </div>

      {/* capture */}
      {mode === 'free' ? (
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="eod-free" style={{ display: 'block', fontSize: 12, color: 'var(--g600)', marginBottom: 6 }}>
            What happened today? Write it however you like — one line or ten.
          </label>
          <textarea
            id="eod-free"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g. The aseptic fill-finish slot for Berobenatide OB fell through, the supplier won't confirm until Thursday. The Berobenatide T2D validation report is signed off. Worried the Hospital field force won't be certified in time…"
            rows={6}
            style={{
              width: '100%',
              padding: 11,
              borderRadius: 8,
              border: '1px solid var(--g300, #CBD4E3)',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {prompts.length === 0 ? (
            <div style={{ color: 'var(--g600)', fontSize: 13 }}>Loading questions&hellip;</div>
          ) : (
            prompts.map((p) => (
              <div key={p.promptId}>
                <label
                  htmlFor={`eod-${p.promptId}`}
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                >
                  {p.question}
                </label>
                {p.hint && (
                  <div style={{ fontSize: 11, color: 'var(--g600)', marginBottom: 4 }}>{p.hint}</div>
                )}
                <input
                  id={`eod-${p.promptId}`}
                  value={answers[p.promptId] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [p.promptId]: e.target.value }))}
                  placeholder="Your update (leave blank if nothing changed)"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--g300, #CBD4E3)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={runExtract}
          disabled={!canExtract}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: canExtract ? 'var(--brand)' : 'var(--g300, #CBD4E3)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: canExtract ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Working…' : 'Extract signals'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid var(--g300, #CBD4E3)',
              background: '#fff',
              color: 'var(--g700, #495871)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        {engine && (
          <span style={{ fontSize: 11, color: 'var(--g600)' }}>
            Structured by {engine === 'llm' ? 'the launch copilot (LLM)' : 'the built-in extractor'}. Review
            before anything is captured.
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--red600, #C21B22)', fontSize: 13, marginTop: 10 }}>{error}</div>
      )}

      {/* review drafts */}
      {drafts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {drafts.length} draft signal{drafts.length === 1 ? '' : 's'} — review and confirm
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drafts.map((d) => (
              <div
                key={d._key}
                style={{
                  border: '1px solid var(--g200, #E2E8F1)',
                  borderLeft: `3px solid ${
                    d.category === 'ct'
                      ? 'var(--red500)'
                      : d.category === 'rk'
                        ? 'var(--amber, #B45309)'
                        : 'var(--g400, #B4C0D3)'
                  }`,
                  borderRadius: 8,
                  padding: 11,
                  opacity: d.approved ? 1 : 0.6,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      fontWeight: 700,
                      color: 'var(--g600)',
                    }}
                  >
                    {KIND_LABEL[d.kind] ?? d.kind}
                  </span>
                  {d.launchName && (
                    <span style={{ fontSize: 11, color: 'var(--g700, #495871)' }}>· {d.launchName}</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--g600)' }}>
                    · confidence {Math.round(d.confidence * 100)}%
                  </span>
                  {d.needsReview && (
                    <span style={{ fontSize: 10, color: 'var(--amber, #B45309)', fontWeight: 700 }}>
                      NEEDS REVIEW
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={d.approved}
                      onChange={(e) => updateDraft(d._key, { approved: e.target.checked })}
                    />
                    Include
                  </label>
                </div>
                <input
                  value={d.headline}
                  onChange={(e) => updateDraft(d._key, { headline: e.target.value })}
                  aria-label="Signal headline"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--g200, #E2E8F1)',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    marginBottom: 6,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor={`cat-${d._key}`} style={{ fontSize: 11, color: 'var(--g600)' }}>
                    Impact
                  </label>
                  <select
                    id={`cat-${d._key}`}
                    value={d.category}
                    onChange={(e) => updateDraft(d._key, { category: e.target.value as EodDraft['category'] })}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--g200, #E2E8F1)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  >
                    {(['ct', 'rk', 'ok'] as const).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={commit}
              disabled={busy || approvedCount === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: approvedCount > 0 ? 'var(--brand)' : 'var(--g300, #CBD4E3)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: approvedCount > 0 && !busy ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'Capturing…' : `Capture ${approvedCount} finding${approvedCount === 1 ? '' : 's'}`}
            </button>
            <span style={{ fontSize: 11, color: 'var(--g600)' }}>
              Only the ones you include become findings. Nothing is written until you press capture.
            </span>
          </div>
        </div>
      )}

      {/* committed confirmation (also mirrored into the thread by the copilot) */}
      {committed && committed.length > 0 && (
        <div className="cap-l ok">
          <div className="cap-lt">
            Captured {committed.length} finding{committed.length === 1 ? '' : 's'} &mdash; now on the tower
          </div>
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
