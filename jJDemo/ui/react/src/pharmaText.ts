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
  [/Ring\s+electrode\s+subassembly/gi, 'Vial stopper'],
  [/Ring\s+electrode/gi, 'Vial stopper'],
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
  [/half-cycle/gi, 'bracketed'],
  [/[Nn]otified\s+[Bb]ody/g, 'contract laboratory'],
  [/loaner\s+kit/gi, 'launch stock'],
  [/Value\s+Analysis\s+Committee/gi, 'P&T formulary committee'],

  /* ── regulatory routes ── */
  [/510\(k\)/g, 'NDA'],
  [/EU\s+MDR/g, 'EMA'],
  [/\bPMA\b/g, 'BLA'],
  [/\bDHF\b/g, 'CTD'],
];

/** Rewrite device-era wording as pharma. Safe and idempotent on pharma text. */
export function pharma(text?: string | null): string {
  if (!text) return '';
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}
