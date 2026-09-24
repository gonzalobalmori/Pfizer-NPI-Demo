/*
 * Guided demo (#gdp) — a faithful port of the click-through's GUIDED DEMO
 * engine (its GD step array + gdStart/gdShow/gdGo/gdSpot/gdPlace/gdBring/gdTrack
 * globals). Each step DRIVES the app itself, so the presenter only ever presses
 * Next.
 *
 * There are THREE demos, chosen from a small picker overlay when the
 * "Guided demo" button is pressed (the button dispatches `gd:open`; picking a
 * demo dispatches `gd:start` carrying its id). All three walk the SAME journey
 * end to end (menu → cockpit → portfolio → open issues → my actions → agent
 * tower → the record → history → fleet log → copilot); they differ only in the
 * case that is threaded through it, so any one on its own shows the whole app:
 *   • Demo 1 — a contract steriliser drops a booked chamber slot: an agent finds
 *     it, five agents work it, and exactly one decision reaches a person (the
 *     original 16-step tour). This is a supplier/scheduling shock, NOT a quality
 *     defect — so it opens no CAPA; the quality-system record is reserved for the
 *     manufacturing case in Demo 3.
 *   • Demo 2 — the regulatory-authority thread: the questions the FDA and the
 *     Notified Body are asking, the BSI review slot that is the real deadline,
 *     the one signature that is actually Helena's, and the site-visit dossier.
 *   • Demo 3 — a manufacturing defect puts commercial batches at risk: Comirnaty
 *     runs commercial output on lines 3 and 5, line 3 gives three out-of-spec
 *     batches, and an overdue CAPA (its DMAIC still in progress) is open on it.
 *     The three routes are re-prioritise markets, drive the DMAIC to close, or
 *     move output to another qualified site on the same modality.
 *
 * The prototype navigated with imperative globals (go/pane/pickMk/openRW/…). Here
 * every step's `target` is a DriveTarget published through the nav model's
 * drive(), and each destination view reads that intent to land on the exact
 * lens/pane/filter/card/prompt. The spotlight then highlights DOM nodes by the
 * prototype's own selectors — retried until the (async, c3Action-fed) view has
 * rendered them — and floating labels track the boxes as the page scrolls or a
 * pane re-renders beneath them.
 *
 * Every demo drives ONLY already-reconciled records — Demo 2 and Demo 3 add no
 * findings and touch no Comirnaty activities (the reconciliation lock), so all
 * data still ties out across every tab and view.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNav, type DriveTarget } from '@/nav/NavContext';

type Spot = [selector: string, label: string];

interface Step {
  /** panel title (may contain inline HTML). */
  t: string;
  /** the paragraph (inline HTML). */
  p: string;
  /** the presenter aside (inline HTML). Optional — omitted steps render no aside. */
  say?: string;
  /** where the step drives the app; null keeps the current view (issue sub-steps). */
  target: DriveTarget | null;
  /** [selector, label] pairs to spotlight. */
  spot: Spot[];
  /** whether to scroll the first target into view (prototype's gdSpot second arg). */
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

