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
    reg: 'EU MDR · G-BA appraisal · hospital tenders Q2 and Q4',
    status: 'ct',
    kpis: [
      { value: '6', label: 'launches', tone: '' },
      { value: '1', label: 'off track', tone: 'r' },
      { value: '€24.1M', label: 'at risk', tone: 'r' },
    ],
    risks: [
      {
        status: 'ct',
        title: 'VARIPULSE G2 has missed the Q2 2027 tender window',
        detail: 'NPI-0417 · sterilisation slip',
        action: issue('417'),
      },
      {
        status: 'rk',
        title: 'Two launches land in Q2 2027 for one field force',
        detail: 'VARIPULSE G2 and OTTAVA',
        action: chat(),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q4 26', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q1 27', status: 'rk' },
      { name: 'VARIPULSE G2', quarter: 'Q2 27', status: 'ct' },
      { name: 'OTTAVA', quarter: 'Q2 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q3 27', status: 'ok' },
      { name: 'Javelin XL', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  FR: {
    name: 'France',
    reg: 'EU MDR · HAS assessment · CEPS pricing committee',
    status: 'ct',
    kpis: [
      { value: '5', label: 'launches', tone: '' },
      { value: '1', label: 'off track', tone: 'r' },
      { value: '€19.8M', label: 'at risk', tone: 'r' },
    ],
    risks: [
      {
        status: 'ct',
        title: 'VARIPULSE G2 has missed the Q2 2027 tender window',
        detail: 'NPI-0417 · sterilisation slip',
        action: issue('417'),
      },
      {
        status: 'rk',
        title: 'Two launches in the same CEPS pricing cycle',
        detail: 'ETHICON 4000+ and OTTAVA, Q3 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q4 26', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q2 27', status: 'ct' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q3 27', status: 'rk' },
      { name: 'OTTAVA', quarter: 'Q3 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  US: {
    name: 'United States',
    reg: 'FDA PMA and 510(k) · CMS · GPO and IDN contracting',
    status: 'rk',
    kpis: [
      { value: '6', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€7.8M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'ETHICON 4000+ has no CPT reimbursement code',
        detail: 'NPI-0344 · escalated to the Launch Board',
        action: issue('344'),
      },
      {
        status: 'rk',
        title: 'Two cardiology launches share the cath-lab call point',
        detail: 'Javelin XL and Impella ECP+, Q4 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'DUALTO', quarter: 'live', status: 'ok' },
      { name: 'OTTAVA', quarter: 'Q1 27', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q2 27', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q3 27', status: 'rk' },
      { name: 'Javelin XL', quarter: 'Q4 27', status: 'ok' },
      { name: 'Impella ECP+', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  UK: {
    name: 'United Kingdom',
    reg: 'UKCA and EU MDR · NICE · NHS Supply Chain',
    status: 'rk',
    kpis: [
      { value: '5', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€4.4M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'ETHICON 4000+ delayed by a Notified Body query cycle',
        detail: 'NPI-0365 · 21-day clock-stop',
        action: issue('365'),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q4 26', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q1 27', status: 'rk' },
      { name: 'VARIPULSE G2', quarter: 'Q2 27', status: 'ok' },
      { name: 'OTTAVA', quarter: 'Q3 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  ES: {
    name: 'Spain',
    reg: 'EU MDR · regional tenders across 17 communities',
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
      { name: 'EMBOTRAP IV', quarter: 'Q4 26', status: 'rk' },
      { name: 'VARIPULSE G2', quarter: 'Q2 27', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q3 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q4 27', status: 'ok' },
      { name: 'OTTAVA', quarter: 'Q4 27', status: 'ok' },
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
        detail: 'ETHICON 4000+ and PureSee Toric, Q4 27',
        action: chat(),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q1 27', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q3 27', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q4 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q4 27', status: 'ok' },
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
        title: 'VARIPULSE G2 registration depends on the EU MDR file',
        detail: 'downstream of the G3 slip',
        action: chat(),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q3 27', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q4 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q4 27', status: 'ok' },
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
      { name: 'EMBOTRAP IV', quarter: 'Q2 27', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q3 27', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q4 27', status: 'ok' },
    ],
  },
  IT: {
    name: 'Italy',
    reg: 'EU MDR · regional tender cycles · AIFA device register',
    status: 'rk',
    kpis: [
      { value: '3', label: 'launches', tone: '' },
      { value: '1', label: 'at risk', tone: 'a' },
      { value: '€2.3M', label: 'at risk', tone: 'a' },
    ],
    risks: [
      {
        status: 'rk',
        title: 'PureSee Toric failed Sequence D of the transit battery',
        detail: 'NPI-0359 · insert redesign, re-test 14 Sep',
        action: issue('359'),
      },
    ],
    launches: [
      { name: 'EMBOTRAP IV', quarter: 'Q1 27', status: 'ok' },
      { name: 'PureSee Toric', quarter: 'Q3 27', status: 'rk' },
      { name: 'DUALTO', quarter: 'Q4 27', status: 'ok' },
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
      { name: 'ETHICON 4000+', quarter: 'Q2 28', status: 'ok' },
      { name: 'Javelin XL', quarter: 'Q3 28', status: 'ok' },
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
      { name: 'EMBOTRAP IV', quarter: 'Q1 27', status: 'ok' },
      { name: 'VARIPULSE G2', quarter: 'Q3 27', status: 'ok' },
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
      { name: 'VARIPULSE G2', quarter: 'Q4 27', status: 'ok' },
      { name: 'ETHICON 4000+ G4', quarter: 'Q4 27', status: 'ok' },
    ],
  },
};

/* ── Registration markets (prototype MKS) ───────────────────────────── */
export const MK_SMALL: Record<string, MkSmall> = {
  MX: { name: 'Mexico', reg: 'COFEPRIS · IMSS and ISSSTE tender cycles', launchesPlanned: 2, wave: 'Wave 2 · from Q1 2028' },
  AR: { name: 'Argentina', reg: 'ANMAT · provincial tenders', launchesPlanned: 1, wave: 'Wave 3 · from Q3 2028' },
  NL: { name: 'Netherlands', reg: 'EU MDR · hospital purchasing groups', launchesPlanned: 3, wave: 'Wave 1 · from Q4 2026' },
  SE: { name: 'Sweden', reg: 'EU MDR · regional procurement', launchesPlanned: 2, wave: 'Wave 2 · from Q2 2027' },
  PL: { name: 'Poland', reg: 'EU MDR · AOTMiT appraisal', launchesPlanned: 2, wave: 'Wave 2 · from Q3 2027' },
  TR: { name: 'Türkiye', reg: 'İTCK · SGK reimbursement list', launchesPlanned: 1, wave: 'Wave 3 · from Q1 2028' },
  AE: { name: 'United Arab Emirates', reg: 'MoHAP · DoH Abu Dhabi registration', launchesPlanned: 1, wave: 'Wave 2 · from Q4 2027' },
  ZA: { name: 'South Africa', reg: 'SAHPRA · private group contracting', launchesPlanned: 1, wave: 'Wave 3 · from Q2 2028' },
  KR: { name: 'South Korea', reg: 'MFDS · HIRA reimbursement', launchesPlanned: 2, wave: 'Wave 2 · from Q3 2027' },
  SG: { name: 'Singapore', reg: 'HSA · public healthcare cluster tenders', launchesPlanned: 1, wave: 'Wave 2 · from Q1 2028' },
};
