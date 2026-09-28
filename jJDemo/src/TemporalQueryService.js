/*
 * TemporalQueryService implementation — bitemporal snapshot, replay and rewind (§5.2).
 *
 * Design notes for a reviewer:
 *
 * 1. GOVERNED is an explicit registry, not reflection. Each entry names the fields
 *    projected into a snapshot and supplies its own fetch. Two reasons: adding history
 *    to a type becomes a deliberate reviewable edit (an accidental snapshot of a
 *    high-churn measurement table would bloat the store while answering no audit
 *    question), and the projection is pinned — a later schema addition cannot silently
 *    change the payload shape that stored e-signature hashes were computed over.
 *
 * 2. currentPayload() is shared by snapshot() and by
 *    AuditService.verifySignature(). Both sides of a signature comparison must project
 *    identically, so there is exactly one projector.
 *
 * 3. A snapshot is taken BEFORE the business write and is stamped supersededAt
 *    immediately: by the time the caller proceeds, the frozen values are by definition
 *    the previous state. Snapshotting after the write would capture the new state and
 *    lose the version an auditor wants.
 *
 * 4. demoReset() is a rewind, not a re-seed. It restores records from the version rows
 *    the cascade itself wrote, which is why it needs no seed reload and why running it
 *    twice is harmless.
 */

/* ===================== helpers ===================== */

function forEach(list, fn) {
  if (!list) return;
  if (typeof list.each === 'function') { list.each(fn); return; }
  for (var i = 0; i < list.length; i++) fn(list[i], i);
}

/**
 * Fetch exactly one record by id. Uses fetch-with-filter rather than `get`, matching the
 * convention already established in CascadeReplanService — a `get` with a projection is
 * not uniformly available across these types.
 */
function fetchOne(typeObj, id, include) {
  var res = typeObj.fetch({ filter: Filter.eq('id', id), include: include, limit: 1 });
  return (res && res.objs && res.objs.length > 0) ? res.objs[0] : null;
}

/** Render any field value into a JSON-safe scalar. C3 datetimes and refs stringify. */
function plain(v) {
  if (v === null || v === undefined) return null;
  var t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return v;
  if (v.id !== undefined && v.id !== null) return v.id;   // reference → id
  return '' + v;                                           // datetime, enum, etc.
}

/**
 * The replayable set. `fields` are projected into the snapshot payload; `refs` are
 * reference fields projected as their target id; `include` is the fetch projection.
 */
