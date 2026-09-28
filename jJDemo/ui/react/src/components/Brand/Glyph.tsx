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
 * The small symbols the UI draws inline — arrows, ticks, pips, carets — as SVG
 * rather than as text characters.
 *
 * Why this exists. The brand font is Noto Sans, loaded through
 * `@fontsource-variable/noto-sans`, whose `@font-face` blocks are gated by
 * `unicode-range`. The `latin` subset covers Latin text, punctuation and the
 * vertical arrows U+2191/U+2193 — but NOT the geometric shapes and dingbats this
 * UI was reaching for. Nine codepoints were measured rendering as the browser's
 * `.notdef` box (a hollow "tofu" rectangle):
 *
 *     →  U+2192   ↳  U+21B3   ⋮  U+22EE   ▲  U+25B2   ▼  U+25BC
 *     ◆  U+25C6   ●  U+25CF   ✓  U+2713   ✕  U+2715
 *
 * How that was established, since the obvious test lies: `document.fonts.check()`
 * returns *true* for every one of these. It answers "is a face matching this
 * family loaded and usable" — a LOAD-STATUS question — not "does that face
 * contain a glyph for this codepoint". The reliable probe is metric: render the
 * character in the brand family alone and compare its advance width against a
 * private-use codepoint no font has. Both measured exactly 24.00px at 40px, i.e.
 * the same `.notdef` box. (Comparing against `serif`/`monospace` is not enough on
 * a container image where both generics resolve to the same physical font.)
 *
 * Note which characters were CLEARED by that probe and deliberately left as text:
 * `≤` `€` `•` `—` `·` `…` all fall outside Noto's subsets too, but the fallback
 * font does have them, so they render — as real typography, with real kerning.
 * Replacing those with SVG would be worse, not better.
 *
 * Why SVG and not an icon font or an emoji: these marks are drawings, not
 * language. An SVG always renders, is unaffected by subsetting, and inherits
 * `currentColor` — so a tick inside a green chip and a tick inside an amber one
 * pick up their tone automatically, with no per-context colour rule. It also
 * keeps the accessibility story honest: every instance is `aria-hidden`, because
 * each one sits beside a real text label ("Complete", "Resolve") that carries the
 * meaning. Per the dataviz rule, the symbol is a secondary cue and never the sole
 * carrier of state.
 *
 * Sizing follows the text it sits in: the default `1em` box scales with
 * `font-size`, so a glyph in an 8.5px chip and one in a 13px button both stay in
 * proportion without a bespoke rule for each call site.
 */

/** The symbols available. Each name says what it MEANS, not what it looks like. */
export type GlyphName =
  /** Flow/consequence: "this becomes that", "go to". Replaces `→`. */
  | 'arrow-right'
  /** A nested consequence, indented under its cause. Replaces `↳`. */
  | 'arrow-branch'
  /** Increase. Paired with a text delta, never alone. Replaces `▲`. */
  | 'tri-up'
  /** Decrease. Paired with a text delta, never alone. Replaces `▼`. */
  | 'tri-down'
  /** Done / criterion met. Always beside its label. Replaces `✓`. */
  | 'check'
  /** Dismiss. Only ever on a button that also has an accessible name. Replaces `✕`. */
  | 'close'
  /** In progress — a filled pip. Replaces `●`. */
  | 'dot'
  /** A milestone marker. Replaces the `◆` in `.ms-chip::before`. */
  | 'diamond'
  /** "Held by a person" / more-actions affordance. Replaces `⋮`. */
  | 'kebab';

interface GlyphProps {
  name: GlyphName;
  /**
   * Extra classes. The glyph inherits colour from its parent, so a caller
   * normally needs nothing here.
   */
  className?: string;
}

/*
 * All paths are drawn in one 12×12 box so every symbol shares an optical weight
 * and baseline. Strokes use round caps/joins to match Noto Sans' terminals;
 * solid shapes are filled so they read at 8px as well as at 16px.
 */
const PATHS: Record<GlyphName, React.ReactNode> = {
  'arrow-right': (
    <path
      d="M1.6 6h8.2M6.6 2.9 9.9 6l-3.3 3.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'arrow-branch': (
    <path
      d="M3 1.4v5.3a1.5 1.5 0 0 0 1.5 1.5h5M7 5.9l3 2.3-3 2.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'tri-up': <polygon points="6,2 10.6,9.6 1.4,9.6" fill="currentColor" />,
  'tri-down': <polygon points="6,10 1.4,2.4 10.6,2.4" fill="currentColor" />,
  check: (
    <path
      d="M1.9 6.4 4.5 9l5.6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  close: (
    <path
      d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  ),
  dot: <circle cx="6" cy="6" r="3.1" fill="currentColor" />,
  diamond: <polygon points="6,1.6 10.4,6 6,10.4 1.6,6" fill="currentColor" />,
  kebab: (
    <g fill="currentColor">
      <circle cx="6" cy="2.1" r="1.25" />
      <circle cx="6" cy="6" r="1.25" />
      <circle cx="6" cy="9.9" r="1.25" />
    </g>
  ),
};

/**
 * Renders one brand symbol.
 *
 * Always decorative: `aria-hidden` and `focusable="false"` keep it out of the
 * accessibility tree and out of the tab order (the latter matters in IE/Edge
 * legacy, where SVG is focusable by default). Callers must keep the adjacent
 * text label that carries the meaning.
 */
export default function Glyph({ name, className }: GlyphProps) {
  return (
    <svg
      className={className ? `gly ${className}` : 'gly'}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
