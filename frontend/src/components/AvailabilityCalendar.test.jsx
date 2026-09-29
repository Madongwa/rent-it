import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AvailabilityCalendar from './AvailabilityCalendar';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
// Two days this month (clamped so the test works on any day of the month).
const d1 = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 25));
const d2 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate() + 1);

describe('AvailabilityCalendar', () => {
  it('marks booked and owner-blocked days and lists them', () => {
    const { container } = render(
      <AvailabilityCalendar
        ranges={[
          { start_date: iso(d1), end_date: iso(d1), kind: 'blocked' },
          { start_date: iso(d2), end_date: iso(d2), kind: 'booked' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-kind="blocked"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-kind="booked"]')).toHaveLength(1);
    expect(screen.getByText('Not available:')).toBeInTheDocument();
    expect(screen.getByText(/· Owner unavailable$/)).toBeInTheDocument();
    expect(screen.getByText(/· Booked$/)).toBeInTheDocument();
  });

  it('says any dates are free when nothing is taken', () => {
    render(<AvailabilityCalendar ranges={[]} />);
    expect(screen.getByText(/No dates are taken yet/)).toBeInTheDocument();
  });
});
