/*
 * API bridge for the non-Execution screens (§5). Every call goes to the backend
 * PortfolioService read methods via c3Action — there is no local/mock data. A
 * failing call surfaces to the caller.
 */

import { c3Action } from '@/c3Action';
import type {
  Cockpit,
  ProductLens,
  MarketLens,
  BusinessUnitLens,
  TimelineLens,
  OpenIssues,
  TimeImpact,
  LaunchRecord,
  LaunchIndex,
} from '@/types/portfolio';

export const getCockpit = (): Promise<Cockpit> =>
  c3Action('PortfolioService', 'cockpit', []);

export const getPortfolioProduct = (): Promise<ProductLens> =>
  c3Action('PortfolioService', 'portfolioProduct', []);

export const getPortfolioMarket = (): Promise<MarketLens> =>
  c3Action('PortfolioService', 'portfolioMarket', []);

export const getPortfolioBusinessUnit = (): Promise<BusinessUnitLens> =>
  c3Action('PortfolioService', 'portfolioBusinessUnit', []);

export const getPortfolioTimeline = (): Promise<TimelineLens> =>
  c3Action('PortfolioService', 'portfolioTimeline', []);

export const getOpenIssues = (): Promise<OpenIssues> =>
  c3Action('PortfolioService', 'openIssues', []);

export const getTimeImpact = (): Promise<TimeImpact> =>
  c3Action('PortfolioService', 'timeImpact', []);

export const getLaunchRecord = (launchId: string): Promise<LaunchRecord | null> =>
  c3Action('PortfolioService', 'launchRecord', [launchId]);

export const getLaunchIndex = (): Promise<LaunchIndex> =>
  c3Action('PortfolioService', 'launchIndex', []);
