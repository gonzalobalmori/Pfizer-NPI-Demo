/*
 * PipelineOrchestrator — the pipeline's operational surface (feed health, key
 * resolution, lineage, thread reconciliation). All static; holds no data.
 * Reads the bookkeeping types the pipeline maintains (DataFeedWatermark,
 * SupplierCrosswalk, LineageRecord) and the locked golden Comment thread.
 */

var LGNOW_ISO = '2026-09-11T08:42:00'; // demo clock

/* ---- helpers ------------------------------------------------------------ */
function toEpoch(v) {
  // Parse an ISO-ish datetime string to epoch seconds (no Date arithmetic on
  // C3 datetime objects, which don't expose getTime()).
  if (!v) return null;
  var s = ('' + v).replace('T', ' ').replace('Z', '');
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) return null;
  return Date.UTC(
    parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
    parseInt(m[4] || '0', 10), parseInt(m[5] || '0', 10), parseInt(m[6] || '0', 10)
  ) / 1000;
}

/* ---- feedHealth --------------------------------------------------------- */
function feedHealth() {
  var wms = DataFeedWatermark.fetch({ limit: -1 }).objs;
  var now = toEpoch(LGNOW_ISO);
  var feeds = [];
  var fresh = 0, stale = 0, failed = 0;
  wms.each(function (w) {
    var loaded = toEpoch(w.lastLoadedAt);
    var ageSec = (loaded != null && now != null) ? (now - loaded) : null;
    var status = w.status || 'FRESH';
    // If the stored status is FRESH but the age exceeds twice the cadence, the
    // computed view is STALE (this is what flips when a feed stops arriving).
    if (status === 'FRESH' && ageSec != null && w.expectedEverySeconds &&
        ageSec > 2 * w.expectedEverySeconds) {
      status = 'STALE';
    }
    if (status === 'FAILED') failed++;
    else if (status === 'STALE') stale++;
    else fresh++;
    feeds.push({
      feedCode: w.feedCode,
      sourceSystem: w.sourceSystem,
      targetType: w.targetType,
      lastLoadedAt: w.lastLoadedAt,
      lastRowCount: w.lastRowCount,
      expectedEverySeconds: w.expectedEverySeconds,
      ageSeconds: ageSec,
      status: status,
      note: w.note
    });
  });
  return { total: feeds.length, fresh: fresh, stale: stale, failed: failed, feeds: feeds };
}

/* ---- resolveSupplier ---------------------------------------------------- */
function resolveSupplier(keyKind, keyValue) {
  var valid = { sapVendor: 1, aribaSupplierId: 1, qmsAuditSubject: 1, dunsNumber: 1 };
  if (!valid[keyKind]) {
    return { resolved: false, reason: 'unknown key kind: ' + keyKind +
      ' (expected sapVendor | aribaSupplierId | qmsAuditSubject | dunsNumber)' };
  }
  if (keyValue == null || ('' + keyValue).length === 0) {
    return { resolved: false, reason: 'empty key value for ' + keyKind };
  }
  var rows = SupplierCrosswalk.fetch({ limit: -1 }).objs;
  var hit = null;
  rows.each(function (r) {
    if (('' + r[keyKind]) === ('' + keyValue)) hit = r;
  });
  if (!hit) {
    return { resolved: false, keyKind: keyKind, keyValue: keyValue,
      reason: 'no crosswalk entry with ' + keyKind + ' == ' + keyValue +
      ' (a source key with no canonical match — e.g. a D&B DUNS lookup on a supplier we never registered a DUNS for)' };
  }
  return {
    resolved: true,
    keyKind: keyKind, keyValue: keyValue,
    supplierId: hit.id,
    canonicalName: hit.canonicalName,
    resolutionState: hit.resolutionState
  };
}

