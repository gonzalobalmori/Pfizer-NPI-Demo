# NPI Launch Control — Backend demo runbook (Item 6)

Three live demonstrations that prove the app is a real C3 backend, not a front-end
with hardcoded data. Each is a **script**: the exact steps, the call to run, the
expected result, and the one sentence to say. Demo clock ("now") = **Fri 11 Sep
2026, 08:42 CET**.

Where a step runs a backend call, use the Type Console
(`http://localhost:9000/static/console`, or your env's app URL + `/static/console`)
or replay it through the app. The three demos are independent — run any subset.

> Presenter tip: run each call **once before** the client is watching so the JSON
> is warm and you know the timing. Some calls read files and take a beat.

---

## Demo 1 — Trace a number back to its source row

**Proves:** every figure on screen has provenance — it traces to one row in one
file from one source system.

1. **Open the app** on the cockpit. Point at Berobenatide G4 (DP Released):
   **"+47 days slip"**.
   Say: *"This number drives the whole escalation. Where does it come from?"*
2. **Run the lineage lookup:**
   ```javascript
   PipelineOrchestrator.lineageFor('Gate', 'seed_gate_berobenatide_obesity_g4')
   ```
   **Expected:**
   ```
   feedCode:     PPM_GATE
   sourceFile:   ppm/PPM_GATE_20260911.csv
   sourceRowKey: G-BEROBENATIDE_OBESITY_G4
   transform:    SrcPpmGate-Gate
   ```
3. **Open that source file** (`jJDemo/sources/ppm/PPM_GATE_20260911.csv`) and find
   the `G-BEROBENATIDE_OBESITY_G4` row — the 47 is right there in the `SlipDays`
   column.

**Say:** *"The '+47 days' isn't a slide. It traces to one row in the Planisware
gate extract, through one named transform, into one object the UI reads."*

---

## Demo 2 — Change a source, watch the app move

**Proves:** there is a live data pipeline behind the screen — change the input, the
app changes, with no code edit.

1. **Show the baseline:**
   ```javascript
   Gate.fetch({filter:"id=='seed_gate_berobenatide_obesity_g4'"}).objs[0]
   ```
   Note **slip 47 / forecast 2026-07-11**.
2. **Write an edited extract into the feed inbox** (the same file, one row changed
   from 47/11-Jul to **9/03-Jun**):
   ```javascript
   var header = 'GateId,ProjectId,GateCode,GateName,BaselineDate,ForecastDate,SlipDays,Status';
   var row = 'G-BEROBENATIDE_OBESITY_G4,PRJ-BERO_OB,G4,DP Released,2026-05-25,2026-06-03,9,late';
   var coll = FileSourceCollection.forName('PpmGateFeed');
   var inbox = coll.inboxUrl();
   FileSystem.makeFile(inbox + 'PPM_GATE_DEMO2.csv').writeString(header + '\n' + row + '\n');
   coll.process(DataIntegSpec.make({process:true}));
   ```
3. **Wait a few seconds, then re-read the gate:**
   ```javascript
   Gate.fetch({filter:"id=='seed_gate_berobenatide_obesity_g4'"}).objs[0]
   ```
   **Expected: slip 9 / forecast 2026-06-03** — the SAME row updated, no duplicate.
4. **Refresh the app** — the cockpit now shows +9 days.

**Say:** *"I changed a source file, not code. The pipeline matched it to the same
gate by its business key and updated it. Every screen downstream moved with it."*

**Reset after the demo** (so the escalation story is back to baseline):
```javascript
var g = Gate.fetch({filter:"id=='seed_gate_berobenatide_obesity_g4'"}).objs[0];
g.withField('slipDays', 47).withField('forecastDate', DateTime.fromString('2026-07-11T00:00:00')).merge();
try { SourceFile.remove(SourceFile.make({id:'PpmGateFeed_PPM_GATE_DEMO2.csv'})); } catch(e) {}
```

---

## Demo 3 — A quality gate admits the clean 80%, quarantines the rest

**Proves:** the app does not blindly ingest everything. A **gate rule** decides, row
by row, what is allowed in — admitting clean data, repairing what it can, and
setting aside the unusable with a reason. This is how the app supports "only the
part of Pfizer's data that's fit to use" **honestly** — nothing is silently dropped.

*(This replaces the earlier "break a feed" script — a gate is the stronger story:
it shows enforcement and the 80/20 handling the client asked about.)*

1. **Frame it.** Say: *"Real supplier feeds are never perfectly clean. Watch what
   the app does with a feed that has a padded key and a duplicate row."*
2. **Show the raw feed** (`jJDemo/sources/sap/SAP_LFA1_VENDOR_20260911.csv`). Point
   out two planted problems:
   - Line 3: vendor `0001007988 ` — **trailing space** in the key.
   - Lines 5 & 58: vendor `0001009003` (Eurofins) — **the same row twice**.
3. **Run the admission gate:**
   ```javascript
   DataQualityCheck.supplierAdmissionGate()
   ```
   **Expected:**
   ```
   status:            GATED
   rowsChecked:       57
   admittedCount:     55
   cleansedCount:     1     -> Siegfried: trimmed whitespace from key "0001007988 "
   quarantinedCount:  1     -> Eurofins: duplicate of an already-admitted vendor (would double-count)
   admittedRate:      98.2
   ```
4. **Walk the three buckets.** Every one of the 57 rows landed in exactly one:
   - **Admitted (55)** — clean, loaded as-is.
   - **Cleansed (1)** — the padded key was **repaired inline** (trimmed) and then
     admitted. Fixable dirt doesn't cost you the row.
   - **Quarantined (1)** — the duplicate is **refused with a reason**, never loaded,
     never lost. It's available for a data steward to review.

**Say:** *"The app took in the 98% it could trust, fixed the one row it could
repair, and quarantined the one that would have corrupted the count — with a
reason attached. If Pfizer's data is only 80% clean, this is the mechanism that lets
the app run on the good part without ever pretending the other 20% didn't exist."*

**Tie it to Configure:** this is exactly what the **Data Validation** section is
for. `DataQualityCheck.runAll()` returns the full scoreboard (7 reporting rules +
this gate) behind a data-quality dashboard.

---

## One-call scoreboard (optional closer)

```javascript
DataQualityCheck.runAll()
```
Returns 7 reporting rules (**4 FAIL** catching planted dirt, **1 WARN**, **2 PASS**
including the NPI-0417 thread-integrity guard) plus the enforcing **gate**. Good
for a "here's the whole data-quality picture in one call" close.

---

## Environment notes (§7 — honest scope)

- **Fully real & demonstrable in this sandbox:** Data Integration (feeds, transforms,
  the live load in Demo 2), Object Model, and Data Validation (Demos 1 & 3).
- **Not provisioned in this sandbox:** the **Data Lakehouse** and **Data Sharing**
  sections (the `/lakehouse` route returns "No page found"). These are platform
  capabilities activated in a full C3 environment — say so; don't open them live.
- **Write-back:** Demo 2's load is a real write into the app's own store. Writing
  *back* to a source system (SAP, Veeva) is **staged, not written** here — it would
  need the real outbound connection configured in a production environment.
