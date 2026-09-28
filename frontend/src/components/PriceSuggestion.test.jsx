import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({ api: { suggestPrice: vi.fn() } }));
vi.mock('../lib/api', () => ({ api }));

const { default: PriceSuggestion } = await import('./PriceSuggestion.jsx');

const form = { title: 'Mahindra 575 Tractor', category_id: '1', condition: 'Good', location: 'Ludhiana', description: '' };

// The failure test swaps in a fresh vi.fn - see PriceCheck.test.jsx.
beforeEach(() => api.suggestPrice.mockClear());

describe('PriceSuggestion', () => {
  it('needs a title and category first', () => {
    render(<PriceSuggestion form={{ ...form, title: '' }} onUse={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Suggest a price' })).toBeDisabled();
    expect(screen.getByText('Add a title and category to get a price suggestion.')).toBeInTheDocument();
  });

  it('shows the estimate and similar listings, and fills the price in on "Use"', async () => {
    api.suggestPrice.mockResolvedValue({
      estimate: { low: 1800, high: 3000, suggested: 2400, reason: 'A 45HP tractor rents for more.' },
      similar: [{ id: 't1', title: 'Compact Tractor 25HP', price_per_day: 2250, location: 'Ludhiana' }],
      similar_stats: { count: 1, min: 2250, max: 2250, median: 2250 },
    });
    const onUse = vi.fn();
    render(<PriceSuggestion form={form} listingId="me" onUse={onUse} />);

    await userEvent.click(screen.getByRole('button', { name: 'Suggest a price' }));

    expect(await screen.findByText('Items like this usually rent for ₹1,800–₹3,000 a day.')).toBeInTheDocument();
    expect(screen.getByText('A 45HP tractor rents for more.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compact Tractor 25HP' })).toHaveAttribute('href', '/listing/t1');
    expect(api.suggestPrice).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mahindra 575 Tractor', category_id: 1, listing_id: 'me' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use ₹2,400' }));
    expect(onUse).toHaveBeenCalledWith(2400);
  });

  it('shows the error when suggestions are unavailable', async () => {
    api.suggestPrice = vi.fn(() => Promise.reject(new Error('Price suggestions are unavailable right now - please try again in a minute.')));
    render(<PriceSuggestion form={form} onUse={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Suggest a price' }));
    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
  });
});