/* ---- crosswalkReport ---------------------------------------------------- */
function crosswalkReport() {
  var rows = SupplierCrosswalk.fetch({ limit: -1 }).objs;
  var out = [], byState = { AUTO: 0, MANUAL: 0, PARTIAL: 0 };
  var missing = [];
  rows.each(function (r) {
    if (byState[r.resolutionState] != null) byState[r.resolutionState]++;
    var gaps = [];
    if (!r.dunsNumber) gaps.push('dunsNumber (no D&B match)');
    if (gaps.length) missing.push({ supplierId: r.id, canonicalName: r.canonicalName, gaps: gaps });
    out.push({
      supplierId: r.id, canonicalName: r.canonicalName,
      sapVendor: r.sapVendor, aribaSupplierId: r.aribaSupplierId,
      qmsAuditSubject: r.qmsAuditSubject, dunsNumber: r.dunsNumber || null,
      resolutionState: r.resolutionState
    });
  });
  return { total: out.length, byState: byState, missingKeys: missing, rows: out };
}

/* ---- lineageFor --------------------------------------------------------- */
function lineageFor(targetType, targetId) {
  var id = targetType + '__' + targetId;
  var rec = LineageRecord.fetch({ filter: Filter.eq('id', id), limit: 1 }).objs;
  if (!rec || rec.length === 0) {
    return { found: false, targetType: targetType, targetId: targetId,
      reason: 'no lineage breadcrumb recorded for ' + id };
  }
  var r = rec[0];
  return {
    found: true,
    targetType: r.targetType, targetId: r.targetId,
    feedCode: r.feedCode, sourceFile: r.sourceFile,
    sourceRowKey: r.sourceRowKey, transform: r.transform,
    loadedAt: r.loadedAt
  };
}

/* ---- reconcileThread ---------------------------------------------------- */
function reconcileThread() {
  // Golden thread: the locked Comment records for decision seed_decision_417,
  // in time order. These cannot be mutated by any load (SeedData is locked).
  var golden = Comment.fetch({
    filter: Filter.eq('decision.id', 'seed_decision_417'),
    order: 'ascending(commentedAt)', limit: -1,
    include: 'author, authorRole, commentedAt, body, isAutomatedCheck'
  }).objs;

  // Staged copy: read the packaged QMS_COMMENT source file (the feed the pipeline
  // would load) and compare against the golden thread, byte-for-byte on body.
  var staged = [];
  var stagedErr = null;
  try {
    var url = 'meta://jJDemo/sources/veeva_qms/QMS_COMMENT_20260911.json';
    var raw = C3.File.make({ url: url }).readString();
    var parsed = JSON.parse(raw);
    var recs = parsed.records || [];
    // Sort staged by comment timestamp to match golden ordering.
    recs.sort(function (a, b) {
      return ('' + a.comment_ts__c).localeCompare('' + b.comment_ts__c);
    });
    staged = recs;
  } catch (e) {
    stagedErr = '' + e;
  }
  if (stagedErr) {
    return { match: false, reason: 'could not read staged QMS_COMMENT feed: ' + stagedErr };
  }

  var diffs = [];
  var n = Math.max(golden.length, staged.length);
  for (var i = 0; i < n; i++) {
    var g = golden[i], s = staged[i];
    if (!g) { diffs.push({ index: i, issue: 'staged has extra entry', staged: s && s.id }); continue; }
    if (!s) { diffs.push({ index: i, issue: 'golden has extra entry', golden: g.author }); continue; }
    var d = {};
    if (('' + g.body) !== ('' + s.body__c)) d.body = { golden: g.body, staged: s.body__c };
    if (('' + g.author) !== ('' + s.author__c)) d.author = { golden: g.author, staged: s.author__c };
    if (('' + g.authorRole) !== ('' + s.author_role__c)) d.authorRole = { golden: g.authorRole, staged: s.author_role__c };
    if (Object.keys(d).length) diffs.push({ index: i, issue: 'field mismatch', diff: d });
  }

  return {
    match: diffs.length === 0,
    goldenCount: golden.length,
    stagedCount: staged.length,
    diffs: diffs,
    note: diffs.length === 0
      ? 'Staged QMS_COMMENT matches the locked golden thread byte-for-byte; NPI-0417 escalation is intact.'
      : diffs.length + ' discrepancy(ies) between staged feed and locked thread.'
  };
}
