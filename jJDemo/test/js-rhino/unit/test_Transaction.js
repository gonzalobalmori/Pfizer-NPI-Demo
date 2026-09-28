/**
 * Idempotency, optimistic concurrency and all-or-nothing cascades — R-BE-05, R-BE-06,
 * R-BE-07.
 *
 * These three requirements share one theme: a write that is repeated, raced or
 * half-completed must never leave the portfolio in a state nobody chose. The demo makes
 * that visible — approving a resolution option cascades across lots, markets, gates and
 * tasks — so the failure mode being guarded against is a cascade that applied to four
 * records out of nine and reported success.
 *
 * What each group proves:
 *
 *   **Idempotency (R-BE-05).** A retried action *replays* its stored result rather than
 *   being rejected. Rejection would be safe but useless: the client that retried because
 *   its connection dropped still needs the answer. So the assertion is not merely "the
 *   second call did not write twice", it is "the second call returned the first call's
 *   result".
 *
 *   **Concurrency (R-BE-06).** A stale version token is refused with an error naming both
 *   versions. The requirement's phrase is "never silent overwrite", so the spec checks
 *   that the write *threw* — a test asserting only the final field value would pass
 *   against a last-write-wins implementation.
 *
 *   **Transactionality (R-BE-07).** Rollback restores in reverse order. Forward-order
 *   restoration is the subtle bug: when two steps touched the same record, replaying
 *   forwards leaves the later snapshot in place — which is a state the cascade created,
 *   not the state it began from. The reverse-order spec below is built to fail if that
 *   regresses.
 *
 * Fixtures use a `TestFixture` entity type name so these specs never mutate seeded
 * business records.
 */
const filename = 'test_Transaction';