var GOVERNED = {
  Launch: {
    fields: ['id', 'deviceName', 'shortName', 'healthStatus', 'revenueAtRisk', 'firstShipDate',
             'readinessPct', 'scheduleFloatDays', 'launchValue', 'launchBuildUnits',
             'registrationsFiled', 'registrationsTotal'],
    refs: ['currentPhase', 'leadMarket', 'franchise'],
    get: function (id, include) { return fetchOne(Launch, id, include); },
    put: function (u) { Launch.make(u).merge(); }
  },
  Gate: {
    fields: ['id', 'code', 'name', 'baselineDate', 'forecastDate', 'slipDays', 'status'],
    refs: ['launch', 'phase'],
    get: function (id, include) { return fetchOne(Gate, id, include); },
    put: function (u) { Gate.make(u).merge(); }
  },
  GateCriterion: {
    fields: ['id', 'name', 'met', 'outstandingReason'],
    refs: ['gate', 'evidence'],
    get: function (id, include) { return fetchOne(GateCriterion, id, include); },
    put: function (u) { GateCriterion.make(u).merge(); }
  },
  Lot: {
    fields: ['id', 'lotId', 'materialNo', 'operation', 'lotQty', 'lotState', 'startTs', 'spcViolation'],
    refs: [],
    get: function (id, include) { return fetchOne(Lot, id, include); },
    put: function (u) { Lot.make(u).merge(); }
  },
  MarketLaunch: {
    fields: ['id', 'firstShipQuarter', 'status', 'reimbursementStatus'],
    refs: ['launch', 'market'],
    get: function (id, include) { return fetchOne(MarketLaunch, id, include); },
    put: function (u) { MarketLaunch.make(u).merge(); }
  },
  Decision: {
    fields: ['id', 'heldBy', 'dueAt', 'authorityThreshold', 'selectedOption', 'approvedAt'],
    refs: ['finding', 'owner', 'escalation'],
    get: function (id, include) { return fetchOne(Decision, id, include); },
    put: function (u) { Decision.make(u).merge(); }
  },
  Activity: {
    fields: ['id', 'name', 'plannedEnd', 'actualEnd', 'status', 'statusCode', 'detail'],
    refs: ['phase', 'domain', 'launch', 'owningPerson', 'owningAgent'],
    get: function (id, include) { return fetchOne(Activity, id, include); },
    put: function (u) { Activity.make(u).merge(); }
  },
  Finding: {
    fields: ['id', 'displayId', 'detectedAt', 'headline', 'outcome', 'category', 'dependency', 'daysAtStake'],
    refs: ['phase', 'launch', 'marketLaunch', 'decision', 'capa'],
    get: function (id, include) { return fetchOne(Finding, id, include); },
    put: function (u) { Finding.make(u).merge(); }
  },
  CAPA: {
    fields: ['id', 'capaId', 'openedAt', 'containmentAction', 'correctiveAction',
             'effectivenessCheck', 'effectivenessDueDate', 'status'],
    refs: ['finding', 'launch', 'closedByDecision'],
    get: function (id, include) { return fetchOne(CAPA, id, include); },
    put: function (u) { CAPA.make(u).merge(); }
  },
  ActionPlanTask: {
    fields: ['id', 'name', 'owner', 'detail', 'optionKey', 'status', 'dueDate'],
    refs: ['decision'],
    get: function (id, include) { return fetchOne(ActionPlanTask, id, include); },
    put: function (u) { ActionPlanTask.make(u).merge(); }
  }
};

function spec(entityTypeName) {
  var g = GOVERNED[entityTypeName];
  if (!g) {
    throw new Error(
      'TemporalQueryService: "' + entityTypeName + '" is not a governed replayable type. ' +
      'Add it to the GOVERNED registry with an explicit field projection before versioning it.'
    );
  }
  return g;
}

function includeFor(g) {
  var parts = g.fields.slice(0);
  for (var i = 0; i < g.refs.length; i++) parts.push(g.refs[i] + '.id');
  return parts.join(', ');
}

/* ===================== projection ===================== */

function currentPayload(entityTypeName, entityId) {
  var g = spec(entityTypeName);
  var obj = g.get(entityId, includeFor(g));
  if (!obj) {
    throw new Error('TemporalQueryService: ' + entityTypeName + ' "' + entityId + '" does not exist.');
  }

  var payload = {};
  for (var i = 0; i < g.fields.length; i++) {
    var f = g.fields[i];
    payload[f] = plain(obj[f]);
  }
  for (var j = 0; j < g.refs.length; j++) {
    var r = g.refs[j];
    payload[r] = obj[r] ? plain(obj[r].id) : null;
  }
  return payload;
}

function governedTypes() {
  var out = [];
  for (var name in GOVERNED) {
    if (Object.prototype.hasOwnProperty.call(GOVERNED, name)) {
      var g = GOVERNED[name];
      out.push({
        entityTypeName: name,
        fields: g.fields.slice(0),
        refs: g.refs.slice(0),
        fieldCount: g.fields.length + g.refs.length
      });
    }
  }
  return { types: out, typeCount: out.length };
}

/* ===================== version bookkeeping ===================== */

function versionsOf(entityTypeName, entityId, order) {
  var res = EntityVersion.fetch({
    filter: Filter.eq('entityTypeName', entityTypeName).and(Filter.eq('entityId', entityId)),
    order: order || 'ascending(versionNo)',
    include: 'this',
    limit: -1
  });
  return res.objs || [];
}

function versionTokenOf(entityTypeName, entityId) {
  var res = EntityVersion.fetch({
    filter: Filter.eq('entityTypeName', entityTypeName).and(Filter.eq('entityId', entityId)),
    order: 'descending(versionNo)',
    include: 'id, versionNo',
    limit: 1
  });
  return (res.objs && res.objs.length > 0) ? res.objs[0].versionNo : 0;
}

