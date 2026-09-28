/*
 * Guided demo (#gdp) — the presenter's autopilot. Each step DRIVES the app
 * itself, so the presenter only ever presses Next: the step publishes a
 * DriveTarget through the nav model's drive(), the destination view lands on the
 * exact pane/lens/step it names, and the spotlight then highlights real DOM nodes
 * by selector — retried until the (async, c3Action-fed) view has rendered them —
 * with floating labels that track the boxes as the page scrolls.
 *
 * There are exactly TWO demos, one per scenario this demo is configured around.
 * They are chosen from a small picker overlay when the "Guided demo" button is
 * pressed (the button dispatches `gd:open`; picking a demo dispatches `gd:start`
 * carrying its id):
 *
 *   • Demo 1 — QUALITY DISRUPTION. A launch batch is placed on hold after visual
 *     inspection identifies a stopper-related defect. Determine the scope,
 *     evaluate recovery and supply options, protect priority markets, make the
 *     Quality and launch decisions, and coordinate the approved response.
 *
 *   • Demo 2 — DEMAND AND MARKET-WAVE CHANGE. Eight weeks before packaging,
 *     Commercial increases demand for a priority market and changes the pack mix.
 *     Supply, site and CMO capacity, packaging components and logistics cannot
 *     support every market as planned. Compare a constrained launch, inventory
 *     reallocation, added capacity and market-wave resequencing; make a governed
 *     decision; and update all affected plans, owners, sites, partners and market
 *     commitments.
 *
 * Both walk the same shape — frame the disruption on the cockpit, work the
 * scenario screen end to end, then show where the result landed — because that is
 * the shape of the work. Each is self-contained: one on its own tells a whole
 * story, and the two together are the whole demo.
 *
 * THE NUMBERS IN THIS COPY ARE NOT DECORATIVE. Every figure quoted below was read
 * back from the live services (QualityDisruptionService / MarketWaveService) with
 * the scenario at its seeded baseline. If a service or its data changes, these
 * strings must be re-read from the app rather than adjusted by eye — a tour that
 * narrates one number while the screen behind it shows another is worse than no
 * tour at all.
 *
 * A step whose `target` carries `qualityStep` / `waveStep` asks the view to have
 * already REACHED that step when the tour lands, so a stop about the options table
 * does not open on an empty one. The views advance the backend stage to get there
 * and never step past it: the decision and the commit always stay a deliberate
 * click, made on camera.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNav, type DriveTarget } from '@/nav/NavContext';
import Glyph from '@/components/Brand/Glyph';

type Spot = [selector: string, label: string];

interface Step {
  /** panel title (may contain inline HTML). */
  t: string;
  /** the paragraph (inline HTML). */
  p: string;
  /** the presenter aside (inline HTML). Optional — omitted steps render no aside. */
  say?: string;
  /** where the step drives the app; null keeps the current view (sub-steps). */
  target: DriveTarget | null;
  /** [selector, label] pairs to spotlight. */
  spot: Spot[];
  /** whether to scroll the first target into view. */
  scroll?: boolean;
}

/** One selectable demo: its menu copy, the chip shown in the panel header, and
 *  its ordered step array. */
interface Demo {
  id: string;
  /** short title in the picker + the panel header chip. */
  chip: string;
  /** picker card title. */
  title: string;
  /** picker card one-liner. */
  blurb: string;
  steps: Step[];
}

/* ── Demo 1 — quality disruption: a stopper defect holds a launch batch ──
 *
 * Scenario 1, clause by clause. The five spec clauses map onto steps 3–9 below;
 * the first two frame it from the portfolio so the batch hold arrives as
 * something the business already felt, and the last two show that the decision
 * actually landed somewhere.
 *
 * Live figures, read back from QualityDisruptionService at baseline:
 *   scope           4 batches · 612,000 doses · 8 markets · €29.4M at risk
 *   suspect lot     WPS-26-4471, 13mm FluroTec-coated lyophilisation stopper,
 *                   West Pharmaceutical Services, single source,
 *                   1,240 ppm against a 500 ppm action limit, 214,000 units left
 *   released        96,000 doses already shipped from the suspect lot → recall
 *                   assessment required
 *   clean stock     190,000 doses against 802,000 committed
 *   options         rework RULED OUT (container-closure integrity) ·
 *                   reject-and-refill 59.6 (85 days) ·
 *                   alternate closure RULED OUT (Type II variation, 90 days) ·
 *                   partial release 70.4 RECOMMENDED (12 days)
 *   under partial   530,000 served · US/DE/JP whole · UK constrained to 2,000 ·
 *                   FR/IT/ES/AU deferred · ready 21 Sep 2026 · €11.95M forgone
 *   coordination    5 Release / 2 Reject dispositions · CAPA-26-0114 · 8 actions
 */
