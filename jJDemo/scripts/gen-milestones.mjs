/*
 * Regulatory milestones and their cascade impact items.
 *
 * WHY THIS EXISTS: the milestone-replan screen only ever had one scenario — a
 * single FDA approval on one launch — and its five impact items were hard-bound
 * to that milestone's id. Any other milestone cascaded to nothing, so there was
 * no way to show the behaviour on a second authority or a second product.
 *
 * Scenarios are declared once in SCENARIOS below; adding another is a data edit
 * here, not new JSON by hand. Each scenario carries its own impact items,
 * because the point of the screen is that the blast radius is specific: an EMA
 * opinion slipping hits tender windows and affiliate comms, an NMPA approval
 * slipping hits import licences and a local partner, and a post-launch variation
 * hits artwork and in-market stock. Generic items would make the demo say
 * nothing.
 *
 * Every item is either AUTO (the tower adjusts it and says what it did) or HUMAN
 * (it needs a decision, with the options stated). The split is the whole
 * argument of the screen, so each scenario keeps both.
 *
 * RUN: node scripts/gen-milestones.mjs   (from the jJDemo package root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* Owners referenced by the HUMAN items — must exist in seed/Person. */
const P = {
  quality: 'seed_person_ak',
  regulatory: 'seed_person_sl',
  supply: 'seed_person_ap',
  commercial: 'seed_person_tb',
  access: 'seed_person_dm',
  mfg: 'seed_person_lh',
  logistics: 'seed_person_rd',
  legal: 'seed_person_jr',
};

