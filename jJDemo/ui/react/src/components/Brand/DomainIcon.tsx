/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';

/**
 * Line icons for the functional domains a cascade touches (manufacturing,
 * logistics, commercial, finance, quality, regulatory, supply, clinical).
 *
 * Why these are drawn and not emoji. The cascade panels previously used
 * `🏭 📦 📣 💶 🔬 ⚖️`, which fails three ways in a branded application:
 *
 *  1. **Emoji are rendered by the platform, not by us.** The glyph comes from the
 *     OS emoji font (Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji), so the
 *     same screen shows a different illustration style — and different colours —
 *     on macOS, Windows and Linux. Nothing in the brand system can reach them: not
 *     the Pfizer palette, not `currentColor`, not weight or size conventions. A
 *     multicolour cartoon factory sitting beside Pfizer Blue rules is the single
 *     most off-brand mark that was left in the UI.
 *  2. **They are full-colour, and colour here is load-bearing.** Every other
 *     status mark in this application earns its colour from the validated ramp
 *     (see the status block in `prototype.css`). Emoji inject saturated reds,
 *     greens and yellows that read as status signals but mean nothing, competing
 *     with the marks that do.
 *  3. **Their advance widths are inconsistent** (and `⚖️` carries a variation
 *     selector), so the icon column did not align down the list.
 *
 * These are 16×16, `currentColor`, 1.5px-stroke line icons in the same idiom as
 * {@link Glyph} — so a domain icon inherits the tone of whatever context it sits
 * in and aligns on a common box. Semantics stay in the adjacent text: the icon is
 * `aria-hidden` and the domain is always named in words beside it, so the icon is
 * decoration that aids scanning, never the only carrier of meaning.
 */

export type DomainName =
  | 'MANUFACTURING'
  | 'LOGISTICS'
  | 'COMMERCIAL'
  | 'FINANCE'
  | 'QUALITY'
  | 'REGULATORY'
  | 'SUPPLY'
  | 'CLINICAL';

/* Shared stroke setup — one place, so every icon has identical weight and joins. */
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<DomainName, React.ReactNode> = {
  /* plant: two stacks and a roofline */
  MANUFACTURING: (
    <g {...S}>
      <path d="M2 14h12" />
      <path d="M3.2 14V7.4l3.4 2.1V7.4l3.4 2.1V5.2h2.8V14" />
    </g>
  ),
  /* carton with a tape seam */
  LOGISTICS: (
    <g {...S}>
      <path d="M2.4 5.3 8 2.6l5.6 2.7v5.4L8 13.4l-5.6-2.7z" />
      <path d="M2.4 5.3 8 8l5.6-2.7M8 8v5.4" />
    </g>
  ),
  /* megaphone */
  COMMERCIAL: (
    <g {...S}>
      <path d="M3 6.6h2.4L11 3.4v9.2L5.4 9.4H3z" />
      <path d="M5.4 9.4v2.9M12.9 6.1a2.6 2.6 0 0 1 0 3.8" />
    </g>
  ),
  /* coin with a currency bar */
  FINANCE: (
    <g {...S}>
      <circle cx="8" cy="8" r="5.4" />
      <path d="M9.9 5.7a2.6 2.6 0 1 0 0 4.6M5.6 7.3h3.1M5.6 8.9h3.1" />
    </g>
  ),
  /* flask */
  QUALITY: (
    <g {...S}>
      <path d="M6.4 2.4h3.2M7 2.4v3.3L3.7 12a1.2 1.2 0 0 0 1 1.8h6.6a1.2 1.2 0 0 0 1-1.8L9 5.7V2.4" />
      <path d="M5.1 9.4h5.8" />
    </g>
  ),
  /* balance / scales */
  REGULATORY: (
    <g {...S}>
      <path d="M8 3v10.2M4.6 13.2h6.8M3 5.6h10M4.1 5.6 2.4 9.1h3.4zM11.9 5.6 10.2 9.1h3.4z" />
    </g>
  ),
  /* link — a supply chain */
  SUPPLY: (
    <g {...S}>
      <path d="M6.6 9.4a2.4 2.4 0 0 1 0-3.4l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4l-.6.6" />
      <path d="M9.4 6.6a2.4 2.4 0 0 1 0 3.4l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4l.6-.6" />
    </g>
  ),
  /* clipboard with a tick — a clinical protocol */
  CLINICAL: (
    <g {...S}>
      <path d="M6 3.2H4.6a1 1 0 0 0-1 1v8.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V4.2a1 1 0 0 0-1-1H10" />
      <path d="M6 2.4h4v1.9H6zM5.9 9.2 7.3 10.6l2.8-3" />
    </g>
  ),
};

interface DomainIconProps {
  /** Functional domain. An unknown value renders nothing rather than a stray mark. */
  domain: string;
  className?: string;
}

export default function DomainIcon({ domain, className }: DomainIconProps) {
  const path = PATHS[domain as DomainName];
  if (!path) return null;
  return (
    <svg
      className={className ? `dmi ${className}` : 'dmi'}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