function snapshot(s) {
  var sp = s || {};
  if (!sp.entityTypeName || !sp.entityId) {
    throw new Error('TemporalQueryService.snapshot: entityTypeName and entityId are required.');
  }

  var payload = currentPayload(sp.entityTypeName, sp.entityId);
  var nextVersion = versionTokenOf(sp.entityTypeName, sp.entityId) + 1;
  var now = DateTime.now();

  var vid = 'ver_' + sp.entityTypeName + '_' + sp.entityId + '_' + nextVersion;
  var row = {
    id: vid,
    entityTypeName: sp.entityTypeName,
    entityId: sp.entityId,
    versionNo: nextVersion,
    payload: payload,
    changedFields: sp.changedFields || [],
    correlationId: sp.correlationId === undefined ? null : sp.correlationId,
    actorName: sp.actorName === undefined ? null : sp.actorName,
    reasonCode: sp.reasonCode === undefined ? null : sp.reasonCode,
    // Valid from the instant the *previous* revision landed; we do not know that here,
    // so the recorded instant is the honest anchor and validTo closes now because the
    // caller is about to supersede this state.
    validFrom: sp.validFrom || now,
    validTo: sp.validTo === undefined ? null : sp.validTo,
    recordedAt: now,
    // Stamped immediately: by the time the caller proceeds to write, this snapshot is
    // the superseded state. See design note 3.
    supersededAt: now
  };

  EntityVersion.create(row);

  return {
    versionId: vid,
    versionNo: nextVersion,
    payload: payload,
    changedFields: row.changedFields,
    recordedAt: '' + now
  };
}

/* ===================== as-of resolution ===================== */

/**
 * Resolve the version a caller should see at an instant.
 *
 * Transaction time: the snapshot must have been recorded at or before the as-of
 * instant, and must not yet have been superseded as of it. Valid time: the business
 * window must contain the as-of business date. When no snapshot matches, the live row
 * is the answer, because the live row *is* the current version.
 */
function asOf(s) {
  var sp = s || {};
  if (!sp.entityTypeName || !sp.entityId) {
    throw new Error('TemporalQueryService.asOf: entityTypeName and entityId are required.');
  }
  if (!sp.asOfTransaction) {
    throw new Error('TemporalQueryService.asOf: asOfTransaction is required — an as-of query with no instant is a live read.');
  }

  var tx = DateTime.fromString('' + sp.asOfTransaction);
  var valid = sp.asOfValid ? DateTime.fromString('' + sp.asOfValid) : tx;

  var versions = versionsOf(sp.entityTypeName, sp.entityId, 'ascending(versionNo)');

  // The earliest snapshot still standing at the as-of instant. C3 datetimes compare
  // with the relational operators; .getTime() is not available on them.
  var chosen = null;
  for (var i = 0; i < versions.length; i++) {
    var v = versions[i];
    if (v.recordedAt && v.recordedAt > tx) continue;                 // not yet known
    if (v.supersededAt && v.supersededAt <= tx) continue;            // already replaced
    if (v.validFrom && v.validFrom > valid) continue;                // not yet true
    if (v.validTo && v.validTo <= valid) continue;                   // no longer true
    chosen = v;
    break;
  }

  // Nothing matched on the strict test: fall back to the newest snapshot recorded at or
  // before the instant, so an as-of read between two revisions returns the state that
  // was standing rather than nothing.
  if (!chosen) {
    for (var j = versions.length - 1; j >= 0; j--) {
      var w = versions[j];
      if (!w.recordedAt || w.recordedAt <= tx) { chosen = w; break; }
    }
  }

  if (chosen) {
    return {
      entityTypeName: sp.entityTypeName,
      entityId: sp.entityId,
      version: chosen.versionNo,
      payload: chosen.payload,
      source: 'version',
      correlationId: chosen.correlationId,
      actorName: chosen.actorName,
      reasonCode: chosen.reasonCode,
      recordedAt: '' + chosen.recordedAt,
      asOfTransaction: '' + tx,
      asOfValid: '' + valid
    };
  }

  return {
    entityTypeName: sp.entityTypeName,
    entityId: sp.entityId,
    version: versionTokenOf(sp.entityTypeName, sp.entityId),
    payload: currentPayload(sp.entityTypeName, sp.entityId),
    source: 'live',
    correlationId: null,
    actorName: null,
    reasonCode: null,
    recordedAt: null,
    asOfTransaction: '' + tx,
    asOfValid: '' + valid
  };
}

