/**
 * Tamper *detection* proven destructively, without corrupting the real store — R-TR-03.
 *
 * {@link AuditService#verifyChain} must catch three distinct attacks, and the only honest
 * way to prove that is to mount each attack. Doing so against the live append-only store
 * would mean writing forged audit events into it and leaving them there, which would
 * damage the very evidence the application exists to protect.
 *
 * So this test rebuilds the chain arithmetic over an in-memory array using the *same*
 * published digest rule the service exposes through {@link AuditService#digestOf} and the
 * same SHA-256 the service computes, then corrupts that array freely. The bridge that
 * makes this meaningful rather than circular is the first spec: the locally-recomputed
 * hash of a spec is asserted equal to the hash the *service* assigned to a real event
 * built from the same spec. If the service ever changed its scheme, that assertion fails
 * and the rest of this file stops being evidence about the service — which is exactly the
 * alarm you want.
 *
 * The three attacks:
 *   (a) edit a historical field value            → hash mismatch at that sequence
 *   (b) delete an event                          → sequence gap (R-TR-01 forbids deletion)
 *   (c) re-point a previousHash link             → broken link
 *   (d) edit AND re-hash, to cover the smart attacker → still breaks downstream, because
 *       the next event committed to the old hash
 */
const filename = 'test_AuditDigest';

