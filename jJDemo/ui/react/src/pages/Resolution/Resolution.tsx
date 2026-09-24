/*
 * Resolution workspace (§2.4) — the single screen where Helena resolves a
 * finding. Eight sections top-to-bottom + a sticky decision bar:
 *   1 Header (finding, franchise, phase, exposure)
 *   2 What the fleet found (signal + detection)
 *   3 The agent chain that worked it (ordered handoffs, absolute timestamps)
 *   4 Guardrail checks (all must PASS before options are proposed)
 *   5 The modelled options (economics; recommended one flagged)
 *   6 The action plan implied by the chosen option
 *   7 The escalation thread (comments)
 *   8 What approving does (the atomic transaction)
 * The sticky bar carries the approve action. When the decision is not held by
 * the user (ESCALATED / DELEGATED / AGENT) the workspace is read-only (§2.1).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Bot,
  ListChecks,
  MessageSquare,
  Zap,
  Search,
  Lock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fmtDateTime, fmtEuro } from '@/lib/format';
import { OutcomeChip, CategoryDot } from '@/components/execution/Tags';
import { getResolutionWorkspace, approveDecision } from '@/api/execution';
import type { ResolutionWorkspace, DecisionOptionVm } from '@/types/execution';

export default function Resolution() {
  const { findingId } = useParams<{ findingId: string }>();
  const navigate = useNavigate();
  const [ws, setWs] = useState<ResolutionWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const load = useCallback(async () => {
    if (!findingId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getResolutionWorkspace(findingId);
      if (!data) {
        setError('That finding could not be found.');
      } else {
        setWs(data);
        setSelectedKey(data.recommendedOptionKey ?? (data.options[0]?.optionKey ?? null));
        setApproved(!!data.decision?.approvedAt);
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the resolution workspace.');
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedOption = ws?.options.find((o) => o.optionKey === selectedKey) ?? null;
  const isUserHeld = ws?.decision?.heldBy === 'USER';
  const canApprove = isUserHeld && !approved && !!selectedOption;

  const handleApprove = async () => {
    if (!ws?.decision || !selectedOption) return;
    setApproving(true);
    try {
      await approveDecision(ws.decision.id, selectedOption.label ?? '');
      setApproved(true);
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'The approval could not be recorded.');
      setConfirmOpen(false);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Skeleton className="mb-4 h-32 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error && !ws) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      </div>
    );
  }

  if (!ws) return null;
  const f = ws.finding;

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-4xl p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        {error && (
          <div className="mb-4 rounded-lg border border-danger bg-danger-weak p-3 text-sm text-danger">{error}</div>
        )}

        {/* 1 — Header */}
        <header className="c3-card rounded-lg border border-weak bg-primary p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-secondary">{f.displayId}</span>
            <OutcomeChip outcome={f.outcome} />
            <CategoryDot category={f.category} />
          </div>
          <h1 className="mt-2 text-xl font-semibold text-primary">{f.headline}</h1>
          <p className="mt-1 text-sm text-secondary">{f.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meta label="Device" value={f.shortName ?? f.deviceName} />
            <Meta label="Franchise" value={f.franchise} />
            <Meta label="Phase" value={f.phaseCode ? `${f.phaseCode} · ${f.phaseName ?? ''}` : null} />
            <Meta label="Revenue at risk" value={fmtEuro(f.revenueAtRisk)} />
          </dl>
          {f.exposureCause && (
            <div className="mt-3 rounded-md bg-danger-weak px-3 py-2 text-sm text-danger">
              {fmtEuro(f.exposure)} exposed — {f.exposureCause}
            </div>
          )}
        </header>

        {/* 2 — What the fleet found */}
        <Section icon={<Search className="size-4" />} title="What the fleet found">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Meta label="Signal source" value={f.signalSource} />
            <Meta label="Detected" value={fmtDateTime(f.detectedAt)} />
            <Meta label="Detected by" value={f.detectedBy} />
          </div>
        </Section>

        {/* 3 — The agent chain */}
        <Section icon={<Bot className="size-4" />} title="The chain the fleet ran">
          <ol className="flex flex-col">
            {ws.chainSteps.map((s, i) => (
              <li key={s.sequence} className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-weak text-xs font-medium text-accent">
                    {i + 1}
                  </span>
                  {i < ws.chainSteps.length - 1 && <span className="my-0.5 w-px flex-1 bg-[color:var(--color-border-weak)]" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-primary">{s.agent}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary">
                      {s.verb}
                    </span>
                    <span className="font-mono text-xs text-secondary">{fmtDateTime(s.occurredAt)}</span>
                  </div>
                  {s.detail && <div className="mt-0.5 text-sm text-secondary">{s.detail}</div>}
                  {s.handoffPrompt && (
                    <div className="mt-1 text-xs italic text-secondary">↳ {s.handoffPrompt}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* 4 — Guardrail checks */}
        <Section icon={<ShieldCheck className="size-4" />} title="Guardrail checks">
          <p className="mb-3 text-xs text-secondary">
            Every check ran and passed before any option was proposed.
          </p>
          <ul className="flex flex-col gap-2">
            {ws.guardrails.map((g, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-md border border-weak bg-secondary/40 p-3"
              >
                <div>
                  <div className="text-sm font-medium text-primary">{g.name}</div>
                  <div className="text-xs text-secondary">
                    {g.threshold ? `Threshold: ${g.threshold}` : ''}
                    {g.observed ? ` · Observed: ${g.observed}` : ''}
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                    g.result === 'PASS'
                      ? 'border-success bg-success-weak text-success'
                      : 'border-danger bg-danger-weak text-danger',
                  )}
                >
                  <CheckCircle2 className="size-3" /> {g.result}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 5 — The modelled options */}
        <Section icon={<Zap className="size-4" />} title="The options the agent modelled">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {ws.options.map((o) => (
              <OptionCard
                key={o.optionKey}
                option={o}
                selected={o.optionKey === selectedKey}
                disabled={!isUserHeld || approved}
                onSelect={() => setSelectedKey(o.optionKey)}
              />
            ))}
          </div>
        </Section>

        {/* 6 — The action plan */}
        <Section icon={<ListChecks className="size-4" />} title="What the chosen option sets in motion">
          <div className="overflow-hidden rounded-lg border border-weak">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-secondary">
                <tr>
                  <th className="p-2 font-medium">Task</th>
                  <th className="p-2 font-medium">Owner</th>
                  <th className="p-2 font-medium">Runs</th>
                  <th className="p-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {ws.tasks
                  .filter((t) => !selectedKey || t.optionKey === selectedKey)
                  .map((t, i) => (
                    <tr key={i} className="border-t border-weak">
                      <td className="p-2">
                        <div className="font-medium text-primary">{t.name}</div>
                        {t.detail && <div className="text-xs text-secondary">{t.detail}</div>}
                      </td>
                      <td className="p-2 text-secondary">{t.owner}</td>
                      <td className="p-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            t.agentRunnable ? 'bg-accent-weak text-accent' : 'bg-secondary text-secondary',
                          )}
                        >
                          {t.agentRunnable ? 'Agent' : 'Person'}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs text-secondary">{fmtDateTime(t.dueDate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 7 — The escalation thread */}
        <Section icon={<MessageSquare className="size-4" />} title="The thread">
          <ol className="flex flex-col gap-3">
            {ws.thread.map((c, i) => (
              <li key={i} className="rounded-md border border-weak bg-primary p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-primary">{c.author}</span>
                  {c.role && <span className="text-secondary">· {c.role}</span>}
                  <span className="text-secondary">· {fmtDateTime(c.at)}</span>
                  {c.isAutomatedCheck && (
                    <span className="rounded bg-accent-weak px-1.5 py-0.5 text-[10px] text-accent">automated</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-primary">{c.body}</div>
                {c.sourcesRead && (
                  <div className="mt-1 text-[11px] text-secondary">Sources read: {c.sourcesRead}</div>
                )}
              </li>
            ))}
          </ol>
        </Section>

        {/* 8 — What approving does */}
        <Section icon={<Lock className="size-4" />} title="What approving does">
          <ul className="flex flex-col gap-1.5 text-sm text-secondary">
            {[
              'Records your decision against the finding',
              'Re-baselines the affected gate date',
              'Releases the revenue exposure',
              'Assigns and dispatches every task above',
              'Notifies the owning functions',
              'Writes the CAPA containment closure',
              'Appends an immutable entry to the Design History File',
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-success" /> {line}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-secondary">
            It runs as one atomic transaction — all of it, or none of it — and cannot be run twice.
          </p>
        </Section>
      </div>

      {/* Sticky decision bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-weak bg-primary/95 backdrop-blur sm:left-16">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            {approved ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 className="size-4" /> Approved
                {ws.decision?.selectedOption ? ` · ${ws.decision.selectedOption}` : ''}
              </span>
            ) : isUserHeld ? (
              <>
                <span className="text-secondary">Selected: </span>
                <span className="font-medium text-primary">{selectedOption?.label ?? '—'}</span>
                {ws.decision?.dueLabel && <span className="ml-2 text-xs text-danger">{ws.decision.dueLabel}</span>}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-warning">
                <Lock className="size-4" /> This decision is held elsewhere — read only
              </span>
            )}
          </div>
          <Button disabled={!canApprove} onClick={() => setConfirmOpen(true)}>
            {approved ? 'Approved' : 'Approve decision'}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {selectedOption?.label}?</DialogTitle>
            <DialogDescription>
              This re-baselines the gate, releases {fmtEuro(f.exposure ?? f.revenueAtRisk)}, dispatches the plan,
              writes the CAPA closure and appends to the DHF — as one transaction that cannot be undone or re-run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={approving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? 'Approving…' : 'Confirm approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-primary">{value ?? '—'}</dd>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="c3-card mt-4 rounded-lg border border-weak bg-primary p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionCard({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: DecisionOptionVm;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
        selected ? 'border-accent bg-accent-weak' : 'border-weak bg-primary hover:border-accent',
        disabled && 'cursor-default opacity-90',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-secondary">Option {option.optionKey}</span>
        {option.recommended && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            Recommended
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-primary">{option.label}</div>
      {option.subLabel && <div className="text-xs text-secondary">{option.subLabel}</div>}
      <dl className="mt-1 flex flex-col gap-1 text-xs">
        <Row label="Recovery" value={option.slipLabel} />
        <Row label="Cost" value={fmtEuro(option.cost)} />
        <Row label="Gate impact" value={option.gateImpact} />
        <Row label="Revenue kept" value={fmtEuro(option.revenueKept)} />
        <Row label="Forfeits" value={option.forfeits} />
        <Row label="Confidence" value={option.confidence} />
        <Row label="Risk" value={option.riskBand} />
      </dl>
      {option.basis && <div className="mt-1 border-t border-weak pt-1.5 text-[11px] text-secondary">{option.basis}</div>}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium text-primary">{value ?? '—'}</dd>
    </div>
  );
}
