/*
 * Resolution workspace (#v-issue) — the issue-detail page reached by opening a
 * finding from an alerts/actions row (useNav's `param` carries the findingId).
 * Ported VERBATIM from the click-through's markup and CSS classes (.is-hd /
 * .is-meta / .is-body / .is-two / .sec / .thr / .opt-t / .ot-r / .acts / .ac-r /
 * .is-bar / .hd-*). Static headings and copy are word-for-word; only data values
 * are fed by the live ExecutionService.resolutionWorkspace c3Action.
 *
 * Model invariants honoured here: the copilot/agent refusal copy is never
 * softened; there is NO withdraw/cancel-escalation control (only escalate);
 * every timestamp is absolute via the fmt* helpers; option copy is verbatim.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getResolutionWorkspace, approveDecision } from '@/api/execution';
import { fmtDate, fmtDateTime, fmtEuro, fmtGate } from '@/lib/format';
import type { Category, Outcome, ResolutionWorkspace } from '@/types/execution';
import Glyph from '@/components/Brand/Glyph';
import ActionToast from '@/components/Feedback/ActionToast';

/** The recurring 4-point spark glyph used for agent avatars and the copilot CTA. */
function Spark() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
    </svg>
  );
}

/** Category → the prototype's chip class + verbatim label. */
function catInfo(c: Category | null): { cls: string; label: string } {
  if (c === 'rk') return { cls: 'rk', label: 'Consuming float' };
  if (c === 'ok') return { cls: 'ok', label: 'Monitored' };
  return { cls: 'ct', label: 'Blocking a gate' };
}

/** heldBy → the prototype's hold-key class + verbatim label. */
function holdInfo(o: Outcome): { cls: string; label: string } {
  if (o === 'AUTO') return { cls: 'agent', label: 'With an agent' };
  return { cls: 'esc', label: 'Escalated — with someone else' };
}

/** Risk band → the prototype's rd size class. */
function riskClass(band: string | null): string {
  const b = (band ?? '').toLowerCase();
  if (b.startsWith('high')) return 'hi';
  if (b.startsWith('low')) return 'lo';
  return 'md';
}

/** "Commercial agent" → "Commercial"; the function a finding sits under. */
function functionOf(detectedBy: string | null): string {
  if (!detectedBy) return 'Cross-functional';
  return detectedBy.replace(/\s+agent$/i, '').trim() || 'Cross-functional';
}

/**
 * "M. Okafor" → "MO"; falls back to the first two letters, and to a drawn dot
 * when there is no name at all.
 *
 * Returns a node rather than a string because the no-name fallback used to be the
 * text character `●` (U+25CF), which has no glyph in any Noto Sans subset and
 * rendered as a tofu box inside the avatar circle.
 */
