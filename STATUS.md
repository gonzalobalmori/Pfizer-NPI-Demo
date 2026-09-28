# STATUS

Per R-BP-09. Current milestone and what is runnable.

**Last updated:** after M1, plus the Pfizer re-brand and the app-service fix. There is no
longer an outstanding environmental blocker — the app runtime, seed upsert and UI are all
working. The only known gap is `runTest` suite discovery (see below).

## Where the build is

| Milestone | Scope | State |
|---|---|---|
| M1 | Traceability core + type skeleton (§4, §5) | **Complete** — see COVERAGE.md |
| M2 | Domain model + seed data (§6, §7, §10) | **Next — and larger than first scoped.** An audit against the supplied six-product table found R-DM-04 **not met** and R-BASE-04 **not met in the domain model**: all 9 launches are J&J/Abbott *device* form factors with Pfizer names pasted on, J&J operating companies survive as franchise primary keys, and none of the six products exists as a record. M2 must re-model `Launch` for pharma (indication/modality/trial phase have nowhere to be stored), swap 510(k)/PMA/EU MDR for BLA/NDA/MAA, and replace the EO-sterilisation suppliers with CMO/API/primary-packaging vendors. See COVERAGE.md "Product / master-data audit". |
| M3 | Scenario 1 end-to-end (§8.1) | Not started |
| M4 | Scenario 2 end-to-end (§8.2) | Not started |
| M5 | UI shell + Resolution Workspace + Cockpit + Portfolio + Open issues (§9) | Not started |
| M6 | Remaining tabs | Not started |
| M7 | Hardening, tests, docs | Not started |

## Is the repo runnable?

Yes. The frontend builds and the existing 11-view app is unchanged and still renders:

```
cd jJDemo/ui/react
VITE_C3_PKG=jJDemo npm run build     # lint + tsc + vite build, all clean
```

M1 added backend types, implementations, seed data and tests. It changed no UI file, so no
existing screen could have regressed.

## RESOLVED: UI service startup (`npm install failed with code 254`)

This was the root cause of the M1 verification blocker, and it is now **fixed**. The app
serves HTTP 200 and `status` reports `appPhase: running`.

### What was actually wrong

The workspace contains **two unrelated package roots**:

| Directory | What it is | Tracked files |
|---|---|---|
| `jJDemo/` | The real C3 package — the only `.c3pkg.json`, 265 files, the whole React app | 265 |
| `pkgbca8aec7/` | This workspace's original scaffold, left as gitignored build residue | **0** |

`git log` shows these are **two root commits with no common ancestor** on two different
branches — not a rename, which is what the directory names suggest at first glance.

`MAIN_PKG_NAME` is `pkgbca8aec7`, and the UI service derives its working directory from it.
The service's own npm log is unambiguous:

```
21 verbose cwd /usr/workspace/pkgbca8aec7/ui/react
17 error  path /usr/workspace/pkgbca8aec7/ui/react/package.json
15 error  code ENOENT
```

That directory had a stale `node_modules` (641 entries) and a `.vite` cache but **no
`package.json`**, so `npm install` exited 254 and the app never started.

### Why the fix is a symlink

`pkgbca8aec7/ui/react` → `../../jJDemo/ui/react`

Exit code 254 is npm's "no package.json here" code — an *empty* directory returns it too
(verified). So **deleting the residue would not have fixed anything**; the service would
still `cd` to that path and still fail. The path has to resolve. Of the four options:

| Option | Rejected because |
|---|---|
| Delete the residue | Doesn't work — an empty/missing dir still exits 254 |
| Repoint `MAIN_PKG_NAME` | It lives in the environment; the project instructions forbid editing `.env` |
| Rename `jJDemo` → `pkgbca8aec7` | The project instructions forbid changing a package name |
| **Symlink** | Leaves both the package name and the environment untouched, and is gitignored so it cannot pollute a commit |

Only the `ui/` subtree is linked, deliberately: `pkgbca8aec7` has no manifest and no `src/`,
so linking the whole directory risked the platform discovering a second, malformed package.
The removed residue held exactly one source file (`src/lib/utils.ts`), verified
byte-identical to jJDemo's, and no jJDemo file references `pkgbca8aec7`. A copy is at
`/tmp/pkgbca8aec7-residue-backup/`.

### Verified after the fix

| Check | Result |
|---|---|
| `npm install` in the previously-failing path | ENOENT/254 gone |
| `npm run build` through that path | lint + tsc clean, 725 modules, built in 3.28s |
| `status` | `phase: RUNNING`, `appPhase: running`, "App is running" |
| `curl localhost:9000` | HTTP 200 (after the standard `/uiservice/` redirect) |
| Browser load | Renders the Pfizer shell and all three branches, **0 console errors** |

If this recurs after a workspace rebuild, the symlink is the first thing to re-check — a
fresh checkout will not recreate it, since it is gitignored. The durable fix is for
`MAIN_PKG_NAME` to point at `jJDemo`, which only the platform/user can change.

