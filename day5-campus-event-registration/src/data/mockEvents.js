export const INITIAL_EVENTS = [
  {
    id: 'evt-ai-hackathon',
    title: 'Campus AI & Robotics Mini-Hack',
    club: 'ACM Student Chapter',
    category: 'Tech',
    dateLabel: 'Fri, Nov 28 · 4:00 PM',
    venue: 'Innovation Lab 204',
    capacity: 40,
    registeredCount: 38,
    waitlistCount: 0,
    userStatus: 'none',
  },
  {
    id: 'evt-design-critique',
    title: 'Product Design Portfolio Critique',
    club: 'Design Collective',
    category: 'Design',
    dateLabel: 'Sat, Nov 29 · 11:00 AM',
    venue: 'Studio B, Arts Block',
    capacity: 25,
    registeredCount: 25,
    waitlistCount: 4,
    userStatus: 'none',
  },
  {
    id: 'evt-acoustic-night',
    title: 'Rooftop Acoustic Jam & Open Mic',
    club: 'Music Society',
    category: 'Culture',
    dateLabel: 'Sat, Nov 29 · 7:00 PM',
    venue: 'Student Union Terrace',
    capacity: 60,
    registeredCount: 42,
    waitlistCount: 0,
    userStatus: 'registered',
  },
  {
    id: 'evt-founders-fireside',
    title: 'Alumni Founders Fireside Chat',
    club: 'E-Cell',
    category: 'Career',
    dateLabel: 'Mon, Dec 1 · 5:30 PM',
    venue: 'Main Auditorium',
    capacity: 120,
    registeredCount: 120,
    waitlistCount: 11,
    userStatus: 'waitlisted',
  },
];

/**
 * Simulates fetching campus events from an API.
 * Supports 'normal', 'empty', and 'error' modes for state demonstration.
 */
export async function fetchCampusEvents(mode = 'normal', delayMs = 250) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (mode === 'error') {
    throw new Error('Unable to reach the Campus Events service. Please try again.');
  }
  if (mode === 'empty') {
    return [];
  }
  return INITIAL_EVENTS.map((event) => ({ ...event }));
}
