/*
 * Launch Record (§5) — the full file on one launch, three tabs:
 *   • Overview  — device/scope facts, the five gates with their readiness
 *                 criteria, downstream impact and the gate timeline
 *   • Workflow  — all activities laid out in six phase columns with the gate at
 *                 the foot of each; a domain filter and a status filter that
 *                 recount the column headers as you narrow
 *   • Documents — every controlled document grouped by kind, missing ones flagged
 * The three tabs are three views of the SAME record — never the same card twice.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, FileWarning, CheckCircle2, Circle, Clock } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fmtEuro, fmtDateYear, fmtPhase } from '@/lib/format';
import { HealthTag, SlipPill } from '@/components/portfolio/HealthTag';
import { getLaunchRecord } from '@/api/portfolio';
import type {
  LaunchRecord as LaunchRecordData,
  RecordGate,
  ActivityCard,
  WorkflowColumn,
} from '@/types/portfolio';

const GATE_STATUS_CLS: Record<string, string> = {
  ok: 'border-success bg-success-weak text-success',
  late: 'border-warning bg-warning-weak text-warning',
  no: 'border-danger bg-danger-weak text-danger',
};

const ACT_STATUS_CLS: Record<string, string> = {
  ok: 'bg-success',
  run: 'bg-accent',
  rk: 'bg-warning',
  late: 'bg-warning',
  no: 'bg-danger',
};

export default function LaunchRecord() {
  const { launchId = '' } = useParams<{ launchId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<LaunchRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rec = await getLaunchRecord(launchId);
      if (!rec) {
        setError('That launch could not be found.');
      } else {
        setData(rec);
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the launch record.');
    } finally {
      setLoading(false);
    }
  }, [launchId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-8">
        <button
          type="button"
          onClick={() => navigate('/portfolio')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
        >
          <ChevronLeft className="size-4" /> Back to portfolio
        </button>
        <div className="rounded-lg border border-danger bg-danger-weak p-4 text-danger">{error}</div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Skeleton className="mb-4 h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  const o = data.overview;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <button
        type="button"
        onClick={() => navigate('/portfolio')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
      >
        <ChevronLeft className="size-4" /> Back to portfolio
      </button>

      {/* Header + fact strip */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-primary">{o.device}</h1>
            <p className="mt-1 text-sm text-secondary">
              {o.franchise} · {o.segment}
            </p>
          </div>
          <HealthTag health={o.health} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Device class" value={o.deviceClass} />
          <Fact label="Regulatory route" value={o.regulatoryRoute} />
          <Fact label="Lead market" value={o.leadMarketCode ?? o.leadMarket} />
          <Fact label="Current phase" value={o.currentPhase ? fmtPhase(o.currentPhase, o.currentPhaseName) : null} />
          <Fact label="First ship" value={fmtDateYear(o.firstShipDate) || null} />
          <Fact
            label="Revenue at risk"
            value={o.revenueAtRisk ? fmtEuro(o.revenueAtRisk) : '—'}
            tone={o.revenueAtRisk ? 'danger' : undefined}
          />
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Workflow · {data.workflow.total}</TabsTrigger>
          <TabsTrigger value="documents">
            Documents · {data.documents.total}
            {data.documents.missing > 0 ? ` (${data.documents.missing} missing)` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={data} />
        </TabsContent>
        <TabsContent value="workflow" className="mt-4">
          <WorkflowTab data={data} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string | null; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-weak bg-secondary/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-secondary">{label}</div>
      <div className={cn('mt-0.5 truncate text-sm font-medium', tone === 'danger' ? 'text-danger' : 'text-primary')}>
        {value ?? '—'}
      </div>
    </div>
  );
}