const GD_QUALITY: Step[] = [
  {
    t: 'A batch hold is a portfolio event',
    p:
      'Start where the launch leadership starts. Gate readiness, the launches at risk, and the ' +
      'money exposed &mdash; one screening pass over nine Biopharma launches. Nothing here says ' +
      '&ldquo;stopper defect&rdquo; yet, and that is the point: a defect found at visual inspection ' +
      'on one filling line arrives as <b>revenue at risk and markets in doubt</b>, not as a lab ' +
      'result.',
    say:
      'Set the altitude first. In the next ten minutes we go from this screen to a signed Quality ' +
      'decision and a coordinated response &mdash; without leaving the platform.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [
      ['#v-cockpit .kc:nth-child(2)', 'which launches are at risk'],
      ['#v-cockpit .kc:nth-child(3)', 'and what it is worth'],
    ],
  },
  {
    t: 'The disruption, on its own screen',
    p:
      '<b>DEV-26-0881</b> &mdash; a deviation raised at <b>Kalamazoo</b> on the <b>Berobenatide T2D</b> ' +
      'launch. Visual inspection found a <b>stopper-related defect</b>, and the batch is on hold. ' +
      'The rail across the top is the whole governed sequence: <b>scope</b>, <b>options</b>, ' +
      '<b>markets</b>, <b>decision</b>, <b>coordinate</b>. Every step is a real service call ' +
      'against real records &mdash; nothing on this screen is staged.',
    say:
      'This screen is Scenario 1 in five steps. I will run them in order, and each one will change ' +
      'the numbers underneath it.',
    target: { branch: 'pipeline', view: 'quality' },
    scroll: false,
    spot: [
      ['#v-quality .sr-steps', 'five governed steps, in the order the work happens'],
      ['#q-defect', 'what the inspector actually found'],
    ],
  },
  {
    t: 'Step 1 — determine the scope',
    p:
      'The defect is not the batch, it is the <b>lot</b>. Lot <b>WPS-26-4471</b> &mdash; a 13mm ' +
      'FluroTec-coated lyophilisation stopper from <b>West Pharmaceutical Services</b>, ' +
      '<b>single-sourced</b> &mdash; tested at <b>1,240 ppm</b> against a <b>500 ppm</b> action ' +
      'limit. So the sweep is: every batch filled from that lot. The answer is <b>4 batches, ' +
      '612,000 doses, 8 markets, &euro;29.4M at risk</b>.',
    say:
      'This is the difference between a deviation and a disruption. One batch failed inspection; ' +
      'four batches share its cause. The platform finds the other three because it knows which lot ' +
      'each batch was filled from.',
    target: { branch: 'pipeline', view: 'quality', qualityStep: 1 },
    spot: [
      ['#q-scope .sc-grid', '4 batches &middot; 612,000 doses &middot; 8 markets &middot; &euro;29.4M'],
      ['#q-defect .sc-dl', 'lot WPS-26-4471 &middot; single source &middot; 1,240 ppm'],
    ],
  },
  {
    t: 'And two things escalate on their own',
    p:
      '<b>96,000 doses from the suspect lot are already released to market</b> &mdash; so this is ' +
      'no longer only a hold, it is a <b>recall assessment</b>, and the platform says so without ' +
      'being asked. Underneath it, the supply arithmetic: <b>190,000 doses of clean stock against ' +
      '802,000 committed</b>. Clean stock alone keeps <b>none</b> of the eight markets whole.',
    say:
      'Two escalations nobody had to remember. The recall trigger is a fact about released stock, ' +
      'and the supply gap is a fact about the order book &mdash; both computed, neither typed in.',
    target: null,
    spot: [['#q-scope .sc-esc', 'recall assessment &middot; and the supply gap underneath it']],
  },
  {
    t: 'Step 2 — evaluate recovery and supply options',
    p:
      'Four options, scored on the same axes so they are actually comparable: doses served, doses ' +
      'lost, days, cost, markets kept whole. <b>Two are ruled out on the data, not on opinion.</b> ' +
      'Rework fails <b>container-closure integrity</b> &mdash; a lyophilised vial cannot be ' +
      'de-stoppered and re-stoppered. An alternate closure needs a <b>Type II variation, 90 days</b>, ' +
      'which lands after the earliest committed ship date.',
    say:
      'Note what the ruled-out cards do. They are not hidden and not ranked last &mdash; they are ' +
      'struck, with the constraint that kills them written on the card. That is the auditable ' +
      'part: we can show why we did not do the obvious thing.',
    target: { branch: 'pipeline', view: 'quality', qualityStep: 2 },
    spot: [
      ['#q-options .oc-grid', 'four options, one scale'],
      ['#q-options .oc.out', 'ruled out &mdash; and the reason is on the card'],
      ['#q-options .oc.rec', 'recommended &middot; 70.4 / 100'],
    ],
  },
  {
    t: 'Two real options, and the trade they represent',
    p:
      '<b>Reject and refill</b> scores <b>59.6</b>: it serves the most doses &mdash; 634,000 ' +
      '&mdash; but it takes <b>85 days</b>, and the tender windows do not wait 85 days. ' +
      '<b>Partial release</b> scores <b>70.4</b>: fewer doses, <b>12 days</b>. The recommendation ' +
      'is not the option that serves the most product; it is the option that <b>protects the most ' +
      'priority market inside the clock</b>.',
    say:
      'This is the sentence the room needs to hear: the score is advisory and the clock is what ' +
      'ranks these. A person still signs, and they can sign against the recommendation.',
    target: null,
    spot: [
      ['#q-options .oc:nth-child(2)', '634,000 doses &mdash; but 85 days'],
      ['#q-options .oc.rec', '530,000 doses in 12 days'],
    ],
  },
  {
    t: 'Step 3 — protect the priority markets',
    p:
      'Press <b>Preview this plan</b> on the recommended card. The allocation runs in priority ' +
      'order against the doses that option actually frees: <b>US, Germany and Japan stay whole</b>; ' +
      '<b>the UK is constrained to 2,000 doses</b>; <b>France, Italy, Spain and Australia are ' +
      'deferred</b>. Stock ready <b>21 September</b>, <b>&euro;11.95M</b> of revenue forgone.',
    say:
      'Press Preview on the recommended card, then come back and press Next. Watch the market ' +
      'table rewrite itself &mdash; and watch the regulatory body on each row. FDA, G-BA, PMDA, ' +
      'MHRA. This is who has to be told, market by market.',
    target: { branch: 'pipeline', view: 'quality', qualityStep: 2 },
    spot: [
      ['#q-options .oc.rec .oc-a', 'press Preview here, then Next'],
      ['#q-markets', 'the markets, in priority order'],
    ],
  },
  {
    t: 'Step 4 — make the Quality decision',
    p:
      'The decision is <b>Approve &mdash; Quality Council</b> on the option in front of us. Two ' +
      'guardrails are enforced by the service, not by the screen: <b>an option ruled out on the ' +
      'data cannot be approved at all</b>, and <b>the signer must hold the Quality function</b>. ' +
      'The signature is <b>21 CFR Part 11</b> &mdash; attributable, reason-coded, and hashed ' +
      'against the exact plan it approves.',
    say:
      'Press Approve on the recommended card, then press Next. The allocation is committed and ' +
      'signed in one move on purpose &mdash; so the market commitments and the signature describe ' +
      'the same plan, and cannot drift apart.',
    target: null,
    spot: [['#q-options .oc.rec .oc-dec', 'press Approve, then Next']],
  },
  {
    t: 'Step 5 — coordinate the approved response',
    p:
      'This is the clause most demos skip: a decision that lands nowhere is not a decision. ' +
      'Coordinating writes it into the record &mdash; <b>every batch dispositioned</b> (the two ' +
      'over the 500 ppm action limit, at <b>1,180</b> and <b>1,640 ppm</b>, are rejected; the rest ' +
      'released), <b>CAPA-26-0114</b> raised against the root cause, and <b>8 owned actions</b> ' +
      'issued across Quality, Supply Chain, Regulatory, Commercial, Market Access and Logistics ' +
      '&mdash; each with a named owner and a due date.',
    say:
      'Press &ldquo;Coordinate the response&rdquo;, then Next. Then look at the disposition column: ' +
      'the platform did not release everything it could have. It rejected exactly the two batches ' +
      'that failed on their own merits.',
    target: { branch: 'pipeline', view: 'quality' },
    spot: [
      ['#sr-run', 'press this, then Next'],
      ['#q-decision', 'the signed record &middot; CAPA &middot; the owned actions'],
    ],
  },
  {
    t: 'What the decision left behind',
    p:
      'The batch table is now dispositioned end to end &mdash; and the two rejections are the two ' +
      'batches that exceeded the action limit on their own inspection result, not merely the two ' +
      'that shared a lot. <b>The hold was scoped by cause; the disposition was decided by ' +
      'evidence.</b> Both are recorded, and both are defensible to an inspector.',
    say:
      'This is the screen a regulator asks for: what did you hold, what did you release, and on ' +
      'what basis for each one.',
    target: null,
    spot: [['#q-batches', 'held by lot &middot; dispositioned by result']],
  },
  {
    t: 'And it is a decision she can account for',
    p:
      'Every decision a person took, with its outcome &mdash; and this one is now on it. The ' +
      'Quality signature, the option approved, the markets it protected and the ones it did not. ' +
      'Separate from what the agents did on their own, on purpose.',
    say:
      'Two records, one for the person and one for the fleet, and they reconcile. Press Finish to ' +
      'return to the menu &mdash; and if you are handing over to another presenter, press ' +
      '&ldquo;Reset scenario&rdquo; on the quality screen first.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'history' },
    spot: [['#v-actions .sb-p.on .hb', 'her decisions, with their outcomes']],
  },
];