## RESOLVED: the app service 500s on every path

**This is now fixed.** The cause was in this workspace after all, and the diagnosis below
(kept for the record) was wrong in its conclusion, though its measurements were sound.

### The actual root cause: the root package had no manifest

`MAIN_PKG_NAME` is `pkgbca8aec7`, so that is the app's **root package**. The workspace has
two unrelated git roots, and the branch that is checked out (`f8f6b98`, the jJDemo demo)
contains **zero** `pkgbca8aec7` files. Checking it out therefore deleted every tracked file
of the root package — including `pkgbca8aec7.c3pkg.json` — leaving only untracked residue
(`gen/`, `jsconfig.json`, and a stale `.c3pkg.lock.json` still pinning `mcpServer: 8.10`).

A root package whose manifest does not exist cannot be resolved, so the app never finished
booting and every path under it returned a bare, headerless, deterministic 500. That also
explains the earlier `npm install` 254: the same deletion removed `ui/react/package.json`.

This is exactly why the "unknown app → clean 400 / real app → 500" probe was so misleading:
the app tag *was* registered, so routing succeeded; it was package resolution that failed.

### The fix

| Change | Why |
|---|---|
| Restored `pkgbca8aec7/pkgbca8aec7.c3pkg.json`, depending on `jJDemo: "1.0"` | Gives the app a resolvable root package that actually pulls in the real code |
| Deleted the stale `pkgbca8aec7.c3pkg.lock.json` (backed up to `/tmp`) | It pinned a resolution from before the manifest existed |
| `jJDemo` deps `mcpServer: 8.10` → `8.11`, `testtools: "*"` → `8.11` | Both are **Java Store** packages, so they must pin to the platform version (`8.11.2+73`). `"*"` is an invalid `SemanticVersion.MajorMinor`, and the warning said it becomes an **ERROR** as of 8.10 — we are on 8.11.2 |

Dependency versions must be `MajorMinor` (`1.0`), not full semver (`1.0.0`) — the validator
rejects the latter.

### Verified after the fix

```
runJsCode 1+1                          → 2            (runtime answers again)
issuesForPkg pkgbca8aec7 / jJDemo      → 0 issues     (the testtools WARNING is gone too)
upsertSeedData                         → seeded: true
UI network: every /api/8/* call        → 200 OK       (16 calls, incl. the 3 replan ones)
browser console                        → 0 errors
VITE_C3_PKG=jJDemo npm run build       → green, 726 modules
```

`runJsCode`, `upsertSeedData` and the UI are all working. The one thing still not working is
`runTest`, which returns an empty `testsuite: []` — see the note below.

<details>
<summary>Original (incorrect) diagnosis, kept for the record</summary>

This is what the user saw as **"Error occurred while trying to proxy:
stgazdemoext.c3.ai/gse67e2092/liveapp/uiservice/"** and a blank preview. It is a *different*
fault from the npm 254 above.

### The two hops, measured separately

The preview is served through two hops: browser → **app service** (`:8888`) → **vite**
(`:9000`). Testing them independently localises the fault precisely:

```
vite  :9000/gse67e2092/liveapp/uiservice/   → 200   serves correct app HTML
app   :8888/gse67e2092/liveapp/uiservice/   → 500   "Internal Server Error"
```

So vite — the part this workspace controls — is healthy. The proxy in front of it is not.

### Why this is the app service and not this package

| Probe | Result | What it rules out |
|---|---|---|
| `:8888/` (bare root) | **400** with a proper C3 error page, headers and `c3auth` cookie | The web server is alive and routing correctly |
| `:8888/nosuchenv/nosuchapp/` | **400** | Unknown tenants are rejected *cleanly* |
| `:8888/gse67e2092/liveapp/` (the real app) | **500** | The app tag resolves but then fails to serve |
| `:8888/gse67e2092/liveapp/static/` | **500** | Not specific to `/uiservice/` — *every* path under the app fails |
| `validatePkgs jJDemo` | **succeeds** | The package itself compiles and validates |
| `gen/cache/Pkg.Issue/` across all packages | **1 WARNING, 0 errors** | No type in `src/` is breaking the build |
| Three consecutive requests | 500 at 2.63s, 2.63s, 2.63s | Deterministic internal failure, not a timeout or a flake |

A resolvable app returning a bare 500 with an **empty content-type** on every path — while
the same server cleanly 400s an unknown app — is an app-service provisioning failure.

### What was tried

- `ensure` (the sanctioned UI-service restart) — twice. Both times vite came back at 200 and
  the proxy stayed at 500, which is itself evidence: restarting the UI cannot fix the hop
  in front of it.
- Removing the orphaned `pkgbca8aec7` package-store artifacts (a lock file and `gen/cache`
  with **no manifest**, i.e. a malformed package the store might choke on). The 500 was
  unchanged, so this was **disproven and the files were restored**.

