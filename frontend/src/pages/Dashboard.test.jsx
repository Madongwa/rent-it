import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: {
    getMyListings: vi.fn(),
    getMyRentals: vi.fn(),
    getIncomingRentals: vi.fn(),
    acceptOffer: vi.fn(),
    updateRentalStatus: vi.fn(),
    getMyProfile: vi.fn(async () => ({ id_verified: true })),
  },
}));

vi.mock('../lib/api', () => ({ api }));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

const { default: Dashboard } = await import('./Dashboard.jsx');

const listing = { id: 'listing-1', title: 'Rotavator 5ft', price_per_day: 600, deposit_required: false, deposit_amount: null };

function rental(overrides) {
  return {
    id: 'rental-1',
    listing_id: listing.id,
    renter_id: 'renter-1',
    status: 'pending',
    start_date: '2099-10-12',
    end_date: '2099-10-15',
    price_per_day: 450,
    listed_price_per_day: 600,
    conversation_id: 'conv-1',
    listing,
    renter: { id: 'renter-1', full_name: 'Ravi' },
    offers: [{ id: 'o1', proposed_by: 'renter-1', price_per_day: 450, status: 'open' }],
    pickup_photo_urls: [],
    return_photo_urls: [],
    ...overrides,
  };
}

function renderTab(tab, { mine = [], incoming = [] }) {
  api.getMyListings.mockResolvedValue([]);
  api.getMyRentals.mockResolvedValue(mine);
  api.getIncomingRentals.mockResolvedValue(incoming);
  return render(
    <MemoryRouter initialEntries={[`/dashboard?tab=${tab}`]}>
      <Dashboard />
    </MemoryRouter>
  );
}

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('Dashboard - offers', () => {
  it("shows the owner the offer vs listed price, and Accept when it's their turn", async () => {
    api.acceptOffer.mockResolvedValue({});
    renderTab('incoming', { incoming: [rental()] });

    expect(await screen.findByText(/\(listed ₹600\) · total ₹1,800/)).toBeInTheDocument();
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open chat' })).toHaveAttribute('href', '/messages?c=conv-1');

    await userEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    expect(api.acceptOffer).toHaveBeenCalledWith('rental-1');
  });

  it("hides the owner's Accept while the renter is answering a counter-offer", async () => {
    renderTab('incoming', {
      incoming: [rental({ price_per_day: 525, offers: [{ id: 'o2', proposed_by: 'owner-1', price_per_day: 525, status: 'open' }] })],
    });

    expect(await screen.findByText('Waiting for renter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it("offers the renter Accept on the owner's counter, and Withdraw", async () => {
    renderTab('mine', {
      mine: [rental({ price_per_day: 525, offers: [{ id: 'o2', proposed_by: 'owner-1', price_per_day: 525, status: 'open' }] })],
    });

    expect(await screen.findByRole('button', { name: 'Accept counter-offer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });

  it('shows an approved rental at its agreed price with no payment step', async () => {
    renderTab('incoming', { incoming: [rental({ status: 'approved', price_per_day: 525, offers: [] })] });

    expect(await screen.findByText(/\(listed ₹600\) · total ₹2,100/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark completed' })).toBeInTheDocument();
    expect(screen.queryByText(/payment|paid/i)).not.toBeInTheDocument();
  });

  it('falls back to the listing price for requests made before offers existed', async () => {
    renderTab('incoming', { incoming: [rental({ price_per_day: null, listed_price_per_day: null, offers: [], conversation_id: null })] });

    expect(await screen.findByText(/total ₹2,400/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept offer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open chat' })).not.toBeInTheDocument();
  });
});