function historyOf(entityTypeName, entityId) {
  var versions = versionsOf(entityTypeName, entityId, 'descending(versionNo)');
  var out = [];
  forEach(versions, function (v) {
    out.push({
      versionId: v.id,
      version: v.versionNo,
      payload: v.payload,
      changedFields: v.changedFields || [],
      correlationId: v.correlationId,
      actorName: v.actorName,
      reasonCode: v.reasonCode,
      validFrom: v.validFrom ? '' + v.validFrom : null,
      validTo: v.validTo ? '' + v.validTo : null,
      recordedAt: v.recordedAt ? '' + v.recordedAt : null,
      supersededAt: v.supersededAt ? '' + v.supersededAt : null
    });
  });

  return {
    entityTypeName: entityTypeName,
    entityId: entityId,
    currentVersion: versionTokenOf(entityTypeName, entityId),
    live: currentPayload(entityTypeName, entityId),
    versions: out,
    versionCount: out.length
  };
}

function payloadAtVersion(entityTypeName, entityId, version) {
  if (version === -1) return currentPayload(entityTypeName, entityId);
  var res = EntityVersion.fetch({
    filter: Filter.eq('entityTypeName', entityTypeName)
      .and(Filter.eq('entityId', entityId))
      .and(Filter.eq('versionNo', version)),
    include: 'id, payload',
    limit: 1
  });
  if (!res.objs || res.objs.length === 0) {
    throw new Error('TemporalQueryService: no version ' + version + ' of ' + entityTypeName + ' "' + entityId + '".');
  }
  return res.objs[0].payload;
}

function diffVersions(entityTypeName, entityId, fromVersion, toVersion) {
  var a = payloadAtVersion(entityTypeName, entityId, fromVersion);
  var b = payloadAtVersion(entityTypeName, entityId, toVersion);

  var keys = {};
  var k;
  for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) keys[k] = true;
  for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) keys[k] = true;

  var changes = [];
  var unchanged = 0;
  for (k in keys) {
    if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
    var av = a[k] === undefined ? null : a[k];
    var bv = b[k] === undefined ? null : b[k];
    if (String(av) === String(bv)) { unchanged += 1; continue; }
    changes.push({ fieldPath: k, oldValue: av, newValue: bv });
  }

  return {
    entityTypeName: entityTypeName,
    entityId: entityId,
    fromVersion: fromVersion,
    toVersion: toVersion,
    changes: changes,
    changedCount: changes.length,
    unchangedCount: unchanged
  };
}

function replay(s) {
  var sp = s || {};
  var typeName = sp.entityTypeName;
  var g = spec(typeName);

  var ids = sp.entityIds;
  if (!ids || ids.length === 0) {
    // No explicit list: replay every record of the type that has any version history,
    // which is the set the scenarios actually touched.
    var res = EntityVersion.fetch({
      filter: Filter.eq('entityTypeName', typeName),
      include: 'entityId',
      limit: -1
    });
    var seen = {};
    ids = [];
    forEach(res.objs, function (v) {
      if (!seen[v.entityId]) { seen[v.entityId] = true; ids.push(v.entityId); }
    });
  }

  var records = [];
  forEach(ids, function (id) {
    records.push(asOf({
      entityTypeName: typeName,
      entityId: id,
      asOfTransaction: sp.asOfTransaction,
      asOfValid: sp.asOfValid
    }));
  });

  return {
    entityTypeName: typeName,
    asOfTransaction: '' + sp.asOfTransaction,
    asOfValid: '' + (sp.asOfValid || sp.asOfTransaction),
    recordCount: records.length,
    records: records,
    projectedFields: g.fields.concat(g.refs)
  };
}

/* ===================== demo reset (R-TR-15) ===================== */

