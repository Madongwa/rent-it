import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListingInsights from './ListingInsights';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { getListingInsights: vi.fn() } }));

describe('ListingInsights', () => {
  it('shows tips, demand and the seasonal hint', async () => {
    api.getListingInsights.mockResolvedValue({
      tips: [{ key: 'weekly', text: 'Add a weekly price.' }],
      demand: { recent: 7, previous: 3, days: 14 },
      season: 'Tractors are wanted most before rabi sowing.',
    });
    render(
      <MemoryRouter>
        <ListingInsights listingId="l1" />
      </MemoryRouter>
    );
    expect(await screen.findByText('Add a weekly price.')).toBeInTheDocument();
    expect(screen.getByText(/7 searches for this kind of item in the last 14 days - up from 3/)).toBeInTheDocument();
    expect(screen.getByText(/rabi sowing/)).toBeInTheDocument();
  });
});
