import React from 'react';
import { CapacityMeter } from './CapacityMeter.jsx';

/**
 * Reusable campus event card.
 * Receives canonical event state from parent and delegates signup/cancel actions.
 */
export function EventCard({ event, isBusy, onRegister, onCancel }) {
  const isFull = event.registeredCount >= event.capacity;
  const isRegistered = event.userStatus === 'registered';
  const isWaitlisted = event.userStatus === 'waitlisted';

  let actionLabel = 'Register Now';
  let actionVariant = 'primary';
  let handleAction = () => onRegister(event.id);

  if (isRegistered) {
    actionLabel = 'Cancel Registration';
    actionVariant = 'secondary';
    handleAction = () => onCancel(event.id);
  } else if (isWaitlisted) {
    actionLabel = 'Leave Waitlist';
    actionVariant = 'secondary';
    handleAction = () => onCancel(event.id);
  } else if (isFull) {
    actionLabel = 'Join Waitlist';
    actionVariant = 'waitlist';
  }

  return (
    <article className="event-card" data-testid={`event-card-${event.id}`}>
      <div className="event-card-top">
        <span className="category-tag">{event.category}</span>
        {isRegistered && <span className="user-badge user-badge--confirmed">Confirmed</span>}
        {isWaitlisted && <span className="user-badge user-badge--waitlisted">On Waitlist</span>}
      </div>

      <h2 className="event-title">{event.title}</h2>
      <p className="event-club">{event.club}</p>

      <div className="event-details">
        <span>{event.dateLabel}</span>
        <span>·</span>
        <span>{event.venue}</span>
      </div>

      <CapacityMeter
        capacity={event.capacity}
        registeredCount={event.registeredCount}
        waitlistCount={event.waitlistCount}
      />

      <div className="event-actions">
        <button
          type="button"
          className={`btn btn--${actionVariant}`}
          disabled={isBusy}
          onClick={handleAction}
        >
          {isBusy ? 'Updating...' : actionLabel}
        </button>
      </div>
    </article>
  );
}