const SCENARIOS = [
  {
    key: 'pf3945_obesity_fda',
    launch: 'seed_launch_pf3945_obesity',
    displayId: 'REG-PF-3945-FDA',
    authority: 'FDA',
    milestoneName: 'FDA NDA Approval — US launch',
    baselineDate: '2026-11-02',
    /* The default demo slip: six weeks. */
    suggestedSlip: 42,
    items: [
      {
        domain: 'MANUFACTURING', domainLabel: 'Manufacturing',
        targetLabel: 'Production Run 2 (launch-stock top-up)',
        detail: 'Launch stock from Run 1 is already built. Run 2 was scheduled to top up for go-live; with approval six weeks out it would build inventory that only accrues carrying cost.',
        resolution: 'AUTO',
        autoAction: 'Held Run 2 six weeks; freed the Puurs line window and notified Manufacturing (L. Haugen). Run 1 stock re-earmarked to cover the shifted go-live.',
      },
      {
        domain: 'SUPPLY', domainLabel: 'Launch stock',
        targetLabel: 'Starter-stock staging to the regional DC',
        detail: 'Staging was timed to land a fortnight before the original approval date. Moving it keeps the stock at the fill site instead of paying to hold it forward.',
        resolution: 'AUTO',
        autoAction: 'Re-timed staging to six weeks later and released the DC inbound slot. Logistics (R. Devi) notified.',
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Commercial comms',
        targetLabel: 'Affiliate launch communications and HCP pre-announcement',
        detail: 'Pre-announcement was scheduled against the original date. Sending it now would commit the field force to a date the authority has moved.',
        resolution: 'AUTO',
        autoAction: 'Paused the pre-announcement sequence and re-based it on the new date. Commercial (T. Bergmann) notified with the revised calendar.',
      },
      {
        domain: 'FINANCE', domainLabel: 'Working capital',
        targetLabel: 'Finished-goods storage and carrying cost',
        detail: 'Six extra weeks of finished-goods storage at the 3PL is a working-capital call: extend the current agreement, or repatriate launch stock to the regional DC to cut carrying cost at the price of a re-stage before go-live.',
        resolution: 'HUMAN', owner: P.legal, costImpact: 48000,
        decisionPrompt: 'Extend 3PL storage six weeks, or repatriate launch stock to the regional DC?',
        decisionOptions: [
          'Extend 3PL storage +6 weeks (+€48k carrying cost, zero re-stage risk)',
          'Repatriate to regional DC (+€12k move, saves €36k, adds a 9-day re-stage before go-live)',
        ],
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Field readiness',
        targetLabel: 'Field-force certification window',
        detail: 'Certification completes four weeks before the original date. Holding it means re-certifying lapsed reps; running it now means a six-week gap between certification and first call.',
        resolution: 'HUMAN', owner: P.commercial, dayShift: 0,
        decisionPrompt: 'Certify now and accept the gap, or re-time certification to the new date?',
        decisionOptions: [
          'Certify on the original window (no re-work, 6-week knowledge gap before first call)',
          'Re-time certification to the new date (+€22k re-scheduling, field ready at go-live)',
        ],
      },
    ],
  },

  {
    key: 'berobenatide_obesity_ema',
    launch: 'seed_launch_berobenatide_obesity',
    displayId: 'REG-BERO-EMA',
    authority: 'EMA / CHMP',
    milestoneName: 'CHMP Opinion — EU marketing authorisation',
    baselineDate: '2027-03-15',
    suggestedSlip: 35,
    items: [
      {
        domain: 'REGULATORY', domainLabel: 'Regulatory',
        targetLabel: 'National phase filings across the 27 member states',
        detail: 'National phase cannot start before the opinion. Every downstream national submission date was derived from it.',
        resolution: 'AUTO',
        autoAction: 'Re-derived all 27 national submission dates from the new opinion date and re-issued the filing calendar to Regulatory (S. Lindqvist).',
      },
      {
        domain: 'SUPPLY', domainLabel: 'Packaging',
        targetLabel: 'EU multi-language artwork and serialisation release',
        detail: 'Printed components were scheduled to release against the original opinion. Releasing early risks artwork that no longer matches the approved label.',
        resolution: 'AUTO',
        autoAction: 'Held printed-component release until opinion+5d and kept the serialisation master in draft. GPLO notified.',
      },
      {
        domain: 'MANUFACTURING', domainLabel: 'Manufacturing',
        targetLabel: 'Puurs prefilled-syringe launch build',
        detail: 'The launch build was sequenced to finish just before the opinion. It can hold without losing the line window.',
        resolution: 'AUTO',
        autoAction: 'Shifted the build five weeks and re-confirmed the Puurs line window; Vetter Ravensburg secondary capacity released.',
      },
      {
        domain: 'MARKET_ACCESS', domainLabel: 'Market access',
        targetLabel: 'Germany and France tender windows',
        detail: 'Germany tenders in Q2 and Q4 only. A five-week slip misses the Q2 window, which means either entering at Q4 or filing for an interim reimbursement price.',
        resolution: 'HUMAN', owner: P.access, costImpact: 0, dayShift: 0,
        decisionPrompt: 'Miss the Q2 German tender and wait for Q4, or seek an interim price?',
        decisionOptions: [
          'Wait for the Q4 tender (no cost, ~€8.4M revenue deferred two quarters)',
          'File for an interim reimbursement price (enters on time, sets a lower reference price for the EU)',
        ],
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Commercial',
        targetLabel: 'EU affiliate launch sequence',
        detail: 'Nine affiliates were sequenced off the opinion date. Holding all nine protects the sequence; releasing the four that do not depend on national pricing gets revenue earlier but breaks the wave.',
        resolution: 'HUMAN', owner: P.commercial,
        decisionPrompt: 'Hold all nine affiliates, or release the four that are price-independent?',
        decisionOptions: [
          'Hold all nine to the new date (sequence intact, uniform messaging)',
          'Release the four price-independent affiliates first (earlier revenue, two-speed launch to manage)',
        ],
      },
    ],
  },

  {
    key: 'sigvotatug_nsclc_fda',
    launch: 'seed_launch_sigvotatug_nsclc',
    displayId: 'REG-SIGVO-FDA',
    authority: 'FDA',
    milestoneName: 'FDA BLA Approval — US launch',
    baselineDate: '2027-04-12',
    suggestedSlip: 21,
    items: [
      {
        domain: 'MANUFACTURING', domainLabel: 'Drug substance',
        targetLabel: 'Grange Castle conjugation campaign',
        detail: 'The conjugation suite was booked to deliver drug substance against the original approval. The campaign can slip three weeks inside the suite booking.',
        resolution: 'AUTO',
        autoAction: 'Moved the conjugation campaign three weeks and held the suite booking; PharmSci and Site Grange Castle notified.',
      },
      {
        domain: 'QUALITY', domainLabel: 'Quality',
        targetLabel: 'Lyophilisation cycle requalification',
        detail: 'Requalification was timed to close before approval. A three-week slip keeps it well inside its validity window.',
        resolution: 'AUTO',
        autoAction: 'Re-timed the requalification and confirmed the protocol stays valid to Q3 2027. ALIMS notified.',
      },
      {
        domain: 'SUPPLY', domainLabel: 'Cold chain',
        targetLabel: 'Cold-chain lane qualification for the US launch',
        detail: 'Lane qualification shipments were booked to complete before approval; they can move without re-opening the protocol.',
        resolution: 'AUTO',
        autoAction: 'Re-booked the qualification shipments with DHL Life Sciences and kept the lane protocol open. Logistics notified.',
      },
      {
        domain: 'SUPPLY', domainLabel: 'Shelf life',
        targetLabel: 'Launch-stock expiry against the new go-live',
        detail: 'Launch stock was filled against the original date. Three more weeks on the shelf leaves under 18 months dating for the wholesaler contracts, which some accounts will reject.',
        resolution: 'HUMAN', owner: P.supply, costImpact: 210000, dayShift: 0,
        decisionPrompt: 'Ship the existing stock with shorter dating, or re-fill for full shelf life?',
        decisionOptions: [
          'Ship existing stock (no cost, ~11% of accounts may refuse on dating)',
          'Re-fill a partial campaign (+€210k, full 24-month dating, needs a Grange Castle slot)',
        ],
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Market access',
        targetLabel: 'US payer contracting effective dates',
        detail: 'Payer contracts were written to an effective date tied to the original approval. Re-papering them costs legal time; leaving them means a three-week window with no contracted price.',
        resolution: 'HUMAN', owner: P.access,
        decisionPrompt: 'Re-paper the payer contracts, or bridge the three-week gap?',
        decisionOptions: [
          'Re-paper all contracts to the new date (+3 weeks legal effort, clean pricing from day one)',
          'Bridge with a letter of intent (fast, exposes ~€1.2M to a retroactive rebate claim)',
        ],
      },
    ],
  },

  {
    key: 'pf08634404_crc_nmpa',
    launch: 'seed_launch_pf08634404_crc',
    displayId: 'REG-PF404-NMPA',
    authority: 'NMPA',
    milestoneName: 'NMPA Approval — China launch',
    baselineDate: '2029-01-18',
    suggestedSlip: 60,
    items: [
      {
        domain: 'REGULATORY', domainLabel: 'Regulatory',
        targetLabel: 'Import drug licence application',
        detail: 'The import licence is filed on approval and gates customs clearance. Its whole timeline derives from the approval date.',
        resolution: 'AUTO',
        autoAction: 'Re-based the import licence filing and the customs pre-clearance dossier on the new date. Regulatory China notified.',
      },
      {
        domain: 'SUPPLY', domainLabel: 'Packaging',
        targetLabel: 'Simplified-Chinese artwork and local labelling',
        detail: 'Local artwork release was set against the original approval; holding it avoids printing a label that may still change.',
        resolution: 'AUTO',
        autoAction: 'Held the Simplified-Chinese artwork at approved-draft and re-timed printed-component release two months.',
      },
      {
        domain: 'MANUFACTURING', domainLabel: 'Manufacturing',
        targetLabel: 'China-market fill campaign at Grange Castle',
        detail: 'The China campaign was slotted immediately before approval. Two months of slip can be absorbed by re-sequencing behind the EU campaign.',
        resolution: 'AUTO',
        autoAction: 'Re-sequenced the China campaign behind the EU build and confirmed the Grange Castle slot. Global Supply Chain notified.',
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Partner',
        targetLabel: 'Local distribution partner commitment',
        detail: 'The distribution agreement carries a minimum-volume commitment that starts on approval. Two months of slip pushes the first commitment period into the next tender cycle.',
        resolution: 'HUMAN', owner: P.legal, costImpact: 0, dayShift: 0,
        decisionPrompt: 'Re-negotiate the commitment start, or absorb the shifted first period?',
        decisionOptions: [
          'Re-negotiate the start date (legal effort, protects the volume floor)',
          'Absorb the shift (no effort, first-period shortfall risk ~€3.1M against the floor)',
        ],
      },
      {
        domain: 'MARKET_ACCESS', domainLabel: 'Market access',
        targetLabel: 'Volume-based procurement cycle entry',
        detail: 'VBP cycles are annual. A two-month slip misses this cycle, so entry is either next cycle or via provincial listing at a lower volume.',
        resolution: 'HUMAN', owner: P.access,
        decisionPrompt: 'Wait for the next VBP cycle, or enter via provincial listing?',
        decisionOptions: [
          'Wait for the next national VBP cycle (full volume, ~12 months later)',
          'Enter via provincial listings now (faster revenue, ~40% of the volume and a lower reference price)',
        ],
      },
    ],
  },

  {
    key: 'atirmociclib_mbc_ema',
    launch: 'seed_launch_atirmociclib_mbc',
    displayId: 'REG-ATIRMO-EMA',
    authority: 'EMA / CHMP',
    milestoneName: 'Type II Variation — label extension',
    baselineDate: '2027-02-08',
    suggestedSlip: 28,
    items: [
      {
        domain: 'SUPPLY', domainLabel: 'Packaging',
        targetLabel: 'Updated patient leaflet and carton artwork',
        detail: 'The variation changes the leaflet. Artwork was scheduled to release on approval; it can hold without affecting in-market supply.',
        resolution: 'AUTO',
        autoAction: 'Held the revised artwork and kept the current approved leaflet in production. GPLO notified.',
      },
      {
        domain: 'REGULATORY', domainLabel: 'Regulatory',
        targetLabel: 'National implementation notifications',
        detail: 'Each member state is notified on approval; the notification calendar derives from it.',
        resolution: 'AUTO',
        autoAction: 'Re-based the national notification calendar four weeks and re-issued it to the affiliates.',
      },
      {
        domain: 'COMMERCIAL', domainLabel: 'Medical',
        targetLabel: 'Updated prescriber materials and MSL briefing',
        detail: 'Materials referencing the extended label cannot be used before approval; the briefing was booked against the original date.',
        resolution: 'AUTO',
        autoAction: 'Re-timed the MSL briefing and locked the extended-label materials until approval. Clinical (J. Thomson) notified.',
      },
      {
        domain: 'SUPPLY', domainLabel: 'In-market stock',
        targetLabel: 'Existing in-market stock with the current leaflet',
        detail: 'Stock in market carries the pre-variation leaflet. Four extra weeks means more of it sells through — acceptable — but the changeover batch now straddles a quarter end.',
        resolution: 'HUMAN', owner: P.supply, costImpact: 0, dayShift: 0,
        decisionPrompt: 'Sell through existing stock, or recall-and-relabel the changeover batch?',
        decisionOptions: [
          'Sell through existing stock (no cost, mixed leaflets in market for ~5 weeks)',
          'Relabel the changeover batch (+€64k, single leaflet version in market)',
        ],
      },
      {
        domain: 'MARKET_ACCESS', domainLabel: 'Market access',
        targetLabel: 'Price re-negotiation tied to the extended indication',
        detail: 'Several markets tie a price review to the label extension. A four-week slip moves those reviews past the annual price-cut date in two of them.',
        resolution: 'HUMAN', owner: P.access,
        decisionPrompt: 'Open the price reviews now on the current label, or wait for the variation?',
        decisionOptions: [
          'Open reviews now (avoids the annual cut in two markets, weaker negotiating position)',
          'Wait for the variation (stronger case, exposes ~€1.8M to the annual price cut)',
        ],
      },
    ],
  },
];