/* ── Demo 2 — demand and market-wave change ─────────────────────────────
 *
 * Scenario 2, clause by clause: the uplift and the pack-mix change, the four
 * constraint families that cannot all be satisfied, the four named options, the
 * governed decision, and the commit that rewrites every affected plan.
 *
 * Live figures, read back from MarketWaveService at baseline:
 *   request         DCR-26-0067 · Berobenatide OB · T. Bergmann (Commercial) ·
 *                   420,000 → 690,000 doses (+270,000, +64.3%) · €7M at stake
 *   pack mix        6-dose multi-dose vial (BER-DE-MDV-6)
 *                   → 1-dose prefilled syringe (BER-DE-PFS-1)
 *   clock           56 days = 8.0 weeks of runway before packaging starts 4 Nov
 *   binds first     BD 1mL long prefillable glass syringe, staked needle —
 *                   84-day lead time against a 56-day runway, so only 15,000 of
 *                   690,000 doses are servable as prefilled syringe
 *   the gap         200,000 of the uplift servable · 70,000 short ·
 *                   8,750/week · €0.76 marginal conversion per dose
 *   internal        fill headroom 3,120,000 but pack headroom only 200,000 —
 *                   packaging, not filling, is the bottleneck
 *   components      support 641,871 doses; the German-language 6-dose carton
 *                   binds, 675,000 units short
 *   cold chain      1,450,000 doses on 1,100 free ultra-cold shippers — not binding
 *   options         constrained 82.3 · reallocation 83.2 · add capacity 90.5 ·
 *                   wave resequencing 91.2 RECOMMENDED
 *   under resequence  DE takes 690,000 (270,000 of 270,000 served, 0 short) ·
 *                   8 markets whole, 1 changed · 0 tenders breached ·
 *                   max slip 14 days · €7M incremental for €205k added cost ·
 *                   IT moves Wave 2 → Wave 3, first ship 4 Jan 2027 (+14 days)
 */
