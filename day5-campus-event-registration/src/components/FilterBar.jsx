import React from 'react';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Events' },
  { id: 'open', label: 'Open Spots' },
  { id: 'waitlist', label: 'Waitlist Only' },
  { id: 'registered', label: 'My Signups' },
];

const DEMO_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
];

/**
 * Controlled filter, search, and state-demo bar.
 * State is owned by the parent page so filtering and demo modes stay synchronized.
 */
export function FilterBar({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  demoMode,
  onDemoModeChange,
}) {
  return (
    <section className="filter-bar" aria-label="Filter and state controls">
      <div className="filter-row">
        <input
          type="search"
          className="search-input"
          placeholder="Search events, clubs, or venues..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search campus events"
        />

        <div className="filter-pills" role="tablist" aria-label="Event availability filter">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === option.id}
              className={`pill-btn ${activeFilter === option.id ? 'pill-btn--active' : ''}`}
              onClick={() => onFilterChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="demo-bar" aria-label="UI state preview controls">
        <span className="demo-label">Preview UI state:</span>
        <div className="demo-pills">
          {DEMO_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`demo-btn ${demoMode === mode.id ? 'demo-btn--active' : ''}`}
              onClick={() => onDemoModeChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
