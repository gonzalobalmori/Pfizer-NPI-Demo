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
 * The micro-chart inside a KPI card: the REAL distribution behind the headline
 * number, one bar per underlying record.
 *
 * Why this exists (R-BASE-03). The cards previously drew an SVG `<polyline>`
 * with hard-coded coordinates — an invented seven-point trend that no backend
 * field fed and that changed meaning with no data behind it. There is no history
 * series on these KPIs to plot, so a "trend" could not be made honest; but every
 * KPI does return its own breakdown (`gateReadiness.byLaunch`,
 * `scheduleDiscipline.byGate`, `revenueExposed.byLaunch`). Plotting that turns
 * the decoration into information: the headline is an average or a total, and
 * this shows the spread it hides — which launch drags gate readiness down, how
 * concentrated the revenue exposure is, whether one gate owns all the slip.
 *
 * Reading it: bars are ordered worst-first (left to right) and a bar is tinted to
 * the at-risk tone only when it crosses a threshold the backend actually supplies
 * (`target`). No threshold is invented here — a KPI with no target renders every
 * bar in the neutral series tone.
 *
 * Bar height is **shortfall, not value** — see {@link KpiDistributionProps.invert}.
 * The three cockpit cards do not measure the same direction: exposure (€M) and
 * slip (days) are quantities of BADNESS, so a bigger number is a worse number and
 * height can be the value itself. Gate readiness is a percentage of GOODNESS,
 * where 100% is perfect. Plotting readiness as height made the card read
 * backwards: the launches in trouble drew the shortest bars while the healthy ones
 * towered over them, so the eye was drawn to the launches that were fine. Three
 * cards side by side with two opposite conventions is worse than either — so a
 * "higher is better" measure is inverted to plot its distance below target, and
 * every card then obeys one rule: TALLER IS WORSE.
 *
 * Accessibility: tone never carries meaning alone (the verified red/amber
 * colour-blind limit — see the status block in `prototype.css`). Each bar has a
 * `<title>`, so hovering names the record and its value, and the breach count is
 * stated in words in the card footer.
 */

/** One underlying record behind a KPI headline. */
export interface KpiDatum {
  /** The record's own name — shown on hover, never rendered as an axis label. */
  label: string;
  /** The measured value. Bar height is proportional to this. */
  value: number;
  /** Pre-formatted value for the tooltip (keeps unit/precision with the caller). */
  display: string;
}

interface KpiDistributionProps {
  data: KpiDatum[];
  /**
   * Threshold from the backend (never invented). A bar is tinted at-risk when it
   * is on the wrong side of this — see {@link KpiDistributionProps.breach}.
   */
  threshold?: number;
  /** Which side of `threshold` counts as bad. */
  breach?: 'above' | 'below';
  /** What one bar represents, e.g. "launch" — used in the accessible summary. */
  unitNoun: string;
  /**
   * Set for a "higher is better" measure (e.g. % readiness), so bar height plots
   * the SHORTFALL from `invert` rather than the value. With `invert={100}`, a
   * launch at 100% draws nothing and one at 40% draws a tall bar — keeping the
   * "taller is worse" rule consistent with the sibling cards. Requires
   * `threshold`/`breach` to stay meaningful, which are still evaluated against the
   * TRUE value, never the inverted height.
   */
  invert?: number;
}

const VB_W = 84;
const VB_H = 30;
const GAP = 2; // 2px surface gap between adjacent fills (dataviz mark spec)

/** English plural for the handful of nouns this component is given. */
function plural(noun: string): string {
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export default function KpiDistribution({
  data,
  threshold,
  breach,
  unitNoun,
  invert,
}: KpiDistributionProps) {
  if (data.length === 0) return null;

  /* Height plots shortfall when inverted, the value itself otherwise — so every
     card reads "taller is worse". Clamped at 0 so a record that BEATS the
     reference draws nothing rather than a bar growing the wrong way. */
  const plotted = (v: number) => (invert == null ? Math.abs(v) : Math.max(0, invert - v));
  const max = Math.max(...data.map((d) => plotted(d.value)), 1);
  const slot = VB_W / data.length;
  const barW = Math.max(2, slot - GAP);

  /* Evaluated against the TRUE value, never the plotted height. */
  const isBreach = (v: number) =>
    threshold == null || breach == null ? false : breach === 'above' ? v > threshold : v < threshold;

  const breaches = data.filter((d) => isBreach(d.value)).length;
  /* Plural via an explicit form, not `+ 's'` — "9 launchs" shipped once already. */
  const n = `${data.length} ${data.length === 1 ? unitNoun : plural(unitNoun)}`;
  /* Says what the bars MEAN, since for an inverted measure the height is a gap
     rather than the value — a screen-reader user would otherwise be told the
     opposite of what the bars show. */
  const what = invert == null ? `Distribution across ${n}` : `Shortfall from ${invert} across ${n}`;
  const summary =
    breaches > 0
      ? `${what}; ${breaches} ${breaches === 1 ? 'is' : 'are'} ${breach === 'below' ? 'under' : 'over'} the ${threshold} target.`
      : `${what}.`;

  return (
    <svg className="spark" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={summary}>
      {data.map((d, i) => {
        /* Floor the height at 2px so a real-but-tiny value still shows a mark —
           a zero-height bar would read as "no record" rather than "near zero". */
        const h = Math.max(2, (plotted(d.value) / max) * VB_H);
        return (
          <rect
            key={`${d.label}-${i}`}
            x={i * slot}
            y={VB_H - h}
            width={barW}
            height={h}
            rx={1.5}
            className={isBreach(d.value) ? 'sb a' : 'sb'}
          >
            <title>{`${d.label} — ${d.display}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