/**
 * The seeded baseline instant. Everything recorded strictly after this is scenario
 * exhaust and is what demoReset() rewinds. Held as a constant rather than a config row
 * so the reset cannot be pointed at an arbitrary date and quietly delete real history.
 */
var DEMO_BASELINE_AT = '2026-09-01T00:00:00Z';

/** Write a governed record back to a stored payload, field by field. */
function restorePayload(entityTypeName, entityId, payload) {
  var g = spec(entityTypeName);
  var update = { id: entityId };
  var i;
  for (i = 0; i < g.fields.length; i++) {
    var f = g.fields[i];
    if (f === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(payload, f)) update[f] = payload[f];
  }
  for (i = 0; i < g.refs.length; i++) {
    var r = g.refs[i];
    if (Object.prototype.hasOwnProperty.call(payload, r)) {
      update[r] = payload[r] ? { id: payload[r] } : null;
    }
  }

  // merge, not create: the record exists and only the governed projection is restored.
  g.put(update);
  return update;
}

/**
 * Public restore entry point — the primitive TransactionService.rollback() compensates
 * with (R-BE-07), and the one demoReset() rewinds with.
 *
 * Restores only the governed projection, so a rollback cannot clobber fields the
 * transaction never claimed to touch.
 */
function restore(s) {
  var sp = s || {};
  if (!sp.entityTypeName || !sp.entityId) {
    throw new Error('TemporalQueryService.restore: entityTypeName and entityId are required.');
  }
  if (!sp.payload) {
    throw new Error(
      'TemporalQueryService.restore: a payload is required. Restoring from nothing would ' +
      'blank the record rather than revert it.'
    );
  }

  var update = restorePayload(sp.entityTypeName, sp.entityId, sp.payload);
  var fields = [];
  for (var k in update) {
    if (Object.prototype.hasOwnProperty.call(update, k) && k !== 'id') fields.push(k);
  }

  return {
    entityTypeName: sp.entityTypeName,
    entityId: sp.entityId,
    restoredFields: fields,
    restoredFieldCount: fields.length
  };
}

/**
 * Rewind to the seeded baseline (R-TR-15).
 *
 * The important design decision here: this is an **append-only** rewind. It restores the
 * live records to their baseline values and writes DEMO_RESET audit events describing
 * every restoration — it does not delete the scenario's versions, audit events,
 * signatures or agent runs. Purging them would be the obvious implementation and it
 * would directly violate R-TR-01 ("no hard deletes anywhere"), in the one service whose
 * entire purpose is to uphold that rule. It would also destroy the evidence that a reset
 * occurred, which is exactly what a tamperer would want.
 *
 * So after a reset the trail reads: the scenario happened, then it was reset. The demo
 * presents from the baseline again because the *live* records are back at baseline, while
 * an auditor can still see every run. The cost is that the store grows across resets,
 * which for a demonstration environment is the right trade.
 */