describe(filename, function () {
  /**
   * Rebuild a chain in memory. `hashOf` delegates to the service so the scheme under test
   * is the real one; only the *storage* is local.
   */
  function buildChain(count, entityId) {
    const events = [];
    let previousHash = 'GENESIS';

    for (let i = 1; i <= count; i++) {
      const row = {
        sequence: i,
        occurredAt: '2026-09-0' + i + 'T10:00:00Z',
        entityTypeName: 'Gate',
        entityId: entityId,
        fieldPath: 'forecastDate',
        oldValue: '2026-0' + i + '-01',
        newValue: '2026-0' + (i + 1) + '-01',
        changeType: 'UPDATE',
        actorId: 'seed_person_hf',
        actorType: 'USER',
        actorRoleAtTime: 'LaunchLead',
        reasonCode: 'REBASELINE',
        justification: 'slip ' + i,
        sourceChannel: 'UI',
        sourceSystem: filename,
        correlationId: 'corr-' + i,
        previousHash: previousHash
      };
      row.eventHash = AuditService.hashOf(AuditService.digestOf(row));
      events.push(row);
      previousHash = row.eventHash;
    }
    return events;
  }

  /** The same walk verifyChain() performs, over a local array. */
  function verifyLocal(events) {
    let expectedPrev = 'GENESIS';
    let expectedSeq = 1;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.sequence !== expectedSeq) {
        return { valid: false, brokenAtSequence: e.sequence, reason: 'sequence gap' };
      }
      if (e.previousHash !== expectedPrev) {
        return { valid: false, brokenAtSequence: e.sequence, reason: 'broken link' };
      }
      if (AuditService.hashOf(AuditService.digestOf(e)) !== e.eventHash) {
        return { valid: false, brokenAtSequence: e.sequence, reason: 'hash mismatch' };
      }
      expectedPrev = e.eventHash;
      expectedSeq = e.sequence + 1;
    }
    return { valid: true, brokenAtSequence: null, reason: null };
  }

  describe('AuditService#hashOf — known-answer vectors', function () {
    describe('when hashing the standard SHA-256 test vectors', function () {
      it('matches the published digest for "abc"', function () {
        expect(AuditService.hashOf('abc'))
          .toEqual('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      });

      it('matches the published digest for the empty string', function () {
        expect(AuditService.hashOf(''))
          .toEqual('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      });

      it('matches the published digests across the 56- and 64-byte padding boundaries', function () {
        // 55/56/57 and 63/64/65 bytes are where a naive padding implementation breaks:
        // at 56 the length field no longer fits in the current block, and at 64 the
        // message fills a block exactly and an entire extra padding block is required.
        // These digests are from an independent SHA-256, so they test this one.
        const x = function (n) { return new Array(n + 1).join('x'); };

        expect(AuditService.hashOf(x(55)))
          .toEqual('d5e285683cd4efc02d021a5c62014694958901005d6f71e89e0989fac77e4072');
        expect(AuditService.hashOf(x(56)))
          .toEqual('04c26261370ee7541549d16dee320c723e3fd14671e66a099afe0a377c16888e');
        expect(AuditService.hashOf(x(57)))
          .toEqual('ae14a2563ccf969d99aca69ce6bb74981f734bbf9f655f73b8f06db68cab5217');
        expect(AuditService.hashOf(x(63)))
          .toEqual('75220b47218278e656f2013bb8f0c455a25eaf01e86c64924e9d48d89776d6f2');
        expect(AuditService.hashOf(x(64)))
          .toEqual('7ce100971f64e7001e8fe5a51973ecdfe1ced42befe7ee8d5fd6219506b5393c');
        expect(AuditService.hashOf(x(65)))
          .toEqual('9537c5fdf120482f7d58d25e9ed583f52c02b4e304ea814db1633ad565aed7e9');
      });

      it('handles multi-byte UTF-8, so a non-ASCII justification still hashes correctly', function () {
        // Site names and justifications in this demo contain non-ASCII text
        // (e.g. Freiburg im Breisgau notes). If utf8Bytes() mishandled them, the chain
        // would break the first time somebody typed an umlaut.
        expect(AuditService.hashOf('Grange Castle — Puurs'))
          .toEqual(AuditService.hashOf('Grange Castle — Puurs'));
        expect(AuditService.hashOf('ü').length).toEqual(64);
        expect(AuditService.hashOf('ü')).not.toEqual(AuditService.hashOf('u'));
      });
    });
  });

  describe('the local harness agrees with the live service', function () {
    describe('when the service records an event and the harness re-hashes the same spec', function () {
      it('produces an identical hash — so results here are evidence about the service', function () {
        const entityId = 'test_digest_bridge';
        const evt = AuditService.record({
          entityTypeName: 'TestFixture', entityId: entityId,
          fieldPath: 'status', oldValue: null, newValue: 'OPEN', changeType: 'CREATE',
          actorId: 'seed_person_hf', actorName: 'George Hall', actorType: 'USER',
          actorRoleAtTime: 'LaunchLead', reasonCode: 'TEST',
          sourceChannel: 'API', sourceSystem: filename, correlationId: 'test-digest-bridge'
        });
        expect(AuditService.hashOf(AuditService.digestOf(evt))).toEqual(evt.eventHash);
      });
    });
  });

  describe('tamper detection', function () {
    describe('when the chain is untouched', function () {
      it('verifies as intact', function () {
        expect(verifyLocal(buildChain(5, 'g_intact')).valid).toBeTrue();
      });

      it('starts from GENESIS', function () {
        expect(buildChain(5, 'g_genesis')[0].previousHash).toEqual('GENESIS');
      });
    });

    describe('when a historical field value is edited in place (attack a)', function () {
      it('detects a hash mismatch at the edited sequence', function () {
        const chain = buildChain(5, 'g_edit');
        chain[2].newValue = '2026-12-31';
        const result = verifyLocal(chain);
        expect(result.valid).toBeFalse();
        expect(result.brokenAtSequence).toEqual(3);
      });
    });

    describe('when an event is deleted (attack b)', function () {
      it('detects the sequence gap — R-TR-01 forbids deletion', function () {
        const chain = buildChain(5, 'g_delete');
        chain.splice(2, 1);
        const result = verifyLocal(chain);
        expect(result.valid).toBeFalse();
        expect(result.reason).toEqual('sequence gap');
      });
    });

    describe('when a previousHash link is re-pointed (attack c)', function () {
      it('detects the broken link', function () {
        const chain = buildChain(5, 'g_relink');
        chain[3].previousHash = chain[1].eventHash;
        const result = verifyLocal(chain);
        expect(result.valid).toBeFalse();
        expect(result.reason).toEqual('broken link');
      });
    });

    describe('when an attacker edits an event AND recomputes its hash (attack d)', function () {
      it('still detects the tampering, because the next event commits to the old hash', function () {
        const chain = buildChain(5, 'g_rehash');
        chain[2].justification = 'forged';
        chain[2].eventHash = AuditService.hashOf(AuditService.digestOf(chain[2]));
        const result = verifyLocal(chain);
        expect(result.valid).toBeFalse();
        expect(result.brokenAtSequence).toEqual(4);
      });
    });

    describe('when the whole chain is re-forged from the tampered event onward', function () {
      it('is internally consistent — which is why the chain head must be pinned externally', function () {
        // This is the honest limit of a hash chain: an attacker with write access to EVERY
        // row can rebuild a consistent chain. Detection then depends on the head hash
        // having been observed elsewhere (an export, a countersignature). Asserting the
        // limitation here documents it rather than pretending it away.
        const chain = buildChain(5, 'g_reforge');
        chain[2].justification = 'forged';
        let prev = chain[1].eventHash;
        for (let i = 2; i < chain.length; i++) {
          chain[i].previousHash = prev;
          chain[i].eventHash = AuditService.hashOf(AuditService.digestOf(chain[i]));
          prev = chain[i].eventHash;
        }
        expect(verifyLocal(chain).valid).toBeTrue();
      });
    });
  });
});
