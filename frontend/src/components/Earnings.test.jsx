import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Earnings from './Earnings';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { getEarnings: vi.fn(), getMyListings: vi.fn() } }));

const months = Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, amount: i === 7 ? 3000 : 0 }));

const renderIt = () =>
  render(
    <MemoryRouter>
      <Earnings />
    </MemoryRouter>
  );

describe('Earnings', () => {
  it('shows the totals, most-rented item and a table view', async () => {
    api.getMyListings.mockResolvedValue([{ id: 't' }]);
    api.getEarnings.mockResolvedValue({
      earned: 4000, upcoming: 2400, deals: 3, completed: 1,
      top_listing: { id: 't', title: 'Tractor', rentals: 2, amount: 5400 },
      listings: [{ id: 't', title: 'Tractor', rentals: 2, amount: 5400 }, { id: 'd', title: 'Drill', rentals: 1, amount: 1000 }],
      months, busiest_month: '2026-08',
    });
    renderIt();
    expect(await screen.findByText('₹4,000')).toBeInTheDocument();
    expect(screen.getByText('₹2,400')).toBeInTheDocument();
    expect(screen.getAllByText('Tractor').length).toBeGreaterThan(0);
    expect(screen.getByText(/Busiest: August 2026/)).toBeInTheDocument();
    expect(screen.getByText('See as a table')).toBeInTheDocument();
  });

  it('stays hidden for people who have never listed anything', async () => {
    api.getMyListings.mockResolvedValue([]);
    api.getEarnings.mockResolvedValue({ earned: 0, upcoming: 0, deals: 0, completed: 0, top_listing: null, listings: [], months, busiest_month: null });
    const { container } = renderIt();
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
