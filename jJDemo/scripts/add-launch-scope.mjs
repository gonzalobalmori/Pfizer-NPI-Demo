/*
 * Idempotent merge of per-launch scope + device facts into data/Launch/Launch.json.
 *
 * WHY (manager review): the Product-detail page hard-coded Comirnaty's scope for
 * EVERY product ("Class", launch scope, units built, sterilisation, manufacture,
 * workstream readiness). These must be attested per launch so each product's
 * detail matches its own context. This script writes those attested facts onto
 * the Launch records (keyed by id) without disturbing existing fields.
 *
 * Comirnaty keeps its authored prototype figures verbatim (€96M value, EO,
 * Irvine + CMO, 11 of 14, 4,200 units, 62/78, 9 of 22).
 *
 * RUN: node scripts/add-launch-scope.mjs   (from the jJDemo pkg root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCH_JSON = join(HERE, '..', 'data', 'Launch', 'Launch.json');

/* Attested per-launch scope. Values are context-appropriate: launched products
 * read near-complete; early-phase products read mostly unstarted. */
const SCOPE = {
  seed_launch_varipulse_g2: {
    launchValue: 96000000, sterilisationMethod: 'EO', manufactureSite: 'Irvine + CMO',
    registrationsFiled: 11, registrationsTotal: 14, launchBuildUnits: 4200,
    fieldForceCertified: 62, fieldForceTotal: 78, vacApprovalsFiled: 9, vacApprovalsTotal: 22
  },
  seed_launch_octaray_g2: {
    launchValue: 54000000, sterilisationMethod: 'EO', manufactureSite: 'Irwindale',
    registrationsFiled: 3, registrationsTotal: 12, launchBuildUnits: 0,
    fieldForceCertified: 0, fieldForceTotal: 64, vacApprovalsFiled: 0, vacApprovalsTotal: 18
  },
  seed_launch_embotrap_iv: {
    launchValue: 41000000, sterilisationMethod: 'e-beam', manufactureSite: 'Galway',
    registrationsFiled: 9, registrationsTotal: 11, launchBuildUnits: 6800,
    fieldForceCertified: 44, fieldForceTotal: 52, vacApprovalsFiled: 12, vacApprovalsTotal: 19
  },
  seed_launch_impella_ecp: {
    launchValue: 120000000, sterilisationMethod: 'EO', manufactureSite: 'Danvers',
    registrationsFiled: 2, registrationsTotal: 6, launchBuildUnits: 900,
    fieldForceCertified: 18, fieldForceTotal: 70, vacApprovalsFiled: 2, vacApprovalsTotal: 15
  },
  seed_launch_javelin_xl: {
    launchValue: 88000000, sterilisationMethod: 'EO', manufactureSite: 'Santa Clara',
    registrationsFiled: 7, registrationsTotal: 9, launchBuildUnits: 5200,
    fieldForceCertified: 58, fieldForceTotal: 66, vacApprovalsFiled: 14, vacApprovalsTotal: 20
  },
  seed_launch_ethicon_4000: {
    launchValue: 76000000, sterilisationMethod: 'Gamma', manufactureSite: 'Cincinnati + CMO',
    registrationsFiled: 6, registrationsTotal: 12, launchBuildUnits: 3100,
    fieldForceCertified: 31, fieldForceTotal: 84, vacApprovalsFiled: 5, vacApprovalsTotal: 24
  },
  seed_launch_dualto: {
    launchValue: 62000000, sterilisationMethod: 'N/A', manufactureSite: 'Cincinnati',
    registrationsFiled: 9, registrationsTotal: 9, launchBuildUnits: 480,
    fieldForceCertified: 112, fieldForceTotal: 112, vacApprovalsFiled: 28, vacApprovalsTotal: 28
  },
  seed_launch_ottava: {
    launchValue: 210000000, sterilisationMethod: 'N/A', manufactureSite: 'Santa Clara',
    registrationsFiled: 0, registrationsTotal: 8, launchBuildUnits: 0,
    fieldForceCertified: 0, fieldForceTotal: 90, vacApprovalsFiled: 0, vacApprovalsTotal: 30
  },
  seed_launch_puresee: {
    launchValue: 47000000, sterilisationMethod: 'Gamma', manufactureSite: 'Groningen',
    registrationsFiled: 4, registrationsTotal: 13, launchBuildUnits: 1200,
    fieldForceCertified: 12, fieldForceTotal: 48, vacApprovalsFiled: 3, vacApprovalsTotal: 21
  }
};

const launches = JSON.parse(readFileSync(LAUNCH_JSON, 'utf8'));
let touched = 0;
for (const l of launches) {
  const s = SCOPE[l.id];
  if (!s) throw new Error(`No scope defined for launch ${l.id}`);
  Object.assign(l, s);
  touched++;
}
writeFileSync(LAUNCH_JSON, JSON.stringify(launches, null, 2) + '\n');
console.log(`Merged scope into ${touched} launches.`);
