/*
 * TransactionService implementation — idempotency (R-BE-05), optimistic concurrency
 * (R-BE-06) and saga-style atomic cascades (R-BE-07).
 *
 * Design notes:
 *
 * 1. Atomicity is compensation, not a database transaction. A C3 server action does not
 *    span one ACID transaction across many entity writes, so begin() snapshots every
 *    target up front and rollback() restores them in REVERSE order. Reverse matters: if
 *    two steps touched one record, replaying forwards would leave the later snapshot in
 *    place — the state the cascade created, not the state it started from.
 *
 * 2. The rollback is audited. A silent rollback would leave an operator unable to explain
 *    why the plan they authorised never appeared.
 *
 * 3. claim() replays rather than rejects. A client that timed out never saw its response;
 *    rejecting the retry would leave it permanently unable to learn the outcome.
 *
 * 4. assertVersion() refuses on mismatch and never merges defensively. R-BE-06 is explicit
 *    that a conflict must be "a clear error, never a silent overwrite".
 */

function forEach(list, fn) {
  if (!list) return;
  if (typeof list.each === 'function') { list.each(fn); return; }
  for (var i = 0; i < list.length; i++) fn(list[i], i);
}

/** Stable id fragment for a claim: the pair (actionName, key) is unique by construction. */
function claimId(actionName, idempotencyKey) {
  return 'idem_' + String(actionName).replace(/[^A-Za-z0-9]/g, '_') + '_' +
    String(idempotencyKey).replace(/[^A-Za-z0-9]/g, '_');
}

function findClaim(actionName, idempotencyKey) {
  var res = IdempotencyRecord.fetch({
    filter: Filter.eq('id', claimId(actionName, idempotencyKey)),
    include: 'this',
    limit: 1
  });
  return (res.objs && res.objs.length > 0) ? res.objs[0] : null;
}

/* ===================== idempotency (R-BE-05) ===================== */

function claim(spec) {
  var s = spec || {};
  if (!s.actionName || !s.idempotencyKey) {
    throw new Error(
      'TransactionService.claim: actionName and idempotencyKey are required. Every mutating ' +
      'action takes a client-supplied idempotency key (R-BE-05).'
    );
  }

  var id = claimId(s.actionName, s.idempotencyKey);
  var existing = findClaim(s.actionName, s.idempotencyKey);

  if (existing) {
    if (existing.status === 'SUCCEEDED') {
      // Replay, not reject — see design note 3.
      return {
        claimed: false,
        replayed: true,
        recordId: id,
        result: existing.resultJson === undefined ? null : existing.resultJson,
        claimedAt: '' + existing.claimedAt,
        completedAt: existing.completedAt ? '' + existing.completedAt : null
      };
    }
    if (existing.status === 'IN_PROGRESS') {
      throw new Error(
        'Conflict: an attempt on "' + s.actionName + '" with idempotency key "' +
        s.idempotencyKey + '" is still in progress (claimed at ' + existing.claimedAt +
        '). Its result does not exist yet, so this retry cannot be replayed. Retry once the ' +
        'first attempt completes.'
      );
    }
    // FAILED: the compensating rollback restored the pre-state, so the key is retryable.
    IdempotencyRecord.make({
      id: id,
      actionName: s.actionName,
      idempotencyKey: s.idempotencyKey,
      status: 'IN_PROGRESS',
      claimedAt: DateTime.now(),
      completedAt: null,
      errorMessage: null,
      correlationId: s.correlationId === undefined ? null : s.correlationId,
      actorId: s.actorId === undefined ? null : s.actorId
    }).merge();

    return { claimed: true, replayed: false, recordId: id, result: null, retryOfFailed: true };
  }

  IdempotencyRecord.make({
    id: id,
    actionName: s.actionName,
    idempotencyKey: s.idempotencyKey,
    status: 'IN_PROGRESS',
    claimedAt: DateTime.now(),
    correlationId: s.correlationId === undefined ? null : s.correlationId,
    actorId: s.actorId === undefined ? null : s.actorId
  }).merge();

  return { claimed: true, replayed: false, recordId: id, result: null, retryOfFailed: false };
}

