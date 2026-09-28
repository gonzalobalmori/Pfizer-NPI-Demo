/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import type { MlStatus } from '@/types/portfolio';

/**
 * The market/rollout status mark — the small dot that sits before a market code
 * in the cockpit attention panel, the milestone market sub-rows, the launch
 * record's market table and the map side-panel's first-ship list.
 *
 * **Why this is a component and not a `<span className={'mg-dot ' + status} />`.**
 * That span was hand-copied into four places across three views, and it carried
 * its meaning in `background-color` alone:
 *
 * ```
 * .mg-dot     { background: var(--g300) }   ← unknown
 * .mg-dot.ok  { background: var(--g500) }   ← on plan
 * .mg-dot.rk  { background: var(--amber)  }
 * .mg-dot.ct  { background: var(--red500) }
 * ```
 *
 * Three defects in four lines. (1) Every mark was the same 7px circle, so red
 * vs amber — off track vs at risk, the one distinction a launch lead acts on —
 * was hue and nothing else, which is the failure the status block in
 * `prototype.css` exists to prevent. (2) `--g300` (unknown) against `--g500`
 * (on plan) is a lightness step of roughly 0.2 on two greys at a 7px diameter:
 * "no data reported" and "this market is fine" were, in practice, the same
 * mark. (3) Every call site set `aria-hidden` with no adjacent status text, so
 * assistive technology got the market code and nothing about its health.
 *
 * **The vocabulary.** Two orthogonal channels, both of which survive greyscale
 * printing and forced-colors mode:
 *
 *  - *round vs angular* — a triangle marks off track, matching the rule
 *    {@link SstIcon} already follows on the launch track (angular = blocked
 *    commitment). One shape language across the app, not two.
 *  - *ink level* — hollow means on plan (nothing to look at), solid means at
 *    risk (attention). Unknown is a dash: not an empty state but an absent
 *    one, so it can never be mistaken for a good one.
 *
 * Shape is redundant with, not a replacement for, the `title`: every mark names
 * its status in words, so the meaning is reachable by pointer, by screen reader
 * and in a black-and-white print. The dot is 9px rather than the old 7px
 * because a triangle and a ring need the extra pixel to read; the size is set in
 * CSS (`.mg-dot`) so the three context overrides still apply.
 */

export const ML_STATUS_TITLE: Record<MlStatus, string> = {
  ok: 'On plan',
  rk: 'At risk',
  ct: 'Off track',
};

interface MlDotProps {
  /** Market rollout status. `null` renders the "not reported" dash. */
  status: MlStatus | null | undefined;
  /** Prefix for the tooltip, e.g. a market name: "Germany — At risk". */
  label?: string;
  className?: string;
}

export default function MlDot({ status, label, className }: MlDotProps) {
  const word = status ? ML_STATUS_TITLE[status] : 'Status not reported';
  const title = label ? `${label} — ${word}` : word;
  const cls = `mg-dot${status ? ` ${status}` : ' nil'}${className ? ` ${className}` : ''}`;

  return (
    <svg className={cls} viewBox="0 0 12 12" role="img" aria-label={title}>
      <title>{title}</title>
      {status === 'ct' ? (
        /* Off track — solid triangle. Angular, and the only angular mark here. */
        <path d="M6 1.1 11.3 10.4H.7z" />
      ) : status === 'rk' ? (
        /* At risk — solid disc. Round, full ink. */
        <circle cx="6" cy="6" r="4.6" />
      ) : status === 'ok' ? (
        /* On plan — hollow ring. Round, no ink to draw the eye. */
        <circle cx="6" cy="6" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      ) : (
        /* Not reported — a dash. Absent, not merely quiet. */
        <path d="M1.9 6h8.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}
