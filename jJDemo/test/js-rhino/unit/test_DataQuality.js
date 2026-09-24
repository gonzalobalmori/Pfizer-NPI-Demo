/**
 * Data-quality + reconciliation tests (Build brief 2, Item 5) — authored
 * FAILING-FIRST against the synthetic extracts.
 *
 * "Failing-first" for a DQ rule means: the rule must CATCH its planted defect.
 * The §4 extracts carry deliberate, bounded dirt, and each test asserts the rule
 * finds exactly that defect (the right count AND the right offending key) — a
 * rule that returned PASS here would be vacuous. The RECON-* tests assert the
 * loaded ontology is internally consistent and that the NPI-0417 escalation
 * thread still matches its locked golden copy (the regression guard the brief
 * requires).
 *
 * Pure read-and-assert against provisioned data/seed — nothing is created, so no
 * TestApi context / waitForSetup is needed.
 *
 *   DQ-KEY-01      SAP_LFA1.LIFNR   trailing whitespace   -> FAIL, 1 offender (Sterigenics padded)
 *   DQ-UNIQ-01     SAP_LFA1.LIFNR   duplicate row         -> FAIL, 1 offender (BSI x2)
 *   DQ-DATE-01     LIMS.result_date dd/MM/yyyy            -> FAIL, 1 offender (OCT-BIO-07)
 *   DQ-REF-01      XWALK.dunsNumber missing DUNS          -> FAIL, 1 offender (Heraeus)
 *   DQ-COMPLETE-01 SAP_LFA1.STCEG   null EU VAT           -> WARN (tolerated, reported)
 *   RECON-SPC-01   breaches confined to HOLD lots         -> PASS
 *   RECON-THREAD-01 staged thread == locked golden        -> PASS
 *   DQ-GATE-01     admission gate (enforcing)             -> GATED: 55 admit / 1 repair / 1 quarantine
 */
const filename = 'test_DataQuality';