const GD_WAVE: Step[] = [
  {
    t: 'Eight weeks before packaging',
    p:
      'Same cockpit, a different kind of shock. Nothing has broken: <b>Commercial has won more ' +
      'demand</b>. <b>DCR-26-0067</b> on the <b>Berobenatide OB</b> launch &mdash; Germany wants ' +
      '<b>690,000 doses instead of 420,000</b>, and wants them in a <b>different presentation</b>. ' +
      'The request arrives <b>eight weeks before packaging starts</b>.',
    say:
      'Start here so the room understands the class of problem. This is not a failure to recover ' +
      'from. It is an opportunity the supply chain cannot absorb as planned &mdash; which is harder, ' +
      'because saying no has a price too.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [['#v-cockpit .kc:nth-child(3)', 'the money already committed across the portfolio']],
  },
  {
    t: 'What Commercial is actually asking for',
    p:
      '<b>+270,000 doses, +64.3%</b>, worth <b>&euro;7M</b>. And the part that makes it hard: the ' +
      'pack mix changes too &mdash; from the <b>6-dose multi-dose vial</b> (BER-DE-MDV-6) to the ' +
      '<b>1-dose prefilled syringe</b> (BER-DE-PFS-1). That is not a bigger version of the same ' +
      'plan. It is <b>different components, a different fill line and a different carton</b>.',
    say:
      'Two changes in one request, and the second one is the expensive one. More doses is a capacity ' +
      'question. A different presentation is a qualification-and-components question.',
    target: { branch: 'pipeline', view: 'wave' },
    scroll: false,
    spot: [
      ['#v-wave .sr-steps', 'the same five governed steps'],
      ['#w-ask', '+270,000 doses &mdash; and the pack mix changes'],
    ],
  },
  {
    t: 'Step 1 — assess every constraint at once',
    p:
      'The runway is <b>56 days &mdash; 8.0 weeks</b>. Against that clock the platform tests ' +
      'internal fill and packaging headroom, every CMO and packaging-partner lane including whether ' +
      'it is <b>qualified in time</b>, every packaging component against its <b>lead time</b>, and ' +
      'the cold-chain shippers. Four constraint families, one pass.',
    say:
      'Watch what this step does not do. It does not ask which constraint to check. It checks all of ' +
      'them and then tells us which one binds &mdash; which is the only question that matters.',
    target: { branch: 'pipeline', view: 'wave', waveStep: 1 },
    spot: [['#w-constraints', 'four constraint families, tested against one clock']],
  },
  {
    t: 'And here is what binds first',
    p:
      'Not capacity. <b>A component lead time.</b> The <b>1mL long prefillable glass syringe with ' +
      'staked needle</b> from <b>Becton Dickinson</b> has an <b>84-day lead time against a 56-day ' +
      'runway</b> &mdash; so only <b>15,000</b> of the requested 690,000 doses can be served as ' +
      'prefilled syringe. <b>No amount of money shortens that</b>, which is why it outranks every ' +
      'capacity gap underneath it.',
    say:
      'This is the single most important frame in the scenario. A capacity gap is a budget problem ' +
      'you can buy your way out of. A lead time longer than your runway is arithmetic. The platform ' +
      'ranks them in that order deliberately.',
    target: null,
    spot: [
      ['#w-constraints .sc-bind', '84-day lead time against a 56-day runway'],
      ['#w-components', 'every component, against its own lead time'],
    ],
  },
  {
    t: 'The gap, and the bottleneck nobody expected',
    p:
      '<b>200,000 of the uplift is servable; 70,000 doses are short</b> &mdash; a gap of ' +
      '<b>8,750 a week</b> at a marginal conversion cost of <b>&euro;0.76 a dose</b>. And note ' +
      'which internal constraint binds: <b>fill headroom is 3,120,000 doses but packaging headroom ' +
      'is only 200,000</b>. <b>Packaging, not filling, is the bottleneck</b> &mdash; the opposite ' +
      'of where most people look first.',
    say:
      'Cold chain supports 1,450,000 doses on 1,100 free ultra-cold shippers, so logistics is not ' +
      'binding here &mdash; and the platform says so rather than staying silent. A constraint that ' +
      'is fine is worth showing.',
    target: null,
    spot: [
      ['#w-constraints .sc-grid', '200,000 servable &middot; 70,000 short'],
      ['#w-constraints .sc-esc', 'packaging binds, not filling &middot; cold chain is fine'],
    ],
  },
  {
    t: 'The five lanes, including the one that is not qualified',
    p:
      'Every lane that could carry this, internal and external: <b>Baxter Halle</b> and ' +
      '<b>Thermo Fisher Patheon</b> as CMOs, and Pfizer <b>Puurs</b> lines 4 and 7 plus its ' +
      'secondary packaging hall. The interesting row is <b>Patheon Ferentino contract pack line 3</b>: ' +
      'capacity is there, but it is <b>Unqualified &mdash; 42 days to qualify and a regulatory ' +
      'variation required</b>. So it is capacity we cannot legally use in this window.',
    say:
      'This is the distinction that separates a real plan from a spreadsheet. Capacity that exists is ' +
      'not capacity you may use. Qualification status and the variation are part of the number.',
    target: null,
    spot: [['#w-lanes', 'capacity that exists &ne; capacity you may use']],
  },
  {
    t: 'Step 2 — compare the four options the spec names',
    p:
      'Exactly the four the business asks for: <b>constrained launch</b> (82.3), <b>inventory ' +
      'reallocation</b> (83.2), <b>added capacity</b> (90.5), and <b>market-wave resequencing</b> ' +
      '(<b>91.2, recommended</b>). All four are executable inside the 56-day runway, so this is a ' +
      'genuine choice rather than a single survivor &mdash; and they are scored on <b>the change ' +
      'each one creates</b>, not on the book it inherits.',
    say:
      'Four live options within nine points of each other. That is what makes this a decision worth ' +
      'governing: there is no obviously right answer, so the reasoning has to be recorded.',
    target: { branch: 'pipeline', view: 'wave', waveStep: 2 },
    spot: [
      ['#w-options .oc-grid', 'four options, all executable, nine points apart'],
      ['#w-options .oc.rec', 'recommended &middot; 91.2 / 100'],
    ],
  },
  {
    t: 'Step 3 — project the book before anyone signs',
    p:
      'Press <b>Preview this plan</b> on the recommended card. Resequencing serves ' +
      '<b>270,000 of the 270,000 doses requested &mdash; nothing short</b> &mdash; by moving ' +
      '<b>Italy from Wave 2 to Wave 3</b>, first ship <b>4 January 2027, +14 days</b>. ' +
      '<b>8 markets stay whole, 1 changes, and zero tender windows are breached.</b> ' +
      '<b>&euro;7M</b> of incremental revenue for <b>&euro;205k</b> of added cost.',
    say:
      'Press Preview, then come back and press Next. And watch the &ldquo;in contested window&rdquo; ' +
      'note: only the Wave 1 and Wave 2 markets carry it. The Wave 3 markets are not competing for ' +
      'the same packaging hours, so the platform does not pretend they are.',
    target: null,
    spot: [
      ['#w-options .oc.rec .oc-a', 'press Preview here, then Next'],
      ['#w-book', 'the whole book, market by market'],
    ],
  },
  {
    t: 'Why resequencing beats simply buying capacity',
    p:
      'Adding capacity scores <b>90.5</b> and resequencing <b>91.2</b> &mdash; close, and the ' +
      'reason is instructive. Qualifying Patheon costs money <i>and</i> <b>42 days and a ' +
      'variation</b>. Resequencing costs <b>one market 14 days</b>, breaches <b>no tender</b>, and ' +
      'needs <b>no filing</b>. The platform prefers the option that spends <b>schedule we own</b> ' +
      'over the option that spends <b>regulatory runway we do not</b>.',
    say:
      'If someone in the room disagrees with that trade, they can approve a different card. The ' +
      'score does not lock the decision &mdash; it just makes the comparison honest.',
    target: null,
    spot: [
      ['#w-options .oc:nth-child(3)', 'add capacity &mdash; 42 days and a variation'],
      ['#w-options .oc.rec', 'resequence &mdash; 14 days, no filing'],
    ],
  },
  {
    t: 'Step 4 — a governed decision, and who may take it',
    p:
      'Press <b>Approve &mdash; launch S&amp;OP</b>. The service enforces that the signer holds a ' +
      '<b>Commercial or Governance</b> function, because reallocating doses between markets is a ' +
      'cross-market trade-off, not a Quality call. It is signed by <b>George Hall, Global NPI ' +
      'Lead</b> &mdash; deliberately <b>not</b> T. Bergmann, who raised the request. <b>The market ' +
      'asking for more cannot be the authority that grants it.</b>',
    say:
      'Press Approve, then Next. That separation is the whole governance story in one field: ' +
      'requester and approver are different people, and the platform will not let them be the same.',
    target: null,
    spot: [['#w-options .oc.rec .oc-dec', 'press Approve, then Next']],
  },
  {
    t: 'Step 5 — update every affected plan',
    p:
      'The last clause of the spec, in full: <b>all affected plans, owners, sites, partners and ' +
      'market commitments</b>. Commit rewrites the book &mdash; <b>Germany at 690,000</b>, ' +
      '<b>Italy at Wave 3</b>, the capacity booked on the lanes that will carry it, and the ' +
      'components drawn down. The three rejected options are marked <b>Not taken</b> and kept, ' +
      'because the options you declined are part of the record.',
    say:
      'Press &ldquo;Commit the plan changes&rdquo;, then Next. Commit is idempotent for the ' +
      'commitments but increments the capacity booking once &mdash; so a second press cannot ' +
      'double-book the line. That detail matters more than it sounds in a live demo.',
    target: { branch: 'pipeline', view: 'wave' },
    spot: [
      ['#sr-run', 'press this, then Next'],
      ['#w-decision', 'signed, attributable, reason-coded'],
    ],
  },
  {
    t: 'The book, rewritten',
    p:
      'Germany holds <b>690,000</b>. Italy reads <b>Wave 2 &rarr; Wave 3</b> with ' +
      '<b>+14 days</b>. Every other market is untouched and still reads <b>Committed</b> against ' +
      'its own regulatory body &mdash; G-BA, FDA, MHRA/NICE, HAS/CEPS, AIFA, AEMPS, AOTMiT. ' +
      '<b>One market moved, eight protected, no tender lost, &euro;7M captured.</b>',
    say:
      'That is Scenario 2 end to end. Press Finish to return to the menu &mdash; and press ' +
      '&ldquo;Reset scenario&rdquo; on this screen before you hand over, so the next run starts from ' +
      'the same baseline.',
    target: null,
    spot: [
      ['#w-book tr.res', 'Germany &middot; 690,000'],
      ['#w-book', 'one market moved, eight protected'],
    ],
  },
];

