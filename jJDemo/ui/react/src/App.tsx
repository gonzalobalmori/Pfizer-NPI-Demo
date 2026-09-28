/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';

import ErrorReporterProvider from './components/ErrorBoundary/ErrorBoundary';
import { NavProvider, useNav } from './nav/NavContext';
import { PortfolioCountsProvider } from './contexts/PortfolioCountsProvider';
import MenuScreen from './shell/MenuScreen';
import AppShell from './shell/AppShell';
import GuidedTour from './shell/GuidedTour';
import DataDisclaimer from './shell/DataDisclaimer';
import useDemoReset from './hooks/useDemoReset';

/*
 * The prototype has two top-level screens toggled by a `.on` class — a landing
 * MENU and the working APP shell (top header + tab strip). We reproduce that
 * exactly with nav state rather than URL routing (see NavContext).
 */
function Screens() {
  const { screen } = useNav();
  return screen === 'menu' ? <MenuScreen /> : <AppShell />;
}

export default function App() {
  /*
   * R-TR-15: every scenario action is rewound to its seeded baseline once per page
   * load, so a refresh returns the demo to its opening state instead of leaving an
   * approved decision settled forever.
   *
   * This GATES the tree rather than running alongside it. PortfolioCountsProvider
   * and every view fetch on mount, so rendering them before the reset settles
   * would race it — a page could read rows mid-rewind and then show post-approval
   * values with no further refresh to correct them.
   */
  const { ready, error } = useDemoReset();

  if (!ready) {
    return <div className="view on v-msg">Loading…</div>;
  }

  return (
    <ErrorReporterProvider>
      <NavProvider>
        <PortfolioCountsProvider>
          <Screens />
          <GuidedTour />
          {/* Non-blocking: the app is usable, but the scenario state may be stale. */}
          {error ? <div className="view v-msg v-err">{error}</div> : null}
          {/* R-BASE-05: rendered at the root so it persists across both screens */}
          <DataDisclaimer />
        </PortfolioCountsProvider>
      </NavProvider>
    </ErrorReporterProvider>
  );
}
