/*
 * Market side-panel data — ported verbatim from the click-through's MKT / MKS /
 * MKN literals (§2.2 Market lens). The prototype filled the #map-side aside by
 * clicking a world-map bubble; that fill logic was not part of the first React
 * port, so the panel came up empty. This restores it: clicking a bubble (or the
 * guided tour driving marketPick) renders the market's regulatory context, its
 * three headline figures, its open-risk records and its first-ship-by-launch
 * list — all static prototype copy, no invented figures.
 *
 * A risk row's `action` maps the prototype's inline handler to our nav model:
 *   { kind: 'issue', findingId }  ← openRW('417', …)  → open the resolution workspace
 *   { kind: 'chat' }              ← askAI('de')        → hand off to the copilot
 */

export type MkStatus = 'ok' | 'rk' | 'ct';

export interface MkRiskAction {
  kind: 'issue' | 'chat';
  findingId?: string;
}
export interface MkRisk {
  status: MkStatus;
  title: string;
  detail: string;
  action: MkRiskAction;
}
export interface MkKpi {
  value: string;
  label: string;
  /** '' | 'r' | 'a' — b-tag colour class. */
  tone: '' | 'r' | 'a';
}
export interface MkLaunch {
  name: string;
  quarter: string;
  status: MkStatus | 'ok';
}
/** A "launch" market with an open-risk narrative. */
export interface MkMarket {
  name: string;
  reg: string;
  status: MkStatus;
  kpis: MkKpi[];
  risks: MkRisk[];
  launches: MkLaunch[];
}
/** A registration ("small") market — no risk narrative, just context. */
export interface MkSmall {
  name: string;
  reg: string;
  launchesPlanned: number;
  wave: string;
}

const issue = (n: string): MkRiskAction => ({ kind: 'issue', findingId: `seed_finding_${n}` });
const chat = (): MkRiskAction => ({ kind: 'chat' });

