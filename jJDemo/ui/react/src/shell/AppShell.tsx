/*
 * App shell (prototype "#app"). The two-row sticky header (.hdr): row 1 is the
 * J&J wordmark + back-to-menu chevron, the active branch label/title, a
 * "Guided demo" button, a "My decisions" button and the avatar; row 2 is the
 * tab strip (.tabs) built from the active branch's tab set. Below it, the .body
 * hosts exactly one .view.on at a time. All class names are the prototype's.
 */

import React from 'react';
import { BRANCH, useNav } from '@/nav/NavContext';
import { usePortfolioCounts } from '@/contexts/PortfolioCountsProvider';
import { startGuidedTour } from '@/shell/GuidedTour';

import CockpitView from '@/views/CockpitView';
import PortfolioView from '@/views/PortfolioView';
import LaunchView from '@/views/LaunchView';
import FlowView from '@/views/FlowView';
import IssueView from '@/views/IssueView';
import DocsView from '@/views/DocsView';
import StratView from '@/views/StratView';
import ActionsView from '@/views/ActionsView';
import TowerView from '@/views/TowerView';
import ChatView from '@/views/ChatView';
import AlertsView from '@/views/AlertsView';
import CascadeView from '@/views/CascadeView';

export default function AppShell() {
  const { branch, view, tab, toMenu, go } = useNav();
  const { openIssues } = usePortfolioCounts();
  const b = BRANCH[branch];

  return (
    <div id="app" className="on">
      <header className="hdr">
        <div className="hdr-1">
          <button className="h-logo" onClick={toMenu}>
            <div className="h-back">‹</div>
            <div className="h-wm">
              Johnson<i>&amp;</i>Johnson<span>NPI Launch Control</span>
            </div>
          </button>
          <div className="h-div" />
          <div className="h-branch">
            {b.n}
            <b>{b.t}</b>
          </div>
          <div className="h-sp" />
          <button type="button" className="h-gd" onClick={startGuidedTour} title="Run the guided demo">
            <svg viewBox="0 0 24 24">
              <polygon points="6 4 20 12 6 20" />
            </svg>
            Guided demo
          </button>
          <button className="mywork" onClick={() => go('exec', 'actions')}>
            <svg viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M8 2v4M16 2v4M8 13l2.5 2.5L16 10" />
            </svg>
            My decisions<span className="bdg r">4</span>
          </button>
          <div className="h-av">HF</div>
        </div>
        <div className="hdr-2">
          <div className="tabs" id="tabs">
            {b.tabs.map((t, i) => {
              // The "Open issues" tab shows the live portfolio total (from
              // PortfolioService.openIssues); every other tab uses its static
              // badge, if any. No hardcoded counts.
              const badge = t.v === 'alerts' ? (openIssues != null ? String(openIssues) : null) : t.b;
              return (
                <button
                  key={`${t.v}-${i}`}
                  className={`tb${view === t.v ? ' on' : ''}`}
                  data-v={t.v}
                  onClick={() => tab(t.v)}
                >
                  {t.l}
                  {badge ? <span className={`bdg ${t.bc ?? ''}`}>{badge}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="flt" />
        </div>
      </header>

      <div className="body">
        {view === 'cockpit' && <CockpitView />}
        {view === 'portfolio' && <PortfolioView />}
        {view === 'launch' && <LaunchView />}
        {view === 'flow' && <FlowView />}
        {view === 'issue' && <IssueView />}
        {view === 'docs' && <DocsView />}
        {view === 'strat' && <StratView />}
        {view === 'actions' && <ActionsView />}
        {view === 'tower' && <TowerView />}
        {view === 'chat' && <ChatView />}
        {view === 'alerts' && <AlertsView />}
        {view === 'cascade' && <CascadeView />}
      </div>
    </div>
  );
}
