/*
 * Landing MENU screen (prototype "SCREEN 0"). Ported verbatim from the #menu
 * markup — the Pfizer wordmark bar, the "Hi, George" hero, the three
 * branch cards (Strategic Decisions / Pipeline Status / Execution) and the
 * right rail. Class names are the prototype's own (.m-*, .mc*, .mr-*).
 */

import React from 'react';
import { useNav } from '@/nav/NavContext';
import { usePortfolioCounts } from '@/contexts/PortfolioCountsProvider';
import { startGuidedTour } from '@/shell/GuidedTour';
import PfizerLogo from '@/components/Brand/PfizerLogo';

export default function MenuScreen() {
  const { go } = useNav();
  const { openIssues } = usePortfolioCounts();
  return (
    <div id="menu" className="on">
      <div className="m-top">
        {/* R-BASE-04: the real trademark, not a type-set approximation of it. */}
        <PfizerLogo size="lg" />
        <div className="m-sub">NPI Launch Control</div>
        <button type="button" className="h-gd" onClick={startGuidedTour} title="Run the guided demo">
          <svg viewBox="0 0 24 24">
            <polygon points="6 4 20 12 6 20" />
          </svg>
          Guided demo
        </button>
      </div>

      <div className="m-shell">
        <div className="m-stage">
          <div className="m-hi">
            Hi, <b>George</b>
          </div>
          <div className="m-hisub">NPI Launch Control · Biopharma · 24 September 2026</div>

          <div className="m-cards">
            {/* 01 — Strategic Decisions (out of scope, dimmed) */}
            <button className="mc dim" onClick={() => go('strategy', 'strat')}>
              <div className="mc-go">›</div>
              <div className="mc-ic">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              </div>
              <div className="mc-n">01</div>
              <div className="mc-t">
                Strategic
                <br />
                Decisions
              </div>
              <div className="mc-d">Assess and define the right strategic choices to enable a successful launch.</div>
              <div className="mc-list">
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                  <span>
                    Sourcing strategy<em>make vs. buy, own plant vs. CMO</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>
                    Suppliers<em>identification, qualification, risk</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Supply chain risk &amp; resilience</span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
                    <path d="M3.3 7.3 12 12l8.7-4.7M12 12v9" />
                  </svg>
                  <span>Scenario analysis and digital twins</span>
                </div>
              </div>
            </button>

            {/* 02 — Pipeline Status Overview */}
            <button className="mc" onClick={() => go('pipeline', 'cockpit')}>
              <div className="mc-go">›</div>
              <div className="mc-badge">
                <span className="mc-bn">2</span>
              </div>
              <div className="mc-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M3 20V10M9 20V4M15 20v-7M21 20V8" />
                </svg>
              </div>
              <div className="mc-n">02</div>
              <div className="mc-t">
                Pipeline Status
                <br />
                Overview
              </div>
              <div className="mc-d">
                Get a clear view of your product pipeline for one division, with the option to see a consolidated
                view across divisions.
              </div>
              <div className="mc-list">
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
                  </svg>
                  <span>
                    Pipeline by product, market or business unit<em>one view, four lenses</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 21V4h11l1 2h4v9h-5l-1-2H4" />
                  </svg>
                  <span>
                    Key milestones and gate status<em>five gates, every launch</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    Open issues across the portfolio
                    <em>{openIssues != null ? `${openIssues} exceptions, worst first` : 'worst first'}</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>
                    Workflow detail and document register<em>for any launch</em>
                  </span>
                </div>
              </div>
            </button>

            {/* 03 — Execution */}
            <button className="mc" onClick={() => go('exec', 'actions')}>
              <div className="mc-go">›</div>
              <div className="mc-badge">
                <span className="mc-bn">4</span>
              </div>
              <div className="mc-ic">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className="mc-n">03</div>
              <div className="mc-t">Execution</div>
              <div className="mc-d">Plan, coordinate and track execution with end-to-end visibility.</div>
              <div className="mc-list">
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="17" rx="2" />
                    <path d="M8 2v4M16 2v4M8 13l2.5 2.5L16 10" />
                  </svg>
                  <span>
                    My actions<em>pending, escalated and your own history</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span>
                    Agent orchestration<em>live and every chain already run</em>
                  </span>
                </div>
                <div className="mc-li">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
                  </svg>
                  <span>
                    Copilot<em>ask it, and it opens the record</em>
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <aside className="m-rail">
          <div className="mr-av">GH</div>
          <div className="mr-n">George Hall</div>
          <div className="mr-r">
            Global NPI Lead
          </div>
          <button className="mr-b" onClick={() => go('exec', 'actions')}>
            My Tasks<span className="bdg r">4</span>
          </button>
          <button className="mr-b" onClick={() => go('exec', 'tower')}>
            Recent Activity<span className="bdg p">31</span>
          </button>
          <button className="mr-b" onClick={() => go('pipeline', 'cockpit')}>
            Saved Views<span className="bdg">3</span>
          </button>
          <button className="mr-b">Help and Support</button>
          <div className="mr-img">
            <div className="mr-it">Innovating for patients, together</div>
            <div className="mr-ir" />
          </div>
        </aside>
      </div>

    </div>
  );
}
