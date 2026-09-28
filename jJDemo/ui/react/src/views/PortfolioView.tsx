/*
 * Portfolio (#v-portfolio) — ported verbatim from the click-through's markup and
 * CSS classes (.pf-sw / .pfb / .sbb / .tk-* / .mk-* / .bu-* / .ms-* / .wp / .chip).
 * Four lenses over the same nine launches, switched by the .pf-sw toggle bar:
 *   • Product        — PortfolioService.portfolioProduct       (one row per launch)
 *   • Market         — PortfolioService.portfolioMarket        (world map + quarter timeline)
 *   • Business unit  — PortfolioService.portfolioBusinessUnit  (franchise roll-up cards)
 *   • Timeline       — PortfolioService.portfolioTimeline      (baseline vs forecast gates)
 * Static headings, column headers and legend copy are the prototype's own, word
 * for word; every dynamic figure is fed by the live c3Action data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNav } from '@/nav/NavContext';
import {
  getPortfolioProduct,
  getPortfolioMarket,
  getPortfolioBusinessUnit,
  getPortfolioTimeline,
} from '@/api/portfolio';
import { fmtDate, fmtDateYear, fmtGate } from '@/lib/format';
import { labelFor, franchiseLabel, modalityLabel, rawName } from '@/productLabel';
import { PHASE_AXIS, normalizePhases } from '@/phaseModel';
import { MK_MARKETS, MK_SMALL } from './marketDetail';
import Glyph from '@/components/Brand/Glyph';
import MlDot from '@/components/Brand/MlDot';
import type {
  ProductLens,
  ProductRow,
  MarketLens,
  MarketRow,
  BusinessUnitLens,
  BuSegment,
  BuFranchise,
  BuLaunch,
  TimelineLens,
  TimelineRow,
  GateMarker,
  MarketGate,
  Health,
} from '@/types/portfolio';

type Lens = 'product' | 'market' | 'bu' | 'milestones';
type Tone = 'ct' | 'rk' | 'ok';

/** Health → the prototype's status tone (ct = off track, rk = at risk, ok = on plan). */
function healthTone(h: Health): Tone {
  if (h === 'OFF_TRACK') return 'ct';
  if (h === 'AT_RISK') return 'rk';
  return 'ok';
}
/** Health → the .slp pill colour class (r / a / n). */
function slpClass(h: Health): 'r' | 'a' | 'n' {
  if (h === 'OFF_TRACK') return 'r';
  if (h === 'AT_RISK') return 'a';
  return 'n';
}

/*
 * The status glyph used across every lens — ONE SHAPE PER STATE.
 *
 * This used to draw the SAME warning triangle for both `ct` (off track) and
 * `rk` (at risk), leaving hue as the only difference between them. That is the
 * exact failure the status block in prototype.css documents as irreducible:
 * green→amber→red cannot be separated under deuteranopia/protanopia at any
 * amber (measured ΔE 2.0–4.0 against a target of 8), which is why that comment
 * requires every status in this app to carry a non-colour cue. Here the cue was
 * missing — the icon was identical, the phase bar had no texture, and neither
 * carried a label — so a red/green-colour-blind reader could not tell a blocked
 * launch from a slipping one anywhere in the Portfolio view.
 *
 * Now the shape itself is the cue and works in pure greyscale:
 *   ok  — check, in a circle: nothing to do.
 *   rk  — CLOCK. At risk is a TIME problem (float being consumed, a gate
 *         drifting), so a clock says what the state means rather than shouting
 *         generically. Round, open, visually quiet.
 *   ct  — OCTAGON with a bar (a stop sign). Off track is a blocked commitment.
 *         Angular and dense, so it reads as more severe than the clock at a
 *         glance and is unmistakable beside it even in one colour.
 * Round-vs-angular is the discriminator, which survives greyscale printing and
 * forced-colors mode. The `title` gives the state in words on hover, and each
 * lens also names the state in its legend and its adjacent slip column, so hue
 * is now the third redundant channel rather than the only one.
 */
const SST_TITLE: Record<Tone, string> = {
  ok: 'On plan',
  rk: 'At risk',
  ct: 'Off track',
};

function SstIcon({ tone }: { tone: Tone }) {
  return (
    <span className={`sst ${tone}`} title={SST_TITLE[tone]}>
      {tone === 'ok' ? (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9.2" />
          <path d="M16.6 9.1 10.8 15l-3.4-3.3" />
        </svg>
      ) : tone === 'rk' ? (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9.2" />
          <path d="M12 6.9V12l3.5 2.2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M8.2 2.9h7.6l5.3 5.3v7.6l-5.3 5.3H8.2l-5.3-5.3V8.2z" />
          <path d="M8.4 12h7.2" />
        </svg>
      )}
    </span>
  );
}

/* ═════════════════════════ 2.1 BY PRODUCT ═════════════════════════ */