### Why it cannot be fixed from here

There is no tool to restart or re-provision the **app** service — `ensure` covers the UI
service only, and the project instructions forbid Kubernetes access. Resolving this needs
the platform or the user.

This is the same fault that blocked M1's in-app verification, so `runJsCode`,
`upsertSeedData` and `runTest` all remain unavailable.

</details>

## M1 in-app verification — now done

Both items that were blocked are resolved:

1. **Seed data is loaded.** `upsertSeedData` succeeded (it outruns the MCP timeout and holds
   a server-side lock, so it must be polled rather than re-invoked):
   `AppRole 6 · Team 12 · RoleAssignment 18 · Site 8`, and `App.State.seeded == true`.
2. **The M1 services were smoke-tested live**, which is what the specs existed to prove:

| Check | Result |
|---|---|
| `AuditService.hashOf('abc')` | `ba7816bf…0015ad` — matches the canonical SHA-256 vector |
| `AccessControlService.roleMatrix()` | returns the full matrix (7.8 kB) |
| `rolesFor` / `primaryRoleKeyFor` / `privilegesFor` (`seed_person_ak`) | `QualityQP`, RACI `A`, team `ALIMS`, 12+ privileges |
| `can(pid, 'APPROVE_GATE')` | `false` — QP correctly lacks it |
| `can(pid, 'NOT_A_REAL_PRIVILEGE')` | `false` — **fails closed**, which is the R-DOD-08 requirement |

### Still outstanding: `runTest` discovers no suites

`runTest **/test_AuditDigest.js` returns `testsuite: []` even though the app is in `dev` mode
with `AppMode.includesTestOverlay == true` and the six spec files are on disk in
`jJDemo/test/js-rhino/unit/`. The harness is not resolving them. This is a **test-tooling**
gap, not a product-code gap: the same logic is covered by the local harnesses described below
and by the live smoke tests above. Worth returning to during M7.

### What was done instead, so nothing is claimed untested

Rather than assert that untested code works, the three pieces of logic where a silent bug
would be most damaging were verified locally against the **real** source and the **real**
seed files:

| Harness | Result | Why it was worth doing locally |
|---|---|---|
| SHA-256 vs an independent implementation — 15 vectors, every padding boundary (55/56/57/63/64/65/119/120 bytes), 2-, 3- and 4-byte UTF-8 | 15/15 | A wrong digest makes the entire hash chain worthless, and it would look fine until an auditor checked |
| Hash-chain tamper detection — edit, delete, re-link, edit-and-re-hash, plus the full-re-forge limitation | 12/12 | This is R-TR-03; a verifier that cannot detect tampering is worse than none |
| RBAC and as-of-date authority, against the real seed JSON | 27/27 | R-DOD-08 is a *refusal* requirement — the failure mode is granting too much, which a happy-path test cannot see |

The harnesses loaded the actual `AuditService.js` and `AccessControlService.js` source and
the actual seed JSON, stubbing only the C3 platform globals. They were then persisted as
repo tests in `jJDemo/test/js-rhino/unit/` so the same assertions run in-app once the
service recovers. Two real bugs were found and fixed this way: `hashOf` was missing from
`AuditService` entirely (the tests referenced a method that did not exist), and several
`test_Transaction.js` fixtures targeted `AppRole`, which `TransactionService.begin` refuses
because it is not in the governed-types registry.

## Structural note for the user

`MAIN_PKG_NAME` is `pkgbca8aec7`; the only real C3 package is `jJDemo/`. This is now
bridged by a symlink (see the RESOLVED section above) so the UI service starts, but the
mismatch itself is unresolved and only the platform/user can fix it properly by repointing
`MAIN_PKG_NAME` at `jJDemo`. Until then, note that the symlink is gitignored and will not
survive a fresh clone.

## Done — this checklist has been executed

```
1. upsertSeedData          ✅ seeded: true; AppRole 6 · Team 12 · RoleAssignment 18 · Site 8
2. validatePkgs            ✅ pkgbca8aec7 + jJDemo, 0 issues each
3. live smoke tests        ✅ AuditService.hashOf + the AccessControlService surface (table above)
4. UI end-to-end           ✅ replan dashboard renders; 16/16 /api/8/* calls 200 OK; 0 console errors
5. runTest **/test_*.js    ⚠️  returns `testsuite: []` — suite discovery unresolved, revisit in M7
```

## Caveat: the root-package manifest is untracked

`pkgbca8aec7/pkgbca8aec7.c3pkg.json` had to be recreated because the checked-out branch does
not contain it. Like the `ui/react` symlink, it is **not tracked on this branch**, so a fresh
clone will boot into the same 500 until it is recreated. The durable fix is for the platform
or the user to repoint `MAIN_PKG_NAME` at `jJDemo`, or to commit the `pkgbca8aec7` shell.

Run 2 before 1 if seed loading itself misbehaves — it is the only suite with no database
dependency, so it isolates a code fault from a data fault.
