import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.jsx';
import { INITIAL_EVENTS } from './data/mockEvents.js';

function createInstantLoader(events = INITIAL_EVENTS) {
  return async (mode) => {
    if (mode === 'error') {
      throw new Error('Network error while fetching events');
    }
    if (mode === 'empty') {
      return [];
    }
    return events.map((ev) => ({ ...ev }));
  };
}

describe('Campus Event Registration UI', () => {
  it('shows loading skeleton first and then renders campus events', async () => {
    render(<App loader={createInstantLoader()} />);

    expect(screen.getByRole('status', { name: /loading campus events/i })).toBeInTheDocument();

    expect(await screen.findByText('Campus AI & Robotics Mini-Hack')).toBeInTheDocument();
    expect(screen.getByText('Product Design Portfolio Critique')).toBeInTheDocument();
  });

  it('registers for an open event and switches to waitlist when at capacity', async () => {
    render(<App loader={createInstantLoader()} />);
    await screen.findByText('Campus AI & Robotics Mini-Hack');

    // Open event (38/40) -> Register Now
    const aiCard = screen.getByTestId('event-card-evt-ai-hackathon');
    const registerBtn = aiCard.querySelector('button');
    fireEvent.click(registerBtn);

    expect(aiCard).toHaveTextContent('Confirmed');
    expect(aiCard).toHaveTextContent('39/40 registered');

    // Full event (25/25, 4 waitlisted) -> Join Waitlist
    const designCard = screen.getByTestId('event-card-evt-design-critique');
    const waitlistBtn = designCard.querySelector('button');
    expect(waitlistBtn).toHaveTextContent('Join Waitlist');
    fireEvent.click(waitlistBtn);

    expect(designCard).toHaveTextContent('On Waitlist');
    expect(designCard).toHaveTextContent('25/25 registered · 5 waitlisted');
  });

  it('shows empty state when search matches nothing and clears filters on action', async () => {
    render(<App loader={createInstantLoader()} />);
    await screen.findByText('Campus AI & Robotics Mini-Hack');

    const searchInput = screen.getByRole('searchbox', { name: /search campus events/i });
    fireEvent.change(searchInput, { target: { value: 'nonexistent-club-xyz' } });

    expect(screen.getByText('No matching campus events')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByText('Campus AI & Robotics Mini-Hack')).toBeInTheDocument();
  });

  it('renders error state on failure and recovers when Retry is clicked', async () => {
    render(<App loader={createInstantLoader()} initialDemoMode="error" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load campus events');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText('Campus AI & Robotics Mini-Hack')).toBeInTheDocument();
    });
  });
});