function ProductPane({ data, open }: { data: ProductLens; open: (id: string) => void }) {
  /* Always the full nine — the rows normalise onto the same model, so the
     labels cannot end up sitting over the wrong bars. */
  const axis = PHASE_AXIS;
  return (
    <div className="pf-l sb-p on" data-l="product" data-p="product">
      <div className="vhd">
        <div>
          <div className="vt">Pipeline by Product</div>
        </div>
      </div>

      <div className="tk-wrap">
        <div className="tk-hd">
          <div className="tk-c0"></div>
          <div className="tk-c1">Launch</div>
          {/* One label per phase the rows actually draw, with a gate between
              each pair — so nine phases render nine columns and eight gates. */}
          <div className="tk-c2">
            {axis.map((p, i) => (
              <React.Fragment key={p.code}>
                <span className="ax">
                  {p.code}
                  <i>{p.short}</i>
                </span>
                {i < axis.length - 1 && <span className="axg">{`G${i + 1}`}</span>}
              </React.Fragment>
            ))}
          </div>
          <div className="tk-c4">Next gate</div>
          <div className="tk-c5">Slip</div>
          <div className="tk-c6">Overview &amp; detail</div>
        </div>

        {data.rows.map((r) => (
          <ProductRowView key={r.launchId} row={r} open={open} />
        ))}

        {/* The legend renders the SAME <SstIcon> the rows do, rather than its own
            copy of the paths — a legend that disagrees with the marks it explains
            is worse than none, and these had already drifted apart. Size comes
            from the existing `.tk-lg .sst` rule, so the inline width/height that
            used to be repeated on each swatch is gone. */}
        <div className="tk-lg">
          <div className="lgi">
            <SstIcon tone="ct" />
            Off track
          </div>
          <div className="lgi">
            <SstIcon tone="rk" />
            At risk
          </div>
          <div className="lgi">
            <SstIcon tone="ok" />
            On plan
          </div>
          <div className="lgd2"></div>
          {/* Swatch sizing lives in `.tk-lg .sg-sw` / `.tk-lg .gd` rather than six
              copies of the same inline style object. The in-progress swatch's 55%
              fill is a fixed illustration of the mark, not a data value, so it is
              a CSS default on `.sg-sw` instead of a `--f` set from the view. */}
          <div className="lgi">
            <span className="sg done sg-sw" />
            Phase complete
          </div>
          <div className="lgi">
            <span className="sg cur ok sg-sw" />
            Phase in progress
          </div>
          <div className="lgi">
            <span className="sg sg-sw" />
            Not started
          </div>
          <div className="lgd2"></div>
          <div className="lgi">
            <span className="gd done">
              <span>1</span>
            </span>
            Gate closed
          </div>
          <div className="lgi">
            <span className="gd rk">
              <span>2</span>
            </span>
            Gate at risk
          </div>
          <div className="lgi">
            <span className="gd ct">
              <span>3</span>
            </span>
            Gate blocked
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRowView({ row, open }: { row: ProductRow; open: (id: string) => void }) {
  // Display tone. Normally the rollup health, but a launch that is "on plan" at
  // the rollup yet has a slipping or late gate (e.g. PF-08634404: ON_PLAN
  // rollup, G3 late +11d) must not read as on-plan grey/green — floor it to
  // amber so the icon, phase bar and gate dot all show the slip.
  const baseTone = healthTone(row.health);
  const hasSlip = row.gates.some((g) => (g.slipDays ?? 0) > 0 || g.status === 'late');
  const tone: Tone = baseTone === 'ok' && row.health !== 'LAUNCHED' && hasSlip ? 'rk' : baseTone;
  const phaseNum = row.currentPhase ? parseInt(row.currentPhase.replace(/\D/g, ''), 10) : 0;
  /* Nine slots regardless of how many the backend sent (see phaseModel). */
  const phases = normalizePhases(row.phases, row.currentPhase);

  // Next gate: the first gate not yet met (when the backend returns them), else
  // derive the code from the current phase and fall back to first-ship date.
  const nextGate = row.gates.find((g) => g.status !== 'ok');
  const ngCode = nextGate?.code ?? (phaseNum ? `G${phaseNum}` : '');
  const ngName = nextGate?.name ?? (row.health === 'LAUNCHED' ? 'BAU handover' : '');
  const ngDate = nextGate?.forecastDate ?? row.firstShipDate;

  // Slip descriptor.
  const slipGate = row.gates.find((g) => (g.slipDays ?? 0) > 0);
  let slipTxt = 'on plan';
  let slipSub = '';
  let slipCls: 'r' | 'a' | 'n' = 'n';
  if (row.health === 'LAUNCHED') {
    slipTxt = 'launched';
    slipSub = fmtDate(row.firstShipDate);
  } else if (slipGate) {
    slipTxt = `+${slipGate.slipDays}d`;
    slipSub = `vs ${fmtDate(slipGate.baselineDate)}`;
    // A positive gate slip is never "on plan" (grey): key off health, but floor
    // at amber so e.g. PF-08634404 (+11d, ON_PLAN rollup) shows a slip tone.
    const byHealth = slpClass(row.health);
    slipCls = byHealth === 'n' ? 'a' : byHealth;
  }

  return (
    <button className="tkr" type="button" data-launch={row.launchId} onClick={() => open(row.launchId)}>
      <div className="tk-c0">
        <SstIcon tone={tone} />
      </div>
      <div className="tk-c1">
        <div className="lnm">{labelFor(row)}</div>
        <div className="lmt">
          {[
            franchiseLabel(row.launchId, rawName(row), row.franchise),
            modalityLabel(row.launchId, rawName(row), row.modality),
            row.regulatoryRoute,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div className="trk">
        {phases.map((p, i) => {
          const segTone = p.state === 'live' ? tone : '';
          const segCls =
            p.state === 'closed' ? 'sg done' : p.state === 'live' ? `sg cur ${segTone}` : 'sg';
          const segStyle: React.CSSProperties =
            p.state === 'live' ? ({ ['--f' as string]: '55%' } as React.CSSProperties) : {};
          // A gate closes every phase but the last, so there are n-1 dots.
          let gateCls = 'gd';
          if (p.state === 'closed') gateCls = 'gd done';
          else if (p.state === 'live' && tone !== 'ok') gateCls = `gd ${tone}`;
          return (
            <React.Fragment key={p.code}>
              <div className={segCls} style={segStyle}></div>
              {i < phases.length - 1 && (
                <div className="gt">
                  <div className={gateCls}>
                    <span>{i + 1}</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="tk-c4">
        <div className="ngt mono">{fmtDateYear(ngDate)}</div>
        <div className="ngl">
          {fmtGate(ngCode, ngName)}
        </div>
      </div>
      <div className="tk-c5">
        <div className={`slp ${slipCls}`}>{slipTxt}</div>
        <div className="slpl">{slipSub}</div>
      </div>
      <div className="tk-c6">
        <span className="tk-go">
          Open
          <svg viewBox="0 0 24 24">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  );
}

/* ═════════════════════════ 2.2 BY MARKET ═════════════════════════ */

/*
 * The world map (SVG land + pins) is purely decorative chrome positioned by
 * hand-tuned percentages that are not derivable from the lat/long data, so it is
 * reproduced verbatim from the prototype. Its per-pin `onclick` (a prototype-only
 * global) is stripped so the static chrome never throws.
 */
const MAP_HTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 2000 760" class="wmap" preserveAspectRatio="xMidYMid meet"><g class="wland">
<path d="m1383 262 2 1-3 1-3 1-6 1-5 1-2 3 1 3 2 3-2 3 1 2-1 3-5-1 3 5-3 1-2 4 1 4-2 2-2-1-4 1v2h-4l-2 4 1 5-7 3-4-1-1 1h-3l-6 1-9-4 4-6-1-4-5-1-1-4-3-5 2-3-2-1v-5l1-8 6 2 3-1 1-2 4-1 2-2v-5l4-2 1-2 3 2h4l5 1 1 1 4-2 2 1 1-3h4l-1-3 2-2 3 1v2h2l1 6 3 2 1-1 2-1 3-3 4 1z" name="Afghanistan"/>
<path d="m1121 572 1 2-1 3 1 3-1 3 1 2h-12l-1 20 4 5 3 4-10 3-14-1-3-3h-23l-1 1-3-3h-4l-3 1-3 1v-10l2-6 1-2 2-6 1-3 3-4 2-3 1-5v-3l-2-3-2-3-1-4v-2l2-2-1-6-2-5-2-4v-1l2-1h21l1 4 2 4 1 2 2 4 4-1 2-1 3 1 1-1 1-4h4v-2h3l-1 3h7v4l1 2v8l2 2-1 8 2-1 2 1 4-1zM1055 539l-1-5 2-3 2-1 2 3-2 1-1 2v2z" name="Angola"/>
<path d="M1088 228v1h2l1 1 1 1 1 2-1 2 1 3 3 2v1l-2 1v2l-2 3h-1v-1l-3-3-1-3v-7l-1-2z" name="Albania"/>
<path d="m1296 337 2 5h-3v4l1 1-3 1 1 3-2 2v3l-1 1-17-3-2-6-1-2h1l1 2 4-1h8l3-4 4-4 3-4z" name="United Arab Emirates"/>
<path d="M669 852h-8l-6-14 3 3 5 4 7 4 8 2-1 3h-5zM639 645l11 10 5 1 7 5 6 2 1 3-4 10 5 2 7 1 4-1 4-5 1-6 2-1 3 4 1 5-4 3-4 3-5 6-6 9-1 5v7l1 6-1 1 1 5v3l8 5v5l4 3v3l-3 8-7 3-10 2-6-1 2 4v5l2 3-3 2-5 1-5-2-2 1 3 7 4 2 2-2 2 3-4 2-3 4 1 6v4h-4l-3 3v5l6 4 5 1 1 6-5 4-1 7-3 2-1 3 4 7 5 3h-2l-5-1-12-1-4-4-2-4h-3l-2-2-4-7 3-2v-4l-2-3 1-6-1-8-2-4 2-1-1-2-3-2 1-2-3-3-4-7 2-1-4-8-1-7v-5l3-3-4-6-1-6 3-4-2-5 2-7-1-5-2-2-5-11 2-6-1-7v-5l3-6 3-4-2-3 1-2-1-11 5-3 1-7-1-1 4-6 8 2 4 4 1-5h7z" name="Argentina"/>
<path d="M1231 253h-2l-3-4h-2l-2-2h-1l-3-2-4-2v-3l-1-2 7-1 1 2 2 1v2l3 2-1 2 2 1 3 1z" name="Armenia"/>
<path d="m1743 764 4 2 3-1 5-1h3l-5 8-3 2-4 5-1-2-6 5-1-1h-3v-5l2-4 1-6 2-3zM1794 590l1 5 4-2 1 3 2 2-1 3 1 5v4h1v6l-1 3 1 5 5 3 4 3 3 3-1 1 2 4 1 7 2-1 2 3 1-1v7l2 3 2 3 3 5v5l-1 4-2 4 1 5-2 6-3 3-3 6-2 3-3 5-5 6-5 3-5 5-3 3-5 6-3 3-4 5-3 4-1 2-4 2-6 1-7 2-4 3-4 2-3-2-3-2 3-3-4 1-7 5-3-2-3-1h-3l-4-2-1-4 2-5v-3l-1-3h-5l3-4 1-4-5 4-5 1 4-3 3-4 3-3 2-5-7 6-4 2-4 5-3-3 1-3-1-5-2-2 2-2-6-4h-3l-4-3-10 1-8 2-7 2h-5l-7 3-5 1-3 4-3 2-4 1h-4l-4-1-4 1h-4l-5 3h-1l-4 2-3 2h-7l-4-4-3-2 2-3 3-1 1-2 1-2 2-4 1-4-1-7v-3l2-4-1-4v-2l-2-3 1-5-2-5v-2l2 2-1-6 3 2 1 3v-4l-1-5v-2l-1-2 1-3 2-2 1-3v-4l3-4v4l3-4 5-2 3-3 5-2 2-1 2 1 4-2 4-1 1-1 2-1h3l6-2 3-3 2-3 4-3 1-3 1-3 5-6 1 6 3-2-2-3 2-3 3 2 1-5 4-3 1-3 3-1 1-2 2 1v-2l3-1h3l3 3 3 3h4l3 1-1-4 4-5 3-1-1-2 3-4 4-2 2 1 5-1v-4l-3-2 3-1 3 2 3 3 4 1h2l3 2 4-2h2l1-1 3 3-2 4-3 2h-2l1 3-3 3-2 3v2l4 4 4 2 2 2 4 4h1l3 1v2l5 3 4-3 2-3 2-3 1-3 3-6v-8l2-5 1-1-1-2 2-4 2-3v-2l2-3 2 4-1 4h2v3l1 3v6" name="Australia"/>
<path d="M1071 191l1 2v2h-3l1 2-1 4-1 1h-5l-2 1h-4l-7-2-2-2-5 1v1h-3l-3-1-2-1 1-1-1-1 2-1 2 2 1-2 4 1 4-2 2 1 2 1 1-1-1-4 1-1 2-3 4 2 2-2 2-1 4 2h2z" name="Austria"/>
<path d="m1229 253-4-1-3-3-1-2h1l2 2h2v1zM1235 236l3-2 3 3 4 5h2l2 2h-4v7l-2 2 1 3h-1l-4-3 1-3-2-2h-2l-5 5-1-4-3-1-2-2 1-2-3-2v-2l-2-1-1-2 1-1 4 2h4l-4-4 2-1 1 1 4 3 3 1z" name="Azerbaijan"/>
<path d="M1155 530l-2-6v-1l-1-3 3 1 2-4h3v3l2 1v2l-2 2-2 3z" name="Burundi"/>
<path d="m1017 177-1 4h-1l-1 4-4-3-2 1-4-3-2-3h-3v-2l4-1h3l5-1 3 3z" name="Belgium"/>
<path d="M1007 427v2l1 4-1 3v1l-3 4-1 2-1 4v15h-5l-2-4 1-15-1-1-1-3-2-2-1-2v-4h2l1-3 3-1 1-2 2-2h2z" name="Benin"/>
<path d="m989 406-1 3 1 3 3 4v3l7 2v4l-2 2-3 1-1 2-2 1h-7l-2 1-2-1h-10v9l-4-2h-2l-2 2-3-1-1-2-2-2-1-4 2-2v-2l4-6 1-4 2-2 2 1 3-1 1-2 4-3 1-2 5-2 3-1 2 1z" name="Burkina Faso"/>
<path d="M1501 360v5l-2-1 1 5-2-3-1-3-1-4-3-3-5-1 1 3-1 4-3-2-1 1h-1l-3-1-1-5-3-5 1-4-4-2 1-2 3-2-5-4 1-4 5 3h3l1 5 6 1 5-1 3 1-2 6h-2l-1 4 3 3 1-4h1z" name="Bangladesh"/>
<path d="m1133 222-3 2-1 5 2 3-5-1-4 2v4h-5l-4-2-4 2h-4v-5l-3-2 1-1h-1l1-2 1-2-2-3-1-2 1-2 2 3 2-1 4 1 7 1 3-2 5-1 5 2z" name="Bulgaria"/>
<path d="M1083 214h2l-1 3 3 3-1 2-1 1h-1l-2 2v3l-5-2-2-3-2-1-2-3-2-1-2-3v-3l2 1 1-1h3l4 1h4z" name="Bosnia and Herzegovina"/>
<path d="m1142 163-4-1-1 1 1 2 2 4h-4l-1 2v3l-2-1-4 1-2-2-1 1-2-1h-4l-6-1-5-1h-4l-2 2h-2l-1-2-2-3 3-2v-2l-2-2-1-3h5l5-2v-4l4-2-1-2 3-1 4-3 6 2 1 1h2l5 1 1 3-1 1 4 4 2 2v1l3 1 2 1z" name="Belarus"/>
<path d="M488 400h-2l1-7 1-5v-1l1-1 1 1 2-4h1v1h1v2l-1 3v1l-1 2v4l-2 1-1 1z" name="Belize"/>
<path d="m663 631-1-2-5-3h-5l-10 2-2 5v4l-1 8-1-2h-7l-1 5-4-4-8-2-4 6-4 1-3-9-3-7 1-7-3-2-2-5-3-4 3-7-3-6 1-2-1-2 2-3v-10l1-3-6-10 4 1 3-1 1-1 5-3 3-2 7-2v5l1 3v4l6 6 7 1 2 2 4 2 2 1h4l3 2 1 4 1 2v3h-2l3 7h11l-1 4 1 3 3 1 2 4v6l-2 2 1 4z" name="Bolivia"/>
<path d="M666 490h3v-4h5l3 1 3 1 2-1h1l1 2 2-1 3-2 1-5 4-6h2l1 3 3 12 3 1v4l-4 5 2 2 10 1v7l4-4 7 2 10 4 3 4-1 3 6-2 11 4 9-1 8 6 8 7 4 2h5l2 2 2 8 1 4-2 11-3 4-7 9-4 7-4 6h-1l-2 4 1 12-1 10v5l-2 2v9l-5 8-1 7-4 2-1 4h-6l-9 3-3 3-6 2-7 5-4 6v5l1 3v7l-1 3-3 4-5 11-4 5-3 3-1 6-3 4-2-4 1-3-3-4-5-4-6-4h-2l-7-5-3 1 6-9 5-6 4-3 4-3-1-5-3-4-2 1v-4l1-3-1-4-2-1-2 1h-2l-1-3-1-6-1-2-4-1-2 1-6-1v-9l-2-4 1-1-1-4 2-2v-5l-1-4-4-2v-6l-11-1-2-7h1v-3l-1-2-1-4-3-2h-4l-2-1-4-2-2-2-7-1-6-6v-4l-1-3 1-4-8 1-3 2-4 3-2 2h-2l-5-1-3 1h-2l-1-10-4 4-5-1-2-3h-4l1-3-3-4-3-6 2-1-1-3 4-2-1-3 1-2 1-3 6-5 5-1v-1h6l2-17v-3l-1-4-3-2v-5l4-1 1 1v-2l-3-1v-4h11l2-2 1 2 1 4 1-1 3 3h5l1-2 4-2 2-1 1-2 4-2v-2h-5l-1-4 1-5-3-1 1-1 4 1 5 2 2-2 4-1 6-2 2-3v-2h3l1 2-1 3h2l1 3-1 3-1 5 1 3v3l4 3 3 1v-2h2l3-1 1-2 4 1z" name="Brazil"/>
<path d="m1633 473 2-3 5-3v7h-3l-1 2z" name="Brunei Darussalam"/>
<path d="m1489 324 2 2 1 4h-5l-4-1-4 1-5-2v-1l2-5 3-2 4 2h3z" name="Bhutan"/>
<path d="m1128 616 1 5 2 1 1 4 6 7h3l-1 3 2 4 4 1 4 3-8 4-6 5-2 5-1 2h-3l-2 4v2l-4 1h-4l-3-2-2-1-3 2-1 3-3 2-3 2-4 1-1-2 1-4-3-6-2-1 1-19h5l1-23h4l9-2 2 2 4-2h1l4-2z" name="Botswana"/>
<path d="m1121 447 4 2 3 3v2l4 3 3 3 1 4 4 2 1 2-1 1h-4l-4-1-2 1-1 1h-2l-2-1-7 3h-3l-2 4-4-1-4-1-4-2-4-2-3 2-3 3v4h-4l-4-1-3 3-3 6v-2l-1-2-2-3-2-3-1-2-3-4 1-1-1-3 1-5 1-1 3-7h4l1-2h1l2 2 7-3 2-2 3-3v-2h7l5-3 4-7 3-3 3-1 1 3 3 4v7z" name="Central African Republic"/>
<path d="m646 213-3-4 3-9-1-1-4 1-1-2-6 5-3 5-3 3-2 1h-2l-1 1h-17l-3 2-7 4v-1l-2 1-2 2-2-1h-5l-4 1-2 1-2 2 2 1 2-1v2l-5 1-3 1-2 1-2-1-2 1-3 1-4 2h-3l2-2 4-4 4-2 1-2 1-3 3-3 1-4 1 4 4 1 3-2-2-5-1-2-4-1-3-1h-4l-4-1v-1l-2 1-1-1 2-2-2-1 2-2-1-2 2-2h-5l-1-4v-1h-4l-4-1-1 1-2 1-3 1-3 3-6-2-4 1-4-2-5-1-3-1-1-1 1-3h-2l-1 2H377l-5-6-2-2-7-3 1-6 4-3-4-3 3-5-2-4 2-3 5-3 4-4-5-4 1-7 2-4-2-3-1-2 1-3-7 2-7 3-1-4v-2l-3-2h-4l35-33 25-20 6 1 3 3h4l6-2 7-2 6 1 9-3 8-1v2l4-1 4-2h2l2 5 9-4-4 4 6-1 4-1h4l4 2 8 2 4 1h5l3 3-9 3 7 1 11-1 5-1 1 3 7-2-2-3 5-2h9l2 1 1 3 5-1 6 3 7-1h6l2-3 5-1 5 2-5 5 7-5 3 1 6-6-1-3-3-2 5-6 8-4 5 1 2 2v6l-5 3 6 1-4 5 9-4 2 4-4 4 1 3 7-4 7-4 4-6h6l5 1 4 3-2 2-5 3 1 3-2 3-11 4-7 1-3-2-3 3-8 4-3 3-7 4h-7l-5 3-3 3-6 1-8 5-10 6-5 5-5 7 6 1-1 5-1 5 7-1 7 2 4 3 1 2 5 2 4 3h8l4 1-3 5-2 6v7l5 6 4-2 6-7 2-9-2-4 9-2 8-5 5-4 1-4v-5l-3-4 9-7 1-5 4-9 3-1 7 1 4 1 5-2 3 2 4 4v2h7l-2 5-2 8 3 1 2 3 8-3 8-7 4-2 1 5 3 7 2 8-4 3 5 4 3 3 7 2 2 2v5l4 1 1 2-2 7-5 2-4 2-9 3-8 5-8 1-10-2h-8l-5 1-6 4-7 3-10 8-8 6 5-1 11-8 12-6h8l3 3-6 4-1 7v5l6 3 8-1 8-7-1 4 2 3-7 4-13 4-5 2-8 5-3-1 1-5 11-5h-9z" name="Canada"/>
<path d="m539 49-5 2 11-1 2 2 8-2 2 1-3 5 5-2 2-5 5-1 3 1 2 2-3 5-2 4 4 2 5 3-3 2-7 1 1 2-3 2-7-1-5-1h-6l-9 2-11 1h-8v-3l-4-1-4 1-1-5h3l8-1h5l6-1-6-1h-15v-2l12-2h-7l-5-1 8-4 5-2 14-3zM579 47l-7 4-3-4 2-1h6zM687 49l-1 1h-8l-5 1-1-1-2-2 2-2 2-1 9 1z" name="Canada"/>
<path d="m647 49 1 3 7-4 12-2 2 5-3 3 9-1 5-2 7 2 3 3-1 2 9-1 1 3 9 2 2 2 1 6-9 2 8 4 5 1 4 5h6l-3 4-11 7-4-3-4-5-6 1-2 3 3 3 4 3 1 1v6l-3 4-5-2-9-4 4 5 3 3-1 2-11-2-7-3-4-3 2-2-4-3-5-2-1 1-13 1-2-2 5-4h8l9-1v-2l3-3 9-5v-4l-5-3-7-2 4-1-2-4h-4l-2-2-3 2-8 1-14-2-7-1-6-1-2-2 6-2h-5l3-6 7-4 6-2 11-2zM597 45l4 1 7-1v2l-6 2 3 3-5 4-8 2h-4l-1-2-5-4 1-2 8 1-1-3zM620 51l-8 3h-5l2-4 3-3 4-2 5-1h8l6 1-10 5zM504 58l-14 2 1-2-6-3 4-2 8-4 7-3 1-3 14-1 4 1h9l2 2 2 2-7 1-13 4-10 4zM629 39l-4 2h-5l-4-1 5-3 7-1 1 2zM620 31v2l-2 2-6 4-7 1-3-1 3-3h-7l5-3h4l7-2zM581 33l-1 2 4-1h4l-2 3-5 2-14 1-13 2h-6l2-1 11-3-18 1-4-1 11-5 6-1 8 2 3 2 6 1 1-5 5-2 4 1zM636 29l3 1h7l2 2-3 2 3 1 1 1h5l5 1 7-1 8-1 6 1 2 2-1 2-3 1-7 1-4-1-12 1h-14l-8-2 1-3 2-2-1-2-7-1-3-1 4-2zM561 26l-6 4-5 2h-4l-10 2-7 1-4-1 12-4 12-3h6zM642 27h-8v-2h7l2 1zM583 26l-9 1-3-1 5-2h6l4 1zM591 22l-6 1h-6l1-1 6-1h2zM638 24l-7 1-1-1v-2l2-1h6l3 2zM624 23l-1 2-5-1-4-1h-8l5-2-3-1 2-1h7l7 2zM678 17l3 1-7 2-10 3-7 1-7-1-2-2 3-2 4-1h-7l-2-1 1-2 5-2 4-1 4-1-1-1h9l1 2 5 1 5 1z" name="Canada"/>
<path d="M757 3h9l7 1 5 1-1 1-10 1-9 1-4 1h7l-10 3-7 1-9 3-8 1-3 1h-12l5 1-4 1 1 2-5 2-7 1-3 2-7 1v1h6l-1 1-13 3-8-1-12 1-5-1h-7l2-2 8-2 2-3h3l8 2-2-3-5-1 5-2 8-1 2-2-3-1 1-3 10 1h2l7-2h-20l-4-1-1-2-2-1 1-1 6-1h4l7-1 7-1h4l3 1 5-2 5-1h42" name="Canada"/>
<path d="M1034 198l-1 1 2 1h3l-1 3-2 1-3-1-1 3h-3l-1-1-2 2h-3l-2-1-2-3-2 1v-3l3-3v-2l2 1 2-1h4l1-1z" name="Switzerland"/>
<path d="m1602 382-4 3-5-2-1-5 2-3 6-2h3l2 2-2 3zM1626 186l9 4 6 6h7l3-3 7-1 1 5v3l3 6v7l-7-2-3 3 5 5 4 8h-3l2 3-5-4v4l-7 2 3 4h-4l-4-2-1 4-4 4-2 4-6 1-3 3-5 2 2-3-3-2 2-5-4-3-3 2-4 5-1 4h-5l-2 3 5 5 5 1 1 2 5 2 4-4 6 2h4l2 4-7 2-1 3-4 3v5l7 3 4 7 6 5 5 5 2 5-3 2 2 3 4 2 1 6v5h-3l-2 7-2 9-3 7-7 6-6 6h-6l-3 3-3-2-2 3-7 4h-6l-1 7-3 1-2-5 1-2-8-3-2 2-6-2-3-3v-3l-5-2-4-2-4 3-5 1h-4l-3 2-3 1 2 7h-3l-1-2v-2l-4 1-2-1-5-2 1-5-4-2-2-6-6 1-1-7 5-6-1-5-2-5-2-1-3-4h-3l-6-1 1-2-4-4-3 2-5-1-5 4-4 5-4 1-3-2h-3l-4-2-3 2-2 5-2-5-3 1-6-1-7-1-5-3-4-1-3-3-3-1-7-4-4-2-2 1-9-4-6-4-3-8 4 1-1-3-3-3-1-5-7-8-10-3-3-5-4-3-2-1-2-4v-2l-4-2-1 1-4-6 2-2-2-1 4-3 4-1h5l1-4h6l1-3 7-3 1-2-2-3 3-2-9-11 9-3 2-1-1-11 11 2 1-3-2-6 4-1 2-4 1-1 4 5 5 3 9 2 5 6 2 7 3 3 6 1 7 1 8 4h4l5 6 5 4h5l11 1 7-1 5 1 10 4h6l3 2 5-3 7-3h8l4-2 2-3 3-3-2-2-3-2 1-4h3l6 2 3-4 6-2 2-4 2-2 7-1 4 1-1-2-7-5-5-2-2 2-6-1-2 1-3-2v-7l-1-4 7 2 5-4-2-3v-6l1-2-2-3-4-2 2-3 5-1h6l8 2 6 2 8 6 4 3 4 4 7 6z" name="China"/>
<path d="m956 435 2 2 1 2 3 1 2-2h2l4 2 2 9-3 5-1 8 2 5v3h-2l-4-1h-4l-7 1-4 2-5 2h-1v-5l1-1-1-3-2-3h-2l-1-2 1-3-1-3 1-1 1-3-1-2 1-1h2l-1-5-2-3 1-2 1-1h1l1 1h5l1-2h1l1-1 1 3 1-1z" name="Cote dIvoire"/>
<path d="m1073 454-3 7-1 1-1 5 1 3-1 1 3 4v2l3 3 2 2v3l1 2v4l-5-2-4-2h-8l-4 1-3-1h-12l1-5-2-4-3-1-1-3-2-1v-2l2-4 3-7h1l4-3 2-1 3 3 4-2v-3l2-2v-4l3-2 1-5 2-1v-3l2-5 5-5v-3l-2-2v-2l2-1 2 4 1 5-1 4 4 6h-5l-3-1-1 3 3 4 3 1 1 3 2 4z" name="Cameroon"/>
<path d="m1141 468 4 5 2 1 2-1 2 1 4-2 1 3 5 4v8l2 1-2 2-2 2-2 3-1 3-1 5-1 3v4h-1v4l1 3v1l-1 10 2 4-1 3 1 4 4 4v3l2 2v1h-1l-8 1-1 1-2 4 1 3-1 7-1 7 2 1 4 2 1-1v7h-4l-2-4-2-2-4-1-2-4-3 2h-5l-1-3-4-1h-3v-2h-4l-4 1-2-1-2 1 1-8-2-2-1-4 1-4-1-2v-4h-7l1-3h-3v2h-4l-1 4-1 1-3-1-2 1-4 1-2-4-1-2-2-4-1-4h-21l-2 1-1-2 2-1v-2l1-2 2-1h1l2-2h4v2l2 1 3-4 4-3 1-2v-6l2-6 3-3 4-3v-2l1-3v-6l1-5 1-4 2-4v-8l3-3 3-2 4 2 4 2 4 1 4 1 2-4h3l7-3 2 1h2v-1l3-1 4 1h3z" name="Democratic Republic of the Congo"/>
<path d="M1091 479v4l-2 4-1 4-1 5v6l-1 3v2l-4 3-3 3-2 6v5l-1 3-4 3-3 4-2-1-1-2h-3l-2 2-1-1-2-2-2 1-2 3-5-7 5-3-3-4 2-2 4-1 1-3 3 3 5 1 1-3 1-5v-5l-3-3 2-8-1-1h-4l-2-3 1-3h7l4 2 5 2v-4l3-6 3-3 4 1z" name="Republic of Congo"/>
<path d="m584 426-3 1-2 4-2 1-2 3-1 4-2 4 3 1 1 2 1 2v6l1 1 1 2 8-1 3 1 4 6 2-1h7l2 1-1 3-1 2-1 5 1 4 2 2v1l-3 4 2 1 2 2 1 7-1 1-1-4-1-2-2 2h-11v4h3v3l-1-1-4 1v5l3 2 1 4v3l-3 17-2-3h-2l3-7-4-3-3 1-3-1-3 1h-4l-3-7-3-2-2-3-4-3-1 1-2-2-3-2-2 1-5-1-1-3-1 1-6-4v-2l2-1-1-3 2-2 3-1 2-4 2-3-2-1 2-4-2-6 2-2-1-5-2-4 1-3 2 1 1-2-1-4v-1h3l5-4 2-1v-2l2-5 3-3h3l1-2 4 1 5-3 2-2 3-3h2l2 2z" name="Colombia"/>
<path d="m515 432 1 3 2 3 2 2-2 1v3l1 1h-1v4l-3-1-2-2 1-1v-1l-1-2-3-1-1-1-1-2-1-1v2l-1 2-1-2-2-1-1-1v-2l1-2-1-1 1-1 1-1 4 2 1-1h2l1 2h1z" name="Costa Rica"/>
<path d="m545 356 2 2 5-1 2 2 4 4 3 3h2l3 1v2h4l3 3v1l-4 1h-16l4-3-2-2h-3l-2-2-1-4h-3l-5-1-1-2-8-1-1-1 2-1-6-1-4 4h-2l-1 1-3 1-2-1 3-2 1-2 3-1 3-2h4l2-1h5l4 1z" name="Cuba"/>
<path d="m1060 175 2 2 4 1v1l3 2v-2l3 1 1 2h4l3 3h-2l-1 1-1 1v1h-1v1l-2 1-2-1v2l-3-1h-2l-4-2-2 1-2 2-4-2-3-3-3-1v-3l-1-2 3-1 2-1 3-2 1-1 2 1z" name="Czech Republic"/>
<path d="m1054 159 1 3-1 2 2 2 2 3-1 2 3 4-2 1-2-1-1 1-3 1-2 2-3 1 1 2v3l3 1 3 3-2 3-1 1 1 4-1 1-2-1-2-1-3 1h-5l-1 2-2-2h-2l-5-1-1 1h-4v-5l2-4-7-1-2-2v-2l-1-2 1-4-2-6h3l1-3 1-5-1-2 1-2h4l1 1 3-3-1-2v-3h6l1 2 4 1 1 2 4-1 3-1 5 2z" name="Germany"/>
<path d="m1230 428-2 4-2-2-1 1h-3v-2l-1-2 2-3 2-3 2 1 2-2 1 2v3l-3 1z" name="Djibouti"/>
<path d="m1046 148-2 5-5-4-1-2 6-2zM1033 152h-6l-2-4-1-6 1-2 1-1 4-1 2-1 3-2v3l-1 2 1 2 2 1-1 2-1-1-3 5z" name="Denmark"/>
<path d="M586 386v-2l-1-2 1-1 1-2v-4l1-1h4l3 2h2v2h3v2h3l2 2-2 3-3-1h-4l-1 1h-3v-1h-2l-3 5-1-1z" name="Dominican Republic"/>
<path d="m1031 265-1 3 1 6-1 5-3 4v5l5 4v1l3 3 3 11 2 6v3l-1 5 1 3-1 4 1 4-2 2 3 5v3l2 3 3-1 4 3 3 4-19 12-16 13-8 3-6 1v-5l-3-1-3-1-1-3-19-14-19-14-20-16v-9l9-5 5-1 5-2 2-3 6-2 1-5 3-1 2-2 7-1 1-3-1-1-2-7v-4l-2-4 5-3 6-2 3-2 5-2 9-1 9-1 3 1 5-2 5-1 2 2z" name="Algeria"/>
<path d="m559 503 1 5-2 4-6 7-7 2-3 6-1 4-3 3-3-4h-4l-1-2 2-2-1-2 3-5-1-3-2 3-4-3 1-2v-5l2-1 1-4 2-4-1-3 3-1 4-3 6 4h1l1 2 5 1 2-1 3 2z" name="Ecuador"/>
<path d="m1172 301 4 10 1 1-2 3v5l-1 3-2 1-2-2-2-3-5-9-1 1 3 7 4 6 5 10 2 4 2 3 6 7-1 1v5l7 5 1 2h-66l-1-24-1-23-2-5 1-4-1-3 2-3h7l5 2 6 2 2 1 4-2 2-2 5-1 4 1 2 3 1-2 4 2h5z" name="Egypt"/>
<path d="m1229 420-2 2-2-1-2-2-3-4-2-2-2-2-5-2-4-1-1-1-3 2-4-3-1 5-7-2-1-2 2-10 1-4 1-2 4-1 3-4 4 8 1 6 4 3 8 6 3 3 3 4 2 2z" name="Eritrea"/>
<path d="M1114 125l-3 3 2 6-1 1h-4l-4-2h-2l-4 1v-4l-2 1-3-2-1-4 5-1 6-1 5 1z" name="Estonia"/>
<path d="M1207 409h4l5 2 2 2 2 3 3 3 2 2-2 3-2 3 1 2v2h4l2 1-2 2 3 4 2 3 2 2 19 8 5-1-16 20h-7l-5 5h-4l-1 2h-4l-3-2-5 2-1 3-4-1h-5l-7-6h-4l-2-2v-3l-3-1-3-7-3-2-1-3-3-3h-3l2-4h3v-8l2-6 2-2 1-3 2-5 3-3 2-6 1-6 7 2 1-5 4 3 3-2z" name="Ethiopia"/>
<path d="M1104 70v4l8 4-3 4 6 6-1 5 5 4-1 4 7 4-1 3-3 3-8 8h-8l-8 2-7 1-3-3-5-2v-6l-3-5 2-3 3-4 9-6 3-1-1-2-7-3-2-2-1-9-8-3-6-3 3-2 5 3h5l5 1 3-2 1-4 6-2 6 2z" name="Finland"/>
<path d="m1061 487-1 3 2 3h4l1 1-2 8 2 3 1 5-1 5-1 3-5-1-3-3-1 3-4 1-2 2 2 4-4 3-6-6-3-5-4-7v-2l2-2 1-5 1-5h10v-8h3l3 1 4-1z" name="Gabon"/>
<path d="m957 158-4-1h-3l1-3v-3l4-1 4 4z" name="United Kingdom"/>
<path d="m973 130-5 6 4-1h5l-1 5-4 6h5v1l4 7 3 1 3 7 2 2 6 1-1 4-2 2 1 3-4 3h-6l-9 2-2-1-3 3-5-1-3 2-3-1 7-6 5-2-8-1-1-2 5-2-3-3 1-4h8v-3l-3-4-6-1-1-2 2-3-1-1-3 3v-6l-2-3 2-7 3-4h10" name="United Kingdom"/>
<path d="m1216 228 5 1 2 3 3 1-1 1 4 4h-4l-4-2-1 1-7 1-6-3h-5v-2l-2-5-4-2-3-1-2-2h1l4 1 8 1 8 3 1 1z" name="Georgia"/>
<path d="m987 431-1 2 2 3v5l1 5 1 3-1 5 1 3 1 4 1 3-9 4-3 2-5 2-5-2v-3l-2-5 2-8 2-5-2-9v-9h10l2 1 2-1z" name="Ghana"/>
<path d="M922 422v2h1l1-1 1 1 2 1 2 1 2-2 1-1h3l1 1 1 2 2 3-1 1v2h1l1 1-1 1 2 2-1 1-1 2 2 3 1 5h-2l-1 1 1 2-1 2h-2l-1 3h-2l-1-2 1-2-3-4-1 1h-3v-2l-1-2v-2l-1-2-1-3h-5l-1 2h-2l-1 1v2l-4 3-2-4-2-3-2-1-1-1-1-3v-1l-2-1 3-3h1l2-1h1l1-1-1-2 1-1v-2h3l4 2 1-1h5" name="Guinea"/>
<path d="M892 417v-3h6l2-1h2l2 1h1l2-1 1 2-2 2-2-1-3-1-2 2h-7" name="The Gambia"/>
<path d="M909 421v5l-1 1h-1l-2 1h-1l-3 3-3-3h-2l-2-2v-1l-1-1-1-2 3-1 2 1 2-1z" name="Guinea-Bissau"/>
<path d="M1050 487v8h-10l-1-1 2-7z" name="Equatorial Guinea"/>
<path d="m1113 273 3 2 4-1 4 1v1l3-1-1 2-7 1v-1l-7-2zM1122 240h-3l-3-1-6 2 4 3-3 1h-3l-3-3-1 2 2 3 3 3-2 2 3 3 3 2v3l-5-2 2 4h-3l2 6h-3l-5-3-2-5-1-4-3-3-3-4v-1l2-4v-2l2-1v-1l3-1 2-1h3l1-1h4l4-2 4 2h5v-3l2 1-1 4z" name="Greece"/>
<path d="m896 1 20 3-7 2h-31l1 1h13l9 1 7-1 3 1-5 3 9-2 18-1h10l1 2-15 3-2 1-11 1h8l-5 3-3 3-2 5 4 3h-6l-6 2 6 3v4h-4l4 5h-9l4 2-2 2-5 1h-6l4 3v3l-7-3-3 2 5 1 5 3v5l-7 1-3-3-4-3 1 4-6 3h16l-12 5-12 4-12 2h-5l-5 2-7 6-11 4h-3l-6 2-6 1-5 3-2 4-3 4-9 5 1 4-4 5-4 6h-6l-5-5h-9l-4-3v-5l-5-8-1-3 2-5-4-6 3-4-2-2 7-6 7-2 3-2 3-5-6 2-2 1-4 1-5-2 2-4 3-2h4l7 1-5-3-3-2-4 1-3-2 7-5-1-1-1-4-1-5-4-2 1-2-8-3-7-1-11 1h-9l-3-2-4-3 11-1h8l-15-2-6-2 2-1 15-3 15-2 3-1-8-2 5-2 14-3h6V8l9-1 11-1h10l3 2 11-3 7 2h5l6 2-7-3 2-1 12-2h12l5-2h38" name="Greenland"/>
<path d="m488 388-1 5-1 7h2l2 1v-1l2 1-3 2-3 2-1 1 1 2-2 1-1 1-1 1-2 2v1l-3-1-3-1-3-1-3-3 1-1 1-2-1-1 3-5h7l1-3h-1l-1-1-1-2-2-2h2l1-4h10" name="Guatemala"/>
<path d="m663 464-1 5-4 2 1 1-1 4 2 4h2v4l4 6h-2l-3-1-2 2-2 1h-2l-1 2-2-1-4-3v-3l-2-3 2-5 1-3-1-3h-2l1-3-2-2h-3l-3-4 1-2v-3l4-1 1-1-2-3 1-2 5-4 3 3 4 4v3h2l3 3z" name="Guyana"/>
<path d="m520 406-2-1-1 1-2 1h-2l-1 1h-1l-1-1-1 1h-1v2l-2 1-1 1-1 1-1-1-2 1h-2l-1 4-1 1h-2l-1-2h-1v-3l-2-1-2 1v-1l-2-1-1-1-2-1 2-1-1-2 1-1 3-2 3-2 2-1h3l2 1 3-1h2v-1h2l1 1h2l1-1 3 1 2 1 1 2 2 1z" name="Honduras"/>
<path d="m1082 208 1 2 2 2-2 2-2-1h-4l-4-1h-3l-1 1-2-1-1 3 3 3 2 1 2 3 2 1 2 3 5 2-1 1-5-2-3-2-5-2-4-5h1l-3-3v-2l-3-1-2 3-1-3v-2h3l1-1 2 1 2 1v-2l2-1v-2l4-2 1 1 4 2 5 2z" name="Croatia"/>
<path d="M587 375v4l-1 2-1 1 1 2v2l-4-1h-6l-3 1-3-2 1-2 5 1h4l3-1-3-3 1-2-4-1 2-2h3z" name="Haiti"/>
<path d="m1096 192 3 2 1 1-3 2-2 4-3 4-4 1h-3l-4 2-1 1-5-2-4-2-1-1-1-2h-1l1-4-1-2h3v-2l3 1 2 1 4-1v-1h2l2-1h1l2-1 1-1h2z" name="Hungary"/>
<path d="M1786 519l-1 20-2 21-5-5-5-1-2 2h-7l3-5 4-2-1-7-3-5-10-6h-5l-8-6-2 3h-2l-1-2v-3l-5-3 7-2h4l-1-2h-8l-2-4-5-1-3-3 8-2 3-2 9 3 1 2 1 11 6 3 5-6 7-4h5l4 2 4 2zM1696 493l-4 6-4 1-6-1h-9l-5 1-1 5 5 6 3-3 11-2-1 3-2-1-3 4-5 2 5 8-1 3 5 7v4l-3 2-3-2 3-5-5 2-2-2 1-2-4-4 1-6-4 2v16l-4 1-2-2 2-5-1-7h-2l-2-4 3-4 1-5 3-10 1-3 5-5 4 2 7 1h7l5-5zM1608 489l1 4 4 4 4-1h3l4-3 2-1 6 2 4-1 3-9 2-2 2-8h6l5 1-3 6 5 6-1 3 6 6-7 1-1 4v6l-6 4v7l-3 10v-3l-7 3-2-4h-4l-3-2-7 2-2-3h-8l-1-9-2-2-3-5-1-6 1-6zM1585 539l-6 1-4-6-8-5-2-4-4-5-3-5-4-9-5-5-1-6-3-5-5-4-3-5-4-4-7-7v-3h3l9 1 6 6 4 5 3 2 6 7h6l4 5 4 5 4 3-2 5 3 3h2l1 4 2 4h4l3 5-2 8z" name="Indonesia"/>
<path d="m1428 308-3 3-1 6 6 2 5 3 8 4 8 1 4 3 4 1 7 1h5v-2l-2-4v-3l3-2 2 6v1l5 2 4-1 4 1 5-1-1-3-2-2 4-1 4-5 5-4 5 1 3-2 4 4-1 2 6 1 1 3-2 1 2 4-5-1-6 4 1 4-2 5v3l-1 6-5-2 1 7-1 2 1 3-2 1-5-10h-1l-1 4-3-3 1-4h2l2-6-3-1h-11l-1-5h-3l-5-3-1 4 5 4-3 2-1 2 3 2v4l3 5 1 5v3l-4-1-7 2 1 5-2 3-8 5-5 7-4 4-5 5 1 2-3 2-5 2-2 1-1 5 1 8 1 5-2 6 1 11-3 1-2 4 2 3-5 1-2 5-2 2-6-6-3-9-3-7-2-3-3-6-2-8-2-4-5-9-4-12-3-9v-7l-2-6-8 4-4-1-8-8 3-2-2-3-7-5 3-5h12l-2-5-3-3-2-5-4-3 5-7 7 1 4-7 2-7 4-6-1-5 4-3-5-4-3-4-3-6 2-2 8 1 6-1 4-5 7 7 1 6 3 3 1 3-4-1 3 7 6 4z" name="India"/>
<path d="M957 158v5l-3 5-9 4-7-1 4-7-2-6 7-5 4-2v3l-1 3h3z" name="Ireland"/>
<path d="M1229 253h2l5-5h2l2 2-1 3 4 3h1l2 5 6 1 4 3 8 1 8-2v-1l4-1 3-4h4l2-1 4 1 6 3 5 1 7 5 4 1 2 5-1 8v5l2 1-1 3 2 5 1 4 5 1 1 5-4 5 3 4 3 4 6 2 1 6 2 1 1 3-7 3-1 8-11-2-6-2h-6l-4-8-3-1-4 1-5 3-7-2-6-5-5-2-5-6-5-9-3 1-3-2-2 3-4-4v-3h-2v-5l-3-5-7-3-5-6 1-5 2-2-1-4-4-2-4-8-4-5v-2l-2-7 3-2 1 2 3 3z" name="Iran"/>
<path d="m1224 263 4 8 4 2 1 4-2 2-1 5 5 6 7 3 3 5v5h2v3l4 4-4-1h-3l-4 6-10-1-17-12-8-5-7-2-3-8 11-6 1-8-1-5 3-1 2-4 2-1 6 1 2 1z" name="Iraq"/>
<path d="m925 85-2 3 5 4-6 4-13 4-4 1-6-1-12-2 5-2-9-3 8-1v-2l-9-1 4-4h6l6 3 7-3 5 2 8-3z" name="Iceland"/>
<path d="M1179 288v4l-1 2-2-1v4l1 1-1 1v1h2l1 2-2 10-1-1-4-10 2-2h-1l1-3 1-5v-2h2l1-1z" name="Israel"/>
<path d="m1068 256-1 6v5l-5-3h-2l-8-4 1-3 6 1 5-1zM1034 237l4 5-1 8h-2l-2 2-2-2-1-7-1-4h3z" name="Italy"/>
<path d="M1056 204v3l1 3-4-1-4 2v5l2 3 5 3 3 6 6 5h4l1 1-1 1 5 3 4 2 4 3 1 1-1 2-3-3-5-1-2 4 4 3v3l-2 1-3 5-2 1v-2l1-4 1-1-2-4-2-3-2-1-2-3-3-1-3-2-4-1-4-3-5-4-4-3-1-7h-3l-4-3-3 1-2 3-3 1 1-3-3-1-1-5 1-2-1-2v-2l2 2 3-1 2-2 1 1h3l1-3 3 1 3-1v-2h3v-1l5-1 2 2z" name="Italy"/>
<path d="m557 387-2 1-3-1-3-2 1-2h3l4 1 3 1 1 2z" name="Jamaica"/>
<path d="m1198 295-1 1-10 4 6 6-2 1-1 2-4 1-1 2-2 2-6-1v-1l2-10-1-2 1-2-1-4 1-2 6 2 10-6z" name="Jordan"/>
<path d="m1709 283 1 2-1 4-3-2-2 1v4l-5-2-1-3 2-4 3 1 1-3z" name="Japan"/>
<path d="m1733 263 1 6 2 3v4l-6 3-9 1-4 7-5-2-2-5-9 1-5 3h-6l7 5 1 11-3 3-3-3-1-6-4-1-4-5 4-2 1-4 4-3 2-5 10-2 6 2v-12l5 3 5-6 1-2-1-8-5-7v-4l5-2 8 9 3 5-1 7zM1721 219l5 1 2-3 6 7-7 2v6l-11-4 1 7h-5l-5-6-1-5h6l-5-9-2-5 11 7z" name="Japan"/>
<path d="m1338 161 5-1 9-6-1 2 9 5 18 16 1-4 8 4 7-2 3 1 4 4 4 1 3 3 6-1 5 4-2 4-4 1 2 6-1 3-11-2 1 11-2 1-9 3 9 11-3 1 2 4-4-1-3-2-8-1h-9l-1 1-9-3-2 1v4l-9-2-3 1v3l-3 1-5 4-1 5h-2l-2-3h-7l-3-6h-2l-2-6-7-5-9 1-6 1-6-6-5-2-9-5h-1l-12 3 6 24h-3l-5-5-3-2-6 2-2 2v-4l-1-3-7-2-4-5-3-2v-2h5l-1-4 4-1 5 1-1-6-2-4h-5l-5-1-5 2-4 2-3-1v-4l-5-4h-3l-5-4 1-5-2-1 3-7 6 4-1-5 8-6 8-1 12 5 6 2 5-2h7l8 3 1-2h7v-3l-10-4 4-3-2-2 4-1-5-4 2-3 17-2 1-1 11-2 3-3 9 1 5 7 4-2 7 2z" name="Kazakhstan"/>
<path d="m1224 477-5 7v23l3 6-4 2-1 3h-3v5l-2 2-1 5-3 2-8-7v-3l-20-13v-5l-1-3 1-2 3-5 2-4-3-8v-3l-3-4 3-4 4-4 3 1v3l2 2h4l7 6h5l3 1 2-3 5-2 3 2z" name="Kenya"/>
<path d="m1401 230-1 2-7 3-1 3h-6l-1 4-5-1-4 2-4 3 1 1-1 2-9 1-7-2h-6v-4l6 2 1-2h4l5-4-7-4-3 2-5-3 3-4h-1v-3l3-1 9 2v-4l2-1 9 3 1-1h9l8 1 3 2z" name="Kyrgyzstan"/>
<path d="m1590 411 2 4v8l-9 5 2 3-5 1-5 3-5-1-2-4-4-6-2-8 3-5 7-2 5 1 5 3 2-5z" name="Cambodia"/>
<path d="M1653 260v-1h2l1-3h4l2-1v-1l8 7 3 5 4 7-1 4-4 1-3 2-5 1-2-4-1-4-5-7 3-1z" name="Republic of Korea"/>
<path d="m1248 309 1 3v2l2 4-4 1-1-3-5-1 3-6z" name="Kuwait"/>
<path d="m1590 411-6-3-1 5-5-3 1-3v-5l-6-6-1-6-5-5-4-1-1 3h-3l-2-1-6 3v-12h-4l-1-4-2-2v-3l4-4 1 2h3l-2-7 3-1 4 5 3 6h7l3 5-3 2-1 2 7 4 6 8 4 5 5 5 2 4z" name="Lao PDR"/>
<path d="M1179 288h-1l-1 1h-2l2-5 2-4v-1l2 1 2 2-3 3z" name="Lebanon"/>
<path d="m939 453-1 1 1 3-1 3 1 2 2 1 2 2 1 3h-1v6h-2l-6-3-5-5-5-4-3-4 1-2v-2l3-3 2-3h2l1-1 3 4-1 3 1 1h2l1-3z" name="Liberia"/>
<path d="m1123 299-2 3 1 3-1 4 2 5 1 23 1 24 1 12h-7v3l-22-12-23-12-5 3-4 2-3-3-9-3-3-4-4-3-3 1-2-3v-3l-3-5 2-2-1-4 1-4-1-3 1-5v-3l-2-6 2-1 1-3-1-3 4-2 1-2 3-2v-5l7 2h2l4 1 8 3 2 5 5 2 8 2 6 3 3-1 2-3-1-5 1-3 4-3 3-1 8 1 2 3h2l2 1 5 1z" name="Libya"/>
<path d="m1446 462-5 2-3-6-1-9 2-10 4 3 3 5 3 7-1 6z" name="Sri Lanka"/>
<path d="m1139 698-2 1-4-5 4-4 3-3 2-1 3 2 1 2-2 3-1 2-3 1z" name="Lesotho"/>
<path d="m1111 148 1 2-4 2v4l-5 2h-4l-2-2-2-1-1-1v-2l-2-1-5-1-2-5 5-2 8 1 5-1 1 1 2 1z" name="Lithuania"/>
<path d="m1017 185-2 1-1-1 1-3 1-1 1 2z" name="Luxembourg"/>
<path d="m1113 137 2 1 1 3 2 3-4 3-3 1-5-3-2-1-1-1-5 1-8-1-5 2v-4l1-4 4-2 5 4h4v-4l3-1h3l4 2z" name="Latvia"/>
<path d="m975 276 2 4v4l2 7 1 1-1 3-7 1-2 2-3 1-1 5-6 2-2 3-5 2-5 1-9 5v7h-1v4h-3l-2 1h-9l-2 5-2 1-3 8-8 7-1 9-3 3-1 2h-12v-3l2-1 2-4v-2l2-4 3-5 2-1 2-3v-4l2-4 4-2 3-7 3-2 5-1 5-4 3-2 4-5-1-8 2-6 1-3 4-5 5-2 4-3 4-7 2-4h4l3 3h5l5 1z" name="Morocco"/>
<path d="m1129 210-1-3v-5l-4-4-2-2-1-2-2-1 1-1h3l4 2h2l3 2v2l2 1 1 2 2 2v1h1l-2 1h-3v-1h-1v1l-1 3v2z" name="Moldova"/>
<path d="M1268 589v8l2 3-1 3-1 2-2-4-1 2 1 4-1 3-2 2v5l-3 8-4 8-4 13-3 8-3 8-4 1-6 3-2-1-5-3-1-3v-6l-1-5-1-5 2-4 2-1v-2l3-5 1-4-1-3-1-5v-5l2-4 1-4h3l3-2 3-1h2l3-4 5-4 2-3v-3l2 1 3-4 1-4 2-3 1 3 2 3z" name="Madagascar"/>
<path d="m449 336h3l-4 5-1 5-2 9-1 3v3l1 3 1 5 3 5v4l2 3 6 2 2 2 5-1 4-1 5-1 3-1 4-3 2-4 1-5 1-2 4-2 6-1h9l1 1-1 3-3 4-2 4 1 1-1 3-2 5-2-2h-2l-2 4-1-1-1 1v1l-5-1h-5l-1 4h-2l1 2 2 2 1 1 1 1-1 2h-7l-3 5v3l-1 2-5-7-3-2-4-2h-4l-4 3h-3l-4-1-4-2-5-2-4-1-6-3-4-3-1-2-3-1-6-2-2-2-5-4-2-4-1-3 2-1v-2l1-1 1-3-2-3v-2l-1-3-4-7-5-5-2-4-4-2v-2l1-4-2-1-3-4v-4l-3-1-2-3-2-3 1-2-2-5v-5l1-2-3-3h-2l-3-1-1 2-1 3-1 5 1 3 3 4 1 2v2h1v5l2 1v2l3 4v6l1 2 1 3v4h3l1 3 2 3-1 1-2 2h-1l-1-4-3-3-3-3-3-2 1-5v-3l-2-2-3-3-1 1-1-2-3-1-2-4v-1l2 1 3-3 1-3-3-4-2-2-1-4-1-4-1-5v-6l7-1h7l-1 1 7 3 11 5h15l1-3h9l1 2 2 2 3 3 1 3v4l2 2 4 2 5-5h5l3 2 1 5 1 3 3 4v5l1 3 4 2z" name="Mexico"/>
<path d="M1106 237h-1l-1 1h-3l-2 1-3 1-3-2-1-3 1-2h1v-1l3-1h1l2-1h2l3 2z" name="Macedonia"/>
<path d="M1010 379v15l-3 4v4l-5 1h-8l-2 3h-7l-2-1-3 1-5 2-1 2-4 3-1 2-2 1-3-1-2 2-1 4-4 6v2l-1 3v3l-2 1-2 1-1-3-1 1h-1l-1 2h-5l-1-1h-1l-2-2 1-1-1-1h-1v-2l1-1-2-3-1-2-1-1h-1l-1 1h-2l-2 2-2-1-2-1-1-1-1 1h-1v-4l-1-2-2-2-1-4v-4l2-1 1-4h2l4 2 3-2 2 1 1-2h22l2-4-1-1-3-28-2-27h8l19 14 19 14 1 3 3 1 3 1v5z" name="Mali"/>
<path d="m1548 364-4 4v3l-3 1-3 3h-4l-2 7-2 1 4 6 4 5 3 4-2 6-2 1 2 3 5 5 1 4v3l2 6-2 6-2 6-1-5 1-5-2-3v-7l-3-4-3-7-2-8-3-6-3 3-6 5-3-1-4-1 1-8-2-6-5-7v-3l-3-1-5-5-1-5 2 1v-5l2-1-1-3 1-2-1-7 5 2 1-6v-3l2-5-1-4 6-4 5 1-2-4 2-1-1-3h3l3 4 2 1 2 5 1 5-5 6 1 7 6-1 2 6 4 2-1 5 5 2 2 1 4-1z" name="Myanmar"/>
<path d="m1091 227-1 2h-2v-1l-2 3 1 2h-2l-1-2-3-2 1-1v-3l2-2h1l1 1 1 1h2z" name="Montenegro"/>
<path d="m1496 182 4-2h11l7 3 5 4h4l7 1 4-2 6-1 4-4h4l3 2h6l1 4v7l3 2 2-1 6 1 2-2 5 2 7 4 1 3-4-1-7 1-2 2-2 4-6 2-3 4-6-2h-4v4l3 2 2 2-3 2-2 4-5 2h-7l-7 2-5 4-3-2h-6l-10-4-5-1-7 1-11-1h-6l-4-4-5-6-4-1-8-4h-7l-6-1-3-3-2-8-6-5-8-2-5-3-4-5 5-1 7-5 6-3 5 2h5l5 3h5l8 2 2-5-4-3 2-7 7 3 4 1 7 1 4 5z" name="Mongolia"/>
<path d="M1167 674h-4l-1-3v-3l-1-3 2-7-1-4-3-9 7-8 1-4 1-1 1-4-1-1 1-5 1-5v-8l-2-2h-3l-1-2-3-1h-5v-7l17-5 3 3 2-1 2 2v2l-1 3v5l4 4 1-5 3-1v-8l-2-5-2-2h-1v-7l1-6 2-1 7 2 2-1h4l2-2h3l6-2 5-4 1 3-1 6 1 6v13l-2 5-2 4-4 4-5 3-6 3-7 7-2 1-4 4-3 2-1 4 3 5 1 4v2h1l-1 6-1 3 1 1-1 3-2 2-5 2-7 4-2 2v3h1z" name="Mozambique"/>
<path d="M959 342h-8l2 27 3 28 1 1-2 4h-22l-1 2-2-1-3 2-4-2h-2l-1 4-2 1-4-4-3-5-4-2-2-2h-3l-3 2-3-1-2 2v-3l1-3 1-6v-7l-1-3 1-3-2-3-2-3 1-2h22l-1-9 1-4h5l1-17 18 1v-10z" name="Mauritania"/>
<path d="M1182 589l2 2 2 5v8l-3 1-1 5-4-4v-5l1-3v-2l-2-2-2 1-3-4-3-1 2-6 2-2-1-6 1-5 1-2-1-5-3-3 6 1 1 2v1l2 4v8l-2 3 2 5-1 3 2 2-1 2 1 1 1-1 2 2v-4z" name="Malawi"/>
<path d="m1564 462 2 1 3 3 3 5v9l1 4 2 2 2 5v3h-4l-5-5-7-5-1-3-3-4-1-6-2-3v-5l-1-3 1-1 4 3 1 3h4zM1654 475l-5-1h-6l-2 8-2 2-3 9-4 1-6-2-2 1-4 3h-3l-4 1-4-4-1-4 4 2 5-1 1-5 2-2 7-1 4-5 2-4 3 3 1-2h3v-7l4-5 3-5h2l3 4v2l4 2 5 2v3h-4l1 3z" name="Malaysia"/>
<path d="m1116 614 5-1h3l3 2-4 2h-1l-4 2-2-3-9 3h-4l-1 23h-5l-1 19-1 23-5 4h-3l-3-1h-3l-1-3-2-2-2 3-4-5-2-4-1-7-1-4-2-10v-8l-1-3-2-3-2-5-3-8-1-4-5-6v-5l3-1 3-1h4l3 3 1-1h22l4 3 14 1z" name="Namibia"/>
<path d="m1069 355 1 10 2 2v2l3 2-1 3-2 13v8l-7 6-3 9 3 2v4h3v3l-2 1v2h-1l-4-7h-1l-4 3-5-2h-3l-1 1h-4l-3 2-3 1-7-4-2 2h-3l-2-3-6-2-6 1-2 1v4l-2 2v6l-5-4h-2l-2 2 1-4-7-2v-3l-3-4-1-3v-3h4l2-3h8l5-1v-4l3-4v-15l8-3 16-13 19-12 9 3 3 3z" name="Niger"/>
<path d="m1066 422 3 2-1 1v2l-5 6-1 4-1 3-1 1-2 5-3 3v3l-2 2v3l-4 2-3-2h-2l-4 3h-1l-3 7-1 4-6 3-3-1-2 2h-4l-3-5-2-4-4-4h-9v-15l1-4 1-2 3-4v-2l1-2-2-4 1-2v-6l2-2v-4l2-1 6-1 6 2 2 3h3l2-2 7 3h3l3-2h4l1-1h3l5 2 4-4 1 1z" name="Nigeria"/>
<path d="M520 406v4l-1 2-1 3-1 2v5l-1 1v4l-1 2v2l1 1-2 1h-1l-1-2h-3l-4-1-1 1-2-2-2-3-1-2-3-2-2-3 1-1v1l1-1h2l1-1 1-4h2l2-1 1 1 1-1 1-1 2-1v-2h1l1-1 1 1h1l1-1h2l2-1 1-1z" name="Nicaragua"/>
<path d="m1114 68-7 2h-3l1-4-6-2-6 2-1 4-3 2-5-1h-5l-5-2-3 1h-2v4l-8-1-1 3h-4l-2 4-3 6-6 8 2 2-2 2h-4l-2 5 1 8 3 3-1 7-3 4-2 3-3-3-9 6-6 2-7-3-1-6-2-14 4-4 11-5 8-5 7-8 9-11 6-4 11-7 8-2h7l5-4h8l7-1 13 4-5 1zM1077 25l-8 2-7-1 2-1-2-2 7-1 2 2zM1051 17l13 3-9 2-1 3-3 1-1 4h-4l-9-2 3-2-6-2-7-3-4-4 10-2 2 2h5l1-2h5zM1075 14l8 1-5 3h-10l-10-1-1-1h-5l-5-2 11-1 5 1 3-1z" name="Norway"/>
<path d="M1469 323v3l2 4v2h-5l-7-1-4-1-4-3-8-1-7-3-6-4-6-2 1-6 3-3 2-1 4 2 7 4 3 1 3 3 4 1 5 3 7 1z" name="Nepal"/>
<path d="m1284 395-2-5-6-10 17-7 2-12-3-5v-3l2-2-1-3 3-1-1-1v-4h3l3 4 3 3h4l3 2 3 3 2 2 2 1v2l-2 3v2l-2 2-2 5-3-1-1 2v3l1 4-1 1h-2l-4 3v3l-1 1h-4l-2 2 1 2-3 2-3-1-4 3zM1296 337l-1-2 1-3 1 1v3z" name="Oman"/>
<path d="m1402 274-4 5-6 1-8-1-2 2 3 6 3 4 5 4-4 3 1 5-4 6-2 7-5 7-6-1-5 7 4 3 1 5 4 3 2 5h-12l-4 5-4-2-2-5-5-4-10 1h-9l-7 1 1-8 7-3-1-3-2-1-1-6-6-2-3-4-3-4 9 4 6-1h3l1-1 4 1 7-3-1-5 2-4h4v-2l4-1 2 1 2-2-1-4 2-4 3-1-3-5 5 1 1-3-1-2 2-3-2-3-1-3 2-3 5-1 6-1 3-1 2-1 5 3 3 5z" name="Pakistan"/>
<path d="m549 446v1l1 4-1 2-2-1-1 3-2-1-1-4 2-2h-2l-1-2-3-2h-2l-1 3-3 1h-1v2l2 3-2 1v1h-3l-1-3-1 1-1-1-1-2-3-1h-4v1-5l1-1h-1v-3l2-1 2 3v1h3l1 1h3l3-2 3-1 2-2h3v1h3l3 1 1 2z" name="Panama"/>
<path d="M591 529h-6v1l-5 1-6 5-1 3-1 2 1 3-4 2 1 3-2 1 3 6 3 4-1 3h4l2 3h5l4-3 1 9 2 1 3-1 6 10-1 3v10l-2 3 1 2-1 2 3 6-3 7-1 3-3 2-6-4v-3l-12-6-11-7-4-4-3-5 1-2-6-9-6-12-6-12-3-3-2-5-4-4-4-3 1-3-3-6 2-4 4-4 1 2-1 2v2h4l3 4 3-3 1-4 3-6 7-2 6-7 2-4-1-5 2-1 3 3 2 3 3 2 3 7h4l4-1 2 1 3-1 4 3-3 7h2z" name="Peru"/>
<path d="m1701 448v4l1 4-2 6-2-7-2 3 2 5-2 3-7-4-2-4 2-3-4-3-1 2h-3l-4 4-1-2 2-6 3-2 3-2 2 3 4-2 1-3h4l-1-5 5 3 1 3zM1686 436l-2 2-1 4-2 2-4-4 1-2 2-2v-4h3l-1 4 4-6zM1656 442l-7 6 2-4 4-4 3-5 2-6 2 5-4 4zM1673 426l4 2h3v2l-2 3-3 2-1-3v-3zM1693 424l3 7-5-2v2l2 4-2 2-1-5h-2l-1-4 3 1v-3l-4-5h5zM1670 418l-1 6-2-4-4-5 5 1zM1664 383l4 2 1-2 1 2-1 3 3 4-1 5-3 3v5l2 5 3 1 3-1 7 3v4l2 1v3l-5-3-2-3-1 2-4-4-5 1-3-1-1-3 2-1-2-2v2l-4-3-1-3-1-6 3 2-1-10v-6z" name="Philippines"/>
<path d="M1783 560l2-21 1-20 9 4 10 4 4 3 3 3 1 4 9 4 1 3-5 1 1 4 4 5 3 6h4l-1 3 4 1-1 1 5 3-1 2h-3l-2-1-4-1-6-1-4-4-3-4-2-5-7-3-5 2-4 2v5l-4 2-3-1z" name="Papua New Guinea"/>
<path d="m1080 155 6 1 9-1 2 1 2 2v3l2 2v2l-3 2 2 3 1 2 3 6v1l-3 1-3 5 1 3h-1l-5-3-3 1h-3l-3 1-2-2-2 1v-1l-3-3h-4v-2l-4-1v2l-3-2v-1l-4-1-2-2-3-4 1-2-2-3-2-2 1-2-1-3 3-2 7-3 6-2 5 1v2z" name="Poland"/>
<path d="m1660 230 2 1-1 2-1 2 3 4-2 2v1l-1 2-3 1-1 2 1 2v1l2 1 5 3v1l-2 1h-4l-1 3h-2l-3-1v2h-2v-1l-2-1-2-1v-3h1l-1-2v-3l-1-1-4-1-3-1 2-5 4-3 1-5 4 3h4l-3-4 7-2v-4z" name="Dem. Rep. Korea"/>
<path d="m663 631 2 4v9l6 1 2-1 4 1 1 2 1 6 1 3h2l2-1 2 1 1 4-1 3v4l-1 6-4 5-4 1-7-1-5-2 4-10-1-3-6-2-7-5-5-1-11-10 1-8v-3l2-6 10-2h5l5 3z" name="Paraguay"/>
<path d="M1270 344h-1l-2-1-1-5 1-3 2-1 1 2 1 4z" name="Qatar"/>
<path d="m1119 193 2 1 1 2 2 2 4 4v5l1 3 3 1 2-1 2 1 1 2-2 1h-2v8l-3-1-4-2-6 1-3 2-7-1-4-1-2 1-2-3-1-1 1-1-1-1-2 2-3-2-1-3-3-1-1-2-3-3 4-1 3-4 2-4 3-2 2-1 3 1h3l3 1 1-1h4l1-2z" name="Romania"/>
<path d="m1159 509 2 4v4h-5l-2 4-3-1v-3l1-1v-4l2-2 1 1z" name="Rwanda"/>
<path d="M939 324v1l-1 10-18-1v17h-5l-1 4v9h-21l-2 2 1-3h12l1-2 2-3 2-9 8-7 3-8 2-1 2-5h9l2-1h3v-4z" name="Western Sahara"/>
<path d="m1241 315 5 1 1 3h4l3 5 3 2 1 2 4 3 1 2-1 2 1 2 2 2 1 2 1 2 2 1h1l1 2 1 2 2 6 17 3 1-1 3 5-2 12-17 7-15 2-5 3-4 7-3 1-1-2h-8l-1-1h-6l-2 1-2-2-1 3v3l-2 2-1-3-2-2v-2l-3-3-4-5-1-5-5-5-2-1-4-6-1-4v-4l-4-7-2-3-3-1-3-4 1-1-2-4-2-1-2-5-4-5-3-4h-3l1-4v-5l6 1 2-2 1-2 5-1v-2l2-1-6-6 10-4 1-1 7 2 9 5 16 13z" name="Saudi Arabia"/>
<path d="m1191 409-1 6-2 6-3 3-2 5-1 3-2 2-2 6v1h-1v-5l-3-3-1-5v-4l-2-1-1 2h-3l1 2 1 4-3 3-3 5-3 1-4-4-3 1v2l-3 1v2h-6l-1-2h-4l-2 1h-1l-3-4-1-2-4 1-2 3-1 6-2 1-2 1v-1l-2-2-1-2 1-2v-3l-3-4-1-3v-1l-2-2v-4l-1-2h-2v-2l2-3-1-3 2-2-1-1 1-4 2-5 5 1-1-26v-3h7l-1-12h66l2 6-1 1 1 7 3 7 2 2 3 2-3 4-4 1-1 2-1 4-2 10z" name="Sudan"/>
<path d="M1178 441v5l-1 2h-2l-2 4h3l3 3 1 3 3 2 3 7-4 4-3 4-4 3h-4l-4 1-4-1-2 1-5-4-1-3-4 2-2-1-2 1h-2l-4-6-1-2-4-2-1-4-3-3-4-3v-2l-3-3-4-2 2-1 2-1 1-6 2-3 4-1 1 2 3 4h1l2-1h4l1 2h6v-2l3-1v-2l3-1 4 4 3-1 3-5 3-3-1-4-1-2h3l1-2 2 1v4l1 5 3 3v5z" name="South Sudan"/>
<path d="M918 408v4l1 4 2 1 1 3v2h-5l-1 1-4-2h-17l-3 1v-5h7l2-2 3 1 2 1 3-2-2-2-1 1h-2l-2-1h-2l-1 1-7 1-2-5-3-3 3-1 3-4 1-4 2-2 3 1 3-2h3l2 2 4 2 3 5z" name="Senegal"/>
<path d="m929 448-3 3-3 3v2l-1 2h-2l-4-3-3-3-1-3v-4l3-3v-2l1-1h2l1-2h5l1 3 1 2v2l1 2v2z" name="Sierra Leone"/>
<path d="m493 416-1 1h-5l-3-2h-3l-1-1v-1l2-2 1-1 1-1 2 1 1 1 2 1v1l2-1 2 1z" name="El Salvador"/>
<path d="m1102 218-1 2 1 2 2 3-1 2-1 2h1l-1 1-2 1h-2l-1-1h1v-2l-1-1h-1l-1-1-1-1-1-1-1 1v2h-1l-2-2h-2l-1-1-1-1 1-1v-2l-2-3 1-3h-2l2-2-2-2-2-2 4-2h3l3 3 1 2 3 1 1 3 3 2 2-2 1 1-1 1z" name="Serbia"/>
<path d="m681 465-3 5v5l2 4-1 2v3l-2 3-3-1h-5l-1 2 1 1v1h-3l-4-6v-4h-2l-2-4 1-4-1-1 4-2 1-6 7 2v-1l5-1z" name="Suriname"/>
<path d="m1098 188-1 1-1 3h-1l-5-1h-2l-1 1-2 1h-1l-2 1h-2v1l-4 1-2-1-3-1-1-2 1-1v-2h4v-1h1v-1l1-1 1-1h1l1 1 2-1 2 2 3-1h3l3-1z" name="Slovakia"/>
<path d="m1070 204-4 2v2l-2 1v1h-2l-2-1-1 1h-2l-2-3 1-3h4l2-1h5l1-1h1z" name="Slovenia"/>
<path d="m1088 87-7 2-3 3 1 4-6 5-8 5-2 8 4 4 4 3-3 7-4 1-1 10-2 6-6-1-2 5h-6l-1-6-5-6-4-9 2-3 3-4 1-7-3-3-1-8 2-5h4l2-2-2-2 6-8 3-6 2-4h4l1-3 8 1v-4h2l6 3 8 3 1 9z" name="Sweden"/>
<path d="m1162 668v3l1 3-2 2-3 1-3-3v-3l2-2v-2h2z" name="Swaziland"/>
<path d="m1195 288-10 6-6-2 1-1-1-3 1-3 3-3-1-2-3-1-1-5 1-2 1-2 1-1v-3l2 1 6-2 3 1h4l6-2h3l6-1-2 4-3 1 1 5-1 8z" name="Syria"/>
<path d="m1119 376 1 26-5-1-2 5-1 4 1 1-2 2 1 3-2 3v2h2l1 2v4l2 2v1l-3 1-3 3-4 7-5 3h-7v2l-3 3-2 2-7 3-2-2h-1l-1 2h-4l1-2-2-4-1-3-2-1-4-3 1-3h8l-4-6 1-4-1-5-2-4v-3h-3v-4l-3-2 3-9 7-6v-8l2-13 1-3-3-2v-2l-2-2-1-10 5-3 23 12z" name="Chad"/>
<path d="m991 431v4l1 1 2 3 1 3 1 1v15l1 4-5 2-1-3-1-4-1-3 1-6-1-2-1-5v-5l-2-3 1-2z" name="Togo"/>
<path d="m1578 410-6-1-7 2-3 5 2 8-5-3h-5v-5h-5l1 7-3 9-1 6 1 4 3 1 3 6 1 5 4 4h3l3 4-1 2-4 1-1-3-4-3-1 1-3-2-1-3-3-4-3-3-1 4-1-4v-4l2-6 2-7 2-6-2-5v-3l-1-4-5-5-2-3 2-2 2-5-3-4-4-5-4-6 2-1 2-7h4l3-3 3-1 2 2 1 4h4v7l1 5 5-3 2 1 3-1 1-2 4 1 5 5 1 6 6 6v5z" name="Thailand"/>
<path d="m1357 244-1 1h-6v3h6l7 2 9-1 3 6 2-1 4 2v2l2 4h-5l-4-1-3 3-2 1-1 1-3-2-1-6h-2v-2l-3-1-2 2 1 3-1 1-3-1-1 3-2-1-4 2-1-1 1-6-3-5-4-1 1-3h4l2-3v-5l7-1v3l1 2z" name="Tajikistan"/>
<path d="M1338 262h-1l-3-2-1 2-4 2v5l-2 2-4 1v3h-4l-6-2-2-5-4-1-7-5-5-1-6-3-4-1-2 1h-4l-3 4-4 1-2-5-1-6-4-2v-5h-3v-6l5 2 4-2-5-4-2-3-4 1 1 5-3-4 2-2 5-2 4 2 5 5h9l-2-4 4-2 3-3 8 3 2 5 2 1h6l2 1 4 7 7 4 4 3 7 3 7 3z" name="Turkmenistan"/>
<path d="M1048 289v5l-2 2-2 2-4 2 1 3v3l-3 1-3-11-3-3v-1l-5-4v-5l3-4 1-5-1-6 1-3 6-3 3 1v3l5-2v1l-2 3v3l2 2-1 5-3 3 1 4h3l1 3z" name="Tunisia"/>
<path d="M1202 235h5l6 3 1 2v4l4 1 3 2-3 2 2 7v2l4 5-3 1-2-1-6-1-2 1-6 1h-3l-6 2h-4l-3-1-6 2-2-1v3l-1 1-1 2-2-3 1-2h-3l-4-1-4 3-8 1-4-3-6-1-1 3-4 1-5-4-6 1-4-7-4-3 2-5-3-3 5-7h8l1-5 10 1 6-4 6-2h8l10 5 8 2 6-1 4 1zM1122 240l1-1 1-4-2-1 5-2h4l1 3 5 2-1 1-6 1-2 2-4 3-2-3z" name="Turkey"/>
<path d="m1658 356-1 5-4-6-2-4 2-7 3-5 3 2v4z" name="Taiwan"/>
<path d="M1167 508v4l-1 5 1 2 3-1 3-1 1 1 3-1-2-3 2-3 3-2 20 13v3l8 7-2 8v3l3 3 1 1-2 4v5l2 4 2 7 2 1-5 4-6 2h-3l-3 2h-3l-2 1-7-2h-2l-2-2v-7l-3-3v1l-1-2-6-1-3-2-3-1-3-1-3-7v-4l-5-4 2-3-1-2v-3l-1-1v-3h1l2-2 2-3 2-2v-2l-2-1v-3h2v-4l-2-4 2-1z" name="Tanzania"/>
<path d="m1179 475 3 4v3l3 8-2 4-3 4-1 3h-1l-3-1-2 1-4 1-2 4v2h-6l-2 1-4 2-1-1v-4l1-3 1-5 1-3 2-3 2-2 2-2-2-1v-8l2-2 4 2 4-2h4z" name="Uganda"/>
<path d="m1157 175 3 2v1l6 3 4-1 3 3 3-1 8 2v2l-1 4 2 3v2l-5 1-2 1v3l-4 1-3 2h-4l-4 2 1 4 2 2 6-1-1 3-5 1-7 3-3-1 1-3-6-2 1-1 4-2-1-1-9-2v-2h-5l-1 4-3 4-3-1-2 1-3-1h2v-3l1-2v-1h1v1h3l2-1h-1v-1l-2-2-1-2-2-1v-2l-3-2h-2l-4-2h-3l-1 1h-2l-1 2h-4l-1 1-3-1h-3l-3-1-2 1-1-1-3-2 1-3 1-1h1l-1-3 3-5 3-1v-1l-3-6h2l3-2h3l5 1 6 1h4l2 1 1-1 2 2 4-1 2 1v-3l1-2h6l1-1h7l3 3v3z" name="Ukraine"/>
<path d="m700 719-2 4-5 3-4-1-3 1-6-3h-3l-4-3-1-5 1-1-1-6v-7l1-5 3-1 7 5h1l7 4 5 4 3 4-1 3z" name="Uruguay"/>
<path d="M1353 231h1l-3 4 5 3 3-2 7 4-5 4h-6l-1-2v-3l-7 2v4l-2 3h-4l-1 3 5 1 2 5-1 6-5-1h-3v-4l-8-3-6-3-5-3-7-4-4-7-2-1h-6l-2-1-2-5-8-3-3 3-4 3 2 3h-6l-6-24 12-3h1l9 5 5 2 6 6 6-1 9-1 7 5 2 6h2l3 6h7l2 3h2l1-5 5-4z" name="Uzbekistan"/>
<path d="m649 448-5 4v2l1 3-1 1-4 1v3l-1 2 3 4 1 2-2 3-6 2-4 1-2 2-5-2-4-1-1 1 3 1-1 5 1 4h5v2l-4 2-1 2-2 1-4 2-1 2h-5l-3-3-1-7-2-2-2-1 3-3v-2l-2-2-1-4 1-5 1-2 1-3-2-1h-7l-2 1-4-6-3-1-8 1-1-2-1-1v-6l-1-2-1-2-3-1 2-4 1-4 2-3 2-1 2-4 3-1v2l-3 1 1 2v4l-3 4 2 5 3-1 1-4-1-3v-5l7-2-1-3 2-2 2 4h4l3 4 1 2h11l3 2 4 1 3-2v-1l8-1h6l-5 2 2 3h5l4 4 1 5h3z" name="Venezuela"/>
<path d="m1587 364-7 5-4 6v5l5 6 7 9 5 4 4 5 4 12 1 11-5 4-6 4-4 6-6 6-3-5 1-4-4-4 5-2 6-1-3-3 9-5v-8l-2-4v-7l-2-4-5-5-4-5-6-8-7-4 1-2 3-2-3-6h-7l-3-5-4-5 3-2h4l5-1 4-3 4 2 5 1v4l3 3z" name="Vietnam"/>
<path d="m1284 395-4 2-1 2v3l-6 2-8 3-5 5h-4l-3 3-4 1h-6l-1 2-2 1v1h-3l-2 1h-4l-2-4v-4l-1-2-1-4-2-3h1v-7l2-2v-3l1-3 2 2 2-1h7l6 1h2l1 2 3-1 3-7 5-3 16-2 6 10z" name="Yemen"/>
<path d="m1162 557 3 1 3 1 3 2 3 3 1 5-1 2-1 5 1 6-2 2-2 6 3 2-17 5v4l-4 1-3 3-1 2-2 1-5 5-3 4h-2l-2-1h-6l-1-1-3-2h-3l-5 1-3-4-4-5 1-20h12l-1-2 1-3-1-3 1-3-1-2h2v2h3l4 1 2 3h4l3-2 2 4 4 1 2 2 2 4h4v-7l-1 1-4-2-2-1 1-7 1-7-1-3 2-4 1-1 8-1h1v1l1 1 2 1z" name="Zambia"/>
<path d="m1159 645-2-1-2 1-3-1h-2l-4-3-4-1-2-4 1-3h-3l-6-7-1-4-2-1-1-5h6l2 1h1l4-4 5-5 2-1 1-2 3-3 4-1v3h5l3 1 1 2h2l3 2v8l-1 5-1 4 1 2-1 4-1 1-1 4z" name="Zimbabwe"/>
<path d="m1222 513-3-6v-23l4-7 2-2h4l5-5h7l15-20h-4l-19-7-2-2-2-4-3-3 2-2 1-4 2 1 2 3 2 3h3l5-2 6-1 5-2h3l2-1h3l2-1 3-1h3l2-2h2v9l-1 2-1 7-3 7-3 8-5 10-4 7-7 8-5 6-9 6-5 5-6 8-2 3z" name="Somalia"/>
<path d="M1098 231h-1l-3 1v1h-1l-1-2-1-1-1-1 1-2h1v-2l1-1 1 1 1 1 1 1h1l1 1v2z" name="Kosovo"/>
<path d="m1159 645 3 9 1 4-2 7 1 3-3-1h-2v2l-2 2v2l3 4 3-1 2-3 4 1-2 4-1 6-2 2-4 4-1 1-2 3-2 3-4 5-6 6-4 4-5 3-6 3h-2l-1 2-3-1-3 1-6-1-3 1-2-1-6 3-5 1-3 2h-3l-2-2h-2l-2-3v1l-1-2 1-4-2-4 2-1v-5l-3-6-3-5-3-9 3-3 2 2v3h3l3 1h3l5-4 1-23 2 1 3 6-1 4 1 2 4-1 3-3 3-1 1-4 3-1 2 1 3 2h4l4-2v-2l2-3h3l1-3 2-4 6-5 8-4h2l3 1 1-1zm-20 53 1-2 3-1 1-2 2-3-1-2-3-2-2 1-3 3-4 4 4 5z" name="South Africa"/>
<path d="m1886 764-1 3 6-3v3l-3 3-4 3-7 4-5 3v3h-4l-6 3-5 4-8 6-7 3-4 2h-4l-2-3h-5l1-2 7-5 11-6 4-1 6-3 7-3 6-3 6-5 3-2 3-3 6-3zM1915 734v7l3-5 1 2-2 5 3 2 3 1 4-3 3 1-6 6-4 3h-4l-2 2-2 3-2 1-4 3-6 5-6 2v-1l-1-1 7-5 1-4-4-3 2-2 5-2 4-5 3-4v-4l1-2-1-2v-10l2-1 1 4 3 1z" name="New Zealand"/>
<path d="m655 838 6 14h8v2l-4 2h-2l-3-1-4-1-6-1-7-4-7-3-9-7 4 1 9 5 7 2 1-3v-4l3-3z" name="Chile"/>
<path d="m614 648 1 1-1 7-5 3 1 11-1 2 2 3-3 4-3 6v5l1 7-2 6 5 11 2 2 1 5-2 7 2 5-3 4 1 6 4 6-3 3v5l1 7 4 8-2 1 4 7 3 3-1 2 3 2 1 2-2 1 2 4 1 8-1 6 2 3v4l-3 2 4 7 2 2h3l2 4 4 4 12 1 5 1h-5l-1 1-4 3 2 5h-2l-6-2-8-4-7-3-4-4v-4l-4-4-5-11v-6l3-4-8-2 3-6-2-10 6 2-2-13-4-2 1 8-3-1-2-9-2-12 1-4-3-6-2-8h2v-10l2-10v-10l-4-10 1-5-2-8 2-8-1-12v-28l-2-10-2-9 3-2 1-3 3 4 2 5 3 2-1 7 3 7 4 9z" name="Chile"/>
<path d="m1017 177-3-1-3-3-5 1h-3l2-2 4-9 7-3 4 1v2l-1 5-1 3h-3z" name="Netherlands"/>
<path d="m947 264-2 1-3-1-3 1 1-5v-4h-3l-1-3 1-4 2-2 1-3 1-4v-2l-1-3v-2l2-1 2-1 1 3h3l1-1h3l1 3-2 2v5l-1 1-1 3-2 1 2 3-1 5 1 1v2l-2 2z" name="Portugal"/>
<path d="m1690 177 13 11-9-2 4 9 10 7 3 4-7-4v5l-4-5-4-6-6-7-2-5-7-8-8-6-6-8 1-3-4-3 1-1 5 4 7 6 5 6zM1095 155l-9 1-6-1 1-3 6-2 5 1 2 1v2zM1548 48h-14l-1-1v-2h5l8 2zM1561 39l-1 2-7-1-10-2-2-1h8zM1536 36l3 4h-15l-4 1-13-3-3-4h14zM1219 61l-2 1-14-1-2-2-8-2-2-3 3-1-1-2 5-5h-4l7-5-3-2 7-3 11-3 11-1 5-2h7l4 2-1 1-12 3-9 2-9 5-3 5-3 5 3 4z" name="Russian Federation"/>
<path d="m1662 231-2-1-2-3h3l-4-8-5-5 3-3 7 2v-7l-3-6v-3l-1-5-7 1-3 3h-7l-6-6-9-4-10-2-7-6-4-4-4-3-8-6-6-2-8-2h-6l-5 1-2 3 4 2 2 3-1 2v6l2 3-5 4-7-2h-6l-3-2h-4l-4 4-6 1-4 2-7-1h-4l-5-4-7-3h-11l-4 2-8-3-4-5-7-1-4-1-7-3-2 7 4 3-2 5-8-2h-5l-5-3h-5l-5-2-6 3-7 5-5 1-1 1-5-4-6 1-3-3-4-1-4-3-3-2-7 2-8-3-1 3-18-16-9-5 1-2-9 6-5 1-1-4-7-2-4 2-5-7-9-1-3 3-11 2-1 1-17 2-2 3 5 4-4 1 2 2-4 3 10 4v3h-7l-1 2-8-3h-7l-5 2-6-2-12-5-8 1-8 6 1 5-6-4-3 7 2 1-1 5 5 4h3l5 4v4l3 1-2 3-4 1-4 7 6 6 1 4 7 8-3 2v2l-3-1-4-3-1-1-4-1-2-3-5-1-3 1-1-1-8-3-8-1-4-1h-1l-7-5-6-2-6-4 4-1 3-5-3-3 7-2-1-2-4 1v-3l2-1 5-1v-2l-2-3 2-4-1-1-8-2h-2l-4-3-4 1-6-2v-2l-3-2-4-1v-3l-3-3h-7l-1 1h-2l-2-4-1-2h5l1-2-1-1-4-1v-1l-2-1-4-4 1-2-1-3-5-1h-2l-1-1-6-2-2-3-1-3-2-1 1-2-2-6 3-3-1-1 4-4-5-2 8-8 3-3 1-3-7-4 1-4-5-4 1-5-6-6 3-4-7-4-1-4h3l7-2 3-2 8 3 12 1 18 6 4 3 1 4-4 3-6 1-20-4-3 1 8 4 1 2 2 6 6 2 4 1v-3l-4-2 2-2 12 3 3-1-4-4 8-6 4 1 5 2 1-4-5-3 1-4-5-3 13 2 3 3h-5l1 3 5 2 6-1-1-3 8-3 12-5 3 1-2 3h5l2-1 8-1 5-2 7 3 2-3-6-3 2-2 13 2 6 1 19 6 1-2-6-3-1-1-5-1v-2l-5-5-1-1 4-5v-5l2-1 11 2 3 2-1 5 4 1 4 4 3 7 7 4 1 3-4 8 5 1 1-2 4-1-1-3 2-3-4-3-1-3-4-1-3-3-1-5-8-5 5-3-4-4h2l4 3 2 5 5 1-4-4 5-2h8l9 3-6-4-5-6 6-1h17l-6-3 2-3 4-1 5-2 9-1v-1h9l4 1 6-3h7l-2-2 1-2 6-2 9 2-4 1h10l4 3 2-1h10l12 2 6 2 2 3-2 1-7 3-1 1 6 1 7 1 2-1 6 4v-2h19l4 3 17 1-5-4 10 1 6-1 10 3 6 3v3l10 4 9 2-3-6 10 3 5-2 10 2 1-1h7l-9-5 2-2 40 4 8 3 16 4 15-1 10 1 6 2 5 4 8 1 3-1h7l10 1 7-1 14 5 2-2-8-3-2-2 15 1h8l16 2 10 3 33 22-2 2h-6l8 3 9 5 4 1 4 3 1 1-10-1-7 4-3 1-1 4-2 4 2 2-12-4-6 5-5-2-1 2-7-1 3 4 1 6 3 2 7 2 9 8-4 1 3 5 5 2-5 3 5 7-5 2 4 6-2 6-5-4-11-9-16-14-7-8 1-4-3-3 5-1v-7l1-6 2-5-6-8h-5l3 5-3 6-13-7-9 2v10l8 4-8 1-7 1-4-5h-8l-3 2-15-1-13 2-3 12-5 14 8 1 5 4 6 1 1-3h5l13 7 5 5 1 6 6 8 5 10-1 9 1 4-2 8-2 7-1 4-4 3h-3l-6-3-4 5zM1367 23l-18 2-1-6 2-1 3 1 13 2zM1165 13l-4 1h-3v1h-4l-4-1 1-1h-8l6-1h5l2 1 1-1h9zM1345 20l-7 1-12-1-8-2-6-3-6-1 5-3 6-1 10 2 14 4z" name="Russian Federation"/>
<path d="m977 223 2 3 9 3 2-2 6 3 6-1v4l-5 4-6 2-1 2-3 3-2 5 2 4-3 3-1 4-4 1-4 5h-12l-3 3-2 2-3-1-2-2-1-3-5-1-1-3 2-2 1-2-2-2 2-4-2-4h2l1-3v-1l1-5 2-2-1-3h-3l-1 1h-3l-1-3-3 1-1 1v-4l-2-3 7-5 7 1h7l5 2 4-1z" name="Spain"/>
<path d="m1036 231-2 5-2-1-1-4v-3l4-2zM1014 185l2 1 1-1 2 2 8 1-3 4v5l-2 1-2-1v2l-3 4v2l2-1 2 3v2l1 2-1 2 1 5 3 1-1 3-4 3-10-1-8 2v3l-6 1-6-3-2 2-9-3-2-3 2-3 1-13-5-7-3-3-8-2v-5l6-1 8 2-1-8 5 3 11-5 1-5 5-1v2h3l2 3 4 3 2-1z" name="France"/>
<path d="m540 195-7 2-4 2-5 3v1l5-2 2 2 5-1 5-2 5-2-3 3 3 1 2 2 5-1 5-1 1 2h1l1 1 2 2-5 1-4-1-4 1-4 1-4 4-3 2v1l5-4h1l-5 5-2 4-3 4-1 3v1l-1 2v4h2l2-1 1-1 4-3 1-4v-4l2-3 2-3 2-2 3-2v3l2-4h1l2-3 4 2 2 2v3l-2 3-4 2v2h1l4-3 2 1-1 4v2l-4 4-2 2-3 2 3 2h2l4-1 4-2h3l5-2 5-4 1-1v-2h10l5-2 1-2-1-1 7-4 3-2h17l1-1h2l2-1 3-3 3-5 6-5 1 2 4-1 1 1-3 9 3 4v2l-7 3-6 2-6 2-4 4-1 1-1 3 1 4h2v-2l1 1-1 2-4 1h-2l-5 1h-5l-5 2 8-1 1 1-8 2h-3v-1l-2 2h2l-3 5-5 5v-2h-1l-1-2v4l1 1-1 2-2 3-5 5 3-5-2-2 1-5-2 2v4l-3-1 3 2-2 7h2v2l-1 7-5 4-6 2-5 4h-2l-4 3-1 2-7 4-4 3-3 4-2 5v10l2 4-1 3 2 7-1 5-1 2-2 4-2 1-2-1-1-3-1-1-2-6-2-5v-2l2-4-1-4-3-5-2-1-6 3-1-1-2-3-3-1-7 1-4-1h-5l-2 1 1 2-1 3 1 1-2 1-1-1-3 1h-4l-3-4-5 1-3-1h-4l-5 2-6 4-6 3-4 3-2 3-1 5v3l1 2h-3l-3-1-4-2-1-3v-5l-3-4-1-3-1-5-3-2h-5l-5 5-4-2-2-2v-4l-1-3-3-3-2-2-1-2h-9l-1 3h-15l-11-5-7-3 1-1h-7l-7 1 1-3-2-4-3-1v-2h-2l-2-2h-4l-1-1v-4l-2-6-1-9 1-2-1-2-1-5 1-5-1-4 4-5 3-6 1-4 6-6 4-6 4-6 4-8 2-6v-3l2-1 5 2-1 6 3-1 2-6 2-5h137l1-2h2l-1 3 1 1 3 1 5 1 4 2 4-1zM275 139l-7 2-1-2 3-2 6-3h6v2zM236 122l-4 1-2-1v-2l5-1 3 1zM237 100l1 1 4-1 2 2h3l-1 1-5 1-2-1v-1h-5z" name="United States"/>
<path d="m410 67-25 20-35 33h4l3 2v2l1 4 7-3 7-2-1 3 1 2 2 3-2 4-1 7 5 4-4 4-5 3v-3l-3-2 4-5-2-5 3-5-4-1h-8l-3-2-4-6-3-1-6-2-6 1-6-3-3-3-6 2-4 4h-3l-6 1-7 2-6 2 3-4 9-6 6-2 1-1-10 3-7 4-11 4v3l-9 4-8 3-6 2-4 2-11 4-4 2-9 3h-2l-7 1-7 2-6 2-10 2 1-1 8-3 7-2 8-3 7-1 5-2 10-4 2-1 6-2 6-5 6-3-7 2-1-1-4 2v-3l-4 2 2-3-7 2h-3l4-3 3-2-1-2-7 1v-3l-2-1 4-4v-2l6-4 8-3 5-3h4l2 1 7-3h2l6-1 2-3-1-1 6-2h-2l-7 1-3 1-1-1-7 1-5-2 1-2-1-3 10-2 13-3h3l-4 3 9-1 1-3-2-2 1-3-1-2-3-2 6-3h8l9-2 4-3 8-3h5l11-3 3 1 11-3 4 1v2l3-1 6 1-2 1 5 1 5-1 6 2 8 1h2l6-1 5 2z" name="United States"/>
<path d="m677 487 2-3v-3l1-2-2-4v-5l3-5 2 1 4 1 6 6 1 2-4 6-2 5-2 2-2 1-1-2h-2l-1 1z" name="French Guiana"/>
<path d="m888 323h-1zM902 321v1l-1 1h-1v-1l-1-1 2-1h2zM898 318h-1v1l-1 1h-1v1h-1l-1-1v-1h2v-1h1zM908 321v-1h1l-1-1 1-1v-1l1 1v2h-1v1zM913 315h-1l-1 1v-2h2z" name="Canary Islands"/>
<path d="m1295 636v1h1v1l-1 1h-1l-1-1-1-1 1-1h1" name="Reunion"/>
</g></svg>
          <div class="map-pins"><button class="wp rk" data-m="US" style="left:21.947%;top:27.131%;--s:18px" title="United States &middot; 6 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">6</span><span class="wp-l">US <em>United States</em></span></button><button class="wp ok" data-m="CA" style="left:19.936%;top:14.225%;--s:14px" title="Canada &middot; 2 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">2</span><span class="wp-l">CA <em>Canada</em></span></button><button class="wp ok" data-m="BR" style="left:34.411%;top:65.848%;--s:15px" title="Brazil &middot; 3 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">3</span><span class="wp-l">BR <em>Brazil</em></span></button><button class="wp rk" data-m="UK" style="left:47.975%;top:17.041%;--s:17px" title="United Kingdom &middot; 5 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">5</span><span class="wp-l">UK <em>United Kingdom</em></span></button><button class="wp rk" data-m="ES" style="left:47.358%;top:26.583%;--s:17px" title="Spain &middot; 5 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">5</span><span class="wp-l">ES <em>Spain</em></span></button><button class="wp ct" data-m="FR" style="left:49.020%;top:21.421%;--s:17px" title="France &middot; 5 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">5</span><span class="wp-l">FR <em>France</em></span></button><button class="wp ct" data-m="DE" style="left:51.111%;top:18.136%;--s:18px" title="Germany &middot; 6 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">6</span><span class="wp-l">DE <em>Germany</em></span></button><button class="wp rk" data-m="IT" style="left:51.727%;top:24.550%;--s:15px" title="Italy &middot; 3 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">3</span><span class="wp-l">IT <em>Italy</em></span></button><button class="wp ok" data-m="IN" style="left:69.526%;top:40.428%;--s:14px" title="India &middot; 2 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">2</span><span class="wp-l">IN <em>India</em></span></button><button class="wp ok" data-m="CN" style="left:75.960%;top:30.651%;--s:15px" title="China &middot; 3 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">3</span><span class="wp-l">CN <em>China</em></span></button><button class="wp ok" data-m="JP" style="left:85.342%;top:29.868%;--s:16px" title="Japan &middot; 4 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">4</span><span class="wp-l">JP <em>Japan</em></span></button><button class="wp ok" data-m="AU" style="left:84.269%;top:77.580%;--s:14px" title="Australia &middot; 2 launches"><span class="wp-r1"></span><span class="wp-r2"></span><span class="wp-d">2</span><span class="wp-l">AU <em>Australia</em></span></button><button class="wp sm" data-m="MX" style="left:21.008%;top:40.037%" title="Mexico &middot; registration market"><span class="wp-d"></span><span class="wp-l">MX <em>Mexico</em></span></button><button class="wp sm" data-m="AR" style="left:31.194%;top:85.402%" title="Argentina &middot; registration market"><span class="wp-d"></span><span class="wp-l">AR <em>Argentina</em></span></button><button class="wp sm" data-m="NL" style="left:49.797%;top:17.197%" title="Netherlands &middot; registration market"><span class="wp-d"></span><span class="wp-l">NL <em>Netherlands</em></span></button><button class="wp sm" data-m="SE" style="left:52.505%;top:10.705%" title="Sweden &middot; registration market"><span class="wp-d"></span><span class="wp-l">SE <em>Sweden</em></span></button><button class="wp sm" data-m="PL" style="left:53.577%;top:17.354%" title="Poland &middot; registration market"><span class="wp-d"></span><span class="wp-l">PL <em>Poland</em></span></button><button class="wp sm" data-m="TR" style="left:57.732%;top:27.522%" title="T&uuml;rkiye &middot; registration market"><span class="wp-d"></span><span class="wp-l">TR <em>T&uuml;rkiye</em></span></button><button class="wp sm" data-m="AE" style="left:62.879%;top:39.098%" title="United Arab Emirates &middot; registration market"><span class="wp-d"></span><span class="wp-l">AE <em>United Arab Emirates</em></span></button><button class="wp sm" data-m="ZA" style="left:55.051%;top:80.709%" title="South Africa &middot; registration market"><span class="wp-d"></span><span class="wp-l">ZA <em>South Africa</em></span></button><button class="wp sm" data-m="KR" style="left:82.607%;top:29.477%" title="South Korea &middot; registration market"><span class="wp-d"></span><span class="wp-l">KR <em>South Korea</em></span></button><button class="wp sm" data-m="SG" style="left:76.174%;top:56.970%" title="Singapore &middot; registration market"><span class="wp-d"></span><span class="wp-l">SG <em>Singapore</em></span></button></div>`;

/*
 * The forecast columns of the quarter timeline. The prototype stopped at Q4
 * 2027, which hid India's two launches (first ship Q2 28 / Q3 28) — the row
 * showed "2" on the right but no chips in the grid. Extended contiguously
 * through Q3 2028 so every scheduled first-ship lands in a visible column.
 */
const MK_QUARTERS: { q: string; label: string; cur?: boolean }[] = [
  { q: 'Q4 26', label: 'Q4 2026', cur: true },
  { q: 'Q1 27', label: 'Q1 2027' },
  { q: 'Q2 27', label: 'Q2 2027' },
  { q: 'Q3 27', label: 'Q3 2027' },
  { q: 'Q4 27', label: 'Q4 2027' },
  { q: 'Q1 28', label: 'Q1 2028' },
  { q: 'Q2 28', label: 'Q2 2028' },
  { q: 'Q3 28', label: 'Q3 2028' },
];

/*
 * The market detail aside (#map-side). Restores the prototype's pickMk/pickMkS
 * fill: a launch market gets its regulatory context, three headline figures,
 * open-risk records (each opening the finding or handing off to the copilot)
 * and a first-ship-by-launch list; a registration market gets the lighter
 * "no activity of its own is open" panel. All copy is the prototype's own.
 */
function MapSide({
  picked,
  onIssue,
  onChat,
}: {
  picked: string;
  onIssue: (findingId: string) => void;
  onChat: () => void;
}) {
  const market = MK_MARKETS[picked];
  const small = MK_SMALL[picked];

  if (market) {
    return (
      <aside className="map-side" id="map-side">
        <div className="ms-hd2">
          <div className="ms-cc">
            <span className="cc">{picked}</span>
            <span className="ms-n2">{market.name}</span>
            <SstIcon tone={market.status} />
          </div>
          <div className="ms-r2">{market.reg}</div>
        </div>
        <div className="ms-k">
          {market.kpis.map((k, i) => (
            <div className="ms-ki" key={i}>
              <b className={k.tone}>{k.value}</b>
              <span>{k.label}</span>
            </div>
          ))}
        </div>
        <div className="ms-s2">
          <div className="ms-lb">Open risks in this market</div>
          {market.risks.length ? (
            market.risks.map((r, i) => (
              <button
                type="button"
                className={`mrk ${r.status}`}
                key={i}
                onClick={() => (r.action.kind === 'issue' && r.action.findingId ? onIssue(r.action.findingId) : onChat())}
              >
                <div className="mrk-t">{r.title}</div>
                <div className="mrk-w">
                  {r.action.kind === 'chat' ? (
                    <span className="ai-spark">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
                      </svg>
                    </span>
                  ) : null}
                  {r.detail}
                </div>
              </button>
            ))
          ) : (
            <div style={{ fontSize: '11.5px', color: 'var(--g500)', lineHeight: 1.5 }}>
              Nothing open in this market. All launches on plan.
            </div>
          )}
        </div>
        <div className="ms-s2">
          <div className="ms-lb">First ship by launch</div>
          {market.launches.map((l, i) => (
            <div className="mlq" key={i}>
              <MlDot status={l.status} label={l.name} />
              <span className="mlq-n">{l.name}</span>
              <span className="mlq-q">{l.quarter}</span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (small) {
    return (
      <aside className="map-side" id="map-side">
        <div className="ms-hd2">
          <div className="ms-cc">
            <span className="cc">{picked}</span>
            <span className="ms-n2">{small.name}</span>
            <span className="sst ok">
              <svg viewBox="0 0 24 24">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </div>
          <div className="ms-r2">{small.reg}</div>
        </div>
        <div className="ms-k">
          <div className="ms-ki">
            <b>{small.launchesPlanned}</b>
            <span>launches planned</span>
          </div>
          <div className="ms-ki">
            <b>0</b>
            <span>off track</span>
          </div>
          <div className="ms-ki">
            <b>&euro;0</b>
            <span>at risk</span>
          </div>
        </div>
        <div className="ms-s2">
          <div className="ms-lb">Status</div>
          <div className="ms-rg">
            Registration market. {small.wave}, behind the lead markets. No activity of its own is open.
          </div>
        </div>
      </aside>
    );
  }

  return <aside className="map-side" id="map-side" />;
}

function MarketPane({
  data,
  marketView,
  marketPick,
  driveSeq,
  onIssue,
  onChat,
}: {
  data: MarketLens;
  marketView?: 'map' | 'tl';
  marketPick?: string;
  driveSeq?: number;
  onIssue: (findingId: string) => void;
  onChat: () => void;
}) {
  const [view, setView] = useState<'map' | 'tl'>('map');
  const [picked, setPicked] = useState<string>('DE');
  const stageRef = useRef<HTMLDivElement>(null);
  const launchMarkets = data.markets.filter((m) => m.tier === 'LAUNCH');

  /* the guided tour drives the sub-view and the picked market atomically. */
  useEffect(() => {
    if (marketView) setView(marketView);
    if (marketPick) setPicked(marketPick);
  }, [marketView, marketPick, driveSeq]);

  /* highlight the picked bubble; the map is raw injected HTML, so toggle the
     prototype's `.sel` class on the matching `.wp` node directly. */
  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.wp[data-m]').forEach((el) => {
      el.classList.toggle('sel', el.dataset.m === picked);
    });
  }, [picked, view]);

  return (
    <div className="pf-l sb-p on" data-l="market" data-p="market">
      <div className="vhd">
        <div>
          <div className="vt">Pipeline by Market</div>
        </div>
      </div>
      <div className="filt" style={{ marginBottom: '14px' }}>
        <span className="filt-l">View</span>
        <button className={`fb ${view === 'map' ? 'on' : ''}`} type="button" onClick={() => setView('map')}>
          World map
        </button>
        <button className={`fb ${view === 'tl' ? 'on' : ''}`} type="button" onClick={() => setView('tl')}>
          Quarter timeline
        </button>
      </div>

      <div className={`mkt-pane ${view === 'map' ? 'on' : ''}`} id="mkt-map">
        <div className="map-grid">
          <div className="map-box">
            <div className="map-hd">
              <div className="map-eb">Global launch footprint</div>
              <div className="map-ti">Where each product reaches first ship</div>
            </div>
            <div
              ref={stageRef}
              className="map-stage"
              onClick={(e) => {
                const btn = (e.target as HTMLElement).closest<HTMLElement>('.wp[data-m]');
                if (btn?.dataset.m) setPicked(btn.dataset.m);
              }}
              dangerouslySetInnerHTML={{ __html: MAP_HTML }}
            />
            <div className="map-lg">
              <span className="wlg">
                <i className="md ct"></i>Off track
              </span>
              <span className="wlg">
                <i className="md rk"></i>At risk
              </span>
              <span className="wlg">
                <i className="md ok"></i>On plan
              </span>
              <span className="map-sc">
                Bubble size = launches
                <i className="sc1" />
                <i className="sc2" />
                <i className="sc3" />
              </span>
              {/* A registration market is the SAME light blue as an on-plan launch
                  market — the pin differs by size (9px vs up to 19px), not hue. The
                  swatch therefore matches the pin and the label carries the
                  distinction; it used to hardcode `background:'#0093D0'`, a copy of
                  `--sky` that had already drifted from the `.md` base beside it. */}
              <span className="wlg">
                <i className="md reg" />
                Registration market <em>smaller bubble</em>
              </span>
              <span className="wlg dim">{data.markets.length} markets &middot; click a bubble for its detail</span>
            </div>
          </div>
          <MapSide picked={picked} onIssue={onIssue} onChat={onChat} />
        </div>
      </div>

      <div className={`mkt-pane ${view === 'tl' ? 'on' : ''}`} id="mkt-tl">
        <div className="tk-wrap">
          <div className="mk-hd">
            <div className="tk-c0"></div>
            <div className="mk-c1">Market</div>
            {MK_QUARTERS.map((c) => (
              <div key={c.q} className={`mk-q ${c.cur ? 'cur' : ''}`}>
                <span>{c.label}</span>
                {c.cur && <em>current</em>}
              </div>
            ))}
            <div className="mk-c9">Launches</div>
          </div>

          {launchMarkets.map((m) => (
            <MarketRowView key={m.code} market={m} />
          ))}

          <div className="tk-lg lg-slim">
            <span className="lg2">
              <i className="ac"></i>On plan
            </span>
            <span className="lg2">
              <i className="ac a"></i>At risk
            </span>
            <span className="lg2">
              <i className="ac r"></i>Off track
            </span>
            <span className="lg2 shade">Two launches in one quarter</span>
            <span className="lg2">
              <span className="ai-spark sm">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2.5l2.1 5.9 5.9 2.1-5.9 2.1L12 18.5l-2.1-5.9L4 10.5l5.9-2.1z" />
                </svg>
              </span>
              Ask the copilot
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketRowView({ market }: { market: MarketRow }) {
  const tone: Tone = market.rollupStatus === 'ct' ? 'ct' : market.rollupStatus === 'rk' ? 'rk' : 'ok';
  const offTrack = market.launches.filter((l) => l.status === 'ct').length;
  const atRisk = market.launches.filter((l) => l.status === 'rk').length;
  const summary = offTrack > 0 ? `${offTrack} off track` : atRisk > 0 ? `${atRisk} at risk` : 'on plan';
  const lmt = [market.regulatoryBody, market.tenderWindows].filter(Boolean).join(' · ');

  return (
    <div className="mkr">
      <div className="tk-c0">
        <SstIcon tone={tone} />
      </div>
      <div className="mk-c1">
        <div className="mkh">
          <span className="cc">{market.code}</span>
          <span className="lnm">{market.name}</span>
        </div>
        <div className="lmt">{lmt}</div>
      </div>
      {MK_QUARTERS.map((c) => {
        const hits = market.launches.filter((l) => l.firstShipQuarter === c.q);
        return (
          <div key={c.q} className={`mk-q ${c.cur ? 'cur' : ''} ${hits.length > 1 ? 'coll' : ''}`.trim()}>
            {hits.map((l, i) => {
              const chipCls = l.status === 'ct' ? 'chip crit' : l.status === 'rk' ? 'chip risk' : 'chip';
              return (
                <button key={i} className={chipCls} type="button">
                  <strong>{l.launch}</strong>
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="mk-c9">
        <b>{market.launchCount}</b>
        <span>{summary}</span>
      </div>
    </div>
  );
}

/* ═════════════════════════ 2.3 BY BUSINESS UNIT ═════════════════════════ */

/** €M with one decimal, no trailing .0 — matches the mono figures elsewhere. */
function em1(v: number): string {
  return `€${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Sum a segment's franchise healthMix maps into one {status: count} tally. */
function segmentHealthMix(segment: BuSegment): Record<string, number> {
  const mix: Record<string, number> = {};
  segment.franchises.forEach((f) => {
    Object.entries(f.healthMix).forEach(([k, n]) => {
      mix[k] = (mix[k] ?? 0) + n;
    });
  });
  return mix;
}

/** Segment tone from its aggregated health mix (worst-wins). */
function segmentTone(mix: Record<string, number>): Tone {
  if ((mix.OFF_TRACK ?? 0) > 0) return 'ct';
  if ((mix.AT_RISK ?? 0) > 0) return 'rk';
  return 'ok';
}

/*
 * Business units are NOT static section titles. They are (a) filter chips and
 * (b) expandable rows: pick a unit from the chip bar, or click a row, to drill
 * into that unit's detail (its franchise cards). "All units" shows every unit
 * as a summary row you can open one at a time.
 */
function BuPane({ data, open }: { data: BusinessUnitLens; open: (id: string) => void }) {
  // Two independent concerns:
  //  • `filter`  — which unit's row(s) are shown (null = show all units). Set by
  //                the chip bar.
  //  • `expanded`— the SET of units whose detail is open. Rows expand/collapse
  //                independently, so any number can be open at once. Defaults to
  //                ALL units expanded (the user's preferred starting state).
  const [filter, setFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(data.segments.map((s) => s.segment)),
  );
  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const totalLaunches = data.segments.reduce((s, seg) => s + seg.launchCount, 0);
  const shown = filter ? data.segments.filter((s) => s.segment === filter) : data.segments;

  return (
    <div className="pf-l sb-p on" data-l="bu" data-p="bu">
      <div className="vhd">
        <div>
          <div className="vt">Pipeline by Business Unit</div>
        </div>
      </div>

      {/* Filter chips — narrow to a single business unit (or show all of them). */}
      <div className="filt" style={{ marginBottom: '14px' }}>
        <span className="filt-l">Business unit</span>
        <button
          className={`fb ${filter === null ? 'on' : ''}`}
          type="button"
          onClick={() => setFilter(null)}
        >
          All units<i className="fb-n">{data.segments.length}</i>
        </button>
        {data.segments.map((segment) => {
          const tone = segmentTone(segmentHealthMix(segment));
          return (
            <button
              key={segment.segment}
              className={`fb ${filter === segment.segment ? 'on' : ''} ${tone === 'ok' ? '' : tone}`.trim()}
              type="button"
              onClick={() => setFilter(filter === segment.segment ? null : segment.segment)}
            >
              {segment.segment}
              <i className="fb-n">{segment.launchCount}</i>
            </button>
          );
        })}
      </div>

      {/* One independently-expandable row per (shown) business unit. */}
      <div className="bu2-wrap">
        {shown.map((segment) => (
          <BuSegmentRow
            key={segment.segment}
            segment={segment}
            expanded={expanded.has(segment.segment)}
            onToggle={() => toggle(segment.segment)}
            open={open}
          />
        ))}
      </div>

      <div className="tk-lg lg-slim">
        <span className="lg2"><i className="ac"></i>On plan</span>
        <span className="lg2"><i className="ac a"></i>At risk</span>
        <span className="lg2"><i className="ac r"></i>Off track</span>
        <span className="lg2 shade">
          {data.segments.length} business units · {totalLaunches} launches · click a row to open or close its detail
        </span>
      </div>
    </div>
  );
}

/** A business-unit row: a summary line that expands to its franchise cards. */
function BuSegmentRow({
  segment,
  expanded,
  onToggle,
  open,
}: {
  segment: BuSegment;
  expanded: boolean;
  onToggle: () => void;
  open: (id: string) => void;
}) {
  const mix = segmentHealthMix(segment);
  const tone = segmentTone(mix);
  const rowCls = `bu2-row ${tone === 'ok' ? 'ok' : tone}${expanded ? ' open' : ''}`;
  const atRiskTone = tone === 'ct' ? 'r' : tone === 'rk' ? 'a' : '';
  const franchiseWord = segment.franchises.length === 1 ? 'franchise' : 'franchises';
  const launchWord = segment.launchCount === 1 ? 'launch' : 'launches';
  const onPlan = mix.ON_PLAN ?? 0;
  const atRisk = mix.AT_RISK ?? 0;
  const offTrack = mix.OFF_TRACK ?? 0;
  const launched = mix.LAUNCHED ?? 0;

  return (
    <div className={rowCls}>
      <button className="bu2-rh" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span className="bu2-cv" aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </span>
        <SstIcon tone={tone} />
        <span className="bu2-id">
          <span className="bu2-nm">{segment.segment}</span>
          <span className="bu2-meta">
            {segment.franchises.length} {franchiseWord} · {segment.launchCount} {launchWord}
            {segment.revenueScale ? ` · ${segment.revenueScale}` : ''}
            {segment.growthRate != null ? ` · ${segment.growthRate > 0 ? '+' : ''}${segment.growthRate}% growth` : ''}
          </span>
        </span>
        <span className="bu2-mix">
          {onPlan > 0 && <em>{onPlan} on plan</em>}
          {launched > 0 && <em>{launched} launched</em>}
          {atRisk > 0 && <em className="a">{atRisk} at risk</em>}
          {offTrack > 0 && <em className="r">{offTrack} off track</em>}
        </span>
        <span className="bu2-rk">
          <b className={atRiskTone}>{em1(segment.revenueAtRisk)}</b>
          <span>{segment.recoverableDays > 0 ? `at risk · ${segment.recoverableDays}d recoverable` : 'at risk'}</span>
        </span>
      </button>
      {expanded && (
        <div className="bu2-detail">
          <div className="bu-grid">
            {segment.franchises.map((franchise) => (
              <BuCardView
                key={`${segment.segment}-${franchise.franchise}`}
                franchise={franchise}
                open={open}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BuCardView({
  franchise,
  open,
}: {
  franchise: BuFranchise;
  open: (id: string) => void;
}) {
  const mix = franchise.healthMix;
  const tone: Tone = (mix.OFF_TRACK ?? 0) > 0 ? 'ct' : (mix.AT_RISK ?? 0) > 0 ? 'rk' : 'ok';
  const cardCls = `bu-c ${tone === 'ok' ? '' : tone}`.trim();
  const launchWord = franchise.launchCount === 1 ? 'launch' : 'launches';
  const atRiskTone = tone === 'ok' ? '' : tone === 'ct' ? 'r' : 'a';

  return (
    <div className={cardCls}>
      <div className="bu-h">
        <SstIcon tone={tone} />
        <div>
          <div className="bu-n">{franchise.franchise}</div>
          <div className="bu-sub">
            {franchise.launchCount} {launchWord}
          </div>
        </div>
      </div>
      <div className="bu-l">
        {franchise.launches.map((l) => (
          <BuLaunchView key={l.launchId} launch={l} open={open} />
        ))}
      </div>
      <div className="bu-f">
        <span>
          <b className={franchise.openIssues > 0 ? atRiskTone : ''}>{franchise.openIssues}</b>{' '}
          {franchise.openIssues === 1 ? 'open issue' : 'open issues'}
        </span>
        {franchise.recoverableDays > 0 && (
          <span>
            <b className="g">{franchise.recoverableDays}d</b> recoverable
          </span>
        )}
        <span>
          <b className={atRiskTone}>€{(franchise.revenueAtRisk / 1_000_000).toFixed(1).replace(/\.0$/, '')}M</b> at risk
        </span>
      </div>
    </div>
  );
}

function BuLaunchView({ launch, open }: { launch: BuLaunch; open: (id: string) => void }) {
  // Slip pill: a slipping launch shows "+Nd" (red/amber by health); an on-plan
  // launch with float shows "Nd float"; a launched one shows "launched".
  const slip = launch.nextGate?.slipDays ?? 0;
  let slpTone: 'r' | 'a' | 'n';
  let slpTxt: string;
  if (launch.health === 'LAUNCHED') {
    slpTone = 'n';
    slpTxt = 'launched';
  } else if (slip > 0) {
    slpTone = launch.health === 'OFF_TRACK' ? 'r' : 'a';
    slpTxt = `+${slip}d`;
  } else if (launch.scheduleFloatDays != null) {
    slpTone = 'n';
    slpTxt = `${launch.scheduleFloatDays}d float`;
  } else {
    slpTone = 'n';
    slpTxt = 'on plan';
  }

  // Readiness bar colour follows the launch tone (r/a/g).
  const barTone = launch.health === 'OFF_TRACK' ? 'r' : launch.health === 'AT_RISK' ? 'a' : 'g';
  const rd = launch.readinessPct;
  const ng = launch.nextGate;

  return (
    <button className="bu-li" type="button" onClick={() => open(launch.launchId)}>
      <span className="bu-ln">{labelFor(launch)}</span>
      <span className={`slp ${slpTone}`}>{slpTxt}</span>
      <span className="bu-lg">
        {launch.currentPhase && <i className="bu-lp">{launch.currentPhase}</i>}
        {ng && (
          <>
            {' '}
            <Glyph name="arrow-right" className="sm" /> {ng.code}{' '}
            <b className="mono">{fmtDate(ng.forecastDate)}</b>
          </>
        )}
      </span>
      {rd != null && (
        <span className="bu-rd">
          <i className="bar-t">
            <i className={`bar-f ${barTone}`} style={{ width: `${rd}%` }}></i>
          </i>
          {rd}%
        </span>
      )}
    </button>
  );
}

/* ═════════════════════════ 2.4 MILESTONES ═════════════════════════ */

/** Axis runs Sep 26 → Nov 27 (14 months); returns the left-offset % for a date.
 *  Day-of-month is kept as a fraction so an in-month slip (e.g. +9d) draws a
 *  visible bar rather than collapsing to zero width. */
function monthPos(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const frac = (d.getDate() - 1) / daysInMonth;
  const months = (d.getFullYear() - 2026) * 12 + d.getMonth() - 8 + frac; // Sep 2026 = 0
  const pct = (months / 14) * 100;
  return Math.max(0, Math.min(100, pct));
}

function MilestonesPane({ data, open }: { data: TimelineLens; open: (id: string) => void }) {
  return (
    <div className="pf-l sb-p on" data-l="milestones" data-p="milestones">
      <div className="vhd">
        <div>
          <div className="vt">Key Milestones &amp; Status</div>
        </div>
      </div>

      <div className="tk-wrap">
        <div className="ms-hd">
          <div className="tk-c0"></div>
          <div className="mk-c1">Launch</div>
          <div className="ms-ax">
            <span className="ms-m">Sep 26</span>
            <span className="ms-m">Nov</span>
            <span className="ms-m">Jan 27</span>
            <span className="ms-m">Mar</span>
            <span className="ms-m">May</span>
            <span className="ms-m">Jul</span>
            <span className="ms-m">Sep</span>
            <span className="ms-m">Nov 27</span>
          </div>
        </div>

        {data.rows.map((r) => (
          <MilestoneRowView key={r.launchId} row={r} open={open} />
        ))}

        <div className="tk-lg">
          <div className="lgi">
            <span className="ms-g base" style={{ position: 'static', pointerEvents: 'none', margin: 0 }}>
              G
            </span>
            Baseline
          </div>
          <div className="lgi">
            <span className="ms-g" style={{ position: 'static', pointerEvents: 'none', margin: 0 }}>
              G
            </span>
            Forecast, on plan
          </div>
          <div className="lgi">
            <span className="ms-g risk" style={{ position: 'static', pointerEvents: 'none', margin: 0 }}>
              G
            </span>
            At risk
          </div>
          <div className="lgi">
            <span className="ms-g crit" style={{ position: 'static', pointerEvents: 'none', margin: 0 }}>
              G
            </span>
            Off track
          </div>
          <div className="lgi">
            <span className="ms-sp" style={{ position: 'static', width: '24px', display: 'inline-block', height: '6px' }}></span>
            Slip
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--g500)' }}>
            Hover any marker for the exact date. Click to open the launch.
          </div>
        </div>
      </div>
    </div>
  );
}

/* MarketLaunch.status → the ms-g marker colour class (shared tone source). */
function mlMarkerCls(s: MarketGate['mlStatus']): 'crit' | 'risk' | '' {
  if (s === 'ct') return 'crit';
  if (s === 'rk') return 'risk';
  return '';
}

/* A quarter label ("Q2 27") → the left-offset % on the same Sep 26 → Nov 27
 * axis the lead gate train uses, positioned at the mid-month of the quarter so
 * a market's projected next gate lines up with the lead markers above it. */
function quarterPos(q: string | null): number | null {
  if (!q) return null;
  const m = /Q([1-4])\s*'?(\d{2})/.exec(q);
  if (!m) return null;
  const quarter = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  const midMonth = (quarter - 1) * 3 + 1; // 0-indexed mid-month of the quarter
  const months = (year - 2026) * 12 + midMonth - 8; // Sep 2026 = 0
  const pct = (months / 14) * 100;
  return Math.max(0, Math.min(100, pct));
}

/* Slip in days → axis width %: 14 months span the Sep 26 → Nov 27 axis, so one
 * month ≈ 100/14 %. Lets a per-market slip be drawn as a baseline→forecast bar
 * on the same scale as the lead gate train. */
function slipWidthPct(slipDays: number | null): number {
  if (!slipDays || slipDays <= 0) return 0;
  const months = slipDays / 30.44;
  return (months / 14) * 100;
}

/* Minimum on-axis width (%) for a drawn slip bar. A small slip (Sigvotatug +9d ≈ 2%,
 * PF-08634404 +11d, Sasanlimab +14d, Vepdegestrant +21d) is narrower than the gate marker itself
 * (~20-26px), so a to-scale bar hides entirely behind the forecast marker and the
 * delay reads as "no slip". Floor the DRAWN width so the baseline marker separates
 * from the forecast marker and the striped bar is visible; large slips (Berobenatide
 * +47d ≈ 11%) already exceed this floor and stay to-scale. */
const MIN_SLIP_BAR_PCT = 5;

/* Given a to-scale slip width and the forecast position, return the drawn
 * baseline position + bar width, floored so a small slip is still visible. */
function slipBarGeom(slipW: number, forePos: number): { basePos: number; width: number } {
  const width = Math.min(forePos, Math.max(slipW, MIN_SLIP_BAR_PCT));
  return { basePos: Math.max(0, forePos - width), width };
}

/*
 * One per-market timeline sub-row (revealed when the launch row is expanded).
 * The lead gate train above is the lead-market schedule; this row shows THIS
 * market's projected next gate (Scope C) on the same axis. When the market is
 * slipping (its own status is at-risk/off-track and it inherits a slip), we draw
 * the SAME baseline→forecast bar the lead row uses — a hollow baseline marker,
 * a coloured slip bar, and the forecast marker — so the delay is visible in the
 * progress, not just a red dot. On-plan markets show a single neutral marker;
 * live markets show a green "live" tick. The gate label is intentionally NOT
 * repeated under the market code — the marker on the track already names it.
 */
function MarketTimelineRow({ mk }: { mk: MarketGate }) {
  const markerCls = mlMarkerCls(mk.mlStatus);
  /* Position by the projected gate DATE (same date axis as the lead train) so a
     small slip renders on-axis; fall back to the coarse quarter mid-month only
     if no date is available. */
  const forePos = mk.live
    ? monthPos(null) ?? 2
    : monthPos(mk.gateForecastDate) ?? quarterPos(mk.gateForecastQuarter);
  const slipW = markerCls && mk.slipDays && mk.slipDays > 0 ? slipWidthPct(mk.slipDays) : 0;
  /* Floor the drawn bar so a small slip (e.g. Sigvotatug +9d) is still visible and
     doesn't hide behind the forecast marker. */
  const geom = forePos != null && slipW > 0 ? slipBarGeom(slipW, forePos) : null;
  const basePos = geom ? geom.basePos : null;
  const slipBarW = geom ? geom.width : 0;
  const slipped = basePos != null && forePos != null;
  const slipBarCls = markerCls === 'risk' ? 'ms-sp amb' : 'ms-sp';
  return (
    <div className="msr-mk">
      <div className="tk-c0" aria-hidden />
      <div className="mk-c1 msr-mk-lbl">
        <MlDot status={mk.mlStatus} label={mk.marketName ?? mk.marketCode} />
        <b className="mg-mk">{mk.marketCode}</b>
        <span className="msr-mk-nm">{mk.marketName ?? mk.marketCode}</span>
        {mk.isLead ? <span className="mg-lead">lead</span> : null}
        {mk.live ? (
          <span className="msr-mk-q live">live</span>
        ) : mk.firstShipQuarter ? (
          <span className="msr-mk-q">{mk.firstShipQuarter}</span>
        ) : null}
      </div>
      <div className="ms-tl">
        <div className="ms-now" />
        {mk.live ? (
          <span
            className="ms-g done"
            style={{ left: '2%' }}
            title={`${mk.marketName ?? mk.marketCode} · live in market`}
          >
            <Glyph name="check" className="sm" />
          </span>
        ) : forePos != null ? (
          <>
            {slipped && (
              <div
                className={slipBarCls}
                style={{ left: `${basePos}%`, width: `${slipBarW}%` }}
                title={`${mk.marketName ?? mk.marketCode} · ${mk.gateCode ?? ''} slipped ${mk.slipDays}d`}
              />
            )}
            {slipped && (
              <span
                className="ms-g base"
                style={{ left: `${basePos}%` }}
                title={`Baseline ${mk.gateCode ?? ''}`}
              >
                {mk.gateCode ?? '•'}
              </span>
            )}
            <span
              className={`ms-g ${markerCls}`.trim()}
              style={{ left: `${forePos}%` }}
              title={`${mk.marketName ?? mk.marketCode} · ${mk.gateCode ?? ''} forecast ${mk.gateForecastQuarter ?? ''}${mk.slipDays && mk.slipDays > 0 ? ` (+${mk.slipDays}d)` : ''}`}
            >
              {mk.gateCode ?? '•'}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MilestoneRowView({ row, open }: { row: TimelineRow; open: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const tone = healthTone(row.health);
  const foreCls = tone === 'ct' ? 'crit' : tone === 'rk' ? 'risk' : '';
  const slipBarCls = tone === 'rk' ? 'ms-sp amb' : 'ms-sp';
  const slipGate = row.gates.find((g) => (g.slipDays ?? 0) > 0);
  const lmt = slipGate
    ? `${row.franchise} · ${slipGate.code} slipped ${slipGate.slipDays} days`
    : `${row.franchise}`;
  const hasMarkets = row.marketGates && row.marketGates.length > 0;

  return (
    <div className={`msr-group${expanded ? ' open' : ''}`}>
      <div className="msr">
        <div className="tk-c0">
          <SstIcon tone={tone} />
        </div>
        <button
          className="mk-c1 msr-name"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={hasMarkets ? 'Show per-market timeline' : undefined}
        >
          <div className="lnm">
            {hasMarkets ? (
              <span className="msr-cv" aria-hidden>
                <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            ) : null}
            {labelFor(row)}
          </div>
          <div className="lmt">{lmt}</div>
        </button>
        <div className="ms-tl">
          <div className="ms-now">
            <span>today</span>
          </div>
          {row.gates.map((g: GateMarker) => {
            const rawBasePos = monthPos(g.baselineDate);
            const forePos = monthPos(g.forecastDate);
            const slipped = (g.slipDays ?? 0) > 0 && rawBasePos != null && forePos != null;
            /* Floor the drawn bar so a small lead slip (e.g. Sigvotatug G5 +9d) is
               still visible instead of hiding behind the forecast marker. The base
               marker is drawn at the same floored position so the two align. */
            const geom = slipped ? slipBarGeom((forePos as number) - (rawBasePos as number), forePos as number) : null;
            const basePos = geom ? geom.basePos : rawBasePos;
            const slipBarW = geom ? geom.width : 0;
            return (
              <React.Fragment key={g.code}>
                {slipped && (
                  <div
                    className={slipBarCls}
                    style={{ left: `${basePos}%`, width: `${slipBarW}%` }}
                  ></div>
                )}
                {slipped && (
                  <button
                    className="ms-g base"
                    type="button"
                    style={{ left: `${basePos}%` }}
                    title={`Baseline ${g.code} · ${fmtDateYear(g.baselineDate)}`}
                  >
                    {g.code}
                  </button>
                )}
                {forePos != null && (
                  <button
                    className={`ms-g ${slipped ? foreCls : ''}`.trim()}
                    type="button"
                    style={{ left: `${forePos}%` }}
                    onClick={() => open(row.launchId)}
                    title={`${g.name} · ${fmtDateYear(g.forecastDate)}`}
                  >
                    {g.code}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {expanded && hasMarkets ? (
        <div className="msr-mks">
          {row.marketGates.map((mk) => (
            <MarketTimelineRow key={`${mk.marketCode}-${mk.gateCode ?? 'live'}`} mk={mk} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ═════════════════════════ ROOT ═════════════════════════ */

export default function PortfolioView() {
  const { open, intent, drive } = useNav();
  const [lens, setLens] = useState<Lens>('product');
  const [product, setProduct] = useState<ProductLens | null>(null);
  const [market, setMarket] = useState<MarketLens | null>(null);
  const [bu, setBu] = useState<BusinessUnitLens | null>(null);
  const [timeline, setTimeline] = useState<TimelineLens | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* the guided tour drives the lens; the market sub-view/pick flow through to
     MarketPane via props keyed on intent.seq. */
  useEffect(() => {
    if (intent?.view === 'portfolio' && intent.lens) setLens(intent.lens);
  }, [intent]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, m, b, t] = await Promise.all([
        getPortfolioProduct(),
        getPortfolioMarket(),
        getPortfolioBusinessUnit(),
        getPortfolioTimeline(),
      ]);
      setProduct(p);
      setMarket(m);
      setBu(b);
      setTimeline(t);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load the portfolio.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openLaunch = useCallback((id: string) => open('launch', id), [open]);
  const openIssue = useCallback((findingId: string) => open('issue', findingId), [open]);
  const askCopilot = useCallback(() => drive({ view: 'chat' }), [drive]);

  if (error) return <div className="view on v-msg v-err">{error}</div>;
  if (!product || !market || !bu || !timeline) return <div className="view on v-msg">Loading…</div>;

  return (
    <div className="view on" id="v-portfolio">
      <div className="pf-sw sb-r">
        <span className="pf-swl">View the portfolio by</span>
        <button className={`pfb sbb ${lens === 'product' ? 'on' : ''}`} type="button" onClick={() => setLens('product')}>
          Product
        </button>
        <button className={`pfb sbb ${lens === 'market' ? 'on' : ''}`} type="button" onClick={() => setLens('market')}>
          Market
        </button>
        <button className={`pfb sbb ${lens === 'bu' ? 'on' : ''}`} type="button" onClick={() => setLens('bu')}>
          Business unit
        </button>
        <button className={`pfb sbb ${lens === 'milestones' ? 'on' : ''}`} type="button" onClick={() => setLens('milestones')}>
          Timeline
        </button>
      </div>

      {lens === 'product' && <ProductPane data={product} open={openLaunch} />}
      {lens === 'market' && (
        <MarketPane
          data={market}
          marketView={intent?.marketView}
          marketPick={intent?.marketPick}
          driveSeq={intent?.seq}
          onIssue={openIssue}
          onChat={askCopilot}
        />
      )}
      {lens === 'bu' && <BuPane data={bu} open={openLaunch} />}
      {lens === 'milestones' && <MilestonesPane data={timeline} open={openLaunch} />}
    </div>
  );
}
