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
  return (
    <ErrorReporterProvider>
      <NavProvider>
        <PortfolioCountsProvider>
          <Screens />
          <GuidedTour />
        </PortfolioCountsProvider>
      </NavProvider>
    </ErrorReporterProvider>
  );
}