function demoReset(s) {
  var sp = s || {};
  var dryRun = sp.dryRun === true;
  var baselineAt = DateTime.fromString('' + (sp.baselineAt || DEMO_BASELINE_AT));
  var correlationId = sp.correlationId || 'demo-reset';
  var actorId = sp.actorId || 'system';

  var out = {
    dryRun: dryRun,
    baselineAt: '' + baselineAt,
    recordsReverted: 0,
    versionsRetained: 0,
    auditEventsRetained: 0,
    signaturesRetained: 0,
    agentRunsRetained: 0,
    claimsReleased: 0,
    details: []
  };

  // 1. Every record that acquired version history after the baseline.
  var vres = EntityVersion.fetch({
    filter: Filter.gt('recordedAt', baselineAt),
    order: 'ascending(entityTypeName), ascending(entityId), ascending(versionNo)',
    include: 'this',
    limit: -1
  });

  var earliest = {};   // key → the lowest-version snapshot, i.e. the pre-scenario state
  forEach(vres.objs, function (v) {
    var key = v.entityTypeName + '|' + v.entityId;
    // ascending(version) means the first row seen for a key is its lowest version, which
    // is the state the record held before the scenario touched it.
    if (!earliest[key]) earliest[key] = v;
    out.versionsRetained += 1;
  });

  // 2. Restore each record from its earliest post-baseline snapshot, and audit the
  //    restoration so the rewind is itself part of the trail.
  var resetEvents = [];
  for (var key in earliest) {
    if (!Object.prototype.hasOwnProperty.call(earliest, key)) continue;
    var v0 = earliest[key];
    if (!GOVERNED[v0.entityTypeName]) continue;   // not restorable; leave it alone

    out.details.push({
      entityTypeName: v0.entityTypeName,
      entityId: v0.entityId,
      restoredToVersion: v0.versionNo,
      reasonCodeOfChange: v0.reasonCode
    });
    out.recordsReverted += 1;

    if (!dryRun) {
      restorePayload(v0.entityTypeName, v0.entityId, v0.payload);
      resetEvents.push({
        entityTypeName: v0.entityTypeName,
        entityId: v0.entityId,
        fieldPath: null,
        oldValue: 'post-scenario state',
        newValue: 'baseline state (version ' + v0.versionNo + ')',
        changeType: 'DEMO_RESET',
        actorId: actorId,
        actorName: 'Demo Reset',
        actorType: 'SERVICE',
        actorRoleAtTime: 'System',
        reasonCode: 'DEMO_RESET',
        justification: 'Record restored to its ' + baselineAt + ' baseline by the demo rewind (R-TR-15). ' +
          'The scenario history above this event is retained — a reset does not erase the trail.',
        sourceChannel: 'API',
        sourceSystem: 'TemporalQueryService',
        correlationId: correlationId
      });
    }
  }

  // 3. Report what the rewind deliberately RETAINS, so the caller can see that the trail
  //    survived rather than assuming a reset wiped it.
  function countAfter(typeObj, field) {
    var r = typeObj.fetch({ filter: Filter.gt(field, baselineAt), include: 'id', limit: -1 });
    return (r.objs && r.objs.length) || 0;
  }
  out.auditEventsRetained = countAfter(AuditEvent, 'occurredAt');
  out.signaturesRetained = countAfter(ESignature, 'signedAt');
  out.agentRunsRetained = countAfter(AgentRunRecord, 'startedAt');

  // 4. Idempotency claims ARE released — and this is not an exception to R-TR-01,
  //    because a claim is not a business fact. It is a concurrency token whose whole
  //    purpose is to stop a replay of a call. After a rewind the scenario is *meant* to
  //    be re-runnable, so the claims are marked released rather than deleted.
  var claims = IdempotencyRecord.fetch({
    filter: Filter.gt('claimedAt', baselineAt).and(Filter.eq('status', 'SUCCEEDED')),
    include: 'id',
    limit: -1
  });
  forEach(claims.objs, function (c) {
    out.claimsReleased += 1;
    if (!dryRun) {
      IdempotencyRecord.make({
        id: c.id,
        status: 'FAILED',
        errorMessage: 'Released by demo reset (R-TR-15) so the scenario can be re-run.'
      }).merge();
    }
  });

  if (!dryRun) {
    if (resetEvents.length > 0) AuditService.recordBatch(resetEvents);

    AuditService.record({
      entityTypeName: 'TemporalQueryService',
      entityId: 'demo-reset',
      fieldPath: 'demoReset',
      oldValue: null,
      newValue: out.recordsReverted + ' records reverted to the ' + baselineAt + ' baseline',
      changeType: 'DEMO_RESET',
      actorId: actorId,
      actorName: 'Demo Reset',
      actorType: 'SERVICE',
      actorRoleAtTime: 'System',
      reasonCode: 'DEMO_RESET',
      justification: 'Bitemporal rewind to the seeded baseline (R-TR-15). Reverted ' +
        out.recordsReverted + ' records; retained ' + out.versionsRetained + ' versions, ' +
        out.auditEventsRetained + ' audit events, ' + out.signaturesRetained + ' signatures and ' +
        out.agentRunsRetained + ' agent runs (append-only, R-TR-01); released ' +
        out.claimsReleased + ' idempotency claims so the scenarios can be re-run.',
      sourceChannel: 'API',
      sourceSystem: 'TemporalQueryService',
      correlationId: correlationId
    });
  }

  return out;
}
