import React from 'react';

/**
 * Reusable capacity & waitlist indicator.
 * Pure presentational component driven by capacity, registeredCount, and waitlistCount.
 */
export function CapacityMeter({ capacity, registeredCount, waitlistCount }) {
  const spotsLeft = Math.max(0, capacity - registeredCount);
  const fillPercent = Math.min(100, Math.round((registeredCount / capacity) * 100));
  const isFull = spotsLeft === 0;
  const isFillingFast = !isFull && fillPercent >= 80;

  const tone = isFull ? 'full' : isFillingFast ? 'warn' : 'open';

  return (
    <div className="capacity-meter" aria-label="Event capacity">
      <div className="capacity-meta">
        <span className={`capacity-pill capacity-pill--${tone}`}>
          {isFull ? 'At Capacity' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
        </span>
        <span className="capacity-numbers">
          {registeredCount}/{capacity} registered
          {waitlistCount > 0 ? ` · ${waitlistCount} waitlisted` : ''}
        </span>
      </div>
      <div className="capacity-track" role="progressbar" aria-valuenow={fillPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`capacity-fill capacity-fill--${tone}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}