function initials(name: string | null): React.ReactNode {
  if (!name) return <Glyph name="dot" className="sm" />;
  const m = /([A-Z])\.\s*([A-Z])/.exec(name);
  if (m) return m[1] + m[2];
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function IssueView() {
  const { param, tab } = useNav();
  const [ws, setWs] = useState<ResolutionWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  /* Set only by a click in THIS session, so the toast fires on the user's own
     approval and not on every revisit of an already-approved finding (the
     persistent banner below covers that case). */
  const [justApproved, setJustApproved] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!param) return;
    setError(null);
    try {
      const data = await getResolutionWorkspace(param);
      setWs(data);
      if (data) {
        /* Once a decision is approved the selection must follow what was ACTUALLY
           approved (decision.selectedOption, e.g. "Option C"), not the agent's
           recommendation. Defaulting to recommendedOptionKey here meant approving
           Option C then re-rendered the bar reading "Option A" — the approval
           looked like it had been ignored, or applied to the wrong option. */
        const approvedKey = data.decision?.selectedOption
          ? (data.decision.selectedOption.replace(/^option\s+/i, '').trim().toLowerCase() || null)
          : null;
        const approvedExists = approvedKey && data.options.some((o) => o.optionKey === approvedKey);
        setSelectedKey(
          (approvedExists ? approvedKey : null)
            ?? data.recommendedOptionKey
            ?? data.options[0]?.optionKey
            ?? null,
        );
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the resolution workspace.');
    }
  }, [param]);

  useEffect(() => {
    load();
  }, [load]);

  if (!param) {
    return (
      <div className="view on v-msg">
        No finding selected. Open an issue from My actions or the open-issues list.
      </div>
    );
  }
  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!ws) return <div className="view on v-msg">Loading…</div>;

  const f = ws.finding;
  const decision = ws.decision;
  const gate = ws.gateAtRisk;
  const slipDays = gate?.slipDays ?? 0;
  const cat = catInfo(f.category);
  const held = !!decision && decision.heldBy !== 'USER';
  const hold = decision ? holdInfo(decision.heldBy) : null;
  /* An issue whose next step depends on an outside authority (FDA / CHMP rapporteur /
     reimbursement payer) cannot be resolved by acting — approving an option here
     would misrepresent who moves it. For those findings the workspace is view-only:
     no Approve/Reject/Reassign, only a "View detail" affordance. */
  const authorityBound = f.dependency === 'REGULATOR';

  const selectedOption = ws.options.find((o) => o.optionKey === selectedKey) ?? null;
  const planTasks = ws.tasks.filter((t) => !selectedKey || t.optionKey == null || t.optionKey === selectedKey);
  const agentTaskCount = planTasks.filter((t) => t.agentRunnable).length;

  const canApprove = !authorityBound && !held && !!decision && !decision.approvedAt && !!selectedOption && !approving;
  /* The decision is settled — the cascade has run and re-approving is refused by
     assertUserCanDecide, so the bar states the outcome instead of offering the
     button again.

     This is WITHIN-SESSION state only. A page refresh rewinds every decision to its
     seeded baseline (see useDemoReset), so after a reload decision.approvedAt is null
     again and the actionable "Approve Option X" button is back. That is deliberate:
     the demo is meant to be re-runnable, and a permanently settled decision made the
     walkthrough a one-shot. */
  const approvedAt = decision?.approvedAt ?? null;
  const approvedLabel = decision?.selectedOption ?? null;

  const handleApprove = async () => {
    if (!decision || !selectedOption) return;
    const optionName = `Option ${(selectedOption.optionKey ?? '').toUpperCase()}`;
    setApproving(true);
    setError(null);
    try {
      await approveDecision(decision.id, selectedOption.label ?? '');
      /* Reload FIRST so the toast and the banner describe committed server state
         rather than an optimistic guess; Decision#approve is atomic, so if it
         resolved we know the cascade ran. */
      await load();
      setJustApproved(optionName);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'The approval could not be recorded.');
    } finally {
      setApproving(false);
    }
  };

  const entries = ws.thread.length;
  const agentComments = ws.thread.filter((c) => c.isAutomatedCheck).length;
  const funcCount = new Set(
    ws.thread.filter((c) => !c.isAutomatedCheck && c.role).map((c) => c.role),
  ).size;
  const firstOpenStep = ws.chainSteps.findIndex((s) => !s.completed);

  return (
    <div className={`view on${held ? ' held' : ''}`} id="v-issue">

      <div className="is-hd">
        <div className="is-hd-top">
          <button type="button" className="bk" id="is-back" onClick={() => tab('actions')}>
            <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg><span className="bk-lbl">Back</span>
          </button>
          <div className="is-hd-b">
            <div className="is-crumb">
              <span id="is-id">{f.displayId}</span> · <span id="is-asset">{f.shortName ?? f.deviceName}</span> ·{' '}
              <span id="is-phase">Phase {f.phaseCode} · {f.phaseName}</span>
            </div>
            <div className="is-t" id="is-t">{f.headline}</div>
            <div className="is-tags">
              <span className={`cat ${cat.cls}`} id="is-cat">{cat.label}</span>
              <span className="tag fn">{functionOf(f.detectedBy)}</span>
              {ws.capa && functionOf(f.detectedBy).toLowerCase() !== 'quality' ? (
                <span className="tag fn">Quality</span>
              ) : null}
              {ws.capa?.capaId ? (
                <span className="tag capa" id="is-capa">{ws.capa.capaId}</span>
              ) : null}
              <span className="is-open" id="is-open">Raised {fmtDateTime(f.detectedAt)} · {f.detectedBy}</span>
            </div>
          </div>
          <button type="button" className="btn s" onClick={() => tab('chat')}>
            <span className="ai-spark"><Spark /></span>Ask the copilot
          </button>
        </div>
        <div className="is-meta">
          <div className="im"><span>Gate at risk</span><b id="is-m-gate">{gate ? fmtGate(gate.code, gate.name) : '—'}</b></div>
          <div className="im"><span>Gate date</span><b className="mono" id="is-m-base">{gate ? (fmtDate(gate.forecastDate ?? gate.baselineDate) || '—') : '—'}</b></div>
          <div className="im">
            <span id="is-m-sll">Slip</span>
            <b className={`mono${slipDays > 0 ? ' r' : ''}`} id="is-slip">{slipDays > 0 ? `+${slipDays} days` : 'on schedule'}</b>
          </div>
          <div className="im"><span id="is-m-rl">Revenue exposed</span><b className="mono r" id="is-rev">{fmtEuro(f.exposure ?? f.revenueAtRisk)}</b></div>
          <div className="im">
            <span id="is-m-wl">{held ? 'Held by' : 'Decide by'}</span>
            <b className={held ? '' : 'r'} id="is-m-w">{held ? '—' : (decision?.dueLabel ?? '—')}</b>
          </div>
        </div>
      </div>

      <div className="is-body">

        <div className="is-two">
          <section className="sec">
            <div className="sec-h">The problem</div>
            <div className="sec-b">
              <p className="pb-txt" id="pb-txt">{f.description}</p>
              {ws.capa ? (
                <p className="pb-txt" style={{ marginTop: 11 }}>
                  {ws.capa.openedBy ?? 'The Quality agent'} opened <b>{ws.capa.capaId}</b> against{' '}
                  {ws.capa.openedAgainstProcess ?? 'the affected process'}
                  {ws.capa.openedAt ? ` on ${fmtDate(ws.capa.openedAt)}` : ''}. The decision below is its{' '}
                  <b>containment action</b>
                  {ws.capa.correctiveAction ? <> — {ws.capa.correctiveAction}</> : null}.
                </p>
              ) : null}
              <div className="pb-facts" id="pb-facts">
                <div className="pf"><span>Raised</span><b>{fmtDateTime(f.detectedAt)} · {f.detectedBy}</b></div>
                <div className="pf"><span>Category</span><b>{f.exposureCause ?? cat.label}</b></div>
                {ws.capa ? (
                  <div className="pf"><span>CAPA status</span><b>{ws.capa.status ?? '—'}</b></div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="sec">
            <div className="sec-h">If nothing changes</div>
            <div className="sec-b p0">
              <div className="imp" id="imp-417">
                {slipDays > 0 && gate ? (
                  <>
                    {ws.capa ? (
                      <div className="imr"><span className="iml">CAPA effectiveness</span><b className="mono">{fmtDate(gate.baselineDate) || '—'}</b><em>{slipDays} days late</em></div>
                    ) : null}
                    <div className="imr"><span className="iml">{fmtGate(gate.code, gate.name)}</span><b className="mono">{fmtDate(gate.baselineDate) || '—'} <Glyph name="arrow-right" className="sm" /> {fmtDate(gate.forecastDate) || '—'}</b><em>gate at risk</em></div>
                    <div className="imr tot"><span className="iml">Revenue at risk</span><b>{fmtEuro(f.exposure ?? f.revenueAtRisk)}</b><em>{slipDays} days of slip</em></div>
                  </>
                ) : (
                  <>
                    <div className="imr"><span className="iml">Gate schedule</span><b>{gate ? fmtGate(gate.code, gate.name) : 'No gate'}</b><em>on schedule</em></div>
                    <div className="imr tot"><span className="iml">Revenue at risk</span><b>{fmtEuro(f.exposure ?? f.revenueAtRisk)}</b><em>{f.exposureCause ?? 'monitored'}</em></div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="sec">
          <div className="sec-h">Escalation thread<span className="sec-n" id="thr-n">{entries} entries · {funcCount} functions · {agentComments} agent</span></div>
          <div className="sec-b">
            <div className="thr" id="thr-417">
              {ws.thread.map((c, i) => (
                <div className="tm" key={i}>
                  <div className={`tm-av${c.isAutomatedCheck ? ' ag' : ''}`}>
                    {c.isAutomatedCheck ? <Spark /> : initials(c.author)}
                  </div>
                  <div className="tm-b">
                    <div className="tm-h">
                      <b>{c.author}</b>
                      {c.isAutomatedCheck ? <span className="tag auto">Automated check</span> : <span>{c.role}</span>}
                      <em>{fmtDateTime(c.at)}</em>
                    </div>
                    <div className="tm-x">
                      {c.body}
                      {c.sourcesRead ? ` · Sources read: ${c.sourcesRead}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div className="tm-add">
                <div className="tm-av">GH</div>
                <input placeholder="Add a comment for the thread…" />
                <button type="button" className="btn s sm">Comment</button>
              </div>
            </div>
          </div>
        </section>

        <section className="sec hd-only" id="is-held">
          <div className="sec-h"><span className={`hd-k ${hold?.cls ?? 'esc'}`} id="hd-k">{hold?.label ?? 'Escalated — with someone else'}</span>
            <span className="sec-n" id="hd-sub" /></div>
          <div className="sec-b">
            <div className="hd-top">
              <div className="hd-who"><span className={`hd-av${hold?.cls === 'agent' ? ' ag' : ''}`} id="hd-av">{hold?.cls === 'agent' ? <Spark /> : <Glyph name="kebab" />}</span>
                <div><b id="hd-who">—</b><em id="hd-role">{decision?.authorityThreshold ?? ''}</em></div></div>
              <div className="hd-f"><span>With them since</span><b id="hd-since">{fmtDate(decision?.dueAt ?? null) || '—'}</b></div>
              <div className="hd-f"><span>Open</span><b id="hd-open">—</b></div>
            </div>
            <p className="hd-why" id="hd-why">{decision?.authorityThreshold ?? 'A qualified signatory is required.'}</p>
            <div className="hd-chain" id="hd-chain">
              {ws.chainSteps.map((s, i) => (
                <div className={`hdc ${s.completed ? 'done' : i === firstOpenStep ? 'now' : ''}`} key={s.sequence}>
                  <i /><span>{s.detail ?? s.verb}</span><em>{fmtDateTime(s.occurredAt)}</em>
                </div>
              ))}
            </div>
            <div className="hd-acts" id="hd-acts" />
            <div className="hd-note" id="hd-note" />
          </div>
        </section>

        <section className="sec you-only">
          <div className="sec-h">Options<span className="sec-n">Modelled against the live launch plan · selecting one rebuilds the action plan below</span></div>
          <div className="sec-b p0">
            <div className="opt-t">
              <div className="ot-h"><span /><span>Option</span><span>Slip</span><span>Cost</span><span>BSI slot</span><span>Revenue kept</span><span>Risk</span></div>
              {ws.options.map((o) => {
                const sel = o.optionKey === selectedKey;
                const slipTone = o.recommended ? 'g' : 'r';
                const gateTone = (o.gateImpact ?? '').toLowerCase().startsWith('retain') ? 'g' : 'r';
                const revTone = o.recommended ? 'g' : 'a';
                return (
                  <label className={`ot-r${sel ? ' sel' : ''}`} id={`opt-${o.optionKey}`} key={o.optionKey}>
                    <input
                      type="radio"
                      name="opt"
                      checked={sel}
                      onChange={() => setSelectedKey(o.optionKey)}
                    />
                    <span className="ot-n">{o.label}<em>{o.subLabel}</em>
                      {o.recommended ? <b className="ot-rec">Agent recommends</b> : null}</span>
                    <span className={`ot-v ${slipTone}`}>{o.slipLabel}</span><span className="ot-v">{fmtEuro(o.cost)}</span><span className={`ot-v ${gateTone}`}>{o.gateImpact}</span>
                    <span className={`ot-v ${revTone}`}>{fmtEuro(o.revenueKept)}</span><span className="ot-v"><i className={`rd ${riskClass(o.riskBand)}`}>{o.riskBand}</i></span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sec you-only">
          <div className="sec-h">Action plan<span className="sec-n" id="act-prog">0 of {planTasks.length} done · {agentTaskCount} can be run by agents</span>
            <button type="button" className="btn s sm" id="run-all">Run all {agentTaskCount} agent actions</button></div>
          <div className="sec-b p0">
            <div className="acts" id="acts">
              {planTasks.map((t, i) => {
                const isAg = !!t.agentRunnable;
                return (
                  <div className={`ac-r${isAg ? '' : ' man'}`} data-k={i + 1} key={i}>
                    <span className={`ac-w${isAg ? ' ag' : ''}`}>{isAg ? <Spark /> : initials(t.owner)}</span>
                    <span className="ac-b"><b>{t.name}</b><em>{t.detail}</em></span>
                    <span className="ac-d">{fmtDate(t.dueDate) || t.dueDate || ''}</span>
                    <span className="ac-s" data-s="0">Not started</span>
                    {isAg
                      ? <button type="button" className="btn p sm ac-go">Ask agent to run</button>
                      : <button type="button" className="btn s sm ac-go">Assign</button>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      <div className="is-bar">
        <div className="is-bar-l">
          <span className="is-sel" id="is-sel">{selectedOption?.label ?? '—'}</span>
          <span className="is-sub" id="is-sub">{selectedOption?.subLabel ?? ''}</span>
        </div>
        <div className="acts-bar" style={{ maxWidth: 160 }}><div className="acts-fill" id="acts-fill" style={{ width: '0%' }} /></div>
        {authorityBound ? (
          /* View-only: the next step is with an outside authority, so there is no
             Approve/Reject/Reassign — acting here cannot move it. */
          <>
            <span className="is-sub" style={{ marginRight: 'auto' }}>
              Waiting on an outside authority — acting here won&apos;t move it
            </span>
            <button type="button" className="btn s">View detail <Glyph name="arrow-right" /></button>
          </>
        ) : approvedAt ? (
          /* Settled: the cascade has run, so the approve/reject/reassign controls
             are gone (re-approving is rejected server-side by
             assertUserCanDecide) and the bar states the outcome instead. Without
             this the only post-click change was the button turning grey, which
             read as "nothing happened". */
          <span className="is-approved" id="is-approved">
            <span className="tag done">
              <Glyph name="check" /> Approved
            </span>
            <span className="is-approved-t">
              {approvedLabel ?? 'Option'} approved · {fmtDateTime(approvedAt)}
              <em>
                Gate re-baselined, exposure released and {planTasks.length}{' '}
                {planTasks.length === 1 ? 'task' : 'tasks'} dispatched. Recorded in the design history file.
              </em>
            </span>
          </span>
        ) : (
          <>
            <button type="button" className="btn q">Reject all options</button>
            <button type="button" className="btn s">Reassign owner</button>
            <button type="button" className="btn s">Escalate to Launch Board</button>
            <button type="button" className="btn p" id="btn-app" disabled={!canApprove} onClick={handleApprove}>
              {approving
                ? 'Approving…'
                : `Approve Option ${(selectedOption?.optionKey ?? '').toUpperCase()}`}
            </button>
          </>
        )}
      </div>

      <ActionToast
        open={!!justApproved}
        title={`${justApproved} approved`}
        detail="Gate re-baselined · exposure released · tasks dispatched · CTD entry written"
        onDismiss={() => setJustApproved(null)}
      />
    </div>
  );
}
