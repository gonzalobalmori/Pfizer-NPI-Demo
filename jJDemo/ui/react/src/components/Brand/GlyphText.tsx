/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import Glyph, { type GlyphName } from '@/components/Brand/Glyph';

/**
 * Renders a backend-supplied string, swapping any codepoint that has no glyph in
 * the Noto Sans subsets for the drawn {@link Glyph} that means the same thing.
 *
 * Why this exists, and why it is NOT a data fix. `Glyph.tsx` established that
 * nine codepoints render as the browser's `.notdef` box ("tofu") in the brand
 * font. The view layer had already been cleaned of them — `LaunchView` builds its
 * baseline→forecast change as a node so the arrow can be `<Glyph
 * name="arrow-right" />`, and `IssueView` draws a dot for the no-name avatar. But
 * a static sweep of `.ts`/`.tsx` reports that as clean and *still misses live
 * tofu*, because the remaining instances never appear in source: they arrive in
 * prose from the backend. Two `Escalation.progressSummary` values and one
 * `CopilotPrompt` handoff subtitle carry U+2192, and they were rendering as boxes
 * on screen — "Raised □ accepted □ both scenarios prepared by the agent".
 *
 * The arrow is the RIGHT character for that text: the summary really is a ladder
 * of states, and `→` is how "this becomes that" is written. The defect is the font
 * subset, not the data. Stripping the arrows out of seed JSON would flatten real
 * structure into comma soup and would have to be re-done for every future string
 * an author writes, in every type, forever. So the substitution happens once, at
 * the point of render, and authors can keep writing ordinary prose.
 *
 * Three call sites needed this, which is exactly the number that produced the
 * four-hand-copied-status-dots problem this redesign already had to undo (see
 * `MlDot.tsx`). Hence one component rather than three bespoke `.split()` calls.
 *
 * Accessibility. `Glyph` is `aria-hidden` by design, because every other caller
 * pairs it with a visible text label that carries the meaning. Here there is no
 * such label — the arrow IS a word in the sentence, so hiding it would hand a
 * screen reader "Raised accepted both scenarios prepared", silently welding two
 * ladder rungs together. Each substituted glyph therefore ships with an adjacent
 * screen-reader-only word (`.sr-t`), so the accessible name reads "Raised then
 * accepted then …" while sighted users see the drawn arrow.
 */

/**
 * Codepoint → the glyph that replaces it, plus the word a screen reader hears.
 *
 * Only characters that MEASURED as `.notdef` belong here. `Glyph.tsx` records the
 * ones deliberately left as text — `≤ € • — · …` are outside Noto's subsets too,
 * but the fallback font has them, so they render as real typography with real
 * kerning. Adding them here would make the output worse.
 */
const SUBSTITUTIONS: Record<string, { glyph: GlyphName; word: string }> = {
  '→': { glyph: 'arrow-right', word: 'then' }, // →
  '↳': { glyph: 'arrow-branch', word: 'which leads to' }, // ↳
  '▲': { glyph: 'tri-up', word: 'up' }, // ▲
  '▼': { glyph: 'tri-down', word: 'down' }, // ▼
  '✓': { glyph: 'check', word: 'done' }, // ✓
  '✕': { glyph: 'close', word: 'no' }, // ✕
  '◆': { glyph: 'diamond', word: 'milestone' }, // ◆
  '●': { glyph: 'dot', word: 'in progress' }, // ●
  '⋮': { glyph: 'kebab', word: 'more' }, // ⋮
};

/*
 * Both built from the table so they can never disagree.
 *
 * TWO regexes, deliberately. `SPLIT_RE` needs the `g` flag for `String.split` to
 * keep every delimiter, but a `g`-flagged regex carries `lastIndex` state across
 * `.test()` calls — so testing with it would return true, then false, then true
 * for the same string, and the arrows would appear and vanish between renders.
 * `String.split` ignores `lastIndex`; `.test` does not. Hence a separate
 * un-flagged `HAS_RE` for the check. Do not merge these two.
 */
const CHARS = Object.keys(SUBSTITUTIONS).join('');
const HAS_RE = new RegExp(`[${CHARS}]`);
const SPLIT_RE = new RegExp(`([${CHARS}])`, 'g');

interface GlyphTextProps {
  /** The backend string. `null`/`undefined` render as nothing, not as "null". */
  text: string | null | undefined;
  /** Size class passed through to each substituted glyph, e.g. `"sm"`. */
  glyphClassName?: string;
}

/**
 * Splits `text` on the tofu codepoints and interleaves drawn glyphs.
 *
 * The common case — a string with no tofu at all — returns the string unchanged
 * and allocates no nodes, so this is safe to wrap around any backend prose
 * whether or not it happens to contain a symbol today. That matters more than it
 * sounds: the whole reason the arrows shipped is that nobody can tell by looking
 * at a seed file whether its text will render.
 */
export default function GlyphText({ text, glyphClassName = 'sm' }: GlyphTextProps) {
  if (!text) return null;
  if (!HAS_RE.test(text)) return <>{text}</>;

  /* `split` with a capturing group keeps the delimiters, so the parts alternate
     text / symbol / text and the original spacing around each symbol survives. */
  const parts = text.split(SPLIT_RE);
  return (
    <>
      {parts.map((part, i) => {
        const sub = SUBSTITUTIONS[part];
        if (!sub) return part;
        return (
          <React.Fragment key={i}>
            <Glyph name={sub.glyph} className={glyphClassName} />
            <span className="sr-t">{` ${sub.word} `}</span>
          </React.Fragment>
        );
      })}
    </>
  );
}