/* ── Demo 1 — the 16 steps, verbatim from the prototype's GD array ────── */
const GD: Step[] = [
  {
    t: 'Three ways in, and we use two',
    p:
      'Helena Fossi runs nine Biopharma launches across three franchises. Three entry points: ' +
      '<b>01 define</b> the launch &mdash; sourcing strategy, supplier qualification, supply-chain ' +
      'risk, digital twins. <b>02 see</b> it. <b>03 execute</b> it. 01 is a design workspace and is ' +
      'not built out in this demo; the screen says so itself. Today is 02 and 03.',
    say: 'Click <b>02 Pipeline Status Overview</b>, or press Next &mdash; the demo goes there either way.',
    target: { screen: 'menu' },
    scroll: false,
    spot: [
      ['.mc.dim', '01 &middot; not built out in this demo'],
      ['.mc:nth-of-type(2)', '02 &middot; we start here &rarr;'],
      ['.mc:last-of-type', '03 &middot; and we finish here'],
    ],
  },
  {
    t: 'Helena starts her day here',
    p:
      'A screening pass, not a report. Gate readiness at <b>87%</b>, six points down on last month ' +
      'against a target of 85. <b>Three launches on plan, four at risk, one off track.</b> ' +
      '<b>&euro;40.6M exposed</b> &mdash; and that is <b>&euro;11.2M more than thirty days ago</b>. Average ' +
      'slip at gate close is <b>20 days</b> against a target of five, and the worst case is <b>47</b>.',
    say:
      'She is not reading status, she is deciding where to look. The exposure climbed &euro;11.2M this ' +
      'month and the worst slip is 47 days &mdash; that 47 is the thread she follows.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [
      ['#v-cockpit .kc:nth-child(2)', 'three on plan, four at risk, one off track'],
      ['#v-cockpit .kc:nth-child(3)', '&euro;40.6M exposed &middot; &euro;11.2M worse in a month'],
      ['#v-cockpit .kc:nth-child(4)', 'avg slip 20d &middot; worst case 47 days'],
    ],
  },
  {
    t: 'Which launch is the 47 days?',
    p:
      'Portfolio, product lens. Nine launches, one line each, <b>always sorted worst first</b> ' +
      '&mdash; so the answer is the top row. <b>Comirnaty Gen 2</b>, in P3, design V&amp;V and ' +
      'supplier qualification, with <b>G3 Submission Commit at +47 days</b>. Hollow markers are the ' +
      'gates ahead; solid ones have closed.',
    say:
      'Four lenses on one screen &mdash; product, market, business unit, timeline. She takes ' +
      'product because her question is <i>which device</i>.',
    target: { branch: 'pipeline', view: 'portfolio', lens: 'product' },
    spot: [
      ['#v-portfolio .pf-sw', 'four lenses, one screen'],
      ['.tkr', 'Comirnaty Gen 2 &middot; P3 &middot; +47d, worst first'],
    ],
  },
  {
    t: 'And which market is carrying it?',
    p:
      'Same portfolio, market lens. <b>Germany is six launches and the only one off track, with ' +
      '&euro;24.1M at risk.</b> Click it and the risk is named for her: <i>Comirnaty G2 has missed ' +
      'the Q2 2027 tender window</i> &mdash; <b>NPI-0417, sterilisation slip</b>. That is the thread ' +
      'she pulls.',
    say:
      'The map sizes by launches and colours by status. Three clicks in, she has the device, the ' +
      'market and the record number, without opening a single document.',
    target: { branch: 'pipeline', view: 'portfolio', lens: 'market', marketView: 'map', marketPick: 'DE' },
    scroll: false,
    spot: [
      ['.wp[data-m=DE]', 'Germany'],
      ['#map-side .ms-k', '6 launches &middot; 1 off track &middot; &euro;24.1M'],
      ['#map-side .mrk', 'and the record behind it: NPI-0417'],
    ],
  },
  {
    t: 'The ones that are actually hers',
    p:
      'Execution, My actions. <b>Five decisions</b>, sorted by when they have to be taken &mdash; ' +
      'and there it is: <b>NPI-0417</b>, the EO sterilisation validation slot, <b>due at 17:00 ' +
      'today</b>.',
    say:
      'She did not have to find this in a mailbox. The screening walked her to the record that ' +
      'owns it.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'pending' },
    spot: [
      ['#v-actions .sb-r', 'pending &middot; escalated &middot; her own history'],
      ['#v-actions .sb-p.on .dr', 'NPI-0417 &middot; due 17:00 today'],
    ],
  },
  {
    t: 'How did this even reach me?',
    p:
      'Agent orchestration. The finding sits in <b>P3</b>, the phase where it was raised, and the ' +
      'card carries the clock. <b>08:14</b> the Quality agent read the cancellation off the Steris ' +
      'supplier portal. <b>08:16</b> Planning recomputed the ' +
      'critical path. <b>08:20</b> Sourcing priced three alternative EO sites. <b>08:23</b> ' +
      'Regulatory checked the dossier against a nine-day shift.',
    say:
      'Twenty-eight minutes, four agents, no meeting. This is the traceability: what was done, by ' +
      'which agent, at what time. Nobody was watching that portal.',
    target: { branch: 'exec', view: 'tower', towerPane: 'live', towerFranchise: 'Vaccines', towerOpenCard: 'seed_finding_417' },
    spot: [['#c-seed_finding_417 .tbwk', 'agent, action, and the time it happened']],
  },
  {
    t: 'Why this one reached her, and most never do',
    p:
      'This is one of her <b>five</b>, and the reason it is hers is the whole point. Most of what ' +
      'runs on this launch never lands on her desk: the agents close what they are allowed to close, ' +
      'and the rest waits with whoever owns the next step &mdash; another person, a supplier, a ' +
      'regulator. This one moves a gate date and commits <b>&euro;340k</b>, which is outside the band ' +
      'an agent may approve on its own &mdash; so the chain stopped and the last step became hers. ' +
      'The boundary is configured, not improvised.',
    say: 'This is the answer to the question every client asks: what decides what reaches me?',
    target: { branch: 'exec', view: 'tower', towerPane: 'live' },
    spot: [
      ['#kpi .tbkc:nth-child(3)', 'stopped and waiting on her'],
      ['#kpi .tbkc:nth-child(5)', 'closed with no human at all'],
    ],
  },
  {
    t: 'The case, in plain words',
    p:
      'The problem stated plainly: the <b>12 Oct EO chamber slot at Steris Venlo was cancelled by ' +
      'the supplier</b>. This is a scheduling and supply shock, not a quality defect &mdash; so it ' +
      'opens <b>no CAPA</b> (the quality system is reserved for a manufacturing or product problem). ' +
      'Without the ISO 11135 validation report, section 4.3 of the EU MDR Technical Documentation ' +
      'cannot close &mdash; <b>and it is the only open section of the dossier</b>.',
    say:
      'Point at the meta strip. This is a decision about a cancelled slot on the critical path, not ' +
      'a quality record &mdash; note there is no CAPA chip here.',
    target: { view: 'issue', param: 'seed_finding_417' },
    spot: [
      ['#pb-txt', 'a cancelled slot &mdash; a supply shock, not a defect'],
      ['.is-meta', 'gate &middot; slip &middot; exposure &middot; clock'],
    ],
  },
  {
    t: 'What the decision actually needs from her',
    p:
      'The task is not &ldquo;get the slot back&rdquo; &mdash; the agent already read the contract ' +
      'and there is no claim. It is <b>get this validation executed in time</b>, and these three ' +
      'options are the three ways to do it. <b>Dual-sourcing to Sterigenics recovers 38 of the 47 ' +
      'days for &euro;340k</b>, and it is that fast because the site is already on the approved list, ' +
      'audit current to 2028, already qualified for two other catheters.',
    say:
      'This is the link people miss: the decision does not fix the cancelled slot, it takes the ' +
      'cancelled slot off the critical path. What follows is a permanent second-source ' +
      'qualification and a committed-capacity clause so this cannot recur.',
    target: null,
    spot: [
      ['#opt-a', 'recommended &middot; +9d for &euro;340k'],
      ['#opt-b', '+62d and &euro;1.1M'],
      ['#opt-c', 'needs a G1 reversal'],
    ],
  },
  {
    t: 'And the guardrails ran first',
    p:
      'Six checks before anything was proposed. The one that decides it: the <b>BSI Q4 review slot ' +
      'holds at +9 days and does not hold at +47</b>. Miss that window and the next confirmed slot ' +
      'is February &mdash; another 31 days on top of the 47.',
    say:
      'This is why the recommendation is safe to act on, and it is the part a quality audience ' +
      'cares about most.',
    target: null,
    spot: [['#run-all', 'six checks, none breached']],
  },
  {
    t: 'Why it came to her, in her colleagues&rsquo; own words',
    p:
      'Four entries, three functions and one agent. <b>M. Okafor</b> pushed back on Steris by phone ' +
      '&mdash; a genuine chamber deviation, nothing earlier anywhere. The <b>Sourcing agent</b> read ' +
      'the master agreement: clause 7.3, non-committed capacity, reallocable on 30 days notice, ' +
      '<b>no claim and no penalty</b>. <b>A. Kowalski</b> confirmed a site move is a half-cycle ' +
      'revalidation, not a full one. <b>S. Lindqvist</b> named the real deadline &mdash; not the 47 ' +
      'days, the BSI window.',
    say:
      'This is the answer to &ldquo;why me&rdquo;. Not a workflow rule: four people and an agent ' +
      'converging on a decision that needs authority. And clause 7.3 is the root cause the ' +
      'follow-through has to remove &mdash; a committed-capacity clause so a slot cannot be pulled again.',
    target: null,
    spot: [['#thr-417', 'four entries, three functions, one agent']],
  },
  {
    t: 'One decision',
    p:
      'She approves the dual-source. <b>That is the only thing a human does in this entire ' +
      'case.</b>',
    say: 'Click Approve on the screen, then come back and press Next.',
    target: null,
    spot: [['#btn-app', 'click this, then press Next']],
  },
  {
    t: 'What one decision moved',
    p:
      'Comirnaty&rsquo;s <b>G3 goes back to 13 November</b> &mdash; its own slip drops 47 &rarr; 9 days &mdash; ' +
      'and <b>&euro;18.4M is released</b>, so it is off the at-risk list. Watch the cockpit&rsquo;s worst-case ' +
      'slip too: it falls <b>47 &rarr; 21</b>, not to 9. Comirnaty was the worst launch in the portfolio; with ' +
      'it fixed, the <b>Prevnar 20 Stapler&rsquo;s G4 at 21 days</b> is now the top of the list. Nothing is off ' +
      'track any more. Seven tasks assigned, BSI notified, the Design History File updated, the launch plan ' +
      're-baselined &mdash; and the same numbers changed on every other screen at the same time.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [
      ['#v-cockpit .kc:nth-child(2)', 'nothing off track'],
      ['#v-cockpit .kc:nth-child(3)', '&euro;18.4M released'],
      ['#v-cockpit .kc:nth-child(4)', 'worst case 47 &rarr; 21'],
    ],
  },
  {
    t: 'Her own record',
    p:
      'My actions, History. Every decision she took, with its outcome, and where somebody else ' +
      'closed it, in their words. <b>Twenty-three decisions in ninety days</b> &mdash; and this one ' +
      'is now on it.',
    say:
      'This is what she shows her manager. Her decisions only. What the agents did on their own ' +
      'is kept separate, on purpose.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'history' },
    spot: [['#v-actions .sb-p.on .hb', 'her decisions, with their outcomes']],
  },
  {
    t: 'And the fleet&rsquo;s record',
    p:
      'Agent orchestration, activity log. Every action the agents executed &mdash; timestamped, ' +
      'attributed, tied to the finding and the launch. <b>The approval is the newest line</b>, and ' +
      'the follow-through is now their work: qualify the second site permanently, add the ' +
      'committed-capacity clause, and confirm the validation report lands by 06 Nov.',
    say:
      'This is the screen a Notified Body auditor asks for. Two records &mdash; one for the ' +
      'person, one for the fleet &mdash; and they reconcile.',
    target: { branch: 'exec', view: 'tower', towerPane: 'past' },
    spot: [
      ['.lg-n', '32 actions, 13 agents'],
      ['#lg-b .lg-r:first-child', 'her approval, newest line'],
    ],
  },
  {
    t: 'Or she could have just asked',
    p:
      'Everything we clicked through, the copilot answers from the same record &mdash; the launch ' +
      'plan, the 107 activities, the agent log, the supplier and market data. Every answer ends in a ' +
      'button that opens the thing it is talking about.',
    say:
      'She could have started here. Ask it to diagnose Comirnaty Gen 2 and it says in one answer ' +
      'what took us five screens: four findings, one cause &mdash; Heraeus.',
    target: { branch: 'exec', view: 'chat', chatAsk: 'varipulse' },
    scroll: false,
    spot: [
      ['#cq-thread .cq-ev', 'the evidence it used'],
      ['#cq-thread .cq-rec', 'the recommendation and its confidence'],
      ['#cq-thread .cq-act', 'buttons that open the record'],
    ],
  },
];

