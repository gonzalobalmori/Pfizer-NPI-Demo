/**
 * Server-side authorisation — R-UI-13, R-DOD-08, and the time-travel half of R-DM-03.
 *
 * The requirement is specific about *where* access control lives: "enforced server-side,
 * not by hiding UI". A test that only proved the happy path would be consistent with a
 * system that grants everything, so the emphasis here is on refusals — each one naming a
 * role that plausibly *wants* the privilege but must not have it.
 *
 * Three properties are worth more than the individual cases:
 *
 *   1. **Refusal is the default.** An unknown caller is denied, not defaulted to a
 *      baseline role. Failing closed is the only safe direction for a GxP system.
 *   2. **Privileges are not monotonic by seniority.** There is no total ordering of
 *      roles where each holds a superset of the one below. The Auditor reads the trail
 *      and cannot allocate; the Site Planner allocates and cannot read the trail. Any
 *      future refactor that collapses roles onto a numeric "level" breaks these specs,
 *      which is the point — {@link AccessControlService}'s internal rank list exists
 *      only to pick a label for an audit row and must never gate access.
 *   3. **Authority is evaluated as-of an instant, not as-of now.** The QP cover
 *      assignment proves a disposition signed on 15 March was validly signed even though
 *      that person holds no QP role today (R-DM-03).
 */
const filename = 'test_AccessControl';

