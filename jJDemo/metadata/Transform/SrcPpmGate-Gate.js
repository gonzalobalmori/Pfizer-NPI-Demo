/*
 * Transform: SrcPpmGate -> Gate  (the file name MUST equal `name`).
 *
 * The gold-path transform of the pipeline: it maps a Planisware PPM gate row onto
 * the existing ontology {@link Gate}, projecting the SAME id the gate was seeded
 * with so a load UPDATES the gate (idempotent, business-key keyed) rather than
 * creating a duplicate. This is what makes demo 2 real — edit ForecastDate/SlipDays
 * in PPM_GATE_20260911.csv, re-run the load, and the gate (and every screen that
 * derives from it) moves. Gate lives in `data/` (not locked seed), so the update lands.
 *
 * Id reversal: gen_sources.mjs emits GateId as `seed_gate_<x>` -> `G-<X upper>`;
 * here we strip the `G-` prefix and lower-case to recover `seed_gate_<x>`.
 * Projecting the same business id makes the load UPDATE the existing gate row
 * (keyed on id) instead of inserting a duplicate.
 */
data = {
  name: 'SrcPpmGate-Gate',
  source: 'SrcPpmGate',
  target: 'Gate',
  projection: {
    id: concat('seed_gate_', lowerCase(replace(gateId, 'G-', ''))),
    code: gateCode,
    name: gateName,
    baselineDate: dateTime(baselineDate, 'yyyy-MM-dd'),
    forecastDate: dateTime(forecastDate, 'yyyy-MM-dd'),
    slipDays: slipDays,
    status: status
  }
};
