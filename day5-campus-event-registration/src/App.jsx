import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EventCard } from './components/EventCard.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { StateFeedback } from './components/StateFeedback.jsx';
import { fetchCampusEvents } from './data/mockEvents.js';

/**
 * Pure state transition for signing up or joining a waitlist.
 */
export function applyRegistration(event) {
  if (event.userStatus !== 'none') return event;

  if (event.registeredCount < event.capacity) {
    return {
      ...event,
      registeredCount: event.registeredCount + 1,
      userStatus: 'registered',
    };
  }

  return {
    ...event,
    waitlistCount: event.waitlistCount + 1,
    userStatus: 'waitlisted',
  };
}

/**
 * Pure state transition for canceling a registration or leaving a waitlist.
 * If a confirmed attendee cancels while a waitlist exists, the next person
 * on the waitlist is automatically promoted to confirmed.
 */
export function applyCancellation(event) {
  if (event.userStatus === 'registered') {
    if (event.waitlistCount > 0) {
      return {
        ...event,
        waitlistCount: event.waitlistCount - 1,
        userStatus: 'none',
      };
    }
    return {
      ...event,
      registeredCount: Math.max(0, event.registeredCount - 1),
      userStatus: 'none',
    };
  }

  if (event.userStatus === 'waitlisted') {
    return {
      ...event,
      waitlistCount: Math.max(0, event.waitlistCount - 1),
      userStatus: 'none',
    };
  }

  return event;
}

export function App({ loader = fetchCampusEvents, initialDemoMode = 'normal' }) {
  // Canonical state owned at the page level
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [busyEventId, setBusyEventId] = useState(null);
  const [bannerMessage, setBannerMessage] = useState('');

  const loadEvents = useCallback(
    async (mode) => {
      if (mode === 'loading') {
        setStatus('loading');
        setErrorMessage('');
        return;
      }

      setStatus('loading');
      setErrorMessage('');
      try {
        const data = await loader(mode);
        setEvents(data);
        setStatus('ready');
      } catch (err) {
        setEvents([]);
        setErrorMessage(err?.message || 'Failed to load campus events.');
        setStatus('error');
      }
    },
    [loader]
  );

  useEffect(() => {
    loadEvents(demoMode);
  }, [demoMode, loadEvents]);

  const handleRegister = (eventId) => {
    setBusyEventId(eventId);
    let feedback = '';
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const updated = applyRegistration(ev);
        feedback =
          updated.userStatus === 'registered'
            ? `Seat confirmed for "${ev.title}".`
            : `Added to waitlist for "${ev.title}" (position #${updated.waitlistCount}).`;
        return updated;
      })
    );
    setBannerMessage(feedback);
    setBusyEventId(null);
  };

  const handleCancel = (eventId) => {
    setBusyEventId(eventId);
    let feedback = '';
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const updated = applyCancellation(ev);
        if (ev.userStatus === 'registered' && ev.waitlistCount > 0) {
          feedback = `Canceled "${ev.title}". Next waitlisted student was promoted.`;
        } else {
          feedback = `Updated your signup for "${ev.title}".`;
        }
        return updated;
      })
    );
    setBannerMessage(feedback);
    setBusyEventId(null);
  };

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      const matchesQuery =
        !query ||
        ev.title.toLowerCase().includes(query) ||
        ev.club.toLowerCase().includes(query) ||
        ev.venue.toLowerCase().includes(query);

      if (!matchesQuery) return false;

      if (activeFilter === 'open') return ev.registeredCount < ev.capacity;
      if (activeFilter === 'waitlist') return ev.registeredCount >= ev.capacity;
      if (activeFilter === 'registered') return ev.userStatus !== 'none';
      return true;
    });
  }, [events, searchQuery, activeFilter]);

  const summary = useMemo(() => {
    const confirmed = events.filter((e) => e.userStatus === 'registered').length;
    const waitlisted = events.filter((e) => e.userStatus === 'waitlisted').length;
    return { confirmed, waitlisted };
  }, [events]);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">CampusPulse · Student Activities</p>
          <h1>Campus Event Registration</h1>
          <p className="subtitle">
            Sign up for upcoming club events with live capacity limits and automatic waitlist promotion.
          </p>
        </div>
        <div className="summary-chips" aria-label="My registration summary">
          <span className="summary-chip">Confirmed: {summary.confirmed}</span>
          <span className="summary-chip">Waitlisted: {summary.waitlisted}</span>
        </div>
      </header>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        demoMode={demoMode}
        onDemoModeChange={setDemoMode}
      />

      {bannerMessage && (
        <div className="toast-banner" role="status" aria-live="polite">
          <span>{bannerMessage}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => setBannerMessage('')}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <main>
        {status === 'loading' && <StateFeedback variant="loading" />}

        {status === 'error' && (
          <StateFeedback
            variant="error"
            title="Could not load campus events"
            message={errorMessage}
            actionLabel="Retry"
            onAction={() => {
              if (demoMode === 'error') {
                setDemoMode('normal');
              } else {
                loadEvents(demoMode);
              }
            }}
          />
        )}

        {status === 'ready' && filteredEvents.length === 0 && (
          <StateFeedback
            variant="empty"
            title="No matching campus events"
            message={
              events.length === 0
                ? 'There are no events scheduled for this week yet. Check back soon!'
                : 'No events match your current search or filter.'
            }
            actionLabel={events.length === 0 ? 'Reload Events' : 'Clear Filters'}
            onAction={() => {
              if (events.length === 0) {
                setDemoMode('normal');
              } else {
                setSearchQuery('');
                setActiveFilter('all');
              }
            }}
          />
        )}

        {status === 'ready' && filteredEvents.length > 0 && (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isBusy={busyEventId === event.id}
                onRegister={handleRegister}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