function complete(spec) {
  var s = spec || {};
  var id = claimId(s.actionName, s.idempotencyKey);
  IdempotencyRecord.make({
    id: id,
    status: 'SUCCEEDED',
    completedAt: DateTime.now(),
    resultJson: s.result === undefined ? null : s.result,
    errorMessage: null
  }).merge();
  return { recordId: id, status: 'SUCCEEDED' };
}

function fail(spec) {
  var s = spec || {};
  var id = claimId(s.actionName, s.idempotencyKey);
  IdempotencyRecord.make({
    id: id,
    status: 'FAILED',
    completedAt: DateTime.now(),
    errorMessage: s.errorMessage === undefined ? null : ('' + s.errorMessage)
  }).merge();
  return { recordId: id, status: 'FAILED' };
}

/* ===================== optimistic concurrency (R-BE-06) ===================== */

function assertVersion(entityTypeName, entityId, expectedVersion) {
  // A null or negative token means the caller is deliberately not asserting a version.
  // Permitted for server-initiated writes (a job has no read-modify-write window to
  // protect); never passed by a UI gesture, which always read the record first.
  if (expectedVersion === null || expectedVersion === undefined || expectedVersion < 0) return true;

  var current = TemporalQueryService.versionTokenOf(entityTypeName, entityId);
  if (current === expectedVersion) return true;

  throw new Error(
    'Conflict on ' + entityTypeName + ' "' + entityId + '": you loaded version ' +
    expectedVersion + ' but the record is now at version ' + current +
    '. Another user changed it in the meantime. Reload the record and re-apply your change — ' +
    'this write was refused rather than silently overwriting theirs (R-BE-06).'
  );
}

function versionTokens(spec) {
  var s = spec || {};
  var tokens = [];
  forEach(s.targets, function (t) {
    tokens.push({
      entityTypeName: t.entityTypeName,
      entityId: t.entityId,
      version: TemporalQueryService.versionTokenOf(t.entityTypeName, t.entityId)
    });
  });
  return { tokens: tokens, count: tokens.length };
}

/* ===================== correlation ids (R-BE-08) ===================== */

/**
 * A correlation id unique to one gesture. Derived from the current instant plus the
 * prefix — no Math.random(), because a reproducible id makes a failed cascade easier to
 * trace through logs and because randomness is not needed for uniqueness at this rate.
 */
function newCorrelationId(prefix) {
  var p = (prefix || 'op').replace(/[^A-Za-z0-9]/g, '');
  var millis = DateTime.now().toMillis();
  return p + '-' + millis.toString(36);
}

/* ===================== transaction envelope (R-BE-07) ===================== */

function begin(spec) {
  var s = spec || {};
  if (!s.actionName) throw new Error('TransactionService.begin: actionName is required.');

  var correlationId = s.correlationId || newCorrelationId(s.actionName);
  var txId = 'tx_' + correlationId;

  var snapshots = [];
  forEach(s.targets, function (t) {
    // Optimistic concurrency is checked before anything is snapshotted: a stale caller
    // must be refused without leaving version rows behind.
    if (t.expectedVersion !== undefined && t.expectedVersion !== null) {
      assertVersion(t.entityTypeName, t.entityId, t.expectedVersion);
    }

    var snap = TemporalQueryService.snapshot({
      entityTypeName: t.entityTypeName,
      entityId: t.entityId,
      changedFields: t.changedFields || [],
      correlationId: correlationId,
      actorName: s.actorName === undefined ? null : s.actorName,
      reasonCode: s.reasonCode === undefined ? null : s.reasonCode
    });

    snapshots.push({
      entityTypeName: t.entityTypeName,
      entityId: t.entityId,
      versionId: snap.versionId,
      version: snap.version,
      payload: snap.payload,
      changedFields: t.changedFields || []
    });
  });

  return {
    txId: txId,
    actionName: s.actionName,
    correlationId: correlationId,
    actorId: s.actorId === undefined ? null : s.actorId,
    actorName: s.actorName === undefined ? null : s.actorName,
    reasonCode: s.reasonCode === undefined ? null : s.reasonCode,
    justification: s.justification === undefined ? null : s.justification,
    snapshots: snapshots,
    snapshotCount: snapshots.length,
    openedAt: '' + DateTime.now()
  };
}

