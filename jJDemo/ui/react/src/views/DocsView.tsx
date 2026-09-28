/*
 * Launch drill-down · Documents (#v-docs) — ported verbatim from the
 * click-through's document register (.dc-k / .dc-f / .dc-wrap / .dc-g / .dc-r /
 * .dc-st). The KPI tallies, the per-group filter and every row are computed
 * from the live PortfolioService.launchRecord documents for the launch carried
 * in `param`; the prototype's dcFilter behaviour (a status KPI or a group
 * narrows the register) is reproduced with local state.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import { getLaunchRecord } from '@/api/portfolio';
import { fmtDateYear } from '@/lib/format';
import type { LaunchRecord, DocumentRow } from '@/types/portfolio';

/* Status → row label, verbatim from the prototype's .dc-st text. */
const ST_LABEL: Record<string, string> = {
  ok: 'Approved',
  rev: 'In review',
  dft: 'Draft',
  miss: 'Missing',
  na: 'Not started',
};
const DOC_ICON = (
  <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);

export default function DocsView() {
  const { param, open } = useNav();
  const [record, setRecord] = useState<LaunchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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
        if (!cancelled) setError(typeof err === 'string' ? err : 'Failed to load the document register.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [param]);

  const groups = record?.documents.groups ?? [];
  const allDocs = useMemo(() => groups.flatMap((g) => g.documents), [groups]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    allDocs.forEach((d) => {
      c[d.status] = (c[d.status] ?? 0) + 1;
    });
    return c;
  }, [allDocs]);

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
  const total = record.documents.total;
  const st = record.workflow.statusTally;
  const exceptionCount = (st.rk ?? 0) + (st.late ?? 0);

  const setStatus = (s: string) => {
    setStatusFilter((prev) => (prev === s ? null : s));
    setFilter('all');
  };

  const shownGroups = filter === 'all' ? groups : groups.filter((g) => g.code === filter);

  return (
    <div className="view on" id="v-docs">
      <div className="ld-top">
        <button className="bk" type="button" onClick={() => open('portfolio')}><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg><span className="bk-lbl">Back</span></button>
        <div><div className="ld-n">{o.device}</div>
          <div className="ld-s">Dossiers, certificates, licences, validation reports and approvals</div></div>
        <div className="h-sp"></div>
        <button className="btn s" type="button"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></svg>Export the register</button>
      </div>
      <div className="ld-tabs">
        <button className="ld-tb" type="button" onClick={() => open('launch', param)}>Overview</button>
        <button className="ld-tb" type="button" onClick={() => open('flow', param)}>Workflow detail{exceptionCount ? <span className="bdg r">{exceptionCount}</span> : null}</button>
        <button className="ld-tb on" type="button" onClick={() => open('docs', param)}>Documents{total ? <span className="bdg a">{total}</span> : null}</button>
      </div>

      <div className="dc-k">
        <button className="dc-ki" type="button" onClick={() => setStatus('ok')}><b className="">{statusCounts.ok ?? 0}</b><span>approved</span></button>
        <button className="dc-ki" type="button" onClick={() => setStatus('rev')}><b className="a">{statusCounts.rev ?? 0}</b><span>in review</span></button>
        <button className="dc-ki" type="button" onClick={() => setStatus('dft')}><b className="">{statusCounts.dft ?? 0}</b><span>drafted</span></button>
        <button className="dc-ki" type="button" onClick={() => setStatus('miss')}><b className="r">{statusCounts.miss ?? 0}</b><span>missing</span></button>
        <button className="dc-ki" type="button" onClick={() => setStatus('na')}><b className="">{statusCounts.na ?? 0}</b><span>not started yet</span></button>
        <div className="dc-tot"><b>{total}</b><span>documents in the record</span><i>1.42 GB &middot; last change 11 Sep 09:14</i></div>
      </div>

      <div className="dc-f"><span className="filt-l">Filter</span>
        <button className={`fb2${filter === 'all' ? ' on' : ''}`} type="button" onClick={() => { setFilter('all'); setStatusFilter(null); }}>All</button>
        {groups.map((g) => (
          <button key={g.code} className={`fb2${filter === g.code ? ' on' : ''}`} type="button" onClick={() => { setFilter(g.code); setStatusFilter(null); }}>{g.label} <i>{g.documents.length}</i></button>
        ))}
      </div>

      <div className="dc-wrap">
        {shownGroups.map((g) => {
          const rows = statusFilter ? g.documents.filter((d) => d.status === statusFilter) : g.documents;
          if (statusFilter && rows.length === 0) return null;
          const missing = g.documents.filter((d) => d.status === 'miss').length;
          return (
            <div className="dc-g" data-c={g.code} key={g.code}>
              <div className="dc-gh">{g.label}<i>{g.documents.length} documents</i>{missing ? <em className="dc-bad">{missing} missing</em> : null}</div>
              {rows.map((d, i) => (
                <DocRow key={`${d.name}-${i}`} d={d} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocRow({ d }: { d: DocumentRow }) {
  const missing = d.status === 'miss' || d.status === 'na';
  const meta = [d.docType, d.revision, d.owner].filter(Boolean).join(' · ');
  return (
    <div className={`dc-r ${d.status}`} data-s={d.status}>
      <span className="dc-ic">{DOC_ICON}</span>
      <span className="dc-b"><span className="dc-n">{d.name}</span><span className="dc-m">{meta}</span></span>
      <span className={`dc-st ${d.status}`}><i></i>{ST_LABEL[d.status] ?? d.status}</span>
      <span className="dc-d">{fmtDateYear(d.documentDate) || '—'}</span>
      <span className="dc-z">{d.fileSize ?? '—'}</span>
      <span className="dc-a"><button className={`dc-open${missing ? ' dim' : ''}`} type="button">{missing ? 'Chase' : 'Open'}</button></span>
    </div>
  );
}