/* ── Demo 2 — the regulatory-authority thread (16 steps, end to end) ────
 * Same journey as Demo 1 — menu → cockpit → portfolio (product then market)
 * → open issues → my actions → agent tower → the record → the record's detail
 * → history → fleet log → copilot — but the casuistry is regulatory. It drives
 * existing, already-reconciled records ONLY: NPI-0420 (FDA deficiency letter, a
 * view-only REGULATOR finding on Comirnaty) and NPI-0365 (BSI Notified Body
 * query-cycle 2 + the signatory escalation on Prevnar 20), plus the Comirnaty
 * dossier register (reg/cert groups) and the `regulatory` copilot answer. No
 * finding is added or changed, so every count still ties out. */
const GD2: Step[] = [
  {
    t: 'Three ways in — today it is the agencies',
    p:
      'The same three entry points Helena always has: <b>01 define</b> the launch, <b>02 see</b> it, ' +
      '<b>03 execute</b> it. This walkthrough is a regulatory read of the portfolio &mdash; what the FDA ' +
      'and the Notified Body are asking, and which of those clocks she can actually move. 01 is a design ' +
      'workspace and is not built out here; today is 02 and 03.',
    say:
      'Today the question is regulatory. Click <b>02 Pipeline Status Overview</b>, or press Next &mdash; the ' +
      'demo goes there either way.',
    target: { screen: 'menu' },
    scroll: false,
    spot: [
      ['.mc.dim', '01 &middot; not built out in this demo'],
      ['.mc:nth-of-type(2)', '02 &middot; we start here &rarr;'],
      ['.mc:last-of-type', '03 &middot; and we finish here'],
    ],
  },
  {
    t: 'Where the schedule time actually is',
    p:
      'The morning read on the portfolio. Gate readiness at <b>87%</b>, four launches at risk and one off track, ' +
      '<b>&euro;40.6M exposed</b>. But the number that decides today is on this panel: of all the slip across the ' +
      'portfolio, exactly <b>one</b> thread is a fixed wait on an authority &mdash; <b>Comirnaty Gen 2</b>, the grey ' +
      'bar, an open FDA deficiency letter. Everything else, including the Prevnar 20 signature, is schedule time she ' +
      'can win back by acting.',
    say:
      'She is not reading status, she is deciding where to look. The grey is the only clock a regulator holds; the ' +
      'green is hers to pull in. So the honest question is: which slip is the FDA&rsquo;s, and can I move it?',
    target: { branch: 'pipeline', view: 'cockpit' },
    spot: [
      ['#v-cockpit .ti-pnl', 'where you can recover schedule time'],
      ['#v-cockpit .ti-card.reg', 'the one fixed wait on an authority — FDA, grey'],
      ['#v-cockpit .ti-card.rec', 'everything else is recoverable by acting'],
    ],
  },
  {
    t: 'The one clock a regulator holds',
    p:
      'Click the grey bar and it opens the launch behind it &mdash; <b>Comirnaty Gen 2</b>, not a product-lens ' +
      'list. Its slip and exposure are on the strip, and the reason is a single <b>FDA</b> thread: a PMA under ' +
      'review with a deficiency letter open. This is the launch this tour follows: the FDA clock she can only ' +
      'wait on, and a Notified Body review slot she has to protect.',
    say:
      'One click from the cockpit chart to the launch itself. The slip you just saw as the grey bar is right ' +
      'here, named &mdash; and it is the FDA&rsquo;s to move, not hers.',
    target: { view: 'launch', param: 'seed_launch_varipulse_g2' },
    spot: [
      ['#ld-slip', 'the slip you saw as the grey bar'],
      ['#ld-rev', 'the exposure behind it'],
    ],
  },
  {
    t: 'Two jurisdictions, two very different clocks',
    p:
      'Back to the portfolio, market lens. The FDA thread lives under <b>the United States</b> &mdash; that is ' +
      'Comirnaty Gen 2&rsquo;s jurisdiction and the one authority clock on the board. <b>The United Kingdom</b> ' +
      'carries the Notified Body thread on <b>Prevnar 20</b> (NPI-0365) &mdash; same word, ' +
      '&ldquo;regulatory&rdquo;, but that one is a signature she can move, not an agency wait.',
    say:
      'The map colours by status and sizes by launches. The US is where the fixed FDA clock sits; the UK is ' +
      'where the movable BSI signature sits &mdash; two agencies, two jurisdictions, only one of them a wait.',
    target: { branch: 'pipeline', view: 'portfolio', lens: 'market', marketView: 'map', marketPick: 'US' },
    scroll: false,
    spot: [
      ['.wp[data-m=US]', 'United States · FDA · the one fixed authority clock (Comirnaty)'],
      ['.wp[data-m=UK]', 'United Kingdom · BSI Notified Body · the movable signature (Prevnar 20)'],
      ['#map-side .ms-k', 'the launches under FDA jurisdiction'],
    ],
  },
  {
    t: 'The one launch an agency is holding',
    p:
      'Open issues, filtered to <b>Waiting on an authority</b>. This bucket holds exactly <b>one</b> row, and ' +
      'that is the whole point: everything else on this screen is work someone can accelerate. <b>NPI-0420</b> ' +
      '&mdash; Comirnaty Gen 2 is under FDA review with a <b>deficiency letter open</b>, and it is <b>blocking a ' +
      'gate</b>. Acting faster does not move it: the next step is with the agency. The Prevnar 20 signature is ' +
      'not here &mdash; it is recoverable work, and it lives on the escalated queue instead.',
    say:
      'This is the honest distinction most tools blur. Only one thread is genuinely on a regulator. The system ' +
      'marks who owns the next move &mdash; and when it is an authority, it says so and offers <i>View detail</i>, ' +
      'never <i>Resolve</i>.',
    target: { branch: 'pipeline', view: 'alerts' },
    spot: [
      ['#v-alerts .al-lens .wl.authority', 'exactly one thread is on an authority'],
      ['#v-alerts tr[data-npi="NPI-0420"]', 'NPI-0420 · FDA · not yours to pull in'],
    ],
  },
  {
    t: 'The one that is actually hers to move',
    p:
      'Execution, My actions &mdash; the Escalated pane. The FDA clock is not here, because it is not ' +
      'hers to push. <b>NPI-0365</b> is: the Notified Body response pack has been <b>drafted and unsigned ' +
      'for 6 days</b>, chased twice, and raised to the director yesterday. An escalation travels upward ' +
      'only &mdash; she cannot pull it back and sign it herself.',
    say:
      'Same word, two opposite situations. 0420 is on the FDA and waits. 0365 is on us: a signature we owe, ' +
      'and every unsigned day is a day of G4.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'escalated' },
    spot: [
      ['#v-actions .sb-r', 'pending · escalated · her own history'],
      ['#v-actions .sb-p.on .dr[data-npi="NPI-0365"]', 'NPI-0365 · chased twice, escalated to sign'],
    ],
  },
  {
    t: 'How the agent worked the query, then stopped',
    p:
      'Agent orchestration, filtered to <b>Hospital</b>. The card for <b>NPI-0365</b> shows the fleet&rsquo;s ' +
      'work verb by verb: the Regulatory agent <b>detected</b> the second query cycle, the Clinical agent ' +
      '<b>assembled</b> a response pack from the CER and the equivalence rationale &mdash; and then it ' +
      '<b>stopped on a human</b>, because a submission cannot go out without a qualified signatory.',
    say:
      'This is the traceability a Notified Body cares about: what was drafted, by which agent, and exactly ' +
      'where the chain handed off to a person. The agent did everything except the signature.',
    target: { branch: 'exec', view: 'tower', towerPane: 'live', towerFranchise: 'Hospital', towerOpenCard: 'seed_finding_365' },
    spot: [['#c-seed_finding_365 .tbwk', 'detected → assembled → stopped on a human']],
  },
  {
    t: 'What reaches a person, and why',
    p:
      'The autonomy band, on the board KPIs. Most activities run without asking anyone. A regulatory ' +
      'submission is <b>never</b> inside the autonomous band &mdash; it always stops for a qualified ' +
      'signatory &mdash; so this one shows as <b>held by a person</b>, not closed by the fleet. That ' +
      'boundary is configured, not improvised.',
    say:
      'This is the answer to the question every regulatory reviewer asks: what can the agents sign, and what ' +
      'can they not? The FDA thread is one of those held cards &mdash; open it and you land on the record itself.',
    target: { branch: 'exec', view: 'tower', towerPane: 'live' },
    spot: [
      ['#kpi .tbkc:nth-child(3)', 'stopped and waiting on a person'],
      ['#kpi .tbkc:nth-child(4)', 'held by a human — a signature is required'],
      ['#c-seed_finding_420', 'the FDA thread, held — click to open the record'],
    ],
  },
  {
    t: 'What the FDA is actually asking',
    p:
      'The FDA thread, opened. Because the next step is the agency&rsquo;s, the workspace is ' +
      '<b>view-only</b> &mdash; no Approve, no Reassign, only the record. Comirnaty Gen 2&rsquo;s PMA is ' +
      'under review with a deficiency letter open, and until the agency responds the gate does not move.',
    say:
      'Point at the bar: &ldquo;Waiting on an outside authority &mdash; acting here won&rsquo;t move ' +
      'it.&rdquo; That sentence is the whole regulatory posture in one line.',
    target: { view: 'issue', param: 'seed_finding_420' },
    spot: [
      ['#is-t', 'the deficiency letter, in the quality record'],
      ['.is-bar', 'view-only — the next move is the agency’s'],
    ],
  },
  {
    t: 'The two open questions, already answered',
    p:
      'The problem in plain words. The deficiency letter has two open questions &mdash; ' +
      '<b>sterilisation-residual limits</b> and the <b>biocompatibility bridge</b> &mdash; and the ' +
      'Regulatory agent has already assembled a traced response pack against each, from the CER and the ' +
      'DMR. The meta strip carries the gate, the exposure and who owns the next move.',
    say:
      'The work is done; what is left is the agency&rsquo;s clock. So the job here is not to act &mdash; it ' +
      'is to keep the thread un-blocked and be ready the moment they respond.',
    target: null,
    spot: [
      ['#pb-txt', 'the deficiency letter, in plain words'],
      ['.is-meta', 'the gate, the exposure, and who owns the next move'],
    ],
  },
  {
    t: 'The Notified Body clock you CAN move',
    p:
      'Now the second agency thread, opened. <b>NPI-0365</b> &mdash; BSI opened query cycle 2 on the ' +
      'clinical evaluation. This is not waiting on the authority; it is <b>held with a person</b> for a ' +
      'qualified signatory. The escalation thread shows it in her colleagues&rsquo; own words: drafted, ' +
      'chased twice, then raised to <b>S. Lindqvist</b>.',
    say:
      'This is the movable one. The FDA thread waits; this thread just needs a name on it &mdash; which is ' +
      'exactly why it is on the escalated queue and not the authority bucket.',
    target: { view: 'issue', param: 'seed_finding_365' },
    spot: [
      ['#thr-417', 'chased twice, then escalated to sign'],
      ['#is-held', 'held with S. Lindqvist — a signature, not the agency'],
    ],
  },
  {
    t: 'The chain that stopped on a signature',
    p:
      'The held panel carries the chain the fleet ran: the Regulatory agent <b>detected</b> the query, the ' +
      'Clinical agent <b>assembled</b> the response pack &mdash; and the Orchestrator <b>stopped on a ' +
      'human</b>, because it cannot submit without a qualified signatory. The BSI review slot is the real ' +
      'deadline behind all of this, and every unsigned day spends it.',
    say:
      'A clean agent handoff that stops at a hard boundary: not a cost threshold this time, but a ' +
      'signature the standard requires. The agents took it as far as they are allowed to, and no further.',
    target: null,
    spot: [['#hd-chain', 'detected → assembled → stopped on a human']],
  },
  {
    t: 'Ready for the site visit',
    p:
      'The dossier register for Comirnaty, narrowed to <b>Regulatory submissions</b> and ' +
      '<b>Certificates &amp; licences</b>. An unannounced BSI site visit is expected this quarter &mdash; ' +
      'a gemba walk of Heraeus line 3 and the Neuss second source. Everything an auditor asks for is here, ' +
      'versioned and attributed: the submissions, the certificates, the validation reports.',
    say:
      'This is the screen you open when the Notified Body walks in. The dossier here and the agent activity ' +
      'log reconcile, so the answer to &ldquo;show me&rdquo; is one click, not a scramble.',
    target: { view: 'docs', param: 'seed_launch_varipulse_g2' },
    spot: [
      ['#v-docs .dc-g[data-c=reg] .dc-gh', 'the regulatory submissions'],
      ['#v-docs .dc-g[data-c=cert] .dc-gh', 'certificates, licences & registrations'],
    ],
  },
  {
    t: 'Her own record',
    p:
      'My actions, History. Every decision she took, with its outcome, and where somebody else closed it, ' +
      'in their words. The regulatory escalation she raised on NPI-0365 is on it &mdash; an escalation is a ' +
      'decision too, and it is logged the same way.',
    say:
      'This is what she shows her manager. Her decisions and escalations only. What the agents did on their ' +
      'own is kept separate, on purpose.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'history' },
    spot: [
      ['#v-actions .fb2[data-f=esc]', 'filter to the escalations she raised'],
      ['#v-actions .sb-p.on .ev[data-npi="NPI-0365"]', 'the Prevnar 20 signature she escalated — the very thread from this tour'],
    ],
  },
  {
    t: 'And the fleet’s record',
    p:
      'Agent orchestration, activity log &mdash; the whole fleet, all franchises. Every action the agents ' +
      'executed against the agency threads is here: timestamped, attributed, tied to the finding and the ' +
      'launch. The response packs the agents assembled are their work; the signatures are not.',
    say:
      'This is the screen a Notified Body auditor asks for. Two records &mdash; one for the person, one for ' +
      'the fleet &mdash; and they reconcile.',
    target: { branch: 'exec', view: 'tower', towerPane: 'past', towerFranchise: 'all' },
    spot: [
      ['.lg-n', 'every action, every agent'],
      ['#lg-b .lg-r:first-child', 'newest first'],
    ],
  },
  {
    t: 'Or she could have just asked',
    p:
      'Everything we clicked through, the copilot answers from the same record. Ask it what the regulators ' +
      'need right now and it says it in one answer: <b>one clock the FDA holds</b> and she can only wait on ' +
      '(NPI-0420), <b>one signature that is hers to push today</b> (NPI-0365), the <b>BSI review slot</b> to ' +
      'protect, and the <b>site visit</b> to be ready for. Every answer ends in a button that opens the record.',
    say:
      'She could have started here. The recommendation is the honest one: push the signature today, keep the ' +
      'FDA clock and the BSI slot un-blocked, and do not chase what the agency owns.',
    target: { branch: 'exec', view: 'chat', chatAsk: 'regulatory' },
    scroll: false,
    spot: [
      ['#cq-thread .cq-ev', 'the FDA clock, the signature, the slot and the visit'],
      ['#cq-thread .cq-rec', 'the one thread that is yours to push'],
      ['#cq-thread .cq-act', 'buttons that open the record'],
    ],
  },
];

