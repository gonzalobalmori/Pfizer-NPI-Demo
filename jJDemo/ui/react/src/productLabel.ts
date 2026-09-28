/*
 * Canonical product labels, resolved in the UI.
 *
 * WHY THIS EXISTS: the C3 environment the demo is shown from can be running an
 * older seed/backend than the repo — old launch ids, old product names, and the
 * pre-rename `device` field instead of `product`. That made the Launch column
 * render blank and the charts show retired names. Rather than require a re-seed
 * before every demo, the UI resolves the label itself.
 *
 * Each of the nine programmes is listed under BOTH its current id and the legacy
 * id that occupied the same slot, plus every retired display name it has been
 * through, so any vintage of backend resolves to the same label.
 *
 * Once the environment is re-seeded this layer becomes a no-op rather than
 * wrong: the current ids map to exactly the names the backend would return.
 */

export interface ProductLabel {
  product: string;
  modality: string;
  franchise: string;
}

const IM = 'Internal Medicine';
const ONC = 'Oncology';
const VAX = 'Vaccines & Anti-Infectives';

/* The nine programmes. Modality wording is the client's own. */
const BEROBENATIDE: ProductLabel = { product: 'Berobenatide', modality: 'Monthly GLP-1 agonist', franchise: IM };
const MET097: ProductLabel = { product: 'MET097', modality: 'Monthly injectable GLP-1', franchise: IM };
const PF3945: ProductLabel = { product: 'PF-3945', modality: 'Amylin-based combo (w/ berobenatide)', franchise: IM };
const ATIRMOCICLIB: ProductLabel = { product: 'Atirmociclib', modality: 'CDK4 inhibitor', franchise: ONC };
const SIGVOTATUG: ProductLabel = { product: 'Sigvotatug vedotin', modality: 'Antibody-drug conjugate (ADC)', franchise: ONC };
const PF08634404: ProductLabel = { product: 'PF-08634404', modality: 'Dual PD-1/VEGF inhibitor', franchise: ONC };
const SASANLIMAB: ProductLabel = { product: 'Sasanlimab', modality: 'Anti-PD-1 monoclonal antibody', franchise: ONC };
const VEPDEGESTRANT: ProductLabel = { product: 'Vepdegestrant', modality: 'Oral ER degrader (PROTAC)', franchise: ONC };
const PF07817883: ProductLabel = { product: 'PF-07817883', modality: 'Oral 3CL protease inhibitor', franchise: VAX };

/* Launch id -> label. Current ids first, then the legacy id for the same slot. */
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

/* Retired display names, for a backend whose ids we do not recognise. Keyed on a
   lower-cased substring match so "Comirnaty Gen 2 PFA Catheter",
   "Comirnaty 2026-27 Formula" and bare "Comirnaty" all resolve. */
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

/** Resolve a launch to its canonical label, or null if nothing matches. */
export function lookupProduct(launchId?: string | null, name?: string | null): ProductLabel | null {
  if (launchId && BY_ID[launchId]) return BY_ID[launchId];
  if (name) {
    const n = name.toLowerCase();
    for (const [needle, label] of BY_NAME) if (n.includes(needle)) return label;
  }
  return null;
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

/** One-call product label for a payload row. */
export function labelFor(row: LaunchNamed): string {
  return productLabel(row.launchId, rawName(row));
}
