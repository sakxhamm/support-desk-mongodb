import React from 'react';

/**
 * Reusable feedback view for loading, empty, and error states.
 */
export function StateFeedback({ variant, title, message, actionLabel, onAction }) {
  if (variant === 'loading') {
    return (
      <div className="state-loading" role="status" aria-live="polite" aria-label="Loading campus events">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton-card">
            <div className="skeleton-line skeleton-line--short" />
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--medium" />
            <div className="skeleton-bar" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`state-box state-box--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <div className="state-icon" aria-hidden="true">
        {variant === 'error' ? '!' : '○'}
      </div>
      <h2 className="state-title">{title}</h2>
      <p className="state-message">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
