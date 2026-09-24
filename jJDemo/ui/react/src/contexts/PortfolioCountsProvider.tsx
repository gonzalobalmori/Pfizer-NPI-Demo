/*
 * Portfolio counts — a single live source for the small tallies the chrome
 * shows outside the views themselves (the "Open issues" tab badge in AppShell
 * and the "N exceptions, worst first" line on the landing menu). Both used to
 * be hardcoded to "11"; they now read the same number the Open Issues page
 * shows as its headline total, fetched once from PortfolioService.openIssues.
 *
 * `openIssues` is null while loading / on error so consumers can hide the badge
 * rather than flash a wrong number — never a hardcoded fallback.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getOpenIssues } from '@/api/portfolio';

interface PortfolioCounts {
  /** Total open-issue rows across the portfolio (matches the Open Issues page headline). */
  openIssues: number | null;
}

const PortfolioCountsCtx = createContext<PortfolioCounts>({ openIssues: null });

export function PortfolioCountsProvider({ children }: { children: React.ReactNode }) {
  const [openIssues, setOpenIssues] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getOpenIssues();
        if (!cancelled) setOpenIssues(data.total);
      } catch {
        // Leave null on failure — consumers omit the badge rather than show a
        // stale/guessed count.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <PortfolioCountsCtx.Provider value={{ openIssues }}>{children}</PortfolioCountsCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortfolioCounts(): PortfolioCounts {
  return useContext(PortfolioCountsCtx);
}