describe(filename, function () {
  beforeAll(function () {
    this.keyHygiene = DataQualityCheck.checkKeyHygiene();
    this.uniqueness = DataQualityCheck.checkUniqueness();
    this.dateFormat = DataQualityCheck.checkDateFormat();
    this.refIntegrity = DataQualityCheck.checkReferentialIntegrity();
    this.completeness = DataQualityCheck.checkCompleteness();
    this.spcConfinement = DataQualityCheck.checkSpcConfinement();
    this.threadIntegrity = DataQualityCheck.checkThreadIntegrity();
    this.gate = DataQualityCheck.supplierAdmissionGate();
    this.all = DataQualityCheck.runAll();
  });

  describe('DQ-KEY-01 — key hygiene (SAP_LFA1.LIFNR)', function () {
    it('FAILs and catches exactly the one padded vendor key', function () {
      expect(this.keyHygiene.status).toBe('FAIL');
      expect(this.keyHygiene.failures).toBe(1);
    });
    it('names the padded value (a trailing space)', function () {
      var off = this.keyHygiene.offenders[0];
      expect(off.value).toContain(' ');
      expect(off.name).toBe('Sterigenics Grand Rapids');
    });
  });

  describe('DQ-UNIQ-01 — uniqueness (SAP_LFA1.LIFNR)', function () {
    it('FAILs and catches exactly the one duplicated vendor', function () {
      expect(this.uniqueness.status).toBe('FAIL');
      expect(this.uniqueness.failures).toBe(1);
    });
    it('identifies BSI (0001009003) emitted twice', function () {
      var off = this.uniqueness.offenders[0];
      expect(off.key).toBe('0001009003');
      expect(off.occurrences).toBe(2);
    });
  });

  describe('DQ-DATE-01 — date conformance (LIMS.result_date)', function () {
    it('FAILs and catches exactly the one non-ISO date', function () {
      expect(this.dateFormat.status).toBe('FAIL');
      expect(this.dateFormat.failures).toBe(1);
    });
    it('identifies the dd/MM/yyyy row (OCT-BIO-07)', function () {
      var off = this.dateFormat.offenders[0];
      expect(off.sample_id).toBe('OCT-BIO-07');
      expect(off.value).toBe('02/09/2026');
    });
  });

  describe('DQ-REF-01 — referential integrity (crosswalk DUNS)', function () {
    it('FAILs and catches exactly the one supplier with no DUNS', function () {
      expect(this.refIntegrity.status).toBe('FAIL');
      expect(this.refIntegrity.failures).toBe(1);
    });
    it('identifies Heraeus (PARTIAL resolution, no D&B match)', function () {
      var off = this.refIntegrity.offenders[0];
      expect(off.supplierId).toBe('seed_supplier_heraeus');
      expect(off.resolutionState).toBe('PARTIAL');
    });
  });

  describe('DQ-COMPLETE-01 — completeness (SAP_LFA1.STCEG)', function () {
    it('WARNs (nulls tolerated, not blocking) and reports a null rate', function () {
      expect(this.completeness.status).toBe('WARN');
      expect(this.completeness.failures).toBeGreaterThan(0);
      expect(this.completeness.nullRatePct).toBeGreaterThan(0);
    });
  });

  describe('RECON-SPC-01 — SPC breaches confined to HOLD lots', function () {
    it('PASSes — no breach hides inside a released lot', function () {
      expect(this.spcConfinement.status).toBe('PASS');
      expect(this.spcConfinement.failures).toBe(0);
    });
    it('checked the full set of breach rows', function () {
      expect(this.spcConfinement.rowsChecked).toBe(366);
    });
  });

  describe('RECON-THREAD-01 — NPI-0417 thread integrity (regression guard)', function () {
    it('PASSes — staged QMS_COMMENT matches the locked golden thread', function () {
      expect(this.threadIntegrity.status).toBe('PASS');
      expect(this.threadIntegrity.failures).toBe(0);
    });
    it('compares all four thread entries', function () {
      expect(this.threadIntegrity.goldenCount).toBe(4);
      expect(this.threadIntegrity.stagedCount).toBe(4);
    });
  });

  describe('DQ-GATE-01 — supplier admission gate (enforcing)', function () {
    it('is GATED — it quarantined at least one row', function () {
      expect(this.gate.status).toBe('GATED');
    });
    it('sorts all 57 rows into exactly three buckets with none lost', function () {
      var sum = this.gate.admittedCount + this.gate.cleansedCount + this.gate.quarantinedCount;
      expect(sum).toBe(this.gate.rowsChecked);
      expect(this.gate.rowsChecked).toBe(57);
    });
    it('repairs the padded key inline (Sterigenics) rather than dropping it', function () {
      expect(this.gate.cleansedCount).toBe(1);
      expect(this.gate.cleansed[0].name).toBe('Sterigenics Grand Rapids');
      expect(this.gate.cleansed[0].key).toBe('0001007988');
    });
    it('quarantines the duplicate (BSI) with a reason, never loading it', function () {
      expect(this.gate.quarantinedCount).toBe(1);
      expect(this.gate.quarantined[0].name).toBe('BSI (Notified Body)');
      expect(this.gate.quarantined[0].reason).toContain('duplicate');
    });
    it('admits 98.2% of the feed (55 clean + 1 repaired of 57)', function () {
      expect(this.gate.admittedCount).toBe(55);
      expect(this.gate.admittedRate).toBe(98.2);
    });
  });

  describe('runAll — scoreboard', function () {
    it('runs all seven rules', function () {
      expect(this.all.total).toBe(7);
    });
    it('yields 4 FAIL (planted dirt caught) / 1 WARN / 2 PASS', function () {
      expect(this.all.fail).toBe(4);
      expect(this.all.warn).toBe(1);
      expect(this.all.pass).toBe(2);
    });
  });
});
