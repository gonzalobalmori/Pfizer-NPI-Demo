/*
 * Translate device-era free text into pharma, in the UI.
 *
 * WHY THIS EXISTS: gate criteria, gate names, BOM part names and supplier names
 * come out of the C3 environment as authored strings. When that environment is
 * on an older seed they still read as a medical-device programme — "Design
 * verification complete", "ISO 11135 sterilisation validation report", "EU MDR
 * Technical Documentation", "Ring electrode / Heraeus Medical". The repo's own
 * seed data is already pharma; this is purely so the screen reads correctly
 * against a backend that has not been re-seeded yet.
 *
 * Rules are applied longest-first and are all no-ops on already-pharma text, so
 * running this over a migrated backend changes nothing.
 */

import { EXACT_PAIRS } from '@/pharmaMap';

/** The nine-gate ladder, by code. */
export const GATE_NAME: Record<string, string> = {
  G1: 'Launch Strategy Approved',
  G2: 'NPL Plan Approved',
  G3: 'DS Released',
  G4: 'DP Released',
  G5: 'Finished Product Released',
  G6: 'Launch Readiness Confirmed',
  G7: 'Launch Go / No-Go',
  G8: 'Commercial Availability',
  BAU: 'BAU handover',
};

/** The gate name to show for a code, falling back to the backend's own label. */
export function gateName(code?: string | null, fallback?: string | null): string {
  if (code && GATE_NAME[code]) return GATE_NAME[code];
  return pharma(fallback ?? '');
}

/*
 * Ordered device -> pharma substitutions. Longest / most specific first, so
 * "EO sterilisation validation slot" is consumed before the bare "sterilisation"
 * rule can see it.
 */
const RULES: [RegExp, string][] = [
  /* ── "code + retired gate name" as it appears in meta lines ── */
  [/G1\s+NPI\s+Readiness\s+Gate/g, 'G1 Launch Strategy Approved'],
  [/G2\s+Design\s+Freeze/g, 'G2 NPL Plan Approved'],
  [/G3\s+Submission\s+Commit/g, 'G3 DS Released'],
  [/G4\s+CE\s+Certificate/g, 'G4 DP Released'],
  [/G4\s+Clearance\s*\/\s*CE\s+Certificate/g, 'G4 DP Released'],

  /* ── retired product names, compound forms first ── */
  [/Comirnaty\s+Gen\s*2/gi, 'Berobenatide'],
  [/Comirnaty\s+G2/gi, 'Berobenatide'],
  [/\bComirnaty\b/g, 'Berobenatide'],
  [/Abrysvo\s+Gen\s*2/gi, 'Sasanlimab'],
  [/Abrysvo\s+G2/gi, 'Sasanlimab'],
  [/\bAbrysvo\b/g, 'Sasanlimab'],
  [/Elrexfio\s+IV/gi, 'Sigvotatug vedotin'],
  [/\bElrexfio\b/g, 'Sigvotatug vedotin'],
  [/\bHympavzi\b/g, 'Sigvotatug vedotin'],
  [/Genotropin\s+ECP\+?/gi, 'MET097'],
  [/\bGenotropin\b/g, 'MET097'],
  [/\bCibinqo\b/g, 'MET097'],
  [/Somavert\s+XL/gi, 'PF-07817883'],
  [/\bSomavert\b/g, 'PF-07817883'],
  [/\bVelsipity\b/g, 'PF-07817883'],
  [/Prevnar\s*20/gi, 'Vepdegestrant'],
  [/\bZavicefta\b/g, 'Vepdegestrant'],
  [/Litfulo\s+Toric/gi, 'PF-08634404'],
  [/\bLitfulo\b/g, 'PF-08634404'],
  [/\bZirabev\b/g, 'PF-08634404'],
  [/\bZavzpret\b/g, 'PF-3945'],
  [/\bFragmin\b/g, 'Atirmociclib'],

  /* ── design-control nouns ── */
  [/design\s+inputs/gi, 'CMC inputs'],
  [/input\s+matrix/gi, 'CMC matrix'],
  [/IEC\s*62366\s+usability/gi, 'Human-factors'],

  /* ── gate criteria ── */
  [/ISO\s*11135\s+sterilisation\s+validation\s+report/gi, 'Aseptic process simulation (media fill) report'],
  [/EO\s+sterilisation\s+validation\s+slot/gi, 'Aseptic fill validation slot'],
  [/sterilisation\s+validation/gi, 'aseptic process validation'],
  [/EU\s*MDR\s+Technical\s+Documentation/gi, 'CTD Module 3'],
  [/Design\s+verification\s+complete/gi, 'Process validation (PPQ) complete'],
  [/Design\s+validation\s+complete/gi, 'Analytical method validation complete'],
  [/Design\s+verification/gi, 'Process validation (PPQ)'],
  [/Design\s+validation/gi, 'Analytical method validation'],
  [/Clinical\s+evaluation\s+report/gi, 'Clinical study report'],
  [/Risk\s+management\s+file/gi, 'Quality risk assessment'],
  [/Design\s+Freeze/g, 'CMC Lock'],
  [/Design\s+freeze/g, 'CMC lock'],

  /* ── gate / phase names ── */
  [/Clearance\s*\/\s*CE\s+Certificate/gi, 'Approval / Marketing Authorisation'],
  [/CE\s+Certificate/gi, 'Marketing Authorisation'],
  [/NPI\s+Readiness\s+Gate/gi, 'Launch Strategy Approved'],
  [/Submission\s+Commit/gi, 'DS Released'],
  [/V&V\s*\(verification\s*&\s*validation\)/gi, 'Drug Substance (DS) Readiness'],
  [/\bV&V\b/g, 'PPQ'],

  /* ── bill of materials / suppliers ── */
  /* Case-sensitive so a mid-sentence "ring electrode" does not come back
     capitalised as "Single-source Vial stopper supplier". */
  [/Ring\s+electrode\s+subassembly/g, 'Vial stopper'],
  [/ring\s+electrode\s+subassembly/g, 'vial stopper'],
  [/Ring\s+electrode/g, 'Vial stopper'],
  [/ring\s+electrode/g, 'vial stopper'],
  [/Heraeus\s+Medical\s+Components/gi, 'Aptar Pharma Le Vaudreuil'],
  [/Heraeus\s+Medical/gi, 'Aptar Pharma'],
  [/\bHeraeus\b/g, 'Aptar Pharma'],
  [/Steris\s+Venlo/gi, 'Vetter Ravensburg'],
  [/\bSterigenics\b/g, 'Siegfried Hameln'],
  [/\bSteris\b/g, 'Vetter Ravensburg'],

  /* ── process nouns ── */
  [/EO\s+steriliser/gi, 'fill-finish site'],
  [/EO\s+sterilisation/gi, 'aseptic fill'],
  [/EO\s+chamber/gi, 'fill line'],
  [/Chamber\s+slot/g, 'Fill slot'],
  [/chamber\s+slot/g, 'fill slot'],
  /* Irvine is a J&J MedTech site; the pharma equivalent in this network is
     Kalamazoo, which already holds the alternate US fill capacity. */
  [/\bIrvine\b/g, 'Kalamazoo'],
  /* Case-preserving: a sentence-initial "Half-cycle" must not come back
     lower-cased mid-heading. */
  [/Half-cycle/g, 'Bracketed'],
  [/half-cycle/g, 'bracketed'],
  [/[Nn]otified\s+[Bb]ody/g, 'contract laboratory'],
  [/loaner\s+kit/gi, 'launch stock'],
  [/Value\s+Analysis\s+Committee/gi, 'P&T formulary committee'],

  /* ── regulatory routes ── */
  [/510\(k\)/g, 'NDA'],
  [/EU\s+MDR/g, 'EMA'],
  [/\bPMA\b/g, 'BLA'],
  [/\bDHF\b/g, 'CTD'],
];

