/*
 * Canonical product facts, resolved in the UI.
 *
 * WHY THIS EXISTS: the C3 environment the demo is shown from can be running an
 * older seed/backend than the repo — old launch ids, old product names, retired
 * franchises, and the pre-rename `device` field instead of `product`. That left
 * the Launch column blank and the Product card reading "—". Rather than require
 * a re-seed before every demo, the UI resolves these itself.
 *
 * Each of the nine programmes is listed under BOTH its current id and the legacy
 * id that occupied the same slot, plus every retired display name it has been
 * through, so any vintage of backend resolves to the same facts.
 *
 * Once the environment is re-seeded this layer becomes a no-op rather than
 * wrong: the current ids resolve to exactly what the backend would return.
 */

export interface ProductLabel {
  product: string;
  modality: string;
  franchise: string;
  segment: string;
  indication: string;
  developmentPhase: string;
  estimatedLaunch: string;
  targetMarkets: string;
  regulatoryRoute: string;
  fillFinishRoute: string;
  manufactureSite: string;
}

const IM = 'Internal Medicine';
const ONC = 'Oncology';
const VAX = 'Vaccines & Anti-Infectives';
const PRIMARY = 'Primary Care';
const ONC_SEG = 'Oncology';

const NDA_MAA = 'NDA (FDA) + MAA centralised procedure (EMA)';
const BLA_MAA = 'BLA (FDA) + MAA centralised procedure (EMA)';
const PFS = 'Aseptic fill — prefilled syringe';
const TABLET = 'Oral solid dose — film-coated tablet';

/* The nine programmes. Modality wording is the client's own. */
const BEROBENATIDE: ProductLabel = {
  product: 'Berobenatide', modality: 'Monthly GLP-1 agonist', franchise: IM, segment: PRIMARY,
  indication: 'Obesity, knee OA, sleep apnoea, T2D', developmentPhase: 'Phase 3 (10 trials)',
  estimatedLaunch: '~2028', targetMarkets: 'US, EU, Global', regulatoryRoute: NDA_MAA,
  fillFinishRoute: PFS, manufactureSite: 'Puurs + Vetter Ravensburg',
};
const MET097: ProductLabel = {
  product: 'MET097', modality: 'Monthly injectable GLP-1', franchise: IM, segment: PRIMARY,
  indication: 'Obesity', developmentPhase: 'Phase 3 (9 trials)',
  estimatedLaunch: '~2028', targetMarkets: 'US, EU', regulatoryRoute: NDA_MAA,
  fillFinishRoute: PFS, manufactureSite: 'Kalamazoo (KZO)',
};
const PF3945: ProductLabel = {
  product: 'PF-3945', modality: 'Amylin-based combo (w/ berobenatide)', franchise: IM, segment: PRIMARY,
  indication: 'Obesity', developmentPhase: 'Phase 2',
  estimatedLaunch: 'Post-2028', targetMarkets: 'US, EU', regulatoryRoute: NDA_MAA,
  fillFinishRoute: 'Aseptic fill — prefilled pen', manufactureSite: 'Puurs',
};
const ATIRMOCICLIB: ProductLabel = {
  product: 'Atirmociclib', modality: 'CDK4 inhibitor', franchise: ONC, segment: ONC_SEG,
  indication: 'HR+/HER2− metastatic breast cancer (1L)', developmentPhase: 'Late Phase 3',
  estimatedLaunch: '2027–2028', targetMarkets: 'US, EU', regulatoryRoute: NDA_MAA,
  fillFinishRoute: TABLET, manufactureSite: 'Freiburg',
};
const SIGVOTATUG: ProductLabel = {
  product: 'Sigvotatug vedotin', modality: 'Antibody-drug conjugate (ADC)', franchise: ONC, segment: ONC_SEG,
  indication: 'Metastatic NSCLC', developmentPhase: 'Late Phase 3',
  estimatedLaunch: '2027–2028', targetMarkets: 'US, EU', regulatoryRoute: BLA_MAA,
  fillFinishRoute: 'Lyophilised — single-use vial', manufactureSite: 'Grange Castle',
};
const PF08634404: ProductLabel = {
  product: 'PF-08634404', modality: 'Dual PD-1/VEGF inhibitor', franchise: ONC, segment: ONC_SEG,
  indication: 'Metastatic colorectal cancer; 1L NSCLC', developmentPhase: 'Phase 3 (2 pivotal)',
  estimatedLaunch: '2028+', targetMarkets: 'US, EU, China',
  regulatoryRoute: 'BLA (FDA) + MAA centralised procedure (EMA) + NMPA (China)',
  fillFinishRoute: 'Aseptic fill — single-use vial', manufactureSite: 'Grange Castle + Siegfried Hameln',
};
const SASANLIMAB: ProductLabel = {
  product: 'Sasanlimab', modality: 'Anti-PD-1 monoclonal antibody', franchise: ONC, segment: ONC_SEG,
  indication: 'Non-muscle-invasive bladder cancer', developmentPhase: 'Phase 3',
  estimatedLaunch: '2027–2028', targetMarkets: 'US, EU', regulatoryRoute: BLA_MAA,
  fillFinishRoute: 'Lyophilised — single-use vial', manufactureSite: 'Puurs',
};
const VEPDEGESTRANT: ProductLabel = {
  product: 'Vepdegestrant', modality: 'Oral ER degrader (PROTAC)', franchise: ONC, segment: ONC_SEG,
  indication: 'HR+/HER2− advanced breast cancer', developmentPhase: 'Phase 3',
  estimatedLaunch: '2027–2028', targetMarkets: 'US, EU', regulatoryRoute: NDA_MAA,
  fillFinishRoute: TABLET, manufactureSite: 'Freiburg',
};
const PF07817883: ProductLabel = {
  product: 'PF-07817883', modality: 'Oral 3CL protease inhibitor', franchise: VAX, segment: PRIMARY,
  indication: 'COVID-19 (oral antiviral)', developmentPhase: 'Phase 3',
  estimatedLaunch: '2027–2028', targetMarkets: 'US, EU', regulatoryRoute: NDA_MAA,
  fillFinishRoute: TABLET, manufactureSite: 'Freiburg',
};

