/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { Inbox, LayoutGrid, Sparkles, Gauge, Boxes, AlertTriangle, Compass } from 'lucide-react';

import { NavigationItem } from '@/types/navigation';

/**
 * Navigation configuration for the application
 * To add a new page:
 * 1. Add a new item to this array
 * 2. Make sure the path matches your route in App.tsx
 * 3. Add the corresponding page component
 */
export const navigationConfig: NavigationItem[] = [
  {
    id: 'my-actions',
    path: '/',
    icon: Inbox,
    iconActive: Inbox,
    label: 'My Actions',
    tooltip: 'Decisions waiting on you',
  },
  {
    id: 'orchestration',
    path: '/orchestration',
    icon: LayoutGrid,
    iconActive: LayoutGrid,
    label: 'Fleet',
    tooltip: 'Agent orchestration — live board & activity log',
  },
  {
    id: 'cockpit',
    path: '/cockpit',
    icon: Gauge,
    iconActive: Gauge,
    label: 'Cockpit',
    tooltip: 'Pipeline cockpit — portfolio status at a glance',
  },
  {
    id: 'portfolio',
    path: '/portfolio',
    icon: Boxes,
    iconActive: Boxes,
    label: 'Portfolio',
    tooltip: 'Nine launches, four lenses: product, market, business unit, timeline',
  },
  {
    id: 'issues',
    path: '/issues',
    icon: AlertTriangle,
    iconActive: AlertTriangle,
    label: 'Open Issues',
    tooltip: 'Every live finding across the portfolio, worst first',
  },
  {
    id: 'copilot',
    path: '/copilot',
    icon: Sparkles,
    iconActive: Sparkles,
    label: 'Copilot',
    tooltip: 'Ask about any launch, gate, market, supplier or agent',
  },
  {
    id: 'strategic',
    path: '/strategic',
    icon: Compass,
    iconActive: Compass,
    label: 'Strategic Decisions',
    tooltip: 'Strategic decision support (out of scope for this demo)',
  },
];

/**
 * Helper function to add navigation item dynamically
 */
export const addNavigationItem = (item: NavigationItem) => {
  navigationConfig.push(item);
};

/**
 * Helper function to remove navigation item
 */
export const removeNavigationItem = (id: string) => {
  const index = navigationConfig.findIndex((item) => item.id === id);
  if (index > -1) {
    navigationConfig.splice(index, 1);
  }
};

/**
 * Helper function to update badge count
 */
export const updateNavigationBadge = (id: string, badge?: number) => {
  const item = navigationConfig.find((item) => item.id === id);
  if (item) {
    item.badge = badge;
  }
};
