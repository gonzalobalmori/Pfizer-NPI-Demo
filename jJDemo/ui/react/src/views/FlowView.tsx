/*
 * Launch drill-down · Workflow detail (#v-flow) — ported verbatim from the
 * click-through's activity board (.dv-strip / .fl-bar / .fl-st / .tbbd / .tbcol
 * / .fk / .fk-g / .fl-lg). The prototype builds the board from a static FLA
 * array in JS; here every card, count and column is computed from the live
 * PortfolioService.launchRecord workflow for the launch carried in `param`.
 * The domain strip and the status strip recount as you narrow, exactly as the
 * prototype's domFilter / flSetStat did.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getLaunchRecord } from '@/api/portfolio';
import { fmtDateYear } from '@/lib/format';
import type { LaunchRecord, ActivityCard, WorkflowColumn } from '@/types/portfolio';
import Glyph, { type GlyphName } from '@/components/Brand/Glyph';
import { labelFor } from '@/productLabel';
import { pharma } from '@/pharmaText';

/* Status → label + pip glyph, verbatim from the prototype's FLST / FLPIP. */
const ST_LABEL: Record<string, string> = {
  ok: 'Complete',
  run: 'In progress',
  rk: 'At risk',
  late: 'Late',
  no: 'Not started',
};
/*
 * The status pip inside the activity badge. `✓` and `●` used to sit here as text
 * and rendered as tofu boxes (no Noto Sans subset covers U+2713/U+25CF), so those
 * two are drawn by {@link Glyph}; `!` is plain Latin and stays text. `no`
 * (not started) is deliberately blank — an empty badge IS the "nothing has
 * happened yet" state.
 *
 * The pip is a SECONDARY cue: the badge's colour carries the same state, and the
 * `title` on every activity names it in words, so state is never colour-alone.
 */
const ST_PIP: Record<string, GlyphName | '!' | ''> = {
  ok: 'check',
  run: 'dot',
  rk: '!',
  late: '!',
  no: '',
};

/** Renders one status pip — a drawn glyph, a literal `!`, or nothing. */
function StatusPip({ status }: { status: string }) {
  const pip = ST_PIP[status] ?? '';
  if (pip === '' || pip === '!') return <>{pip}</>;
  return <Glyph name={pip} className="sm" />;
}
/* Autonomy → title, verbatim from the prototype's FLAUT. */
const AU_TITLE: Record<string, string> = {
  A: 'Executed by agent',
  R: 'Agent recommends, human decides',
};
const STATUS_KEYS = ['all', 'exc', 'ok', 'run', 'rk', 'late', 'no'] as const;