/* ── Demo 3 — a manufacturing defect puts commercial batches at risk ────
 * (16 steps, end to end — the same journey as Demo 1, anchored on a different
 * case.) Drives NPI-0412: Comirnaty runs commercial output on lines 3 and 5,
 * line 3 has produced 3 batches out of spec on the dimensional check, and an
 * overdue CAPA (CAPA-2026-0149, its DMAIC still in progress) is open on it. It
 * is a fully-modelled USER decision with three options a/b/c — re-prioritise
 * markets, drive the DMAIC to close, or move output to another qualified site on
 * the same modality — a 4-entry thread and an action plan. The only backing data
 * added for this demo are TEST-INVISIBLE records (a manufacturing CAPA, a third
 * decision option, the comment thread and five ActionPlanTasks on decision_412);
 * no finding is added or changed, so every count still ties out. */
const GD3: Step[] = [
  {
    t: 'Three ways in — today it is manufacturing',
    p:
      'The same three entry points: <b>01 define</b>, <b>02 see</b>, <b>03 execute</b>. This walkthrough ' +
      'follows a single manufacturing signal all the way to a decision &mdash; a <b>line defect that ' +
      'puts commercial launch batches at risk</b>. 01 is a design workspace and is not built out here; ' +
      'today is 02 and 03.',
    say:
      'Today the question is manufacturing. Click <b>02 Pipeline Status Overview</b>, or press Next &mdash; ' +
      'the demo goes there either way.',
    target: { screen: 'menu' },
    scroll: false,
    spot: [
      ['.mc.dim', '01 &middot; not built out in this demo'],
      ['.mc:nth-of-type(2)', '02 &middot; we start here &rarr;'],
      ['.mc:last-of-type', '03 &middot; and we finish here'],
    ],
  },
  {
    t: 'Where a manufacturing problem shows up',
    p:
      'The screening pass. Gate readiness at <b>87%</b>, <b>&euro;40.6M exposed</b>, four launches at risk. One of ' +
      'those is <b>Comirnaty G2</b>, and behind its number is a manufacturing problem: it builds commercial ' +
      'output on two lines, and one of them is producing out-of-spec batches. The cockpit is where that ' +
      'first shows as a launch drifting the wrong way.',
    say:
      'She is deciding where to look. A manufacturing problem shows here as at-risk launch volume &mdash; ' +
      'not a schedule slip, a shortfall in the batches the launch was counting on.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [
      ['#v-cockpit .kc:nth-child(2)', 'four at risk — one is a manufacturing problem'],
      ['#v-cockpit .kc:nth-child(3)', '&euro;40.6M exposed across the portfolio'],
      ['#v-cockpit .kc:nth-child(4)', 'worst-case slip: 47 days'],
    ],
  },
  {
    t: 'Find the launch that is building at risk',
    p:
      'Portfolio, product lens. Nine launches, <b>sorted worst first</b>. <b>Comirnaty G2</b> is in P3, and ' +
      'its commercial build runs on <b>two manufacturing lines &mdash; line 3 and line 5</b>. Line 3 has ' +
      'gone out of spec, so a share of the launch volume is at risk. Hollow markers are the gates ahead; ' +
      'solid ones have closed.',
    say:
      'Product lens first, because the question is <i>which device</i> is building at risk. Comirnaty is ' +
      'the one &mdash; its commercial batches, not its design work, are the problem.',
    target: { branch: 'pipeline', view: 'portfolio', lens: 'product' },
    spot: [
      ['#v-portfolio .pf-sw', 'four lenses, one screen'],
      ['.tkr', 'Comirnaty G2 · commercial build on lines 3 and 5'],
    ],
  },
  {
    t: 'Open the launch and see the build at risk',
    p:
      'Click into <b>Comirnaty G2</b>. Its record shows the launch scope &mdash; the commercial build that ' +
      'is committed for first ship. That build runs on lines 3 and 5, and with line 3 out of spec the ' +
      'launch is short of the batches it planned for. This is not a schedule line; it is real commercial ' +
      'volume that now has to be re-planned.',
    say:
      'Open the detail and point at the launch scope. The problem is not the gate date &mdash; it is that ' +
      'the launch is building fewer good commercial batches than the plan assumed.',
    target: { view: 'launch', param: 'seed_launch_varipulse_g2' },
    spot: [
      ['#ld-phase', 'P3 · commercial build for launch'],
      ['#ld-strip', 'the launch scope now short of planned batches'],
    ],
  },
  {
    t: 'A defect the line found by itself',
    p:
      'Execution, My decisions. <b>NPI-0412</b> &mdash; a line monitor broke an SPC rule on <b>line 3</b>: ' +
      '<b>3 commercial batches out of spec</b> on the dimensional check. Line 5 is clean. Nobody asked it ' +
      'to look. The card already carries the agent&rsquo;s read: hold the 3 batches, keep supply on line 5, ' +
      'and re-plan the shortfall.',
    say:
      'This is where a manufacturing signal becomes a decision. Watch what it turns into &mdash; not a ' +
      'schedule slip, a question about which markets get the reduced volume.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'pending' },
    spot: [
      ['#v-actions .sb-r', 'pending · escalated · her own history'],
      ['#v-actions .sb-p.on .dr[data-npi="NPI-0412"]', 'NPI-0412 · line 3, found by an agent'],
    ],
  },
  {
    t: 'How it reached her — agent by agent',
    p:
      'Agent orchestration, filtered to <b>Vaccines</b>. The card for <b>NPI-0412</b> shows the ' +
      'chain verb by verb: the <b>Line Monitor</b> flagged the drift, the <b>Quality agent</b> re-measured ' +
      'the commercial batches and confirmed 3 out of tolerance, the <b>Planning agent</b> modelled the ' +
      'volume shortfall against the launch plan &mdash; and then it <b>stopped on her</b>, because ' +
      're-prioritising which markets get the reduced volume is not the fleet&rsquo;s call.',
    say:
      'Several agents, minutes, no meeting. The clearest example of the handoff in the fleet: a dimensional ' +
      'drift on a line becomes a commercial-priority decision on her desk.',
    target: { branch: 'exec', view: 'tower', towerPane: 'live', towerFranchise: 'Vaccines', towerOpenCard: 'seed_finding_412' },
    spot: [['#c-seed_finding_412 .tbwk', 'line monitor → quality → planning → you']],
  },
  {
    t: 'What the fleet may not do on its own',
    p:
      'The autonomy band, on the board KPIs. Most activities run without asking anyone. <b>Prioritising ' +
      'markets is deliberately outside that band</b> &mdash; deciding which markets get less product is a ' +
      'commercial and planning trade-off, not a rule an agent can apply. So the chain did the analysis and ' +
      'then <b>stopped for her decision</b>. That boundary is configured, not improvised.',
    say: 'This is the answer to &ldquo;what decides what reaches me?&rdquo; &mdash; a market-priority call always does.',
    target: { branch: 'exec', view: 'tower', towerPane: 'live' },
    spot: [
      ['#kpi .tbkc:nth-child(3)', 'stopped and waiting on her'],
      ['#kpi .tbkc:nth-child(5)', 'closed with no human at all'],
    ],
  },
  {
    t: 'Three good batches, and why they matter',
    p:
      'The record, opened. Line 3 produced <b>3 commercial batches out of spec</b> on the dimensional ' +
      'check. For scale: <b>V&amp;V produces 3 batches as the norm</b> (a validation run was 12 at one ' +
      'site), so three affected commercial batches is a full run&rsquo;s worth of launch supply. There is ' +
      'an <b>overdue CAPA</b> open on line 3 &mdash; overdue because its <b>DMAIC is still in progress</b>. ' +
      'Line 5 is holding supply, so this is a volume question, not a stoppage.',
    say:
      'Point at the problem statement. &ldquo;A full run&rsquo;s worth of commercial batches, and the CAPA ' +
      'is overdue&rdquo; is the phrase that turns a quality event into a market-priority decision.',
    target: { view: 'issue', param: 'seed_finding_412' },
    spot: [
      ['#pb-txt', 'three commercial batches — a full V&V run’s worth'],
      ['#is-capa', 'CAPA overdue — its DMAIC still in progress'],
    ],
  },
  {
    t: 'Three ways to handle it',
    p:
      'The options, modelled against the live plan. <b>Option A &mdash; re-prioritise markets</b> and ' +
      'redistribute the reduced commercial volume: protect the lead markets, defer the lower-priority ' +
      'ones. It is the recommendation. <b>Option B &mdash; drive the in-progress DMAICs</b> to close the ' +
      'overdue CAPA and re-operate line 3 quickly. <b>Option C &mdash; move output to another qualified ' +
      'site</b>, same modality &mdash; viable only if the agents confirm regulatory/engineering clearance ' +
      'and that the site actually has capacity.',
    say:
      'Three options, one trade-off table, each modelled against the live plan. All three hold G3 &mdash; ' +
      'the difference is where the reduced volume lands and how fast line 3 comes back.',
    target: null,
    spot: [
      ['#opt-a', 'recommended · re-prioritise markets'],
      ['#opt-b', 'drive the DMAIC to close the CAPA'],
      ['#opt-c', 'another site, same modality — if capacity'],
    ],
  },
  {
    t: 'The plan the agents can run',
    p:
      'The recommended option builds an action plan: <b>quarantine the 3 out-of-spec batches</b>, ' +
      '<b>continue commercial supply from line 5</b>, <b>re-weight the allocation across markets</b>, and ' +
      '<b>re-baseline P3 to hold G3</b> &mdash; four of the five steps the agents can run themselves. The ' +
      'fifth, approving the revised market priority, is a person&rsquo;s call.',
    say:
      'This is the &ldquo;what happens after I approve&rdquo; part. Four steps go straight to the fleet; ' +
      'the market-priority approval is flagged for a human, because it is a commercial trade-off.',
    target: null,
    spot: [['#run-all', 'four of the five steps the agents can run']],
  },
  {
    t: 'The agents converge on a market call',
    p:
      'The escalation thread, in their own words. The <b>Line Monitor</b> scoped it to 3 commercial ' +
      'batches on line 3, line 5 clean. <b>A. Kowalski</b> confirmed the line-3 CAPA is overdue because its ' +
      'DMAIC is still in progress, so line 3 cannot be re-qualified yet. The <b>Planning agent</b> then ' +
      'modelled the shortfall: redistribute across markets, or move output to another qualified site.',
    say:
      'Four entries, three functions and an agent, handed cleanly from one to the next &mdash; and here it lands on ' +
      'a question no single owner can answer: which markets take the reduced volume?',
    target: null,
    spot: [['#thr-417', 'line monitor → quality → planning']],
  },
  {
    t: 'Why the CAPA is overdue',
    p:
      'Back on the record, the overdue CAPA is the crux of the timing. It is open on line 3 for the ' +
      'dimensional drift, and it is <b>overdue because its DMAIC is still in progress</b>: Measure and ' +
      'Analyse are complete and point at tool wear, but <b>Improve and Control are not signed</b>. Until ' +
      'the DMAIC closes, line 3 cannot be re-qualified for commercial output &mdash; which is exactly what ' +
      'Option B sets out to accelerate.',
    say:
      'This is why the recommendation is to re-prioritise markets rather than wait: line 3 comes back only ' +
      'when the DMAIC signs off, and that is not a date she can force from here.',
    target: { view: 'issue', param: 'seed_finding_412' },
    spot: [
      ['#is-capa', 'CAPA-2026-0149 · overdue'],
      ['.is-meta', 'the DMAIC in progress behind it'],
    ],
  },
  {
    t: 'One decision',
    p:
      'She approves the recommended route &mdash; <b>re-prioritise markets and redistribute the reduced ' +
      'commercial volume</b>, protecting the lead markets and deferring the lower-priority ones. That is ' +
      'the only thing a human does in this case; the four agent steps run from it.',
    say: 'Click Approve on the screen, then come back and press Next.',
    target: { view: 'issue', param: 'seed_finding_412' },
    spot: [['#btn-app', 'click this, then press Next']],
  },
  {
    t: 'Her own record',
    p:
      'My actions, History. Every decision she took, with its outcome &mdash; and the <b>NPI-0412</b> ' +
      'market-priority call she just approved is now the newest row on it, marked <b>Decision taken</b>. ' +
      'The four agent steps are already running against it.',
    say:
      'This is what she shows her manager. Point at the NPI-0412 row at the top &mdash; the exact decision ' +
      'from this demo, now on her record. Her decisions only; what the agents did on their own is kept ' +
      'separate, on purpose.',
    target: { branch: 'exec', view: 'actions', actionsPane: 'history' },
    spot: [['#ev-list .ev[data-npi="NPI-0412"]', 'the market-priority call she just approved']],
  },
  {
    t: 'And the fleet’s record',
    p:
      'Agent orchestration, activity log &mdash; the whole fleet. The same <b>NPI-0412</b> decision she ' +
      'just took shows here from the other side: the line-monitor detection, the re-measure, the CAPA/DMAIC ' +
      'status, the shortfall model &mdash; timestamped, attributed, tied to the finding and the launch. Her ' +
      'record shows the decision; the fleet&rsquo;s record shows the work under it.',
    say:
      'This is the screen an auditor asks for. Point at the NPI-0412 rows &mdash; the exact same event as ' +
      'the row on her history, seen from the fleet side. Two records that reconcile on one id.',
    target: { branch: 'exec', view: 'tower', towerPane: 'past', towerFranchise: 'all' },
    spot: [
      ['#lg-b .lg-r[data-npi="NPI-0412"]', 'the same NPI-0412 event, from the fleet side'],
      ['.lg-n', 'every action, every agent'],
    ],
  },
  {
    t: 'Two lines, three batches, one decision',
    p:
      'Ask the copilot what is putting Comirnaty&rsquo;s commercial batches at risk and it says it in one ' +
      'answer: line 3 has produced <b>3 batches out of spec</b> while line 5 is clean, an <b>overdue ' +
      'CAPA</b> is open because its <b>DMAIC is still in progress</b>, and &mdash; since V&amp;V produces ' +
      '<b>3 batches as the norm</b> &mdash; that is a full run&rsquo;s worth of launch volume. The three ' +
      'routes are re-prioritise markets, drive the DMAIC to close, or move to another qualified site. Every ' +
      'answer ends in a button that opens the record.',
    say:
      'That is the whole case in one answer: a manufacturing defect that becomes a market-priority call ' +
      '&mdash; and the redistribution Helena just approved is the move that protects the lead markets while ' +
      'line 3 comes back.',
    target: { branch: 'exec', view: 'chat', chatAsk: 'supplier' },
    scroll: false,
    spot: [
      ['#cq-thread .cq-ev', 'line 3 out of spec, line 5 clean'],
      ['#cq-thread .cq-rec', 're-prioritise markets and redistribute'],
      ['#cq-thread .cq-act', 'buttons that open the record'],
    ],
  },
];