/*
 * EXACT_PAIRS is generated from git history — every authored seed string that
 * has ever changed, paired old -> new. It runs BEFORE the regex rules because a
 * whole authored sentence should be replaced by its actual successor rather
 * than word-substituted into an approximation of it.
 */
const EXACT = new Map(EXACT_PAIRS);
/* Pairs long enough to be worth an embedded-substring search; shorter ones are
   covered by the regex rules and would risk matching inside unrelated text. */
const EMBEDDED = EXACT_PAIRS.filter(([o]) => o.length >= 12);

/** Rewrite device-era wording as pharma. Safe and idempotent on pharma text. */
export function pharma(text?: string | null): string {
  if (!text) return '';

  /* 1. the whole string is a known authored string */
  const whole = EXACT.get(text);
  if (whole !== undefined) return whole;

  let out = text;

  /* 2. a known authored string embedded in a longer one */
  for (const [oldVal, newVal] of EMBEDDED) {
    if (out.includes(oldVal)) out = out.split(oldVal).join(newVal);
  }

  /* 3. anything the seed never authored — stray vocabulary, other vintages */
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

/*
 * Keys whose values are identifiers rather than prose. Rewriting these would
 * break lookups, routing and lineage — an id must stay byte-identical to what
 * the backend holds, however retired the name inside it reads.
 */
const ID_KEYS = new Set([
  'id', 'ids', 'type', 'typeIdent', 'url', 'href', 'path', 'transform',
  'sourceFile', 'sourceRowKey', 'feedCode', 'version',
]);

const isIdKey = (key: string): boolean =>
  ID_KEYS.has(key) || /(^|[a-z])(Id|Ids|Code|Codes|Ref|Key|Uri|Url)$/.test(key);

/**
 * Apply `pharma` to every prose string in an API response.
 *
 * Wiring this once at the transport boundary is deliberate: doing it per view
 * meant any screen nobody had looked at yet kept rendering the retired
 * vocabulary. Identifier-shaped keys are skipped so ids, codes and lineage keys
 * survive untouched, and non-strings are returned as-is.
 */
export function pharmaDeep<T>(value: T): T {
  if (typeof value === 'string') return pharma(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => pharmaDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      out[key] = isIdKey(key) ? src[key] : pharmaDeep(src[key]);
    }
    return out as unknown as T;
  }
  return value;
}