/* Launch id -> facts. Current ids first, then the legacy id for the same slot. */
const BY_ID: Record<string, ProductLabel> = {
  seed_launch_berobenatide_obesity: BEROBENATIDE,
  seed_launch_berobenatide_t2d: SASANLIMAB,
  seed_launch_berobenatide_osa: VEPDEGESTRANT,
  seed_launch_berobenatide_knee_oa: PF07817883,
  seed_launch_met097_obesity: MET097,
  seed_launch_pf3945_obesity: PF3945,
  seed_launch_atirmociclib_mbc: ATIRMOCICLIB,
  seed_launch_sigvotatug_nsclc: SIGVOTATUG,
  seed_launch_pf08634404_crc: PF08634404,

  seed_launch_varipulse_g2: BEROBENATIDE,
  seed_launch_octaray_g2: SASANLIMAB,
  seed_launch_ethicon_4000: VEPDEGESTRANT,
  seed_launch_javelin_xl: PF07817883,
  seed_launch_impella_ecp: MET097,
  seed_launch_ottava: PF3945,
  seed_launch_dualto: ATIRMOCICLIB,
  seed_launch_embotrap_iv: SIGVOTATUG,
  seed_launch_puresee: PF08634404,
};

/* Retired display names, for a backend whose ids we do not recognise. Matched as
   a lower-cased substring so "Comirnaty Gen 2 PFA Catheter", "Comirnaty 2026-27
   Formula" and bare "Comirnaty" all resolve to the same programme. */
const BY_NAME: [string, ProductLabel][] = [
  ['comirnaty', BEROBENATIDE],
  ['abrysvo', SASANLIMAB],
  ['zavicefta', VEPDEGESTRANT],
  ['prevnar', VEPDEGESTRANT],
  ['velsipity', PF07817883],
  ['somavert', PF07817883],
  ['cibinqo', MET097],
  ['genotropin', MET097],
  ['zavzpret', PF3945],
  ['fragmin', ATIRMOCICLIB],
  ['hympavzi', SIGVOTATUG],
  ['elrexfio', SIGVOTATUG],
  ['zirabev', PF08634404],
  ['litfulo', PF08634404],
  /* current names, so an already-migrated backend still matches by name */
  ['berobenatide', BEROBENATIDE],
  ['sasanlimab', SASANLIMAB],
  ['vepdegestrant', VEPDEGESTRANT],
  ['pf-07817883', PF07817883],
  ['met097', MET097],
  ['pf-3945', PF3945],
  ['atirmociclib', ATIRMOCICLIB],
  ['sigvotatug', SIGVOTATUG],
  ['pf-08634404', PF08634404],
];

/** A payload row carrying a launch, from any vintage of the backend. */
export interface LaunchNamed {
  launchId?: string | null;
  product?: string | null;
  productName?: string | null;
  shortName?: string | null;
  /** Pre-rename field name — a backend deployed before `device` became `product`. */
  device?: string | null;
}

/** Whatever name this row carries, whichever field the backend used for it. */
export function rawName(row: LaunchNamed): string | null {
  return row.product ?? row.productName ?? row.device ?? row.shortName ?? null;
}

/** Resolve a launch to its canonical facts, or null if nothing matches. */
export function lookupProduct(launchId?: string | null, name?: string | null): ProductLabel | null {
  if (launchId && BY_ID[launchId]) return BY_ID[launchId];
  if (name) {
    const n = name.toLowerCase();
    for (const [needle, label] of BY_NAME) if (n.includes(needle)) return label;
  }
  return null;
}

/** Resolve straight from a payload row. */
export function lookupRow(row: LaunchNamed): ProductLabel | null {
  return lookupProduct(row.launchId, rawName(row));
}

/**
 * The product name to show. Falls back to whatever the backend sent, so an
 * unrecognised launch degrades to the old behaviour instead of rendering blank.
 */
export function productLabel(launchId?: string | null, name?: string | null): string {
  return lookupProduct(launchId, name)?.product ?? name ?? '';
}

/** The modality (the client's "Type" column) to show. */
export function modalityLabel(launchId?: string | null, name?: string | null, fallback?: string | null): string {
  return lookupProduct(launchId, name)?.modality ?? fallback ?? '';
}

/** The therapeutic area to show. */
export function franchiseLabel(launchId?: string | null, name?: string | null, fallback?: string | null): string {
  return lookupProduct(launchId, name)?.franchise ?? fallback ?? '';
}

/** One-call product label for a payload row. */
export function labelFor(row: LaunchNamed): string {
  return productLabel(row.launchId, rawName(row));
}

/** One field of the canonical facts for a row, falling back to the backend's value. */
export function factFor<K extends keyof ProductLabel>(
  row: LaunchNamed,
  key: K,
  fallback?: string | null,
): string {
  return lookupRow(row)?.[key] ?? fallback ?? '';
}