/* ── Overview tab ─────────────────────────────────────────────────── */
function OverviewTab({ data }: { data: LaunchRecordData }) {
  const o = data.overview;
  return (
    <div className="flex flex-col gap-4">
      {o.exposureCause ? (
        <div className="rounded-lg border border-danger bg-danger-weak p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-danger">Downstream impact</div>
          <p className="mt-1 text-sm text-danger">{o.exposureCause}</p>
        </div>
      ) : null}

      <section className="c3-card rounded-lg border border-weak bg-primary p-5">
        <h2 className="mb-1 text-sm font-semibold text-primary">Gate readiness</h2>
        <p className="mb-4 text-xs text-secondary">
          The five phase gates, each with the criteria that must be met before it can close.
        </p>
        <div className="flex flex-col gap-3">
          {o.gates.map((g) => (
            <GateRow key={g.code} gate={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GateRow({ gate }: { gate: RecordGate }) {
  const met = gate.criteria.filter((c) => c.met).length;
  const total = gate.criteria.length;
  return (
    <div className={cn('rounded-lg border p-3', GATE_STATUS_CLS[gate.status] ?? 'border-weak')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary">
            {gate.code}
          </span>
          <div>
            <div className="text-sm font-medium text-primary">{gate.name}</div>
            <div className="text-xs text-secondary">
              {total > 0 ? `${met}/${total} criteria met` : 'no criteria'} · forecast {fmtDateYear(gate.forecastDate)}
            </div>
          </div>
        </div>
        <SlipPill slipDays={gate.slipDays} />
      </div>
      {total > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {gate.criteria.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {c.met ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-secondary" />
              )}
              <span className={c.met ? 'text-primary' : 'text-secondary'}>
                {c.name}
                {!c.met && c.outstandingReason ? (
                  <span className="text-danger"> — {c.outstandingReason}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── Workflow tab ─────────────────────────────────────────────────── */
function WorkflowTab({ data }: { data: LaunchRecordData }) {
  const [domain, setDomain] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');

  const matches = useCallback(
    (a: ActivityCard) => {
      if (domain !== 'ALL' && a.domainCode !== domain) return false;
      if (status !== 'ALL' && a.statusCode !== status) return false;
      return true;
    },
    [domain, status],
  );

  // Recount column headers against the active filters.
  const columns = useMemo(
    () =>
      data.workflow.columns.map((col) => {
        const activities = col.activities.filter(matches);
        return { ...col, activities, count: activities.length };
      }),
    [data.workflow.columns, matches],
  );

  const shownTotal = columns.reduce((n, c) => n + c.count, 0);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium uppercase tracking-wide text-secondary">Domain</span>
          <FilterChip label="All" active={domain === 'ALL'} onClick={() => setDomain('ALL')} count={data.workflow.total} />
          {data.workflow.domains.map((d) => (
            <FilterChip
              key={d.code}
              label={d.name}
              count={d.count}
              active={domain === d.code}
              onClick={() => setDomain(d.code)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium uppercase tracking-wide text-secondary">Status</span>
          <FilterChip label="All" active={status === 'ALL'} onClick={() => setStatus('ALL')} count={data.workflow.total} />
          {Object.entries(data.workflow.statusTally).map(([code, n]) => (
            <FilterChip
              key={code}
              label={statusLabel(code)}
              count={n}
              active={status === code}
              onClick={() => setStatus(code)}
            />
          ))}
          <span className="ml-auto text-xs text-secondary">
            {shownTotal} of {data.workflow.total} activities
          </span>
        </div>
      </div>

      {/* Autonomy tally strip */}
      <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-weak bg-secondary/30 px-4 py-2 text-xs text-secondary">
        <span>
          <span className="font-semibold text-accent">{data.workflow.autonomyTally.A ?? 0}</span> autonomous
        </span>
        <span>
          <span className="font-semibold text-warning">{data.workflow.autonomyTally.R ?? 0}</span> recommend
        </span>
      </div>

      {/* Phase columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <PhaseColumn key={col.code} col={col} />
        ))}
      </div>
    </div>
  );
}

function PhaseColumn({ col }: { col: WorkflowColumn }) {
  const stateCls =
    col.state === 'closed' ? 'text-success' : col.state === 'live' ? 'text-accent' : 'text-secondary';
  return (
    <div className="flex flex-col rounded-lg border border-weak bg-secondary/20">
      <div className="flex items-center justify-between border-b border-weak px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold uppercase', stateCls)}>{col.code}</span>
          <span className="text-sm font-medium text-primary">{col.name}</span>
        </div>
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-secondary">{col.count}</span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {col.activities.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-secondary">No activities</div>
        ) : (
          col.activities.map((a) => <ActivityCardView key={a.id} act={a} />)
        )}
        {col.gate ? <GateFoot gate={col.gate} /> : null}
      </div>
    </div>
  );
}

function ActivityCardView({ act }: { act: ActivityCard }) {
  return (
    <div className="rounded-md border border-weak bg-primary p-2.5">
      <div className="flex items-start gap-2">
        <span className={cn('mt-1 inline-block size-2 shrink-0 rounded-full', ACT_STATUS_CLS[act.statusCode ?? ''] ?? 'bg-secondary')} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-primary">{act.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-secondary">
            {act.domainName ? <span>{act.domainName}</span> : null}
            {act.autonomy ? (
              <span
                className={cn(
                  'rounded px-1 font-semibold',
                  act.autonomy === 'A' ? 'bg-accent-weak text-accent' : 'bg-warning-weak text-warning',
                )}
                title={act.autonomy === 'A' ? 'Autonomous' : 'Recommend'}
              >
                {act.autonomy}
              </span>
            ) : null}
            {act.owner ? <span>· {act.owner}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function GateFoot({ gate }: { gate: RecordGate }) {
  const met = gate.criteria.filter((c) => c.met).length;
  return (
    <div className={cn('mt-1 rounded-md border p-2 text-xs', GATE_STATUS_CLS[gate.status] ?? 'border-weak')}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {gate.code} {gate.name}
        </span>
        <span>{gate.criteria.length > 0 ? `${met}/${gate.criteria.length}` : '—'}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[10px]">
        <Clock className="size-3" /> {fmtDateYear(gate.forecastDate)}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'border-accent bg-accent-weak text-accent' : 'border-weak text-secondary hover:text-primary',
      )}
    >
      {label}
      {count != null ? <span className={cn('text-[10px]', active ? 'text-accent' : 'text-secondary')}>{count}</span> : null}
    </button>
  );
}

function statusLabel(code: string): string {
  switch (code) {
    case 'ok':
      return 'Complete';
    case 'run':
      return 'Running';
    case 'rk':
      return 'At risk';
    case 'late':
      return 'Late';
    case 'no':
      return 'Blocked';
    default:
      return code;
  }
}

/* ── Documents tab ────────────────────────────────────────────────── */
const DOC_STATUS_META: Record<string, { label: string; cls: string }> = {
  ok: { label: 'Released', cls: 'text-success' },
  rev: { label: 'In review', cls: 'text-warning' },
  dft: { label: 'Draft', cls: 'text-secondary' },
  miss: { label: 'Missing', cls: 'text-danger' },
  na: { label: 'N/A', cls: 'text-secondary' },
};

function DocumentsTab({ data }: { data: LaunchRecordData }) {
  return (
    <div className="flex flex-col gap-4">
      {data.documents.missing > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger bg-danger-weak p-3 text-sm text-danger">
          <FileWarning className="size-4" />
          {data.documents.missing} required document{data.documents.missing === 1 ? '' : 's'} not yet on file.
        </div>
      ) : null}
      {data.documents.groups.map((grp) => (
        <section key={grp.code} className="c3-card overflow-hidden rounded-lg border border-weak bg-primary">
          <div className="flex items-center justify-between border-b border-weak bg-secondary/50 px-4 py-2">
            <h3 className="text-sm font-semibold text-primary">{grp.label}</h3>
            <span className="text-xs text-secondary">{grp.documents.length}</span>
          </div>
          <div className="divide-y divide-[color:var(--color-border-weak)]">
            {grp.documents.map((d, i) => {
              const meta = DOC_STATUS_META[d.status] ?? DOC_STATUS_META.na;
              const missing = d.status === 'miss';
              return (
                <div key={`${d.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  {missing ? (
                    <FileWarning className="size-4 shrink-0 text-danger" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-sm', missing ? 'text-danger' : 'text-primary')}>{d.name}</div>
                    <div className="truncate text-xs text-secondary">
                      {d.docType}
                      {d.revision ? ` · rev ${d.revision}` : ''}
                      {d.owner ? ` · ${d.owner}` : ''}
                    </div>
                  </div>
                  {d.documentDate ? (
                    <span className="text-xs text-secondary">{fmtDateYear(d.documentDate)}</span>
                  ) : null}
                  {d.fileSize ? <span className="w-16 text-right text-xs text-secondary">{d.fileSize}</span> : null}
                  <span className={cn('w-20 text-right text-xs font-medium', meta.cls)}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