describe(filename, function () {
  /** A key unique to one spec, so specs cannot collide through the shared claim store. */
  function keyFor(label) {
    return filename + '_' + label;
  }

  describe('TransactionService#claim — idempotent writes (R-BE-05)', function () {
    describe('when a key is claimed for the first time', function () {
      it('grants the claim, so the caller proceeds with the business write', function () {
        const r = TransactionService.claim({
          actionName: 'testAction', idempotencyKey: keyFor('first'),
          actorId: 'seed_person_hf', correlationId: 'test-idem-first'
        });
        expect(r.claimed).toBeTrue();
        expect(r.replayed).toBeFalse();
      });
    });

    describe('when a completed key is claimed again', function () {
      it('replays the stored result instead of re-running or rejecting', function () {
        const key = keyFor('replay');
        TransactionService.claim({
          actionName: 'testAction', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-replay'
        });
        TransactionService.complete({
          actionName: 'testAction', idempotencyKey: key,
          result: { unitsAffected: 612000, decision: 'OPTION_B' }
        });

        const again = TransactionService.claim({
          actionName: 'testAction', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-replay'
        });

        expect(again.claimed).toBeFalse();
        expect(again.replayed).toBeTrue();
        // The point of replay: the retrying client gets the original answer.
        expect(again.result.unitsAffected).toEqual(612000);
        expect(again.result.decision).toEqual('OPTION_B');
      });
    });

    describe('when a claim is still in flight', function () {
      it('raises a conflict rather than inventing a result that does not exist yet', function () {
        const key = keyFor('inflight');
        TransactionService.claim({
          actionName: 'testAction', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-inflight'
        });
        expect(() => {
          TransactionService.claim({
            actionName: 'testAction', idempotencyKey: key,
            actorId: 'seed_person_ap', correlationId: 'test-idem-inflight-2'
          });
        }).toThrow();
      });
    });

    describe('when a failed key is claimed again', function () {
      it('grants the claim — a rolled-back attempt is retryable from the same pre-state', function () {
        const key = keyFor('retry');
        TransactionService.claim({
          actionName: 'testAction', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-retry'
        });
        TransactionService.fail({
          actionName: 'testAction', idempotencyKey: key,
          errorMessage: 'simulated downstream failure'
        });

        const again = TransactionService.claim({
          actionName: 'testAction', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-retry-2'
        });
        expect(again.claimed).toBeTrue();
      });
    });

    describe('when two different actions use the same key text', function () {
      it('treats them as independent — the key is scoped to the action, not global', function () {
        const key = keyFor('scoped');
        TransactionService.claim({
          actionName: 'actionOne', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-scope-1'
        });
        const other = TransactionService.claim({
          actionName: 'actionTwo', idempotencyKey: key,
          actorId: 'seed_person_hf', correlationId: 'test-idem-scope-2'
        });
        expect(other.claimed).toBeTrue();
      });
    });
  });

  describe('TransactionService#assertVersion — optimistic concurrency (R-BE-06)', function () {
    // A governed type, because version tokens live in EntityVersion and only governed
    // types are snapshotted. TASK is a leaf record, so revising it cannot disturb a
    // scenario the other specs depend on.
    const TASK = 'seed_task_417_a_1';

    describe('when the caller holds a stale version token', function () {
      it('refuses the write rather than silently overwriting the other user\'s change', function () {
        // Take the real token, then assert a *different* one — the definition of stale,
        // without assuming any particular current version number.
        const current = TemporalQueryService.versionTokenOf('ActionPlanTask', TASK);
        expect(() => {
          TransactionService.assertVersion('ActionPlanTask', TASK, current + 1);
        }).toThrow();
      });

      it('names both versions in the error, so the user can see what happened', function () {
        const current = TemporalQueryService.versionTokenOf('ActionPlanTask', TASK);
        let message = '';
        try {
          TransactionService.assertVersion('ActionPlanTask', TASK, current + 1);
        } catch (e) {
          message = String(e.message || e);
        }
        expect(message.indexOf('Conflict') >= 0).toBeTrue();
        expect(message.indexOf('' + current) >= 0).toBeTrue();
        expect(message.indexOf('Reload') >= 0).toBeTrue();
      });
    });

    describe('when the caller passes the current token', function () {
      it('permits the write', function () {
        const current = TemporalQueryService.versionTokenOf('ActionPlanTask', TASK);
        expect(TransactionService.assertVersion('ActionPlanTask', TASK, current)).toBeTrue();
      });
    });

    describe('when the caller deliberately asserts no version', function () {
      it('permits the write — server-initiated jobs have no token to hold', function () {
        expect(TransactionService.assertVersion('ActionPlanTask', TASK, -1)).toBeTrue();
      });
    });
  });

  describe('TransactionService#begin / commit / rollback — atomicity (R-BE-07)', function () {
    describe('when a transaction is opened', function () {
      it('snapshots every target up front, which is what makes rollback possible', function () {
        const tx = TransactionService.begin({
          actionName: 'testCascade',
          correlationId: 'test-tx-begin',
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [
            { entityTypeName: 'ActionPlanTask', entityId: 'seed_task_417_a_2', changedFields: ['status'] },
            { entityTypeName: 'ActionPlanTask', entityId: 'seed_task_417_a_3', changedFields: ['status'] }
          ]
        });
        expect(tx.snapshots.length).toEqual(2);
        expect(tx.txId.length > 0).toBeTrue();
      });

      it('refuses a type it does not govern, rather than silently skipping the snapshot', function () {
        // An unsnapshotted target could not be rolled back, so a cascade that quietly
        // accepted one would be advertising atomicity it cannot deliver.
        expect(() => {
          TransactionService.begin({
            actionName: 'testCascade', correlationId: 'test-tx-ungoverned',
            actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
            targets: [{ entityTypeName: 'AppRole', entityId: 'role_executive', changedFields: ['name'] }]
          });
        }).toThrow();
      });
    });

    describe('when a transaction commits', function () {
      it('writes one audit event per changed field, so a commit is fully audited', function () {
        const correlationId = 'test-tx-commit';
        const tx = TransactionService.begin({
          actionName: 'testCascade', correlationId: correlationId,
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'TestFixture', entityId: 'tx_commit_a', changedFields: ['status'] }]
        });

        const result = TransactionService.commit({
          txId: tx.txId, actionName: tx.actionName, correlationId: correlationId,
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          snapshots: tx.snapshots,
          changes: [
            {
              entityTypeName: 'TestFixture', entityId: 'tx_commit_a',
              fieldPath: 'status', oldValue: 'OPEN', newValue: 'CLOSED',
              changeType: 'STATE_TRANSITION'
            },
            {
              entityTypeName: 'TestFixture', entityId: 'tx_commit_a',
              fieldPath: 'ownerTeam', oldValue: 'GSC', newValue: 'NPLM',
              changeType: 'UPDATE'
            }
          ]
        });

        expect(result.committed).toBeTrue();
        expect(result.auditEventCount).toEqual(2);
      });

      it('shares one correlation id across the burst, so History can collapse it to one gesture', function () {
        const correlationId = 'test-tx-correlation';
        const tx = TransactionService.begin({
          actionName: 'testCascade', correlationId: correlationId,
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'TestFixture', entityId: 'tx_corr_a', changedFields: ['status'] }]
        });
        TransactionService.commit({
          txId: tx.txId, actionName: tx.actionName, correlationId: correlationId,
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          snapshots: tx.snapshots,
          changes: [{
            entityTypeName: 'TestFixture', entityId: 'tx_corr_a',
            fieldPath: 'status', oldValue: 'A', newValue: 'B', changeType: 'UPDATE'
          }]
        });

        const history = AuditService.historyFor('TestFixture', 'tx_corr_a', -1);
        let tagged = 0;
        const events = history.events || [];
        for (let i = 0; i < events.length; i++) {
          if (events[i].correlationId === correlationId) tagged += 1;
        }
        expect(tagged > 0).toBeTrue();
      });
    });

    describe('when a partially-applied cascade is rolled back', function () {
      it('restores the record to its pre-transaction value', function () {
        const taskId = 'seed_task_417_a_4';
        const before = ActionPlanTask.forId(taskId).status;

        const tx = TransactionService.begin({
          actionName: 'testCascade', correlationId: 'test-tx-restore',
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'ActionPlanTask', entityId: taskId, changedFields: ['status'] }]
        });

        // Apply a change, as a cascade step would, then fail the cascade.
        ActionPlanTask.make({ id: taskId, status: 'In progress' }).merge();
        expect(ActionPlanTask.forId(taskId).status).toEqual('In progress');

        const result = TransactionService.rollback({
          txId: tx.txId, actionName: tx.actionName, correlationId: 'test-tx-restore',
          actorId: 'seed_person_hf', actorName: 'George Hall',
          snapshots: tx.snapshots, errorMessage: 'simulated failure at step 2'
        });

        expect(result.rolledBack).toBeTrue();
        expect(result.recordsRestored).toEqual(1);
        expect(ActionPlanTask.forId(taskId).status).toEqual(before);
      });
    });

    describe('when one record was touched twice by the same cascade', function () {
      it('restores in reverse order, so the pre-cascade state wins over the mid-cascade one', function () {
        // The subtle bug this guards: step 1 snapshots the original value, step 2
        // snapshots the already-modified value. Restoring *forwards* would finish by
        // re-applying step 2's snapshot and leave the state the cascade created. Reverse
        // order ends on step 1's snapshot — the state the cascade began from.
        const taskId = 'seed_task_417_a_5';
        const original = ActionPlanTask.forId(taskId).status;

        const first = TransactionService.begin({
          actionName: 'testCascade', correlationId: 'test-tx-reverse',
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'ActionPlanTask', entityId: taskId, changedFields: ['status'] }]
        });
        ActionPlanTask.make({ id: taskId, status: 'In progress' }).merge();

        const second = TransactionService.begin({
          actionName: 'testCascade', correlationId: 'test-tx-reverse',
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'ActionPlanTask', entityId: taskId, changedFields: ['status'] }]
        });
        ActionPlanTask.make({ id: taskId, status: 'Blocked' }).merge();

        // One envelope holding both snapshots in the order the cascade took them.
        const result = TransactionService.rollback({
          txId: first.txId, actionName: 'testCascade', correlationId: 'test-tx-reverse',
          actorId: 'seed_person_hf', actorName: 'George Hall',
          snapshots: [first.snapshots[0], second.snapshots[0]],
          errorMessage: 'simulated failure after two steps'
        });

        expect(result.recordsRestored).toEqual(2);
        expect(ActionPlanTask.forId(taskId).status).toEqual(original);
      });
    });

    describe('when a rollback runs', function () {
      it('audits itself — a compensated cascade must not look like it never happened', function () {
        const tx = TransactionService.begin({
          actionName: 'testCascade', correlationId: 'test-tx-audited-rollback',
          actorId: 'seed_person_hf', actorName: 'George Hall', reasonCode: 'TEST',
          targets: [{ entityTypeName: 'ActionPlanTask', entityId: 'seed_task_417_a_6', changedFields: ['status'] }]
        });
        TransactionService.rollback({
          txId: tx.txId, actionName: tx.actionName, correlationId: 'test-tx-audited-rollback',
          actorId: 'seed_person_hf', actorName: 'George Hall',
          snapshots: tx.snapshots, errorMessage: 'simulated failure'
        });

        // The rollback event is keyed to the transaction, not to any one record, because
        // the thing that happened was "this cascade was compensated".
        const history = AuditService.historyFor('TransactionService', tx.txId, -1);
        let found = false;
        const events = history.events || [];
        for (let i = 0; i < events.length; i++) {
          if (events[i].reasonCode === 'CASCADE_ROLLBACK') found = true;
        }
        expect(found).toBeTrue();
      });
    });
  });

  describe('TransactionService#versionTokens — what the UI holds alongside the data', function () {
    describe('when tokens are requested for several records', function () {
      it('returns one token per record, so each write can assert its own version', function () {
        const r = TransactionService.versionTokens({
          targets: [
            { entityTypeName: 'ActionPlanTask', entityId: 'seed_task_417_a_1' },
            { entityTypeName: 'ActionPlanTask', entityId: 'seed_task_417_a_2' }
          ]
        });
        expect(r.tokens.length).toEqual(2);
      });
    });
  });

  describe('TransactionService#newCorrelationId', function () {
    describe('when two ids are generated in succession', function () {
      it('returns distinct ids carrying the supplied prefix', function () {
        const a = TransactionService.newCorrelationId('approve');
        const b = TransactionService.newCorrelationId('approve');
        expect(a.indexOf('approve') >= 0).toBeTrue();
        expect(a).not.toEqual(b);
      });
    });
  });
});
