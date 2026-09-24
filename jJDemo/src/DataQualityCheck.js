/*
 * DataQualityCheck — the data-quality rule engine (Item 5).
 *
 * DQ-* rules read the RAW source extracts (meta://jJDemo/sources/...) and catch
 * the deliberate bounded dirt planted in §4. RECON-* rules read the LOADED
 * ontology and prove internal consistency. All static; holds no data.
 *
 * Each rule returns a uniform verdict shape:
 *   { rule, description, feed, field, rowsChecked, failures, offenders[], status }
 * where status is 'PASS' | 'WARN' | 'FAIL'.
 */

/* ---- helpers ------------------------------------------------------------ */
// Native JS arrays (from split/JSON.parse/literals) lack C3's .each(); use this.
function forEach(arr, fn) { for (var i = 0; i < arr.length; i++) fn(arr[i], i); }

function readSource(rel) {
  var url = 'meta://jJDemo/sources/' + rel;
  return C3.File.make({ url: url }).readString();
}
function parseCsv(text) {
  var t = ('' + text).replace(/\r/g, '');
  var lines = [];
  var raw = t.split('\n');
  for (var li = 0; li < raw.length; li++) { if (raw[li].length > 0) lines.push(raw[li]); }
  var header = lines[0].split(',');
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cells = lines[i].split(',');
    var o = {};
    for (var j = 0; j < header.length; j++) o[header[j]] = cells[j] !== undefined ? cells[j] : '';
    o.__line = i + 1; // 1-based line number in the file (incl. header)
    rows.push(o);
  }
  return rows;
}
function verdict(rule, description, feed, field, rowsChecked, offenders, opts) {
  opts = opts || {};
  var failures = offenders.length;
  var status;
  if (failures === 0) status = 'PASS';
  else status = opts.warnOnly ? 'WARN' : 'FAIL';
  return {
    rule: rule, description: description, feed: feed, field: field,
    rowsChecked: rowsChecked, failures: failures,
    offenders: offenders.slice(0, 25), // cap for display
    status: status
  };
}

/* ---- DQ-KEY-01 — key hygiene (trailing/leading whitespace) -------------- */
function checkKeyHygiene() {
  var rows = parseCsv(readSource('sap/SAP_LFA1_VENDOR_20260911.csv'));
  var offenders = [];
  forEach(rows, function (r) {
    var k = r.LIFNR;
    if (k != null && ('' + k) !== ('' + k).trim()) {
      offenders.push({ line: r.__line, value: JSON.stringify(k), name: r.NAME1 });
    }
  });
  return verdict('DQ-KEY-01', 'Vendor key (LIFNR) must have no leading/trailing whitespace',
    'SAP_LFA1', 'LIFNR', rows.length, offenders);
}

/* ---- DQ-UNIQ-01 — uniqueness on the vendor key -------------------------- */
function checkUniqueness() {
  var rows = parseCsv(readSource('sap/SAP_LFA1_VENDOR_20260911.csv'));
  var seen = {}, dupKeys = {};
  forEach(rows, function (r) {
    var k = ('' + r.LIFNR).trim(); // normalize so a padded dup still counts
    if (seen[k]) dupKeys[k] = (dupKeys[k] || 1) + 1; else seen[k] = 1;
  });
  var offenders = [];
  for (var k in dupKeys) {
    if (dupKeys.hasOwnProperty(k)) offenders.push({ key: k, occurrences: dupKeys[k] });
  }
  return verdict('DQ-UNIQ-01', 'Vendor key (LIFNR) must be unique across the extract',
    'SAP_LFA1', 'LIFNR', rows.length, offenders);
}

/* ---- DQ-DATE-01 — ISO date conformance ---------------------------------- */
function checkDateFormat() {
  var rows = parseCsv(readSource('lims/LIMS_RESULT_20260911.csv'));
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  var offenders = [];
  forEach(rows, function (r) {
    var d = r.result_date;
    if (d != null && ('' + d).length > 0 && !iso.test('' + d)) {
      offenders.push({ line: r.__line, sample_id: r.sample_id, value: d });
    }
  });
  return verdict('DQ-DATE-01', 'LIMS result_date must be ISO yyyy-MM-dd',
    'LIMS_RESULT', 'result_date', rows.length, offenders);
}