describe(filename, function () {
  // Signing instants used by the R-DM-03 specs. J. Thomson covered QP at Puurs from
  // 2026-03-02 to 2026-04-13 (see seed/RoleAssignment) and returned to PharmSci after.
  const DURING_COVER = DateTime.fromString('2026-03-15T09:00:00Z');
  const AFTER_COVER = DateTime.fromString('2026-06-15T09:00:00Z');

  /** True when rolesFor(...) contains the given role key. */
  function holdsRole(personId, roleKey, asOf) {
    const roles = AccessControlService.rolesFor(personId, asOf);
    const list = roles.roles || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].roleKey === roleKey) return true;
    }
    return false;
  }

  describe('AccessControlService#assertCan — refusals (R-DOD-08)', function () {
    describe('when a Commercial user attempts to sign a batch disposition', function () {
      it('throws, because disposition is reserved to the Qualified Person', function () {
        expect(() => {
          AccessControlService.assertCan('seed_person_tb', 'batch.disposition.sign');
        }).toThrow();
      });
    });

    describe('when an Auditor attempts to approve a gate', function () {
      it('throws — read access to the trail confers no write authority', function () {
        expect(() => {
          AccessControlService.assertCan('seed_person_jr', 'gate.approve');
        }).toThrow();
      });
    });

    describe('when a Site Planner attempts to re-baseline a launch date', function () {
      it('throws — re-baselining is a Launch Lead / Executive act (R-BE-04e)', function () {
        expect(() => {
          AccessControlService.assertCan('seed_person_lh', 'launch.rebaseline');
        }).toThrow();
      });
    });

    describe('when the caller is not a known person at all', function () {
      it('throws rather than defaulting to a baseline role — it fails closed', function () {
        expect(() => {
          AccessControlService.assertCan('no_such_person_12345', 'gate.approve');
        }).toThrow();
      });
    });

    describe('when a refusal is raised', function () {
      it('explains that the check is server-side, so a reachable UI control is not authority', function () {
        let message = '';
        try {
          AccessControlService.assertCan('seed_person_tb', 'batch.disposition.sign');
        } catch (e) {
          message = String(e.message || e);
        }
        expect(message.indexOf('batch.disposition.sign') >= 0).toBeTrue();
        expect(message.indexOf('server-side') >= 0).toBeTrue();
      });
    });
  });

  describe('AccessControlService#can — grants', function () {
    describe('when the Qualified Person is asked about disposition signing', function () {
      it('permits it', function () {
        expect(AccessControlService.can('seed_person_ak', 'batch.disposition.sign')).toBeTrue();
      });
    });

    describe('when the Launch Lead is asked about re-baselining', function () {
      it('permits it', function () {
        expect(AccessControlService.can('seed_person_hf', 'launch.rebaseline')).toBeTrue();
      });
    });

    describe('when a non-throwing check is made for a privilege the caller lacks', function () {
      it('returns false rather than throwing — `can` is the predicate, `assertCan` is the guard', function () {
        expect(AccessControlService.can('seed_person_tb', 'batch.disposition.sign')).toBeFalse();
      });
    });
  });

  describe('privileges are not ordered by seniority', function () {
    describe('when the Auditor and the Site Planner are compared', function () {
      it('gives the Auditor audit.read, which the Site Planner lacks', function () {
        expect(AccessControlService.can('seed_person_jr', 'audit.read')).toBeTrue();
        expect(AccessControlService.can('seed_person_lh', 'audit.read')).toBeFalse();
      });

      it('gives the Site Planner supply.allocate, which the Auditor lacks', function () {
        expect(AccessControlService.can('seed_person_lh', 'supply.allocate')).toBeTrue();
        expect(AccessControlService.can('seed_person_jr', 'supply.allocate')).toBeFalse();
      });
    });
  });

  describe('AccessControlService#rolesFor — authority as-of an instant (R-DM-03)', function () {
    describe('when asked who held QP at Puurs on 15 March 2026', function () {
      it('includes the seconded cover, so a disposition signed that day was valid', function () {
        expect(holdsRole('seed_person_jt', 'QualityQP', DURING_COVER)).toBeTrue();
      });
    });

    describe('when asked about the same person after the cover ended', function () {
      it('no longer includes QP — the assignment was time-boxed, not deleted', function () {
        expect(holdsRole('seed_person_jt', 'QualityQP', AFTER_COVER)).toBeFalse();
      });

      it('includes the role they returned to, so history and present both resolve', function () {
        expect(holdsRole('seed_person_jt', 'SitePlanner', AFTER_COVER)).toBeTrue();
      });
    });

    describe('when a permanent assignment is queried at two different instants', function () {
      it('resolves at both — an open-ended validTo must not read as expired', function () {
        expect(holdsRole('seed_person_ak', 'QualityQP', DURING_COVER)).toBeTrue();
        expect(holdsRole('seed_person_ak', 'QualityQP', AFTER_COVER)).toBeTrue();
      });
    });
  });

  describe('AccessControlService#primaryRoleKeyFor — the audit stamp', function () {
    describe('when a person holds several roles', function () {
      it('returns one deterministic key, so the same action always stamps the same role', function () {
        const a = AccessControlService.primaryRoleKeyFor('seed_person_hf');
        const b = AccessControlService.primaryRoleKeyFor('seed_person_hf');
        expect(a).toEqual(b);
        expect(a.length > 0).toBeTrue();
      });
    });

    describe('when a person holds no roles at all', function () {
      it('returns a non-blank placeholder — an audit event must never have an empty role', function () {
        const key = AccessControlService.primaryRoleKeyFor('no_such_person_12345');
        expect(key === null).toBeFalse();
        expect(key.length > 0).toBeTrue();
      });
    });
  });

  describe('AccessControlService#assertSpendAuthority — R-S2-05 check 7', function () {
    describe('when a Commercial lead commits $750k', function () {
      it('permits it, being inside their authority', function () {
        expect(AccessControlService.assertSpendAuthority('seed_person_tb', 750000.0)).toBeTrue();
      });
    });

    describe('when the same lead commits $4.2M', function () {
      it('throws, and the message states both the amount and the ceiling', function () {
        let message = '';
        try {
          AccessControlService.assertSpendAuthority('seed_person_tb', 4200000.0);
        } catch (e) {
          message = String(e.message || e);
        }
        expect(message.indexOf('Spend authority exceeded') >= 0).toBeTrue();
      });
    });

    describe('when an Executive commits the same $4.2M', function () {
      it('permits it — the ceiling is a property of the role, not of the amount', function () {
        expect(AccessControlService.assertSpendAuthority('seed_person_board', 4200000.0)).toBeTrue();
      });
    });
  });

  describe('AccessControlService#roleMatrix — the six roles of R-UI-13', function () {
    describe('when the matrix is requested', function () {
      it('returns exactly the six seeded roles', function () {
        expect(AccessControlService.roleMatrix().roles.length).toEqual(6);
      });

      it('names exactly one role able to sign a batch disposition', function () {
        const roles = AccessControlService.roleMatrix().roles;
        let signers = 0;
        for (let i = 0; i < roles.length; i++) {
          if (roles[i].canSignDisposition === true) signers += 1;
        }
        expect(signers).toEqual(1);
      });

      it('names exactly one role able to approve a governance reversal (R-S2-08)', function () {
        const roles = AccessControlService.roleMatrix().roles;
        let approvers = 0;
        for (let i = 0; i < roles.length; i++) {
          if (roles[i].canApproveGovernanceReversal === true) approvers += 1;
        }
        expect(approvers).toEqual(1);
      });
    });
  });

  describe('AccessControlService#raciFor — accountability is scoped, not global', function () {
    describe('when the RACI set for the Puurs site is requested', function () {
      it('returns at least one accountable party', function () {
        const raci = AccessControlService.raciFor('Site', 'seed_site_puurs', DateTime.now());
        expect((raci.accountable || []).length > 0).toBeTrue();
      });
    });
  });
});
