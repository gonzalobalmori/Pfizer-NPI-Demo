/*
 * One scored option, rendered so the trade-off is legible at a glance: the same
 * five quantities in the same places on every card, the recommendation marked,
 * and an option ruled out by a constraint visibly struck rather than quietly
 * ranked last.
 *
 * Both scenarios use this. Every number comes from the backend's ScenarioOption
 * row — nothing is computed here, so the card and the decision agree by
 * construction.
 */

import React from 'react';
import type { ScenarioOptionRow } from '@/types/scenarios';
import { fmtEuro } from '@/lib/format';

/** Thousands separator for dose counts, which are too big to read raw. */
function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

interface OptionCardProps {
  option: ScenarioOptionRow;
  /** True when this card is the one the presenter has selected for preview. */
  selected: boolean;
  /** True once a decision is signed, which freezes the cards. */
  decided: boolean;
  /** Label for the primary action, e.g. "Preview allocation". */
  onSelect: (optionId: string) => void;
  /** Runs the decision on this option. Absent before the decide step is live. */
  onDecide?: (optionId: string) => void;
  busy: boolean;
  /** What the decide button says, e.g. "Approve — Quality Council". */
  decideLabel?: string;
}

export default function OptionCard({
  option: o,
  selected,
  decided,
  onSelect,
  onDecide,
  busy,
  decideLabel = 'Approve this option',
}: OptionCardProps) {
  const out = !o.feasible;
  const approved = o.status === 'APPROVED';
  const rejected = o.status === 'REJECTED';

  const cls = [
    'oc',
    selected ? 'sel' : '',
    out ? 'out' : '',
    o.recommended && !out ? 'rec' : '',
    approved ? 'app' : '',
    rejected ? 'rej' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} data-option={o.id}>
      <div className="oc-h">
        <div className="oc-hx">
          <div className="oc-t">{o.label}</div>
          <div className="oc-k">{o.optionKind.replace(/_/g, ' ').toLowerCase()}</div>
        </div>
        {approved ? (
          <span className="pill g">Approved</span>
        ) : rejected ? (
          <span className="pill z">Not taken</span>
        ) : out ? (
          <span className="pill r">Ruled out</span>
        ) : o.recommended ? (
          <span className="pill g">Recommended</span>
        ) : null}
      </div>

      {/* the score, and what it is a score of */}
      {!out && (
        <div className="oc-score">
          <span className="oc-score-v">{o.score.toFixed(1)}</span>
          <span className="oc-score-u">/ 100</span>
          <div className="oc-bar">
            <i style={{ width: `${Math.max(0, Math.min(100, o.score))}%` }} />
          </div>
        </div>
      )}

      {out && o.infeasibleReason && (
        <div className="oc-out-why">
          <span className="cs-auto-lbl">Why this cannot be done</span>
          <span className="cs-auto-tx">{o.infeasibleReason}</span>
        </div>
      )}

      {o.description && <p className="oc-d">{o.description}</p>}

      {/* the five comparable quantities, same order on every card */}
      <div className="oc-m">
        <div className="oc-mi">
          <span className="oc-mv">{fmtNum(o.dosesServed)}</span>
          <span className="oc-ml">doses served</span>
        </div>
        <div className="oc-mi">
          <span className={`oc-mv${o.dosesLost > 0 ? ' a' : ''}`}>{fmtNum(o.dosesLost)}</span>
          <span className="oc-ml">doses lost</span>
        </div>
        <div className="oc-mi">
          <span className={`oc-mv${o.dayImpact > 0 ? ' a' : ''}`}>
            {o.dayImpact > 0 ? `+${o.dayImpact}` : '0'}
          </span>
          <span className="oc-ml">days slip</span>
        </div>
        <div className="oc-mi">
          <span className="oc-mv">{fmtEuro(o.incrementalCost)}</span>
          <span className="oc-ml">added cost</span>
        </div>
        <div className="oc-mi">
          {/* Two counts, not a fraction: a slash here read as "7 out of 1". */}
          <span className="oc-mv">
            {o.marketsProtected}
            {o.marketsImpacted > 0 && <i className="oc-mv-sub"> · {o.marketsImpacted} hit</i>}
          </span>
          <span className="oc-ml">markets whole</span>
        </div>
      </div>

      {/* who takes the hit, and what filing it triggers */}
      <dl className="oc-f">
        {o.impactedMarkets && (
          <div className="oc-fr">
            <dt>Markets affected</dt>
            <dd>{o.impactedMarkets}</dd>
          </div>
        )}
        <div className="oc-fr">
          <dt>Regulatory</dt>
          <dd>{o.regulatoryDetail ?? (o.regulatoryImpact ? 'Filing required' : 'No filing')}</dd>
        </div>
        {o.executionDays > 0 && (
          <div className="oc-fr">
            <dt>Time to execute</dt>
            <dd>{o.executionDays} days</dd>
          </div>
        )}
        {o.residualRisk && (
          <div className="oc-fr">
            <dt>Residual risk</dt>
            <dd>{o.residualRisk}</dd>
          </div>
        )}
      </dl>

      {!out && (
        <div className="oc-a">
          <button
            type="button"
            className={`btn ${selected ? 'p' : 's'} sm`}
            disabled={busy}
            onClick={() => onSelect(o.id)}
          >
            {selected ? 'Showing this plan' : 'Preview this plan'}
          </button>
          {onDecide && !decided && (
            <button
              type="button"
              className="btn p sm oc-dec"
              disabled={busy}
              onClick={() => onDecide(o.id)}
            >
              {decideLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