/* ---- DQ-REF-01 — referential integrity (missing D&B key) ---------------- */
function checkReferentialIntegrity() {
  var rows = SupplierCrosswalk.fetch({ limit: -1 }).objs;
  var offenders = [];
  rows.each(function (r) {
    if (!r.dunsNumber || ('' + r.dunsNumber).trim().length === 0) {
      offenders.push({ supplierId: r.id, canonicalName: r.canonicalName,
        resolutionState: r.resolutionState });
    }
  });
  return verdict('DQ-REF-01', 'Every supplier must carry a D&B key (DUNS) to resolve credit risk',
    'SUPPLIER_XWALK', 'dunsNumber', rows.length, offenders);
}

/* ---- DQ-COMPLETE-01 — completeness on EU VAT (WARN only) ---------------- */
function checkCompleteness() {
  var rows = parseCsv(readSource('sap/SAP_LFA1_VENDOR_20260911.csv'));
  var offenders = [];
  forEach(rows, function (r) {
    if (r.STCEG == null || ('' + r.STCEG).trim().length === 0) {
      offenders.push({ line: r.__line, LIFNR: ('' + r.LIFNR).trim(), name: r.NAME1 });
    }
  });
  var v = verdict('DQ-COMPLETE-01', 'EU VAT id (STCEG) completeness — nulls tolerated, reported not blocked',
    'SAP_LFA1', 'STCEG', rows.length, offenders, { warnOnly: true });
  v.nullRatePct = rows.length > 0 ? Math.round((offenders.length / rows.length) * 1000) / 10 : 0;
  return v;
}

/* ---- RECON-SPC-01 — breaches confined to HOLD lots ---------------------- */
function checkSpcConfinement() {
  var lots = Lot.fetch({ limit: -1 }).objs;
  var holdById = {};
  lots.each(function (l) { holdById[l.id] = (l.lotState === 'HOLD'); });

  var meas = ProcessMeasurement.fetch({ limit: -1, include: 'measId, spcRuleViolated, lot.id' }).objs;
  var checked = 0, offenders = [];
  meas.each(function (m) {
    if (m.spcRuleViolated && ('' + m.spcRuleViolated).length > 0) {
      checked++;
      var lid = m.lot ? m.lot.id : null;
      if (!lid || holdById[lid] !== true) {
        offenders.push({ measId: m.measId, lot: lid, rule: m.spcRuleViolated });
      }
    }
  });
  return verdict('RECON-SPC-01', 'Every SPC breach must belong to a lot on HOLD (no breach inside a released lot)',
    'MES_SPC', 'spcRuleViolated', checked, offenders);
}

/* ---- RECON-THREAD-01 — escalation thread integrity ---------------------- */
function checkThreadIntegrity() {
  var r = PipelineOrchestrator.reconcileThread();
  var offenders = [];
  if (!r.match) {
    forEach(r.diffs || [], function (d) { offenders.push(d); });
    if (offenders.length === 0) offenders.push({ issue: r.reason || 'thread mismatch' });
  }
  var v = verdict('RECON-THREAD-01',
    'Staged QMS_COMMENT must match the locked golden NPI-0417 thread byte-for-byte',
    'QMS_COMMENT', 'body', (r.goldenCount || 0), offenders);
  v.goldenCount = r.goldenCount;
  v.stagedCount = r.stagedCount;
  return v;
}

/* ---- DQ-GATE-01 — supplier admission gate (enforcing) ------------------- */
function supplierAdmissionGate() {
  var rows = parseCsv(readSource('sap/SAP_LFA1_VENDOR_20260911.csv'));
  var admitted = [], cleansed = [], quarantined = [];
  var seen = {};
  forEach(rows, function (r) {
    var raw = r.LIFNR == null ? '' : ('' + r.LIFNR);
    var key = raw.trim();
    // 1. Missing key -> cannot join anything -> quarantine.
    if (key.length === 0) {
      quarantined.push({ line: r.__line, name: r.NAME1, reason: 'missing key (LIFNR empty)' });
      return;
    }
    // 2. Duplicate of a key already admitted -> would double-count -> quarantine.
    if (seen[key]) {
      quarantined.push({ line: r.__line, key: key, name: r.NAME1,
        reason: 'duplicate of an already-admitted vendor (would double-count)' });
      return;
    }
    seen[key] = 1;
    // 3. Repairable dirt: key had surrounding whitespace -> trim and admit.
    if (raw !== key) {
      cleansed.push({ line: r.__line, key: key, name: r.NAME1,
        repair: 'trimmed whitespace from key ' + JSON.stringify(raw) });
      return;
    }
    // 4. Clean -> admit as-is.
    admitted.push({ key: key, name: r.NAME1 });
  });
  var status = quarantined.length > 0 ? 'GATED' : 'PASS';
  return {
    rule: 'DQ-GATE-01',
    description: 'Admission gate on SAP_LFA1: admit clean rows, repair fixable keys, quarantine unusable/duplicate rows',
    feed: 'SAP_LFA1', field: 'LIFNR',
    rowsChecked: rows.length,
    admittedCount: admitted.length,
    cleansedCount: cleansed.length,
    quarantinedCount: quarantined.length,
    admittedRate: rows.length > 0 ? Math.round((admitted.length + cleansed.length) / rows.length * 1000) / 10 : 0,
    cleansed: cleansed,
    quarantined: quarantined,
    status: status
  };
}