/* ── The demo registry the picker chooses from ────────────────────────── */
const DEMOS: Demo[] = [
  {
    id: 'quality',
    chip: 'QUALITY DISRUPTION',
    title: 'A stopper defect holds a launch batch',
    blurb:
      'Scenario 1. Visual inspection finds a stopper-related defect and a launch batch goes on hold. Scope the lot across 4 batches and €29.4M, rule two recovery options out on the data, protect US, Germany and Japan, sign it under the Quality Council, and coordinate the response.',
    steps: GD_QUALITY,
  },
  {
    id: 'wave',
    chip: 'DEMAND & WAVE CHANGE',
    title: 'Commercial changes the demand and the pack mix',
    blurb:
      'Scenario 2. Eight weeks before packaging, Germany wants +64% and a different presentation. A component lead time binds before any capacity gap; compare a constrained launch, reallocation, added capacity and wave resequencing, then commit the one that captures €7M and breaches no tender.',
    steps: GD_WAVE,
  },
];

const DEFAULT_DEMO = DEMOS[0];

interface Mark {
  el: HTMLElement;
  label: string;
}

/** Open the demo PICKER (press "Guided demo"). The picker then dispatches
 *  `gd:start` with the chosen demo id. */
export function startGuidedTour() {
  window.dispatchEvent(new Event('gd:open'));
}