export default function FlowView() {
  const { param, open } = useNav();
  const [record, setRecord] = useState<LaunchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dom, setDom] = useState<string>('all');
  const [stat, setStat] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!param) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rec = await getLaunchRecord(param);
        if (!cancelled) setRecord(rec);
      } catch (err) {
        if (!cancelled) setError(typeof err === 'string' ? err : 'Failed to load the launch workflow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [param]);

  const columns = record?.workflow.columns ?? [];
  const total = record?.workflow.total ?? 0;
  const allActs = useMemo<ActivityCard[]>(() => columns.flatMap((c) => c.activities), [columns]);
  const doneAll = useMemo(() => allActs.filter((a) => a.statusCode === 'ok').length, [allActs]);

  // The whole-plan status counts drive the summary bar.
  const planCounts = useMemo(() => {
    const c: Record<string, number> = {};
    allActs.forEach((a) => {
      const k = a.statusCode ?? 'no';
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [allActs]);

  // The status strip counts the active domain slice, not the whole plan.
  const inDom = useMemo(
    () => allActs.filter((a) => dom === 'all' || a.domainCode === dom),
    [allActs, dom],
  );
  const domCounts = useMemo(() => {
    const c: Record<string, number> = {};
    inDom.forEach((a) => {
      const k = a.statusCode ?? 'no';
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [inDom]);

  const matches = useMemo(
    () => (a: ActivityCard) => {
      if (dom !== 'all' && a.domainCode !== dom) return false;
      if (stat === 'exc') return a.statusCode === 'rk' || a.statusCode === 'late';
      if (stat !== 'all' && a.statusCode !== stat) return false;
      return true;
    },
    [dom, stat],
  );

  if (!param) {
    return <div className="view on v-msg">Select a launch from the Cockpit or Portfolio.</div>;
  }
  if (error) {
    return <div className="view on v-msg v-err">{error}</div>;
  }
  if (loading) {
    return <div className="view on v-msg">Loading…</div>;
  }
  if (!record) {
    return <div className="view on v-msg">Select a launch from the Cockpit or Portfolio.</div>;
  }

  const o = record.overview;
  const gateCount = columns.filter((c) => c.gate).length;
  // Real tab-badge counts (manager: "(3)" is meaningless with nothing pending).
  const exceptionCount = (planCounts.rk ?? 0) + (planCounts.late ?? 0);
  const docCount = record.documents.total;

  return (
    <div className="view on" id="v-flow">
      <div className="ld-top">
        <button className="bk" type="button" onClick={() => open('portfolio')}><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg><span className="bk-lbl">Back</span></button>
        <div><div className="ld-n">{labelFor(o)}</div>
          <div className="ld-s">{total} activities &middot; {columns.length} phases &middot; {gateCount} gates</div></div>
        <div className="h-sp"></div>
      </div>
      <div className="ld-tabs">
        <button className="ld-tb" type="button" onClick={() => open('launch', param)}>Overview</button>
        <button className="ld-tb on" type="button" onClick={() => open('flow', param)}>Workflow detail{exceptionCount ? <span className="bdg r">{exceptionCount}</span> : null}</button>
        <button className="ld-tb" type="button" onClick={() => open('docs', param)}>Documents{docCount ? <span className="bdg a">{docCount}</span> : null}</button>
      </div>

      <div className="dv-strip">
        <DomainButton
          active={dom === 'all'}
          label="All domains"
          done={doneAll}
          count={total}
          summary={<><b>{doneAll}</b> of {total} complete</>}
          onClick={() => setDom('all')}
        />
        {record.workflow.domains.map((d) => {
          const acts = allActs.filter((a) => a.domainCode === d.code);
          const done = acts.filter((a) => a.statusCode === 'ok').length;
          const late = acts.filter((a) => a.statusCode === 'late').length;
          const rk = acts.filter((a) => a.statusCode === 'rk').length;
          const run = acts.filter((a) => a.statusCode === 'run').length;
          const tone = late ? 'hot' : rk ? 'warn' : '';
          return (
            <DomainButton
              key={d.code}
              active={dom === d.code}
              tone={tone}
              label={d.name}
              done={done}
              count={acts.length}
              summary={
                <>
                  <b>{done}</b> of {acts.length}
                  {late ? <em className="dvf late">{late} late</em> : null}
                  {rk ? <em className="dvf rk">{rk} at risk</em> : null}
                  {run ? <em className="dvf run">{run} running</em> : null}
                </>
              }
              onClick={() => setDom(d.code)}
            />
          );
        })}
      </div>

      <div className="fl-bar">
        <div className="fl-sum"><b>{doneAll}</b> of {total} activities complete &middot; <i className="fbg run">{planCounts.run ?? 0} in progress</i> &middot; <i className="fbg rk">{planCounts.rk ?? 0} at risk</i> &middot; <i className="fbg late">{planCounts.late ?? 0} late</i></div>
      </div>

      <div className="fl-st" id="fl-st">
        <span className="tbflt-l">
          Status
          <em style={{ fontStyle: 'normal', color: 'var(--g600)', fontWeight: 400, marginLeft: 6 }}>
            {dom === 'all'
              ? '· across all phases'
              : `· ${record.workflow.domains.find((d) => d.code === dom)?.name ?? dom} across all phases`}
          </em>
        </span>
        {STATUS_KEYS.map((k) => {
          const n =
            k === 'all'
              ? inDom.length
              : k === 'exc'
                ? (domCounts.rk ?? 0) + (domCounts.late ?? 0)
                : domCounts[k] ?? 0;
          return (
            <button
              key={k}
              className={`tbfb${k === stat ? ' on' : ''}${k === 'exc' ? ' exc' : ''}`}
              type="button"
              onClick={() => { setStat(k); window.scrollTo(0, 0); }}
              disabled={!n}
            >
              {k === 'all' ? 'All' : k === 'exc' ? 'Exceptions' : ST_LABEL[k]}<i>{n}</i>
            </button>
          );
        })}
      </div>

      <div className="tbbd" id="flbd">
        {columns.map((col) => (
          <PhaseColumn key={col.code} col={col} inDomCol={inDom.filter((a) => a.phaseCode === col.code)} visible={col.activities.filter(matches)} />
        ))}
      </div>

      <div className="fl-lg">
        <span className="lg2"><i className="fai ok"><Glyph name="check" className="sm" /></i>Complete</span>
        <span className="lg2"><i className="fai run"><Glyph name="dot" className="sm" /></i>In progress</span>
        <span className="lg2"><i className="fai rk">!</i>At risk</span>
        <span className="lg2"><i className="fai late">!</i>Late</span>
        <span className="lg2"><i className="fai no"></i>Not started</span>
        <span className="lgd2"></span>
        <span className="lg2"><i className="fau a">A</i>Executed by agent</span>
        <span className="lg2"><i className="fau r">R</i>Agent recommends, human decides</span>
      </div>
    </div>
  );
}

function DomainButton({
  active,
  tone,
  label,
  done,
  count,
  summary,
  onClick,
}: {
  active: boolean;
  tone?: string;
  label: string;
  done: number;
  count: number;
  summary: React.ReactNode;
  onClick: () => void;
}) {
  const pct = count ? Math.round((done / count) * 100) : 0;
  return (
    <button className={`dvt${tone ? ` ${tone}` : ''}${active ? ' on' : ''}`} type="button" onClick={onClick}>
      <span className="dvt-n">{label}</span>
      <span className="dvt-b"><i style={{ width: `${pct}%` }}></i></span>
      <span className="dvt-m">{summary}</span>
    </button>
  );
}

function PhaseColumn({ col, inDomCol, visible }: { col: WorkflowColumn; inDomCol: ActivityCard[]; visible: ActivityCard[] }) {
  const done = inDomCol.filter((a) => a.statusCode === 'ok').length;
  const g = col.gate;
  return (
    <div className={`tbcol ${col.state === 'live' ? 'live' : ''}`}>
      <div className="tbch">
        <div className="tbch-p"><b>{col.code}</b><em>{col.state}</em></div>
        <div className="tbch-n">{pharma(col.name)}</div>
        <div className="tbch-c">{inDomCol.length ? <><b>{done}</b> of {inDomCol.length} complete</> : 'nothing in this function'}</div>
        {inDomCol.length ? <div className="fk-bar"><i style={{ width: `${Math.round((done / inDomCol.length) * 100)}%` }}></i></div> : null}
      </div>
      <div className="tbcb-b">
        {visible.length
          ? visible.map((a) => <FlowCard key={a.id} act={a} />)
          : <div className="tbcol-empty">No activity here<br />for this filter.</div>}
      </div>
      {g ? (
        <div className={`fk-g ${g.status}`}><span className="fk-gc">{g.code}</span>
          <span className="fk-gn">{pharma(g.name)}<em>{g.status === 'ok' ? 'closed' : 'forecast'} {fmtDateYear(g.forecastDate)}</em></span></div>
      ) : null}
    </div>
  );
}

function FlowCard({ act }: { act: ActivityCard }) {
  const sc = act.statusCode ?? 'no';
  const au = act.autonomy;
  return (
    <div className={`fk ${sc}`} data-c={act.id} data-w={act.domainCode ?? ''}>
      <button className="fk-r" type="button">
        <span className={`fai ${sc}`}><StatusPip status={sc} /></span>
        <span className="fk-b"><span className="fk-n">{pharma(act.name)}</span>
          <span className="fa-m"><span className="faw">{act.domainName}</span>
            <span className="fao">{act.owner}</span>
            {au ? <span className={`fau ${au.toLowerCase()}`} title={AU_TITLE[au]}>{au}</span> : null}
          </span>
          <span className="fa-s">{act.status}{act.detail ? <em>{act.detail}</em> : null}</span>
        </span></button>
    </div>
  );
}
