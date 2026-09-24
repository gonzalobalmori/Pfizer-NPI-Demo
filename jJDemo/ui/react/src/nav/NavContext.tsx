/*
 * Navigation model — a faithful port of the prototype's menu → branch → tabs
 * scheme (its `BRANCH` object + `go()` / `view()` / `tab()` driver). There is no
 * URL routing here on purpose: the click-through toggles a `#menu` / `#app`
 * screen and a set of `.view.on` panels via state, and we reproduce that exactly.
 *
 *   • screen  — 'menu' (the landing) or 'app' (the working shell)
 *   • branch  — which of the three top-level options is active; it decides the
 *               header label/title and which tabs the top bar shows
 *   • view    — which panel is on; some views are branch tabs, others are
 *               drill-downs reached from inside a view (launch/flow/issue/docs)
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type BranchId = 'strategy' | 'pipeline' | 'exec';
export type ViewId =
  | 'cockpit'
  | 'portfolio'
  | 'launch'
  | 'flow'
  | 'issue'
  | 'docs'
  | 'strat'
  | 'actions'
  | 'tower'
  | 'chat'
  | 'alerts'
  | 'cascade';

export interface TabDef {
  v: ViewId;
  l: string;
  b?: string;
  bc?: 'r' | 'a' | 'p';
}
export interface BranchDef {
  n: string;
  t: string;
  tabs: TabDef[];
}

/* The three branches, verbatim from the prototype's BRANCH object. */
export const BRANCH: Record<BranchId, BranchDef> = {
  strategy: {
    n: 'OPTION 01',
    t: 'Strategic Decisions',
    tabs: [
      { v: 'strat', l: 'Sourcing strategy' },
      { v: 'strat', l: 'Suppliers' },
      { v: 'strat', l: 'Risk & resilience' },
      { v: 'strat', l: 'Scenarios & twins' },
    ],
  },
  pipeline: {
    n: 'OPTION 02',
    t: 'Pipeline Status Overview',
    tabs: [
      { v: 'cockpit', l: 'Cockpit' },
      { v: 'portfolio', l: 'Portfolio' },
      // No static badge count here — the "Open issues" tally is fed live from
      // PortfolioService.openIssues via PortfolioCountsProvider (see AppShell),
      // so the badge is never a hardcoded dashboard number.
      { v: 'alerts', l: 'Open issues', bc: 'a' },
      { v: 'cascade', l: 'Milestone replan' },
    ],
  },
  exec: {
    n: 'OPTION 03',
    t: 'Execution',
    tabs: [
      { v: 'actions', l: 'My actions', b: '6', bc: 'r' },
      { v: 'tower', l: 'Agent orchestration' },
      { v: 'chat', l: 'Copilot' },
    ],
  },
};

/* Which branch a drill-down view belongs to (so its tab strip is right). */
const VIEW_BRANCH: Partial<Record<ViewId, BranchId>> = {
  launch: 'pipeline',
  flow: 'pipeline',
  docs: 'pipeline',
  issue: 'exec',
};

/*
 * A "drive intent" carries deep sub-state into the target view so the guided
 * tour (and any deep link) can land on an exact pane/lens/filter, not just a
 * view. Each view reads the intent from nav and applies the fields that name
 * its own local state. `seq` bumps on every drive() so a view re-applies even
 * when the same target repeats.
 */
export interface DriveTarget {
  screen?: 'menu' | 'app';
  branch?: BranchId;
  view?: ViewId;
  param?: string | null;
  /** Portfolio lens. */
  lens?: 'product' | 'market' | 'bu' | 'milestones';
  /** Portfolio market sub-view + which market bubble is picked. */
  marketView?: 'map' | 'tl';
  marketPick?: string;
  /** My-actions sub-pane. */
  actionsPane?: 'pending' | 'escalated' | 'history';
  /** Agent tower sub-pane, franchise filter, and a card to expand. */
  towerPane?: 'live' | 'past';
  towerFranchise?: string;
  towerOpenCard?: string;
  /** Copilot: id of a canned prompt to ask. */
  chatAsk?: string;
  /** Milestone replan (cascade) view: when true, land already showing the run cascade result. */
  cascadeRun?: boolean;
}
export interface DriveIntent extends DriveTarget {
  seq: number;
}

interface NavState {
  screen: 'menu' | 'app';
  branch: BranchId;
  view: ViewId;
  /** id carried into a drill-down view (launch record / issue detail). */
  param: string | null;
  /** deep sub-state for the current navigation (tour / deep links); see DriveTarget. */
  intent: DriveIntent | null;
  go: (branch: BranchId, view: ViewId) => void;
  /** open a drill-down view, keeping the branch's tab strip. */
  open: (view: ViewId, param?: string | null) => void;
  tab: (view: ViewId) => void;
  toMenu: () => void;
  /** navigate with deep sub-state in one atomic step (used by the guided tour). */
  drive: (target: DriveTarget) => void;
}

const NavCtx = createContext<NavState | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<'menu' | 'app'>('menu');
  const [branch, setBranch] = useState<BranchId>('pipeline');
  const [view, setView] = useState<ViewId>('cockpit');
  const [param, setParam] = useState<string | null>(null);
  const [intent, setIntent] = useState<DriveIntent | null>(null);
  const seqRef = useRef(0);

  const go = useCallback((b: BranchId, v: ViewId) => {
    setBranch(b);
    setView(v);
    setParam(null);
    setIntent(null);
    setScreen('app');
    window.scrollTo(0, 0);
  }, []);

  /*
   * Atomic deep navigation for the guided tour. Sets screen/branch/view/param
   * from the target (with sensible defaults so a bare {view} still works) and
   * publishes the full intent so the destination view can apply its own
   * sub-state (lens, pane, filters, a card to expand, a prompt to ask).
   */
  const drive = useCallback((target: DriveTarget) => {
    const nextSeq = seqRef.current + 1;
    seqRef.current = nextSeq;
    const nextScreen = target.screen ?? (target.view ? 'app' : 'menu');
    setScreen(nextScreen);
    if (target.view) {
      const b = target.branch ?? VIEW_BRANCH[target.view];
      if (b) setBranch(b);
      setView(target.view);
      setParam(target.param ?? null);
    } else if (target.branch) {
      setBranch(target.branch);
    }
    setIntent({ ...target, seq: nextSeq });
    window.scrollTo(0, 0);
  }, []);

  const open = useCallback(
    (v: ViewId, p: string | null = null) => {
      const b = VIEW_BRANCH[v];
      if (b) setBranch(b);
      setView(v);
      setParam(p);
      setIntent(null);
      setScreen('app');
      window.scrollTo(0, 0);
    },
    [],
  );

  const tab = useCallback((v: ViewId) => {
    setView(v);
    setParam(null);
    setIntent(null);
    window.scrollTo(0, 0);
  }, []);

  const toMenu = useCallback(() => {
    setScreen('menu');
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo<NavState>(
    () => ({ screen, branch, view, param, intent, go, open, tab, toMenu, drive }),
    [screen, branch, view, param, intent, go, open, tab, toMenu, drive],
  );

  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav(): NavState {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('useNav must be used within a NavProvider');
  return ctx;
}
