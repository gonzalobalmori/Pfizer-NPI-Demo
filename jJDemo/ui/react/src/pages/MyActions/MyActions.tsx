/*
 * My Actions (§2.1) — the decision-owner queue. Three panes partitioned by
 * decision-ownership state: Pending (USER, 4), Escalated (2) and History (23 in
 * the last 90 days). A record never appears in more than one pane (§6). Panes
 * are tabs so the same record is never shown twice at once.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/format';
import { SeverityTag } from '@/components/execution/Tags';
import { getPendingQueue, getEscalatedQueue, getDecisionHistory } from '@/api/execution';
import type { PendingQueue, EscalatedQueue, DecisionHistory } from '@/types/execution';

export default function MyActions() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingQueue | null>(null);
  const [escalated, setEscalated] = useState<EscalatedQueue | null>(null);
  const [history, setHistory] = useState<DecisionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, e, h] = await Promise.all([getPendingQueue(), getEscalatedQueue(), getDecisionHistory()]);
      setPending(p);
      setEscalated(e);
      setHistory(h);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load My Actions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      </div>
    );
  }

  const pendingCount = pending?.count ?? 0;
  const escCount = escalated?.count ?? 0;
  const historyCount = history?.counts.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-primary">My Actions</h1>
        <p className="text-sm text-secondary">
          Everything that needs a decision from you, sorted so you never re-work an earlier call.
        </p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            <Badge>{pendingCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="escalated">
            Escalated
            <Badge>{escCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            History
            <Badge>{historyCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {loading ? (
            <PaneSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              {pending?.cards.map((c) => (
                <button
                  key={c.decisionId}
                  type="button"
                  onClick={() => c.findingId && navigate(`/resolve/${c.findingId}`)}
                  className="group c3-card flex flex-col gap-3 rounded-lg border border-weak bg-primary p-4 text-left transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-secondary">{c.displayId}</span>
                      {c.dueLabel && (
                        <SeverityTag label={c.dueLabel} kind={c.dueTagClass ?? 'risk'} />
                      )}
                    </div>
                    <ChevronRight className="size-4 text-secondary transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div>
                    <div className="font-medium text-primary">{c.title}</div>
                    {c.meta && <div className="mt-0.5 text-sm text-secondary">{c.meta}</div>}
                  </div>
                  {c.agentRecommendation && (
                    <div className="rounded-md bg-secondary px-3 py-2 text-sm text-primary">
                      {c.agentRecommendation}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">{c.functions}</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-sm font-medium',
                        c.ctaEmphasis === 'primary' ? 'text-accent' : 'text-secondary',
                      )}
                    >
                      Resolve <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                </button>
              ))}
              {pendingCount === 0 && <EmptyPane label="Nothing waiting on you." />}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escalated" className="mt-4">
          {loading ? (
            <PaneSkeleton />
          ) : (
            <div className="flex flex-col gap-3">
              {escalated?.cards.map((c) => (
                <div
                  key={c.escalationId}
                  className="c3-card flex flex-col gap-3 rounded-lg border border-weak bg-primary p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-secondary">{c.displayId}</span>
                      {c.tagLabel && <SeverityTag label={c.tagLabel} kind={c.tagClass ?? 'auto'} />}
                    </div>
                    <span className="text-xs text-secondary">{c.functionLabel}</span>
                  </div>
                  <div>
                    <div className="font-medium text-primary">{c.title}</div>
                    {c.meta && <div className="mt-0.5 text-sm text-secondary">{c.meta}</div>}
                  </div>
                  <Pips pips={c.pips} />
                  {c.progressSummary && <div className="text-xs text-secondary">{c.progressSummary}</div>}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      Send a reminder
                    </Button>
                    <Button variant="outline" size="sm">
                      Escalate higher
                    </Button>
                    <Button variant="outline" size="sm">
                      Add to a board pack
                    </Button>
                  </div>
                </div>
              ))}
              {escCount === 0 && <EmptyPane label="No open escalations." />}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {loading ? (
            <PaneSkeleton />
          ) : (
            <>
              {history && <HistoryKpiBand history={history} />}
              <ol className="mt-4 flex flex-col">
                {history?.rows.map((r) => (
                  <li key={r.id} className="flex gap-3 border-l-2 border-weak py-3 pl-4">
                    <StatusIcon status={r.status} />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-secondary">{r.npiId}</span>
                        <span className="text-xs text-secondary">{fmtDateTime(r.occurredAt)}</span>
                        <StatusPill status={r.status} />
                      </div>
                      <div className="mt-1 text-sm text-primary">{r.label}</div>
                      {r.subLine && <div className="text-xs text-secondary">{r.subLine}</div>}
                      {r.note && (
                        <div className="mt-2 rounded-md bg-secondary px-3 py-2 text-xs text-primary">
                          <span className="font-medium">
                            {r.note.author}
                            {r.note.role ? ` · ${r.note.role}` : ''}
                          </span>
                          <span className="text-secondary"> · {fmtDateTime(r.note.at)}</span>
                          <div className="mt-1">{r.note.body}</div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs text-secondary">
      {children}
    </span>
  );
}

function Pips({ pips }: { pips: { sequence: number; label: string; state: string }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {pips.map((p) => (
        <li key={p.sequence} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block size-2.5 rounded-full',
              p.state === 'done' ? 'bg-success' : p.state === 'now' ? 'bg-accent' : 'bg-secondary',
            )}
          />
          <span
            className={cn(
              'text-xs',
              p.state === 'now' ? 'font-medium text-primary' : 'text-secondary',
            )}
          >
            {p.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function HistoryKpiBand({ history }: { history: DecisionHistory }) {
  const k = history.kpis;
  const items = [
    { big: k.decisionsTaken, label: 'Decisions taken', note: `${k.decisionsTakenWindow} · ${k.decisionsTakenDelta}` },
    { big: k.closed, label: 'Closed', note: `${k.closedOf} · ${k.closedNote}` },
    { big: k.actionsDelegated, label: 'Actions delegated', note: k.actionsDelegatedNote },
    { big: k.escalationsOpen, label: 'Escalations open', note: k.escalationsOpenNote },
    { big: k.medianTimeToDecide, label: 'Median time to decide', note: '' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="c3-card rounded-lg border border-weak bg-primary p-3">
          <div className="text-2xl font-semibold text-primary">{it.big}</div>
          <div className="text-xs font-medium text-primary">{it.label}</div>
          {it.note && <div className="mt-0.5 text-xs text-secondary">{it.note}</div>}
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'RESOLVED') return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  if (status === 'ESCALATED') return <ArrowUpRight className="size-4 shrink-0 text-warning" />;
  if (status === 'RUNNING') return <Clock className="size-4 shrink-0 text-accent" />;
  return <AlertTriangle className="size-4 shrink-0 text-secondary" />;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    RESOLVED: 'bg-success-weak text-success border-success',
    ESCALATED: 'bg-warning-weak text-warning border-warning',
    RUNNING: 'bg-accent-weak text-accent border-accent',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', map[status])}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function PaneSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyPane({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-weak p-8 text-center text-secondary">{label}</div>;
}
