import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { priceVsRange } from '../lib/offers';

const { api } = vi.hoisted(() => ({ api: { getPriceCheck: vi.fn() } }));
vi.mock('../lib/api', () => ({ api }));

const { default: PriceCheck } = await import('./PriceCheck.jsx');

const check = {
  estimate: { low: 600, high: 1000, suggested: 800, reason: 'Tillers are mid-priced.' },
  similar: [{ id: 'a', title: 'Tiller', price_per_day: 875 }],
  similar_stats: { count: 1, min: 875, max: 875, median: 875 },
};

// The failure tests swap in a fresh vi.fn: reusing this one after a
// resolved call made Vitest report the caught rejection as a test failure.
beforeEach(() => api.getPriceCheck.mockClear());

describe('priceVsRange', () => {
  it('places a price below, within or above the range', () => {
    expect(priceVsRange(500, 600, 1000)).toBe('below');
    expect(priceVsRange(600, 600, 1000)).toBe('within');
    expect(priceVsRange(1200, 600, 1000)).toBe('above');
    expect(priceVsRange(null, 600, 1000)).toBeNull();
  });
});

describe('PriceCheck', () => {
  it('shows the usual range, similar listings and where the offer sits', async () => {
    api.getPriceCheck.mockResolvedValue(check);
    render(<PriceCheck listingId="l1" price={500} />);

    expect(await screen.findByText('Items like this usually rent for ₹600–₹1,000 a day.')).toBeInTheDocument();
    expect(screen.getByText('1 similar item on Rent It: ₹875/day.')).toBeInTheDocument();
    expect(screen.getByText('₹500 is below the usual range for items like this.')).toBeInTheDocument();
    expect(screen.getByText('AI estimate')).toBeInTheDocument();
    expect(api.getPriceCheck).toHaveBeenCalledWith('l1');
  });

  it('shows nothing when no estimate is available', async () => {
    api.getPriceCheck = vi.fn(() => Promise.reject(new Error('unavailable')));
    const { container } = render(<PriceCheck listingId="l1" price={500} />);
    await waitFor(() => expect(api.getPriceCheck).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