/* ---- runAll — scoreboard ------------------------------------------------ */
function runAll() {
  var checks = [
    checkKeyHygiene(),
    checkUniqueness(),
    checkDateFormat(),
    checkReferentialIntegrity(),
    checkCompleteness(),
    checkSpcConfinement(),
    checkThreadIntegrity()
  ];
  var pass = 0, warn = 0, fail = 0;
  forEach(checks, function (c) {
    if (c.status === 'PASS') pass++;
    else if (c.status === 'WARN') warn++;
    else fail++;
  });
  // The admission gate is enforcing (status GATED), not a report — surfaced
  // separately so the reporting scoreboard (PASS/WARN/FAIL) stays clean.
  var gate = supplierAdmissionGate();
  return {
    total: checks.length, pass: pass, warn: warn, fail: fail,
    checks: checks,
    gate: gate
  };
}

/* ---- native DataValidation.Rule registration ---------------------------- */
/*
 * The ontology-level DQ rules, re-expressed as native platform validation
 * rules so they render (and are editable) in Studio's Configure → Data Fusion
 * → Data Validation screen. Each definition carries a userCode source string —
 * the JavaScript the Data Validation editor displays and re-saves — which
 * defines the map and summarize lambdas that the MapReduce engine runs. The
 * compiled map/summarize lambda fields on the def are kept for reference /
 * standalone smoke tests, but the persisted rule is authored FROM userCode.
 *
 * A note on the API shape (learned empirically — the docs MCP was unavailable):
 *   - Author a DRAFT rule (DataValidation.Rule.Lambda.Draft): this is the exact
 *     object the Data Validation editor operates on. DataValidation.Rule.Lambda.
 *     Draft.save(draft, UpsertSpec) parses userCode, extracts the map/summarize
 *     lambdas into the rule, and persists BOTH the runnable lambdas AND the
 *     userCode source — so the rule shows its source in the editor AND runs.
 *     (A bare Rule.Lambda.make()/create() drops userCode; deploy()-ing a Draft
 *     to a concrete rule also drops userCode — so we keep the Draft.)
 *   - targetType is passed as a plain type-name string (e.g. 'Supplier').
 *   - detailsType MUST be a NAMED tuple built with TupleType.fromMap(...) so
 *     the emitted rows keep their field names.
 *   - The map lambda signature is map(objs, run): objs is a JS array of the
 *     target-type records for this batch; run is the DataValidation.Run.
 *   - summarize(run) has no offender list in-arg — it reads the persisted
 *     details via run.fetchDetails({limit:-1}).count to decide status.
 *   - Draft rules run via draft.run(), which returns a DataValidation.Run.
 */