/* ── emit ───────────────────────────────────────────────────────────── */

const iso = (d) => `${d}T00:00:00`;

const milestones = SCENARIOS.map((s) => ({
  id: `seed_milestone_${s.key}`,
  displayId: s.displayId,
  launch: { id: s.launch },
  authority: s.authority,
  milestoneName: s.milestoneName,
  baselineDate: s.baselineDate,
  currentDate: s.baselineDate,
  slipDays: 0,
  status: 'ON_TRACK',
}));

const items = [];
for (const s of SCENARIOS) {
  s.items.forEach((it, i) => {
    const row = {
      id: `seed_cascade_${s.key}_${i + 1}`,
      milestone: { id: `seed_milestone_${s.key}` },
      sortOrder: i + 1,
      domain: it.domain,
      domainLabel: it.domainLabel,
      targetLabel: it.targetLabel,
      detail: it.detail,
      resolution: it.resolution,
      costImpact: it.costImpact ?? 0,
      dayShift: it.dayShift ?? 0,
      status: 'PENDING',
    };
    if (it.resolution === 'AUTO') row.autoAction = it.autoAction;
    else {
      row.decisionPrompt = it.decisionPrompt;
      row.decisionOptions = it.decisionOptions;
      row.owner = { id: it.owner };
    }
    items.push(row);
  });
}