/* ── Demo 4 — a regulator moves a date and the plan re-plans itself ─────
 * (16 steps, end to end — the same journey shape as the other three, anchored
 * on the connected-milestone / dynamic-cascade case.) The FDA slips Velsipity's
 * 510(k) clearance six weeks; the platform cascades the impact across five
 * downstream commitments, auto-adjusting the three it safely can and surfacing
 * the two that need a human. Drives its own self-contained subsystem
 * (RegulatoryMilestone + CascadeImpactItem via CascadeReplanService) plus the
 * already-modelled Velsipity launch record and the `cascade` copilot answer. It
 * adds NO finding and touches NO Comirnaty activity, so the reconciliation lock
 * holds and every count still ties out. The Milestone-replan screen is
 * repeatable — its reset restores the pre-slip baseline — so the tour can be
 * run again and again from a clean state. */
const GD4: Step[] = [
  {
    t: 'Three ways in — today a regulator moves a date',
    p:
      'The same three entry points Helena always has: <b>01 define</b> the launch, <b>02 see</b> it, ' +
      '<b>03 execute</b> it. This walkthrough follows a single outside event &mdash; the <b>FDA slips ' +
      'Velsipity&rsquo;s clearance six weeks</b> &mdash; all the way through to a plan that re-plans itself. ' +
      '01 is a design workspace and is not built out here; today is 02 and 03.',
    say:
      'Today the trigger is a regulator, and the story is what happens <i>downstream</i> of a date nobody ' +
      'controls. Click <b>02 Pipeline Status Overview</b>, or press Next &mdash; the demo goes there either way.',
    target: { screen: 'menu' },
    scroll: false,
    spot: [
      ['.mc.dim', '01 &middot; not built out in this demo'],
      ['.mc:nth-of-type(2)', '02 &middot; we start here &rarr;'],
      ['.mc:last-of-type', '03 &middot; and we finish here'],
    ],
  },
  {
    t: 'The launch that is waiting on a clearance',
    p:
      'The screening pass. Most of the portfolio is in-market work, but <b>Velsipity</b> &mdash; the robotic ' +
      'surgical platform &mdash; is <b>pre-market</b>, first ship targeted at Q2 2027, its whole plan hung off ' +
      'one FDA 510(k) clearance date. Nothing is on fire yet: manufacturing has built launch stock, the loaner ' +
      'kits are staged, the field is trained. That is exactly the calm before a date moves.',
    say:
      'She is deciding where to look. A pre-market launch with everything staged is the one most exposed to a ' +
      'clearance slip &mdash; every downstream commitment is already committed against the old date.',
    target: { branch: 'pipeline', view: 'cockpit' },
    scroll: false,
    spot: [
      ['#v-cockpit .kc:nth-child(2)', 'the portfolio at a glance'],
      ['#v-cockpit .kc:nth-child(4)', 'schedule discipline — before the slip'],
    ],
  },
  {
    t: 'Find Velsipity in the portfolio',
    p:
      'Portfolio, product lens. Nine launches, one line each. <b>Velsipity Robotic Platform Kit</b> is the ' +
      'pre-market line &mdash; Neuroscience, Class II, lead market Germany, first ship Q2 2027. Its gates are ' +
      'still ahead of it; the clearance milestone is the one that sets everything after it.',
    say:
      'Product lens, because the question is <i>which device</i> is exposed to the clearance date. It is the ' +
      'capital platform, not a catheter &mdash; a launch where one regulatory date gates the whole rollout.',
    target: { branch: 'pipeline', view: 'portfolio', lens: 'product' },
    spot: [
      ['#v-portfolio .pf-sw', 'four lenses, one screen'],
      ['.tkr[data-launch="seed_launch_ottava"]', 'Velsipity · pre-market · one clearance date gates it all'],
    ],
  },
  {
    t: 'Everything hangs off one clearance date',
    p:
      'Open Velsipity. The record shows what is already committed against the original clearance: a ' +
      '<b>launch build of 40 units</b>, a <b>field force part-certified</b>, registrations filed. This is the ' +
      'point of the case &mdash; the plan is real, physical and staged, so a six-week slip is not a line on a ' +
      'chart, it is stock in a warehouse and reps trained for the wrong month.',
    say:
      'Point at the launch-scope card. Build stock, loaner kits, a certified field &mdash; every one of these is ' +
      'a downstream commitment that assumed the old date. That is what has to re-plan when the date moves.',
    target: { view: 'launch', param: 'seed_launch_ottava' },
    spot: [
      ['#ld-phase', 'pre-market — clearance is the gating milestone'],
      ['#ld-supply', 'critical supply, staged against the old date'],
    ],
  },
  {
    t: 'The connected-milestone screen',
    p:
      'Pipeline, <b>Milestone replan</b>. This is the exception dashboard for Velsipity&rsquo;s ' +
      '<b>FDA 510(k) clearance</b>. Right now the milestone is <b>on track</b> at 02 Nov, and the panel spells ' +
      'out the situation in plain words: launch stock built, kits at the 3PL, field trained for the original ' +
      'go-live. Nothing has moved &mdash; yet.',
    say:
      'This screen exists to answer one question the moment a date slips: <i>what now depends on it, and which ' +
      'of those can move themselves?</i> Watch the KPI band &mdash; on track, zero slip, nothing waiting on a person.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-kpis .kc:nth-child(1)', 'the FDA clearance milestone — on track, for now'],
      ['.cs-hint', 'stock built, kits staged, field trained — against the old date'],
    ],
  },
  {
    t: 'The FDA slips it six weeks',
    p:
      'The clearance moves from <b>02 Nov to 14 Dec</b> &mdash; a <b>six-week slip</b> on a date Helena cannot ' +
      'pull in. Press the button and the platform does in one pass what used to be three days of manual rework: ' +
      'it walks every downstream commitment, moves the ones that follow a rule, and stops on the ones that need a ' +
      'judgement. Watch the KPI band change.',
    say:
      'Press <b>&ldquo;FDA slips 6 weeks &mdash; run cascade replan&rdquo;</b> on the screen, then press Next. ' +
      'The demo also runs it for you &mdash; either way, the six weeks fan out across the whole plan.',
    target: { branch: 'pipeline', view: 'cascade', cascadeRun: true },
    scroll: false,
    spot: [
      ['#cs-run', 'one button — the six-week slip, cascaded'],
      ['#cs-kpis .kc:nth-child(1)', '+6 wks · 02 Nov → 14 Dec'],
    ],
  },
  {
    t: 'Three auto-adjusted, two need a human',
    p:
      'The slip has fanned out. The exception summary is the whole story in three numbers: ' +
      '<b>five downstream commitments</b>, <b>three auto-adjusted</b> by the platform, <b>two that need a human ' +
      'decision</b> &mdash; and the <b>working-capital impact leadership sees in real time</b>. This is the ' +
      'exception-based decision surface: the plan re-planned itself, and only the genuine judgement calls ' +
      'surfaced.',
    say:
      'This is the number that matters. The six-week slip did not become a ten-week scramble &mdash; it became ' +
      'three automatic re-times and two decisions, both on one screen, both takeable in the same meeting.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-auto-kpi', '3 auto-adjusted · no human needed'],
      ['#cs-human-kpi', '2 need a decision · exception surface'],
      ['#cs-kpis .kc:nth-child(4)', 'working-capital impact, in real time'],
    ],
  },
  {
    t: 'What the platform moved on its own',
    p:
      'The left column &mdash; the three commitments that follow a rule, so the platform re-timed them and ' +
      '<b>recorded what it did rather than asking</b>. <b>Production Run 2</b> is held to the new clearance. ' +
      'The <b>loaner-kit deployment</b> across US geographies is re-timed to the new go-live. The ' +
      '<b>KOL pre-announcement accounts</b> are flagged for proactive outreach, so nobody is selling a date the ' +
      'FDA just moved.',
    say:
      'This is the manual rework that used to eat three days &mdash; manufacturing, logistics and commercial, ' +
      'each re-planned by hand. Here each one carries a one-line &ldquo;what the platform did&rdquo;, timestamped ' +
      'and auditable.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-auto-list', 'held · re-timed · flagged — automatically'],
      ['#cs-auto-list .cs-item:first-child', 'Run 2 held to the new clearance date'],
    ],
  },
  {
    t: 'The first call that is genuinely hers',
    p:
      'The right column &mdash; the two the cascade <b>cannot</b> make for her. The first is <b>Finance</b>: six ' +
      'extra weeks of finished-goods storage. <b>Extend the 3PL slot</b> (+&euro;48k carrying cost, zero re-stage ' +
      'risk) or <b>repatriate to the regional DC</b> (saves &euro;36k but adds a 9-day re-stage before go-live). ' +
      'That is a real trade-off &mdash; carrying cost against schedule risk &mdash; and it is <b>J. Ruiz&rsquo;s</b> to own.',
    say:
      'This is why it stopped for a human. There is no rule that says cash-vs-risk; it depends on how confident ' +
      'the team is the new date holds. The platform frames the choice and the cost, and leaves the judgement to her.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-human-list .cs-item:first-child', 'storage: €48k carrying cost vs a 9-day re-stage'],
      ['#cs-human-list .cs-item:first-child .cs-prompt', 'the trade-off, in one line'],
    ],
  },
  {
    t: 'And the second — a trained field going stale',
    p:
      'The second decision is <b>field readiness</b>. The field was certified for the original go-live, and a ' +
      'six-week slip pushes certification currency past the new date. <b>Recertify now</b> (everyone current ' +
      'today, but risks a second lapse if clearance moves again) or <b>schedule one refresh two weeks out</b> ' +
      '(a single touch, tighter margin). <b>T. Bergmann</b> owns the call.',
    say:
      'Same shape as the finance call: a genuine judgement the cascade will not fake. Recertify-now buys ' +
      'certainty and spends effort; a single late refresh is leaner but assumes the date holds. Her call, not a rule&rsquo;s.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-human-list .cs-item:nth-child(2)', 'field certification currency vs the new go-live'],
      ['#cs-human-list .cs-item:nth-child(2) .cs-opts', 'recertify now, or one refresh close to go-live'],
    ],
  },
  {
    t: 'She resolves both in the same meeting',
    p:
      'She takes the finance call &mdash; <b>extend the 3PL storage</b>, six weeks, &euro;48k, no re-stage risk ' +
      'so close to a launch. The moment she does, the exception count drops: <b>two needing a decision becomes ' +
      'one</b>, and the resolved item moves to <b>Decided</b>, its choice recorded on the card.',
    say:
      'Click the <b>&ldquo;Extend 3PL storage&rdquo;</b> option on the finance card, then press Next. This is the ' +
      'whole promise of the screen &mdash; a decision taken in seconds, on the same surface that surfaced it.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-human-list .cs-item:first-child .cs-opts', 'pick "Extend 3PL storage", then press Next'],
      ['#cs-human-kpi', 'watch this fall 2 → 1'],
    ],
  },
  {
    t: 'One decision left, and the cost is booked',
    p:
      'After the finance call the board reads <b>one decision resolved, one still open</b>, and the ' +
      '<b>working-capital number is now committed</b>, not a hypothetical &mdash; leadership sees the &euro;48k ' +
      'carrying cost the instant she decides. The field-readiness call is the only human item still waiting.',
    say:
      'This is the exception surface doing its job across a meeting: what was five commitments and a three-day ' +
      'scramble is now one open decision and a cost everyone can see. Nothing is hidden and nothing is waiting on rework.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-human-kpi', 'one resolved, one open'],
      ['#cs-kpis .kc:nth-child(4)', 'the €48k, now committed and visible'],
    ],
  },
  {
    t: 'The milestone, re-planned',
    p:
      'The milestone card carries the new reality: <b>clearance 02 Nov &rarr; 14 Dec, +42 days</b>, status ' +
      '<b>re-planned</b>. Everything downstream now references this date &mdash; the held run, the re-timed kits, ' +
      'the flagged accounts, the extended storage &mdash; instead of the original one. One date changed, and the ' +
      'whole connected plan moved with it.',
    say:
      'This is connected milestone management in one line: the authority date is the anchor, and every commitment ' +
      'is wired to it. Change the anchor and the plan re-plans &mdash; the manual part is only the judgement calls.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-kpis .kc:nth-child(1)', '02 Nov → 14 Dec · +42 days · re-planned'],
      ['#cs-auto-kpi', 'the three that moved with it'],
    ],
  },
  {
    t: 'The commitments, re-timed against the new date',
    p:
      'Back on the Velsipity record, the launch scope now reads against the <b>new clearance</b>: the build is ' +
      'held for the later date, the kit deployment and field plan reference the new go-live. The record and the ' +
      'replan screen reconcile &mdash; one date, one connected plan, the same numbers on every screen.',
    say:
      'This is the reconciliation point. The replan dashboard is not a separate spreadsheet &mdash; it is the ' +
      'same launch, so what she decided on the exception surface is what the record shows.',
    target: { view: 'launch', param: 'seed_launch_ottava' },
    spot: [
      ['#ld-strip', 'the launch, now against the new clearance'],
      ['#ld-phase', 'still pre-market — but re-planned, not scrambled'],
    ],
  },
  {
    t: 'Or she could have just asked',
    p:
      'Everything we clicked through, the copilot answers from the same connected plan. Ask it what Velsipity&rsquo;s ' +
      'six-week slip moves and it says it in one answer: <b>three commitments re-timed themselves</b> ' +
      '(manufacturing, logistics, commercial), <b>two need a human</b> (the &euro;48k storage call and the field ' +
      'refresh), and the working-capital impact is visible now. Every answer ends in a button that opens the record.',
    say:
      'She could have started here. The honest read is the same one the screen gave her: take the two judgement ' +
      'calls, and let the three rule-bound commitments re-plan themselves.',
    target: { branch: 'exec', view: 'chat', chatAsk: 'cascade' },
    scroll: false,
    spot: [
      ['#cq-thread .cq-ev', 'three auto-adjusted, two that need you'],
      ['#cq-thread .cq-rec', 'take the two calls; the rest re-planned itself'],
      ['#cq-thread .cq-act', 'buttons that open the record'],
    ],
  },
  {
    t: 'One date moved, and the plan kept up',
    p:
      'That is the case. A regulator moved a date Helena could not control, and instead of three days of manual ' +
      'rework across manufacturing, logistics and commercial, the plan re-planned itself: <b>three commitments ' +
      'auto-adjusted, two decisions surfaced, both taken in one sitting</b>, and the carrying-cost impact visible ' +
      'to leadership from the first minute. Connected milestones, automated downstream re-planning, and an ' +
      'exception-based decision surface &mdash; on one screen.',
    say:
      'The slip was six weeks; the response was one meeting. To run the whole cascade again from a clean slate, ' +
      'press <b>Reset scenario</b> on this screen &mdash; it restores the pre-slip baseline. Then press Finish.',
    target: { branch: 'pipeline', view: 'cascade' },
    scroll: false,
    spot: [
      ['#cs-auto-kpi', 'three re-timed automatically'],
      ['#cs-human-kpi', 'two decisions, taken in one sitting'],
      ['#cs-kpis .kc:nth-child(4)', 'working capital, visible from minute one'],
    ],
  },
];

