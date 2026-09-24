/*
 * Strategic Decisions (#v-strat) — the deliberately-unbuilt branch. Ported
 * verbatim from the click-through: it is static explanatory content (no data
 * wiring by design) so the full platform scope stays visible. Class names and
 * copy are the prototype's own (.vhd / .banner / .st-grid / .ld-card / .st-*).
 */

import React from 'react';

export default function StratView() {
  return (
    <div className="view on" id="v-strat">
      <div className="vhd">
        <div>
          <div className="vt">Strategic Decisions</div>
        </div>
        <span className="pill z">Out of scope for this demo</span>
      </div>
      <div className="banner">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <h3>This branch is deliberately not built out</h3>
          <p>
            Strategic Decisions is a design workspace, not a monitoring one — it is where the sourcing model, supplier
            base and launch sequence get decided, upstream of everything in options 02 and 03. It is shown so the full
            scope of the platform stays visible, but this demo focuses on <b>Pipeline Status Overview</b> and{' '}
            <b>Execution</b>.
          </p>
        </div>
      </div>
      <div className="st-grid">
        <div className="ld-card">
          <div className="st-ic">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
          <div className="st-t">Sourcing strategy</div>
          <div className="st-d">
            Make vs. buy and own plant vs. CMO, compared on capacity, unit cost, qualification risk and time to first
            conforming lot.
          </div>
          <div className="st-u">
            Feeds gate <b>G1 NPI Readiness</b> · decision class <b>Agent recommends, human decides</b>
          </div>
        </div>
        <div className="ld-card">
          <div className="st-ic">
            <svg viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="st-t">Suppliers</div>
          <div className="st-d">
            Identification, qualification and risk assessment across the multi-level BOM, with the Approved Supplier
            List and ISO 13485 audit status.
          </div>
          <div className="st-u">
            Feeds gate <b>G2 Design Freeze</b> · agent qualifies, human approves
          </div>
        </div>
        <div className="ld-card">
          <div className="st-ic">
            <svg viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="st-t">Supply chain risk &amp; resilience</div>
          <div className="st-d">
            Network exposure: single-source components, geographic concentration, sterilisation capacity, Notified Body
            dependency.
          </div>
          <div className="st-u">
            Continuous · <b>this is the module that raised NPI-0417 and NPI-0388</b>
          </div>
        </div>
        <div className="ld-card">
          <div className="st-ic">
            <svg viewBox="0 0 24 24">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
              <path d="M3.3 7.3 12 12l8.7-4.7M12 12v9" />
            </svg>
          </div>
          <div className="st-t">Scenario analysis and digital twins</div>
          <div className="st-d">
            Simulation before committing: what if this site slips, what if we launch US first, what if the steriliser
            has no capacity.
          </div>
          <div className="st-u">
            Same engine that models the options inside the <b>Resolution Workspace</b>
          </div>
        </div>
      </div>
    </div>
  );
}