/* ── Launch markets (prototype MKT) ─────────────────────────────────── */
export const MK_MARKETS: Record<string, MkMarket> = {
  DE: {
    name: 'Germany',
    reg: 'MAA (EMA) · G-BA appraisal · hospital tenders Q2 and Q4',
    status: 'ct',
    kpis: [
      { value: '6', label: 'launches', tone: '' },
      { value: '1', label: 'off track', tone: 'r' },
      { value: '€24.1M', label: 'at risk', tone: 'r' },
    ],
    risks: [
      {
        status: 'ct',
        title: 'Berobenatide has missed the Q2 2027 tender window',
        detail: 'NPI-0417 · fill-finish slip',
        action: issue('417'),
      },
      {
        status: 'rk',
        title: 'Two launches land in Q2 2027 for one field force',
        detail: 'Berobenatide and PF-07817883',
        action: chat(),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q4 26', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q1 27', status: 'rk' },
      { name: 'Berobenatide', quarter: 'Q2 27', status: 'ct' },
      { name: 'PF-07817883', quarter: 'Q2 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q3 27', status: 'ok' },
      { name: 'PF-07817883', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  FR: {
    name: 'France',
    reg: 'MAA (EMA) · HAS assessment · CEPS pricing committee',
    status: 'ct',
    kpis: [
      { value: '5', label: 'launches', tone: '' },
      { value: '1', label: 'off track', tone: 'r' },
      { value: '€19.8M', label: 'at risk', tone: 'r' },
    ],
    risks: [
      {
        status: 'ct',
        title: 'Berobenatide has missed the Q2 2027 tender window',
        detail: 'NPI-0417 · fill-finish slip',
        action: issue('417'),
      },
      {
        status: 'rk',
        title: 'Two launches in the same CEPS pricing cycle',
        detail: 'Vepdegestrant and PF-07817883, Q3 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q4 26', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q2 27', status: 'ct' },
      { name: 'Vepdegestrant', quarter: 'Q3 27', status: 'rk' },
      { name: 'PF-07817883', quarter: 'Q3 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  US: {
    name: 'United States',
    reg: 'FDA BLA and NDA · CMS · GPO and IDN contracting',
    status: 'rk',
    kpis: [
      { value: '6', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€7.8M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'Vepdegestrant has no CPT reimbursement code',
        detail: 'NPI-0344 · escalated to the Launch Board',
        action: issue('344'),
      },
      {
        status: 'rk',
        title: 'Two cardiology launches share the cath-lab call point',
        detail: 'PF-07817883 and MET097, Q4 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'PF-3945', quarter: 'live', status: 'ok' },
      { name: 'PF-07817883', quarter: 'Q1 27', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q2 27', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q3 27', status: 'rk' },
      { name: 'PF-07817883', quarter: 'Q4 27', status: 'ok' },
      { name: 'MET097', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  UK: {
    name: 'United Kingdom',
    reg: 'MHRA and MAA (EMA) · NICE · NHS Supply Chain',
    status: 'rk',
    kpis: [
      { value: '5', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€4.4M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'Vepdegestrant delayed by a CHMP rapporteur query cycle',
        detail: 'NPI-0365 · 21-day clock-stop',
        action: issue('365'),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q4 26', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q1 27', status: 'rk' },
      { name: 'Berobenatide', quarter: 'Q2 27', status: 'ok' },
      { name: 'PF-07817883', quarter: 'Q3 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  ES: {
    name: 'Spain',
    reg: 'MAA (EMA) · regional tenders across 17 communities',
    status: 'rk',
    kpis: [
      { value: '5', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€1.1M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'Iberia field-force certification at 91% against a 95% target',
        detail: 'NPI-0319 · agent rebooked 14 reps',
        action: issue('319'),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q4 26', status: 'rk' },
      { name: 'Berobenatide', quarter: 'Q2 27', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q3 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q4 27', status: 'ok' },
      { name: 'PF-07817883', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  JP: {
    name: 'Japan',
    reg: 'PMDA · Chuikyo reimbursement listing, quarterly',
    status: 'ok',
    kpis: [
      { value: '4', label: 'launches', tone: '' },
      { value: '0', label: 'at risk', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'Two launches targeting the same Chuikyo listing cycle',
        detail: 'Vepdegestrant and PF-08634404, Q4 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q1 27', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q3 27', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q4 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  CN: {
    name: 'China',
    reg: 'NMPA · volume-based procurement rounds',
    status: 'ok',
    kpis: [
      { value: '3', label: 'launches', tone: '' },
      { value: '0', label: 'at risk', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'Berobenatide registration depends on the MAA (EMA) file',
        detail: 'downstream of the G3 slip',
        action: chat(),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q3 27', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q4 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  BR: {
    name: 'Brazil',
    reg: 'ANVISA · registration long tail',
    status: 'ok',
    kpis: [
      { value: '3', label: 'launches', tone: '' },
      { value: '0', label: 'at risk', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q2 27', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q3 27', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  IT: {
    name: 'Italy',
    reg: 'MAA (EMA) · regional tender cycles · AIFA transparency list',
    status: 'rk',
    kpis: [
      { value: '3', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€2.3M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'PF-08634404 failed Sequence D of the transit battery',
        detail: 'NPI-0359 · insert redesign, re-test 14 Sep',
        action: issue('359'),
      },
    ],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q1 27', status: 'ok' },
      { name: 'PF-08634404', quarter: 'Q3 27', status: 'rk' },
      { name: 'PF-3945', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  IN: {
    name: 'India',
    reg: 'CDSCO · state tender cycles · import licence per SKU',
    status: 'ok',
    kpis: [
      { value: '2', label: 'launches', tone: '' },
      { value: '0', label: 'off track', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [],
    launches: [
      { name: 'Vepdegestrant', quarter: 'Q2 28', status: 'ok' },
      { name: 'PF-07817883', quarter: 'Q3 28', status: 'ok' },
    ],
  },
  CA: {
    name: 'Canada',
    reg: 'Health Canada MDL · provincial procurement',
    status: 'ok',
    kpis: [
      { value: '2', label: 'launches', tone: '' },
      { value: '0', label: 'at risk', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [],
    launches: [
      { name: 'Sigvotatug', quarter: 'Q1 27', status: 'ok' },
      { name: 'Berobenatide', quarter: 'Q3 27', status: 'ok' },
    ],
  },
  AU: {
    name: 'Australia',
    reg: 'TGA · Prostheses List reimbursement',
    status: 'ok',
    kpis: [
      { value: '2', label: 'launches', tone: '' },
      { value: '0', label: 'at risk', tone: '' },
      { value: '€0', label: 'at risk', tone: '' },
    ],
    risks: [],
    launches: [
      { name: 'Berobenatide', quarter: 'Q4 27', status: 'ok' },
      { name: 'Vepdegestrant', quarter: 'Q4 27', status: 'ok' },
    ],
  },
};

/* ── Registration markets (prototype MKS) ───────────────────────────── */
export const MK_SMALL: Record<string, MkSmall> = {
  MX: { name: 'Mexico', reg: 'COFEPRIS · IMSS and ISSSTE tender cycles', launchesPlanned: 2, wave: 'Wave 2 · from Q1 2028' },
  AR: { name: 'Argentina', reg: 'ANMAT · provincial tenders', launchesPlanned: 1, wave: 'Wave 3 · from Q3 2028' },
  NL: { name: 'Netherlands', reg: 'MAA (EMA) · hospital purchasing groups', launchesPlanned: 3, wave: 'Wave 1 · from Q4 2026' },
  SE: { name: 'Sweden', reg: 'MAA (EMA) · regional procurement', launchesPlanned: 2, wave: 'Wave 2 · from Q2 2027' },
  PL: { name: 'Poland', reg: 'MAA (EMA) · AOTMiT appraisal', launchesPlanned: 2, wave: 'Wave 2 · from Q3 2027' },
  TR: { name: 'Türkiye', reg: 'İTCK · SGK reimbursement list', launchesPlanned: 1, wave: 'Wave 3 · from Q1 2028' },
  AE: { name: 'United Arab Emirates', reg: 'MoHAP · DoH Abu Dhabi registration', launchesPlanned: 1, wave: 'Wave 2 · from Q4 2027' },
  ZA: { name: 'South Africa', reg: 'SAHPRA · private group contracting', launchesPlanned: 1, wave: 'Wave 3 · from Q2 2028' },
  KR: { name: 'South Korea', reg: 'MFDS · HIRA reimbursement', launchesPlanned: 2, wave: 'Wave 2 · from Q3 2027' },
  SG: { name: 'Singapore', reg: 'HSA · public healthcare cluster tenders', launchesPlanned: 1, wave: 'Wave 2 · from Q1 2028' },
};