/* ── The demo registry the picker chooses from ────────────────────────── */
const DEMOS: Demo[] = [
  {
    id: 'capa',
    chip: 'STERILISATION SLOT',
    title: 'A steriliser drops a booked slot',
    blurb:
      'A supply shock. A contract steriliser cancels a booked chamber slot; an agent catches it, five agents work it, and exactly one decision — worth €18.4M — reaches Helena.',
    steps: GD,
  },
  {
    id: 'regulatory',
    chip: 'REGULATORY',
    title: 'Two agencies, two clocks',
    blurb:
      'A regulatory read. An open FDA deficiency letter she can only wait on, a Notified Body signature that is hers to push today, and the site visit to be ready for.',
    steps: GD2,
  },
  {
    id: 'supplier',
    chip: 'MANUFACTURING',
    title: 'Commercial batches at risk',
    blurb:
      'A manufacturing call. Comirnaty builds on two lines; line 3 gives three out-of-spec commercial batches and its CAPA is overdue with the DMAIC still open, so Helena re-prioritises markets while line 3 comes back.',
    steps: GD3,
  },
  {
    id: 'cascade',
    chip: 'MILESTONE REPLAN',
    title: 'A regulator slips a date',
    blurb:
      'A dynamic cascade replan. The FDA slips Velsipity’s clearance six weeks; the plan re-plans itself — three downstream commitments auto-adjust, two decisions reach Helena, and she resolves both in one meeting.',
    steps: GD4,
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
     React may drop the additive class on re-render, so we re-assert both. */
  const track = useCallback(() => {
    if (!marksRef.current.length) return;
    marksRef.current.forEach((m) => {
      if (!m.el.classList.contains('gdp-spot')) m.el.classList.add('gdp-spot');
    });
    place();
  }, [place]);

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

  /* FINISH (the last step's button): the demo is genuinely over, so tear it
     down AND reset — give the fleet back, return to the menu, and rewind to the
     first step so the next launch starts clean. */
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
    /* the demo narrowed the tower to one franchise; give the fleet back. */
    drive({ branch: 'exec', view: 'tower', towerPane: 'live', towerFranchise: 'all' });
    setTimeout(() => drive({ screen: 'menu' }), 0);
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
            &#10005;
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
          &#10005;
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