function validationRuleDefs() {
  return [
    {
      id: 'dq_supplier_risk_rating',
      name: 'Supplier — financial risk rating present',
      description: 'Every supplier must carry a financial risk rating so credit risk can be assessed before award. Offenders are suppliers with a null/blank financialRiskRating.',
      targetType: 'Supplier',
      detailsType: TupleType.fromMap({ supplierId: 'string', supplierName: 'string' }),
      map: function (objs, run) {
        var d = [];
        for (var i = 0; i < objs.length; i++) { var s = objs[i]; if (!s.financialRiskRating) d.push({ supplierId: s.id, supplierName: s.name }); }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') }); },
      userCode: "/* Supplier — financial risk rating present. */\nfunction map(objs, run) {\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var s = objs[i];\n    if (!s.financialRiskRating) offenders.push({ supplierId: s.id, supplierName: s.name });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') });\n}"
    },
    {
      id: 'dq_supplier_approval_present',
      name: 'Supplier — approval status present',
      description: 'Every supplier must carry an approvalStatus so the sourcing gate can decide admissibility; a blank status is unresolvable.',
      targetType: 'Supplier',
      detailsType: TupleType.fromMap({ supplierId: 'string', supplierName: 'string' }),
      map: function (objs, run) {
        var d = [];
        for (var i = 0; i < objs.length; i++) { var s = objs[i]; if (!s.approvalStatus) d.push({ supplierId: s.id, supplierName: s.name }); }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') }); },
      userCode: "/* Supplier — approval status present. */\nfunction map(objs, run) {\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var s = objs[i];\n    if (!s.approvalStatus) offenders.push({ supplierId: s.id, supplierName: s.name });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') });\n}"
    },
    {
      id: 'dq_supplier_audit_current',
      name: 'Supplier — quality audit current (not expired)',
      description: 'Every supplier must have a quality audit valid date on/after today; a missing or past auditValidUntil means the supplier is not audit-current.',
      targetType: 'Supplier',
      detailsType: TupleType.fromMap({ supplierId: 'string', supplierName: 'string', auditValidUntil: 'string' }),
      map: function (objs, run) {
        var now = DateTime.now(); var d = [];
        for (var i = 0; i < objs.length; i++) { var s = objs[i]; var av = s.auditValidUntil; if (!av || av < now) d.push({ supplierId: s.id, supplierName: s.name, auditValidUntil: (av || '') }); }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') }); },
      userCode: "/* Supplier — quality audit current. Offenders: auditValidUntil null or in the past. */\nfunction map(objs, run) {\n  var now = DateTime.now();\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var s = objs[i];\n    var av = s.auditValidUntil;\n    if (!av || av < now) offenders.push({ supplierId: s.id, supplierName: s.name, auditValidUntil: (av || '') });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') });\n}"
    },
    {
      id: 'dq_supplier_single_source_risk',
      name: 'Supplier resilience — single-source high-risk supplier',
      description: 'A single-source supplier carrying a High financial risk rating is a concentrated supply risk with no fallback; flag it for a resilience review.',
      targetType: 'Supplier',
      detailsType: TupleType.fromMap({ supplierId: 'string', supplierName: 'string', risk: 'string' }),
      map: function (objs, run) {
        var d = [];
        for (var i = 0; i < objs.length; i++) { var s = objs[i]; if (s.singleSourceFlag && s.financialRiskRating === 'High') d.push({ supplierId: s.id, supplierName: s.name, risk: (s.financialRiskRating || '') }); }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') }); },
      userCode: "/* Supplier resilience — single-source AND High financial risk. Expected to FAIL and surface the concentrated supplier. */\nfunction map(objs, run) {\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var s = objs[i];\n    if (s.singleSourceFlag && s.financialRiskRating === 'High') offenders.push({ supplierId: s.id, supplierName: s.name, risk: (s.financialRiskRating || '') });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') });\n}"
    },
    {
      id: 'dq_lot_state_present',
      name: 'Lot — lot state present and clean',
      description: 'Every manufacturing lot must carry a non-blank lotState with no leading/trailing whitespace; a blank or padded state breaks disposition logic.',
      targetType: 'Lot',
      detailsType: TupleType.fromMap({ lotId: 'string', lotState: 'string' }),
      map: function (objs, run) {
        var d = [];
        for (var i = 0; i < objs.length; i++) { var o = objs[i]; var st = o.lotState; if (st == null || st.trim() === '' || st !== st.trim()) d.push({ lotId: (o.lotId || o.id), lotState: (st == null ? '' : st) }); }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') }); },
      userCode: "/* Lot — lot state present and clean (no null, blank, or padded lotState). */\nfunction map(objs, run) {\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var o = objs[i];\n    var st = o.lotState;\n    if (st == null || st.trim() === '' || st !== st.trim()) offenders.push({ lotId: (o.lotId || o.id), lotState: (st == null ? '' : st) });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_MODERATE' : 'PASSED') });\n}"
    },
    {
      id: 'recon_spc_confinement',
      name: 'Reconciliation — SPC breaches confined to flagged lots',
      description: 'Every process measurement outside its USL/LSL spec limits must belong to a lot whose spcViolation flag is set. An out-of-spec reading on a lot NOT flagged means a breach is hiding in a released lot.',
      targetType: 'ProcessMeasurement',
      detailsType: TupleType.fromMap({ measId: 'string', parameter: 'string', measValue: 'double', lotId: 'string' }),
      map: function (objs, run) {
        var flagged = {};
        var lots = Lot.fetch({ filter: 'spcViolation==true', limit: -1, include: 'id' }).objs;
        for (var k = 0; k < lots.length; k++) { flagged[lots[k].id] = true; }
        var d = [];
        for (var i = 0; i < objs.length; i++) {
          var m = objs[i]; var v = m.measValue;
          var oos = (v != null) && ((m.usl != null && v > m.usl) || (m.lsl != null && v < m.lsl));
          if (!oos) continue;
          var lotId = m.lot ? m.lot.id : null;
          if (!lotId || !flagged[lotId]) d.push({ measId: (m.measId || m.id), parameter: (m.parameter || ''), measValue: (v == null ? 0 : v), lotId: (lotId || '') });
        }
        return DataValidation.Rule.MapResult.make({ details: d });
      },
      summarize: function (run) { var n = run.fetchDetails({ limit: -1 }).count || 0; return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_CRITICAL' : 'PASSED') }); },
      userCode: "/* RECON-SPC-01. Offenders: measurements outside [lsl,usl] whose parent Lot is NOT flagged spcViolation. Expected PASS. */\nfunction map(objs, run) {\n  var flagged = {};\n  var lots = Lot.fetch({ filter: 'spcViolation==true', limit: -1, include: 'id' }).objs;\n  for (var k = 0; k < lots.length; k++) flagged[lots[k].id] = true;\n  var offenders = [];\n  for (var i = 0; i < objs.length; i++) {\n    var m = objs[i];\n    var v = m.measValue;\n    var oos = (v != null) && ((m.usl != null && v > m.usl) || (m.lsl != null && v < m.lsl));\n    if (!oos) continue;\n    var lotId = m.lot ? m.lot.id : null;\n    if (!lotId || !flagged[lotId]) offenders.push({ measId: (m.measId || m.id), parameter: (m.parameter || ''), measValue: (v == null ? 0 : v), lotId: (lotId || '') });\n  }\n  return DataValidation.Rule.MapResult.make({ details: offenders });\n}\n\nfunction summarize(run) {\n  var n = run.fetchDetails({ limit: -1 }).count || 0;\n  return DataValidation.Rule.SummaryResult.make({ status: (n > 0 ? 'FAILED_CRITICAL' : 'PASSED') });\n}"
    }
  ];
}

function registerValidationRules() {
  var defs = validationRuleDefs();
  var registered = [];
  var issuesFound = [];
  forEach(defs, function (def) {
    // Remove any prior draft with this id so re-registration is idempotent.
    var existing = DataValidation.Rule.Lambda.Draft.fetch({ filter: "id=='" + def.id + "'", limit: 1 }).objs;
    if (existing.length > 0) { existing[0].remove(); }
    // Author a DRAFT rule: this is the object the Data Validation editor in
    // Studio operates on. Draft.save() parses userCode, extracts the map /
    // summarize lambdas into the rule, and persists BOTH the runnable lambdas
    // and the human-readable userCode source together — so the rule shows in
    // the editor with its source AND actually executes its map.
    var draft = DataValidation.Rule.Lambda.Draft.make({
      id: def.id, name: def.name, description: def.description,
      targetType: def.targetType, language: 'JavaScript',
      detailsType: def.detailsType, userCode: def.userCode
    });
    var result = DataValidation.Rule.Lambda.Draft.save(draft, UpsertSpec.make({}));
    if (result.issues && result.issues.length > 0) {
      forEach(result.issues, function (iss) { issuesFound.push({ id: def.id, error: iss.error, lineno: iss.lineno }); });
    } else {
      registered.push(def.id);
    }
  });
  return { registered: registered.length, ids: registered, issues: issuesFound };
}

function runValidationRules() {
  registerValidationRules();
  var defs = validationRuleDefs();
  var verdicts = [];
  forEach(defs, function (def) {
    var draft = DataValidation.Rule.Lambda.Draft.fetch({ filter: "id=='" + def.id + "'", limit: 1 }).objs[0];
    var run = draft.run();
    verdicts.push({ id: def.id, name: def.name, targetType: def.targetType, runId: run.id });
  });
  return { rules: verdicts };
}
