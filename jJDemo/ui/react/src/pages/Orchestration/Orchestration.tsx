/*
 * Agent orchestration (§2.2, §2.3). Two views over the same finding set behind
 * one shared franchise + market filter:
 *   • Live board — six phase columns over Finding.outcome, with a KPI row.
 *   • Activity log — completed fleet actions only, reverse-chronological.
 * The board and the log NEVER merge with the user's decision history (§6).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/format';
import { OutcomeChip } from '@/components/execution/Tags';
import { getLiveBoard, getActivityLog } from '@/api/execution';
import type { LiveBoard, ActivityLog, BoardCard } from '@/types/execution';

export default function Orchestration() {
  const [franchise, setFranchise] = useState('all');
  const [market, setMarket] = useState('all');
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [log, setLog] = useState<ActivityLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, l] = await Promise.all([getLiveBoard(franchise, market), getActivityLog(franchise, market)]);
      setBoard(b);
      setLog(l);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the orchestration board.');
    } finally {
      setLoading(false);
    }
  }, [franchise, market]);

  useEffect(() => {
    load();
  }, [load]);

  const franchises = board?.filters.franchises ?? ['all'];
  const markets = board?.filters.markets ?? ['all'];

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Agent orchestration</h1>
          <p className="text-sm text-secondary">
            What the fleet is doing across the programme, and every action it has already executed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect
            value={franchise}
            onChange={setFranchise}
            options={franchises}
            allLabel="All franchises"
            width="w-48"
          />
          <FilterSelect value={market} onChange={setMarket} options={markets} allLabel="All markets" width="w-36" />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      )}

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Live board</TabsTrigger>
          <TabsTrigger value="log">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {loading ? (
            <Skeleton className="h-96 w-full rounded-lg" />
          ) : board ? (
            <BoardView board={board} />
          ) : null}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          {loading ? <Skeleton className="h-96 w-full rounded-lg" /> : log ? <LogView log={log} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  width: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o === 'all' ? allLabel : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BoardView({ board }: { board: LiveBoard }) {
  const k = board.kpis;
  const kpis = [
    { big: k.actionsOnBoard, label: 'Agent actions on the board' },
    { big: k.workingNow, label: 'Working right now' },
    { big: k.yourDecision, label: 'Your decision' },
    { big: k.heldByPerson, label: 'Held by a person' },
    { big: k.closedByFleet, label: 'Closed by the fleet' },
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((it) => (
          <div key={it.label} className="c3-card rounded-lg border border-weak bg-primary p-3">
            <div className="text-2xl font-semibold text-primary">{it.big}</div>
            <div className="text-xs text-secondary">{it.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {board.columns.map((col) => (
          <div key={col.code} className="flex flex-col rounded-lg border border-weak bg-secondary/40 p-2">
            <div className="mb-2 px-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">{col.code}</span>
                <PhaseState state={col.state} />
              </div>
              <div className="text-xs text-secondary">{col.name}</div>
            </div>
            <div className="flex flex-col gap-2">
              {col.cards.map((c) => (
                <BoardCardTile key={c.findingId} card={c} />
              ))}
              {col.cards.length === 0 && (
                <div className="rounded-md border border-dashed border-weak p-3 text-center text-xs text-secondary">
                  No open findings
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PhaseState({ state }: { state: string }) {
  const map: Record<string, string> = {
    live: 'bg-accent-weak text-accent',
    closed: 'bg-success-weak text-success',
    queued: 'bg-secondary text-secondary',
  };
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase', map[state] ?? '')}>
      {state}
    </span>
  );
}

function BoardCardTile({ card }: { card: BoardCard }) {
  const navigate = useNavigate();
  const lastStep = card.steps.length ? card.steps[card.steps.length - 1] : null;
  return (
    <button
      type="button"
      onClick={() => navigate(`/resolve/${card.findingId}`)}
      className="c3-card flex flex-col gap-2 rounded-md border border-weak bg-primary p-3 text-left transition-colors hover:border-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-secondary">{card.displayId}</span>
        <OutcomeChip outcome={card.outcome} />
      </div>
      <div className="text-sm font-medium leading-snug text-primary">{card.headline}</div>
      <div className="flex flex-wrap items-center gap-1">
        {card.products.map((p) => (
          <span key={p} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary">
            {p}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-secondary">
        <span>{card.detectedBy}</span>
        <span>
          {card.steps.filter((s) => s.completed).length} action
          {card.steps.filter((s) => s.completed).length === 1 ? '' : 's'}
        </span>
      </div>
      {lastStep && (
        <div className="border-t border-weak pt-1.5 text-[11px] text-secondary">
          <span className="font-medium text-primary">{lastStep.stateLabel ?? lastStep.verb}</span>
          {lastStep.agent ? ` · ${lastStep.agent}` : ''}
        </div>
      )}
    </button>
  );
}

function LogView({ log }: { log: ActivityLog }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="mb-3 text-sm text-secondary">
        <span className="font-semibold text-primary">{log.actionCount}</span> actions executed by{' '}
        <span className="font-semibold text-primary">{log.agentCount}</span> agents
      </div>
      <ol className="flex flex-col divide-y divide-[color:var(--color-border-weak)] rounded-lg border border-weak bg-primary">
        {log.rows.map((r, i) => (
          <li key={`${r.findingId}-${i}`} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="w-28 shrink-0 font-mono text-xs text-secondary">{fmtDateTime(r.occurredAt)}</div>
            <div className="w-36 shrink-0 text-xs font-medium text-primary">{r.agent}</div>
            <div className="flex-1">
              <div className="text-sm text-primary">
                <span className="font-medium">{r.verb}</span>
                {r.detail ? ` — ${r.detail}` : ''}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                <button
                  type="button"
                  className="font-mono underline-offset-2 hover:underline"
                  onClick={() => navigate(`/resolve/${r.findingId}`)}
                >
                  {r.displayId}
                </button>
                <span>·</span>
                <span>
                  {r.product}
                  {r.otherProductCount > 0 ? ` +${r.otherProductCount}` : ''}
                </span>
                <span>·</span>
                <span>{r.phaseCode}</span>
                <span>·</span>
                <span>{r.franchise}</span>
                <OutcomeChip outcome={r.outcome} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