/* Sanity: every HUMAN item needs an owner that exists, and every scenario needs
   both resolutions or the screen's argument collapses. */
const people = new Set(
  JSON.parse(readFileSync(join(ROOT, 'seed', 'Person', 'Person.json'), 'utf8')).map((p) => p.id),
);
for (const it of items) {
  if (it.owner && !people.has(it.owner.id)) throw new Error(`unknown owner ${it.owner.id} on ${it.id}`);
}
for (const s of SCENARIOS) {
  const kinds = new Set(s.items.map((i) => i.resolution));
  if (!kinds.has('AUTO') || !kinds.has('HUMAN')) {
    throw new Error(`scenario ${s.key} must have both AUTO and HUMAN items`);
  }
}

writeFileSync(
  join(ROOT, 'data', 'RegulatoryMilestone', 'RegulatoryMilestone.json'),
  JSON.stringify(milestones, null, 2) + '\n',
);
writeFileSync(
  join(ROOT, 'data', 'CascadeImpactItem', 'CascadeImpactItem.json'),
  JSON.stringify(items, null, 2) + '\n',
);

/* The suggested slip per scenario, for the UI's date control. */
const suggest = SCENARIOS.map((s) => `  ${JSON.stringify(`seed_milestone_${s.key}`)}: ${s.suggestedSlip},`);
writeFileSync(
  join(ROOT, 'ui', 'react', 'src', 'execution', 'slipDefaults.ts'),
  `/*
 * GENERATED — do not edit by hand. Regenerate with scripts/gen-milestones.mjs.
 *
 * The slip each replan scenario demonstrates by default, in days. The screen
 * lets you type any date; this is only what it opens on, so a demo does not
 * start by asking the presenter to pick a number.
 */
export const SUGGESTED_SLIP_DAYS: Record<string, number> = {
${suggest.join('\n')}
};

export const DEFAULT_SLIP_DAYS = 42;
`,
);

console.log(`${milestones.length} milestones, ${items.length} cascade items`);
for (const s of SCENARIOS) {
  const auto = s.items.filter((i) => i.resolution === 'AUTO').length;
  console.log(`  ${s.authority.padEnd(11)} ${s.milestoneName.slice(0, 44).padEnd(46)} ${auto} auto / ${s.items.length - auto} human · +${s.suggestedSlip}d`);
}
console.log('also wrote ui/react/src/execution/slipDefaults.ts');
