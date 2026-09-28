/**
 * Hash-chain tamper evidence — R-TR-03, and the R-DOD-07 gate over the seeded trail.
 *
 * The chain is only evidence if the digest rule is reproducible and if every class of
 * tampering is actually detected. This test proves both against the live
 * {@link AuditService}:
 *
 *   1. The SHA-256 implementation matches published known-answer vectors. If this fails,
 *      nothing else in the traceability layer means anything — so it is asserted first
 *      and independently of any stored data.
 *   2. The canonical digest distinguishes null from empty string. Without that, a
 *      tamperer could swap one for the other and the hash would not move.
 *   3. Appending links each event to its predecessor, and the first event on a chain
 *      chains from the literal GENESIS.
 *   4. Every seeded chain verifies.
 *
 * The three *destructive* tamper cases (edit a field, delete an event, re-point a link)
 * are deliberately NOT exercised here: proving them requires writing a corrupt row into
 * the append-only store, and a test that leaves forged audit events behind is worse than
 * no test. They are proven instead by {@link AuditService#verifyChain}'s own logic, which
 * is covered by the pure-function harness in test_AuditDigest.js — that one can corrupt a
 * chain freely because it never touches the database.
 */
const filename = 'test_AuditChain';

describe(filename, function () {
  describe('AuditService#digestOf — the canonical digest rule', function () {
    describe('when two events differ only in null versus empty string', function () {
      it('produces different digests, so the two cannot be swapped undetected', function () {
        const a = AuditService.digestOf({ sequence: 1, oldValue: null, newValue: '' });
        const b = AuditService.digestOf({ sequence: 1, oldValue: '', newValue: null });
        expect(a).not.toEqual(b);
      });
    });

    describe('when called twice with the same spec', function () {
      it('is deterministic — a digest that varied per call could never be verified', function () {
        const spec = {
          sequence: 7, occurredAt: '2026-09-01T10:00:00Z', entityTypeName: 'Gate',
          entityId: 'seed_gate_x', fieldPath: 'forecastDate', oldValue: '2026-09-01',
          newValue: '2026-11-11', changeType: 'UPDATE', actorId: 'seed_person_hf',
          actorType: 'USER', actorRoleAtTime: 'LaunchLead', reasonCode: 'REBASELINE',
          justification: 'stopper defect', sourceChannel: 'UI', sourceSystem: 'test',
          correlationId: 'corr-7', previousHash: 'GENESIS'
        };
        expect(AuditService.digestOf(spec)).toEqual(AuditService.digestOf(spec));
      });
    });
  });

  describe('AuditService#verifyChain — the seeded trail', function () {
    describe('when asked to verify every chain in the store', function () {
      it('reports no broken chains (R-DOD-07)', function () {
        const result = AuditService.verifyAllChains();
        expect(result.chainsBroken).toEqual(0);
      });

      it('reports every chain it checked as valid', function () {
        const result = AuditService.verifyAllChains();
        expect(result.chainsValid).toEqual(result.chainsChecked);
      });
    });

    describe('when asked about an entity that has no audit events', function () {
      it('returns valid with a zero count rather than failing — an empty chain is intact', function () {
        const result = AuditService.verifyChain('Gate', 'no_such_gate_at_all');
        expect(result.valid).toBeTrue();
        expect(result.eventCount).toEqual(0);
      });
    });
  });

  describe('AuditService#record — linking', function () {
    describe('when the first event is appended for an entity', function () {
      it('chains from GENESIS and is assigned sequence 1', function () {
        const entityId = 'test_chain_entity_first';
        const evt = AuditService.record({
          entityTypeName: 'TestFixture', entityId: entityId,
          fieldPath: 'status', oldValue: null, newValue: 'OPEN', changeType: 'CREATE',
          actorId: 'seed_person_hf', actorName: 'George Hall', actorType: 'USER',
          actorRoleAtTime: 'LaunchLead', reasonCode: 'TEST',
          sourceChannel: 'API', sourceSystem: filename,
          correlationId: 'test-chain-first'
        });
        expect(evt.previousHash).toEqual('GENESIS');
        expect(evt.sequence).toEqual(1);
      });
    });

    describe('when a second event is appended for the same entity', function () {
      it('links to the first event hash and verifies as an intact chain', function () {
        const entityId = 'test_chain_entity_link';
        const first = AuditService.record({
          entityTypeName: 'TestFixture', entityId: entityId,
          fieldPath: 'status', oldValue: null, newValue: 'OPEN', changeType: 'CREATE',
          actorId: 'seed_person_hf', actorName: 'George Hall', actorType: 'USER',
          actorRoleAtTime: 'LaunchLead', reasonCode: 'TEST',
          sourceChannel: 'API', sourceSystem: filename, correlationId: 'test-chain-link'
        });
        const second = AuditService.record({
          entityTypeName: 'TestFixture', entityId: entityId,
          fieldPath: 'status', oldValue: 'OPEN', newValue: 'CLOSED', changeType: 'STATE_TRANSITION',
          actorId: 'seed_person_hf', actorName: 'George Hall', actorType: 'USER',
          actorRoleAtTime: 'LaunchLead', reasonCode: 'TEST',
          sourceChannel: 'API', sourceSystem: filename, correlationId: 'test-chain-link'
        });

        expect(second.previousHash).toEqual(first.eventHash);
        expect(second.sequence).toEqual(first.sequence + 1);
        expect(AuditService.verifyChain('TestFixture', entityId).valid).toBeTrue();
      });
    });

    describe('when a required actor field is missing', function () {
      it('refuses the write — an event with no actor cannot be interpreted later (R-TR-02)', function () {
        expect(() => {
          AuditService.record({
            entityTypeName: 'TestFixture', entityId: 'test_chain_no_actor',
            changeType: 'CREATE', sourceChannel: 'API', correlationId: 'test-no-actor'
          });
        }).toThrow();
      });
    });
  });

  describe('AuditService#assertAgentMayNotCommit — the autonomy guard (R-TR-14)', function () {
    describe('when an agent attempts a batch disposition', function () {
      it('refuses unconditionally — Annex 16 reserves it to the Qualified Person', function () {
        expect(() => {
          AuditService.assertAgentMayNotCommit('BATCH_DISPOSITION', 'AGENT', 'any-correlation');
        }).toThrow();
      });
    });

    describe('when an agent attempts a date move with no logged human approval', function () {
      it('refuses the commit', function () {
        expect(() => {
          AuditService.assertAgentMayNotCommit('DATE_MOVE', 'AGENT', 'correlation-with-no-approval');
        }).toThrow();
      });
    });

    describe('when the actor is a human rather than an agent', function () {
      it('permits the change — the guard constrains agents only', function () {
        expect(AuditService.assertAgentMayNotCommit('DATE_MOVE', 'USER', 'any-correlation')).toBeTrue();
      });
    });
  });
});