export default function GuidedTour() {
  const { drive } = useNav();
  const [on, setOn] = useState(false);
  /* the demo picker overlay (shown when "Guided demo" is pressed). */
  const [pick, setPick] = useState(false);
  /* which demo is running; its steps + header chip drive everything below. */
  const [demo, setDemo] = useState<Demo>(DEFAULT_DEMO);
  const [i, setI] = useState(0);
  /* the live step index, so go()/keyboard handlers can advance without running
     a drive() side effect inside a setState updater (which React forbids). */
  const iRef = useRef(0);
  /* the live demo, for the same reason (event handlers close over it). */
  const demoRef = useRef<Demo>(DEFAULT_DEMO);
  const marksRef = useRef<Mark[]>([]);
  const trackTimer = useRef<number | null>(null);
  const spotTimer = useRef<number | null>(null);

  /* remove every spotlight class + clear the floating labels. */
  const clear = useCallback(() => {
    document.querySelectorAll('.gdp-spot').forEach((e) => e.classList.remove('gdp-spot'));
    marksRef.current = [];
    const layer = document.getElementById('gdp-marks');
    if (layer) layer.innerHTML = '';
    /* back to the bottom-right home until the next step decides otherwise */
    document.getElementById('gdp')?.classList.remove('gdp-left');
  }, []);

  /* the callout is pinned bottom-right. If that home would sit on top of a
     spotlighted box (as it does for the P3 tower card on a ~1280px viewport),
     flip it to the left edge so it never hides the rectangle it points at. */
  const reflow = useCallback(() => {
    const panel = document.getElementById('gdp');
    if (!panel) return;
    const boxes = marksRef.current
      .map((m) => m.el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.height > 0);
    if (!boxes.length) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 20;
    const w = panel.offsetWidth || 376;
    const h = panel.offsetHeight || 356;
    const hits = (leftEdge: number) => {
      const pr = { left: leftEdge, right: leftEdge + w, top: vh - margin - h, bottom: vh - margin };
      return boxes.some((b) => b.left < pr.right && b.right > pr.left && b.top < pr.bottom && b.bottom > pr.top);
    };
    const rightHome = vw - margin - w;
    /* prefer the bottom-right home; flip left only when it clears the target */
    const flipLeft = hits(rightHome) && !hits(margin);
    panel.classList.toggle('gdp-left', flipLeft);
  }, []);

  /* place every label near its box, in live page coordinates. HARD RULE: a
     label must never cover readable content that is not its own target. These
     views are dense — rows butt against each other with no gap — so a single
     fixed slot (always-above, or always-below-left) inevitably lands on a
     neighbour's title. Instead we generate several candidate slots around the
     box (above/below × left/right edge) plus in-box corner fallbacks, SCORE each
     by how many sample points fall on foreign content, and keep the best. A slot
     that overlaps only the target box (its own highlighted rectangle, whose band
     under the chip is whitespace) scores zero and is preferred. */
  const place = useCallback(() => {
    const layer = document.getElementById('gdp-marks');
    if (!layer) return;
    const hd = document.querySelector('.hdr');
    const top0 = hd ? hd.getBoundingClientRect().bottom : 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    /* a point in an element's padding band is background, not content. */
    const inContent = (el: Element, x: number, y: number): boolean => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      return x >= r.left + pl && x <= r.right - pr && y >= r.top + pt && y <= r.bottom - pb;
    };

    /* caret-from-point, across engines (Blink/WebKit vs Firefox). Returns the
       text node + offset the point resolves to, or null when the API is absent. */
    type CaretHit = { node: Node; offset: number } | null;
    const docAny = document as unknown as {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const caretAt = (x: number, y: number): CaretHit | 'unsupported' => {
      if (typeof docAny.caretRangeFromPoint === 'function') {
        const r = docAny.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
      }
      if (typeof docAny.caretPositionFromPoint === 'function') {
        const p = docAny.caretPositionFromPoint(x, y);
        return p ? { node: p.offsetNode, offset: p.offset } : null;
      }
      return 'unsupported';
    };

    /* does a viewport point sit over an actual rendered glyph? This is stricter
       than the padding-band test: whitespace between lines is NOT a hit, and —
       crucially — a glyph belonging to the TARGET's own content counts, so a
       label can never be parked on top of the very text it points at. Our own
       floating labels (in the pointer-events:none #gdp-marks layer) are ignored. */
    const overGlyph = (x: number, y: number): boolean | 'unsupported' => {
      const c = caretAt(x, y);
      if (c === 'unsupported') return 'unsupported';
      if (!c || c.node.nodeType !== Node.TEXT_NODE) return false;
      if (layer.contains(c.node)) return false; // one of our own chips
      const text = c.node.textContent || '';
      if (!text.trim()) return false;
      const len = text.length;
      if (len === 0) return false;
      const off = Math.max(0, Math.min(c.offset, len - 1));
      const range = document.createRange();
      range.setStart(c.node, off);
      range.setEnd(c.node, Math.min(off + 1, len));
      const rect = range.getBoundingClientRect();
      const pad = 2;
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        x >= rect.left - pad &&
        x <= rect.right + pad &&
        y >= rect.top - pad &&
        y <= rect.bottom + pad
      );
    };

    /* count sample points that land on readable text the label would cover.
       Prefer the glyph test; where the caret API is unavailable, fall back to
       the older element/padding heuristic (which skips the target). Lower = better. */
    const foreignHits = (left: number, top: number, w: number, h: number, target: HTMLElement): number => {
      const pts: Array<[number, number]> = [
        [left + 3, top + 3],
        [left + w - 3, top + 3],
        [left + w / 2, top + h / 2],
        [left + 3, top + h - 3],
        [left + w - 3, top + h - 3],
      ];
      let n = 0;
      for (const [x, y] of pts) {
        if (x < 0 || y < top0 || x > vw || y > vh) {
          n += 1; // off the usable canvas counts against the slot
          continue;
        }
        const glyph = overGlyph(x, y);
        if (glyph !== 'unsupported') {
          if (glyph) n += 1; // over a real character (target's own OR a neighbour's)
          continue;
        }
        /* fallback: no caret API → old behaviour (target contents are free). */
        const hit = document.elementFromPoint(Math.round(x), Math.round(y));
        if (!hit) continue;
        if (target.contains(hit) || hit.contains(target)) continue;
        if (layer.contains(hit)) continue;
        if (!inContent(hit, x, y)) continue;
        n += 1;
      }
      return n;
    };

    layer.innerHTML = '';
    marksRef.current
      .filter((m) => m.label)
      .forEach((m) => {
        const b = m.el.getBoundingClientRect();
        /* a box fully off screen is noise, so its label goes with it */
        if (b.width === 0 || b.bottom < top0 + 8 || b.top > vh - 24) return;
        const span = document.createElement('span');
        span.className = 'gdp-mk';
        span.style.left = '0px';
        span.style.top = '0px';
        span.innerHTML = m.label;
        layer.appendChild(span);
        const cw = span.offsetWidth || 120;
        const ch = span.offsetHeight || 20;
        const gap = 7;

        const leftAligned = Math.round(Math.max(6, Math.min(b.left, vw - cw - 6)));
        const rightAligned = Math.round(Math.max(6, Math.min(b.right - cw, vw - cw - 6)));
        const aboveTop = Math.round(b.top - gap - ch);
        const belowTop = Math.round(b.bottom + gap);
        /* lateral slots: in dense views the rows above/below butt together, but
           there is often whitespace to the SIDE of the box (e.g. the map canvas
           beside the market side-panel). Try the outer margins level with the
           box before ever resorting to an in-box slot. */
        const leftOfBox = Math.round(b.left - gap - cw);
        const rightOfBox = Math.round(b.right + gap);
        const midTop = Math.round(b.top + b.height / 2 - ch / 2);
        /* in-box corners: sit within the target's own top/bottom edge — never a
           neighbour — the LAST resort. With the glyph-aware scorer these only win
           when they land on genuine whitespace inside the box, never on its text. */
        const inTop = Math.round(b.top + 3);
        const inBottom = Math.round(b.bottom - ch - 3);

        type Cand = { left: number; top: number; below: boolean };
        const candidates: Cand[] = [
          { left: leftAligned, top: aboveTop, below: false },
          { left: rightAligned, top: aboveTop, below: false },
          { left: leftAligned, top: belowTop, below: true },
          { left: rightAligned, top: belowTop, below: true },
          /* to the sides, level with the box */
          { left: rightOfBox, top: midTop, below: false },
          { left: leftOfBox, top: midTop, below: false },
          { left: rightOfBox, top: aboveTop, below: false },
          { left: leftOfBox, top: aboveTop, below: false },
          /* last resort: inside the box's own top/bottom band */
          { left: rightAligned, top: inTop, below: false },
          { left: leftAligned, top: inTop, below: false },
          { left: rightAligned, top: inBottom, below: true },
        ];

        let best: Cand | null = null;
        let bestScore = Infinity;
        for (const c of candidates) {
          if (c.top < top0 || c.top + ch > vh) continue; // must be on-canvas (vertical)
          if (c.left < 6 || c.left + cw > vw - 6) continue; // must be on-canvas (horizontal)
          const score = foreignHits(c.left, c.top, cw, ch, m.el);
          if (score < bestScore) {
            bestScore = score;
            best = c;
            if (score === 0) break; // clean slot — take it
          }
        }
        if (!best) best = { left: leftAligned, top: belowTop, below: true };

        span.classList.toggle('below', best.below);
        span.style.left = `${best.left}px`;
        span.style.top = `${best.top}px`;
      });
    reflow();
  }, [reflow]);

  /* scroll so the target clears the sticky header, instantly. */
  const bring = useCallback(
    (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      const pad = 196;
      const bottom = window.innerHeight - 150;
      if (b.top < pad || b.bottom > bottom) {
        window.scrollTo({ top: window.pageYOffset + b.top - pad, behavior: 'auto' });
      }
      place();
    },
    [place],
  );

  /* apply a step's spotlight; returns true once the first target resolved. */
  const applySpot = useCallback(
    (spot: Spot[], scroll: boolean): boolean => {
      clear();
      let first: HTMLElement | null = null;
      spot.forEach(([sel, label]) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return;
        el.classList.add('gdp-spot');
        if (!first) first = el;
        marksRef.current.push({ el, label });
      });
      place();
      if (first && scroll) bring(first);
      return !!first;
    },
    [clear, place, bring],
  );

  /* the labels + spotlight classes follow the page. A frame loop rather than a
     scroll listener: the boxes also move when a pane re-renders under them, and
     React may drop the additive class on re-render, so we re-assert both.

     It also has to survive a step whose own action button REBUILDS the view. When
     the presenter presses "Coordinate the response" on step 5, the pane re-renders
     and two things break at once: the run button we were pointing at unmounts (the
     rail swaps it for "Run complete"), and the panel we also point at slides far
     below the fold, where place() correctly suppresses its label. What is left is a
     callout highlighting nothing — the worst possible state to be in on camera.
     So when the resolved set stops matching the DOM, re-run the whole step spot:
     that re-queries the selectors and scrolls the first survivor back into view.
     This is a one-shot reaction to a re-render, NOT a continuous pull — while the
     DOM is stable the check is two cheap comparisons and the presenter keeps their
     own scroll position. */
  const track = useCallback(() => {
    if (!marksRef.current.length) return;
    const st = demoRef.current.steps[iRef.current];
    if (st) {
      /* did the view change under us? Either a node we hold is now detached, or
         the count of resolvable selectors moved (a panel arrived, or one left). */
      const stale =
        marksRef.current.some((m) => !document.contains(m.el)) ||
        st.spot.filter(([sel]) => document.querySelector(sel)).length !== marksRef.current.length;
      if (stale) {
        applySpot(st.spot, st.scroll !== false);
        return;
      }
    }
    marksRef.current.forEach((m) => {
      if (!m.el.classList.contains('gdp-spot')) m.el.classList.add('gdp-spot');
    });
    place();
  }, [applySpot, place]);

  /* show step n: drive the app, then spotlight — retried until the async,
     c3Action-fed view has actually rendered the targets (up to ~2.5s). */
  const show = useCallback(
    (n: number) => {
      iRef.current = n;
      setI(n);
      const st = demoRef.current.steps[n];
      clear();
      if (spotTimer.current) {
        window.clearInterval(spotTimer.current);
        spotTimer.current = null;
      }
      if (st.target) drive(st.target);

      const scroll = st.scroll !== false;
      let tries = 0;
      const attempt = () => {
        const ok = applySpot(st.spot, scroll);
        tries += 1;
        if (ok || tries > 25) {
          if (spotTimer.current) {
            window.clearInterval(spotTimer.current);
            spotTimer.current = null;
          }
        }
      };
      /* first attempt after the view has had a tick to mount, then poll */
      window.setTimeout(attempt, 60);
      spotTimer.current = window.setInterval(attempt, 100);
    },
    [applySpot, clear, drive],
  );

  const go = useCallback(
    (d: number) => {
      const n = iRef.current + d;
      if (n < 0 || n >= demoRef.current.steps.length) return;
      show(n);
    },
    [show],
  );

  /* PAUSE (the ✕): just hide the callout and stop the tracking/spotlight loops.
     The step index is preserved (iRef/i untouched) and the app is NOT navigated
     away, so pressing "Guided demo" again reopens on the very card we left. */
  const pause = useCallback(() => {
    setOn(false);
    if (trackTimer.current) {
      window.clearInterval(trackTimer.current);
      trackTimer.current = null;
    }
    if (spotTimer.current) {
      window.clearInterval(spotTimer.current);
      spotTimer.current = null;
    }
    clear();
  }, [clear]);

  /* FINISH (the last step's button): the demo is genuinely over, so tear it down
     AND rewind to step 0, then return to the menu so the next run starts clean.
     Note what this does NOT do: it does not reset the scenario itself. The
     backend stage is deliberately left where the presenter drove it, because
     after a run the room usually wants to look around the committed result. The
     "Reset scenario" button on each scenario screen is the way back to baseline,
     and the last step of each demo says so out loud. */
  const finish = useCallback(() => {
    setOn(false);
    if (trackTimer.current) {
      window.clearInterval(trackTimer.current);
      trackTimer.current = null;
    }
    if (spotTimer.current) {
      window.clearInterval(spotTimer.current);
      spotTimer.current = null;
    }
    clear();
    iRef.current = 0;
    setI(0);
    drive({ screen: 'menu' });
  }, [clear, drive]);

  /* open (or re-open) the demo at wherever we last were — 0 on a fresh start,
     or the paused step after the ✕. */
  const start = useCallback(() => {
    setPick(false);
    setOn(true);
    show(iRef.current);
  }, [show]);

  /* choose a demo from the picker: switch the running step array + header chip,
     rewind to step 0, and begin. */
  const choose = useCallback(
    (d: Demo) => {
      demoRef.current = d;
      setDemo(d);
      iRef.current = 0;
      setI(0);
      setPick(false);
      setOn(true);
      show(0);
    },
    [show],
  );

  /* "Guided demo" button opens the picker (gd:open). If a demo is already
     paused mid-run, reopen straight onto it instead of re-prompting. */
  useEffect(() => {
    const openH = () => {
      if (iRef.current > 0) {
        start();
      } else {
        setOn(false);
        setPick(true);
      }
    };
    /* gd:start may carry a demo id (from the picker, or a deep link). */
    const startH = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const d = id ? DEMOS.find((x) => x.id === id) : null;
      if (d) choose(d);
      else start();
    };
    window.addEventListener('gd:open', openH);
    window.addEventListener('gd:start', startH);
    return () => {
      window.removeEventListener('gd:open', openH);
      window.removeEventListener('gd:start', startH);
    };
  }, [start, choose]);

  /* tracking loop + arrow-key / escape driving, only while running. */
  useEffect(() => {
    if (!on) return;
    trackTimer.current = window.setInterval(track, 90);
    const onScroll = () => track();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') pause();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      if (trackTimer.current) {
        window.clearInterval(trackTimer.current);
        trackTimer.current = null;
      }
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [on, track, go, pause]);

  const steps = demo.steps;
  const st = steps[i] ?? steps[0];
  const total = steps.length;
  const last = i === total - 1;

  return (
    <>
      <div className="gdp-marks" id="gdp-marks" />

      {/* Demo picker — shown when "Guided demo" is pressed with no demo paused. */}
      {pick && (
        <div className="gdp gdp-pick on" id="gdp-pick">
          <button
            type="button"
            className="gdp-x"
            onClick={() => setPick(false)}
            title="Close"
          >
            <Glyph name="close" />
          </button>
          <div className="gdp-hd">
            <span className="gdp-c">GUIDED DEMO</span>
            <span className="gdp-n">Choose a case</span>
          </div>
          <div className="gdp-t">Pick a case</div>
          <div className="gdp-pk">
            {DEMOS.map((d, idx) => (
              <button type="button" className="gdp-pk-b" key={d.id} onClick={() => choose(d)}>
                <span className="gdp-pk-n">{idx + 1}</span>
                <span className="gdp-pk-tx">
                  <b>{d.title}</b>
                  <em>{d.blurb}</em>
                </span>
                <span className="gdp-pk-s">{d.steps.length} steps</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`gdp${on ? ' on' : ''}`} id="gdp">
        <button type="button" className="gdp-x" onClick={pause} title="Hide (resumes where you left off)">
          <Glyph name="close" />
        </button>
        <div className="gdp-hd">
          <span className="gdp-c" id="gdp-c">
            {demo.chip}
          </span>
          <span className="gdp-n" id="gdp-n">
            {i + 1} / {total}
          </span>
        </div>
        <div className="gdp-t" id="gdp-t" dangerouslySetInnerHTML={{ __html: st.t }} />
        <div className="gdp-p" id="gdp-p" dangerouslySetInnerHTML={{ __html: st.p }} />
        {st.say ? <div className="gdp-say" id="gdp-say" dangerouslySetInnerHTML={{ __html: st.say }} /> : null}
        <div className="gdp-f">
          <button type="button" className="gdp-b s" id="gdp-prev" disabled={i === 0} onClick={() => go(-1)}>
            Back
          </button>
          <button type="button" className="gdp-b p" id="gdp-next" onClick={last ? finish : () => go(1)}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
        <div className="gdp-bar">
          <i id="gdp-bar" style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
      </div>
    </>
  );
}