function commit(spec) {
  var s = spec || {};
  if (!s.txId || !s.correlationId) {
    throw new Error('TransactionService.commit: the handle from begin() is required (txId, correlationId).');
  }

  // One audit event per changed field, written here rather than by each step, so a
  // committed cascade is completely audited by construction (see design note in the
  // .c3typ). An event batch shares the correlation id, which is what lets the History tab
  // collapse the cascade back to one gesture.
  var events = [];
  forEach(s.changes, function (c) {
    events.push({
      entityTypeName: c.entityTypeName,
      entityId: c.entityId,
      fieldPath: c.fieldPath === undefined ? null : c.fieldPath,
      oldValue: c.oldValue === undefined ? null : c.oldValue,
      newValue: c.newValue === undefined ? null : c.newValue,
      changeType: c.changeType || 'UPDATE',
      actorId: c.actorId || s.actorId || 'system',
      actorName: c.actorName || s.actorName || null,
      actorType: c.actorType || 'USER',
      actorRoleAtTime: c.actorRoleAtTime === undefined ? null : c.actorRoleAtTime,
      reasonCode: c.reasonCode || s.reasonCode || null,
      justification: c.justification === undefined ? (s.justification || null) : c.justification,
      sourceChannel: c.sourceChannel || 'UI',
      sourceSystem: c.sourceSystem || s.actionName,
      correlationId: s.correlationId,
      sessionId: c.sessionId === undefined ? null : c.sessionId
    });
  });

  var written = { count: 0 };
  if (events.length > 0) written = AuditService.recordBatch(events);

  var records = [];
  forEach(s.snapshots, function (sn) {
    records.push({ entityTypeName: sn.entityTypeName, entityId: sn.entityId, fromVersion: sn.version });
  });

  return {
    txId: s.txId,
    correlationId: s.correlationId,
    committed: true,
    auditEventCount: written.count,
    records: records,
    recordCount: records.length,
    committedAt: '' + DateTime.now()
  };
}

function rollback(spec) {
  var s = spec || {};
  if (!s.txId) throw new Error('TransactionService.rollback: the handle from begin() is required.');

  var snaps = s.snapshots || [];
  var restored = 0;
  var failures = [];

  // Reverse order — see design note 1.
  for (var i = snaps.length - 1; i >= 0; i--) {
    var sn = snaps[i];
    try {
      TemporalQueryService.restore({
        entityTypeName: sn.entityTypeName,
        entityId: sn.entityId,
        payload: sn.payload
      });
      restored += 1;
    } catch (err) {
      // A failed restoration is the worst case in a saga and must be surfaced loudly, not
      // swallowed: the record is now in an indeterminate state and needs a human.
      failures.push({
        entityTypeName: sn.entityTypeName,
        entityId: sn.entityId,
        error: '' + (err.message || err)
      });
    }
  }

  // The rollback is itself audited — see design note 2.
  AuditService.record({
    entityTypeName: 'TransactionService',
    entityId: s.txId,
    fieldPath: 'rollback',
    oldValue: 'partially applied cascade',
    newValue: restored + ' of ' + snaps.length + ' records restored to their pre-transaction state',
    changeType: 'UPDATE',
    actorId: s.actorId || 'system',
    actorName: s.actorName || 'TransactionService',
    actorType: 'SERVICE',
    actorRoleAtTime: 'System',
    reasonCode: 'CASCADE_ROLLBACK',
    justification: 'Cascade "' + (s.actionName || 'unknown') + '" failed and was compensated (R-BE-07). ' +
      'Cause: ' + (s.errorMessage || 'unspecified') +
      (failures.length > 0
        ? ' WARNING: ' + failures.length + ' record(s) could not be restored and need manual review.'
        : ''),
    sourceChannel: 'API',
    sourceSystem: 'TransactionService',
    correlationId: s.correlationId || s.txId
  });

  return {
    txId: s.txId,
    correlationId: s.correlationId || null,
    rolledBack: true,
    recordsRestored: restored,
    recordsAttempted: snaps.length,
    unrestored: failures,
    errorMessage: s.errorMessage === undefined ? null : ('' + s.errorMessage),
    rolledBackAt: '' + DateTime.now()
  };
}
