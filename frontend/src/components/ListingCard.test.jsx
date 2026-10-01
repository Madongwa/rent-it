import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListingCard from './ListingCard';

vi.mock('./ui/GlowingEffect', () => ({ GlowingEffect: () => null }));

const base = { id: 'l1', title: 'Manual Wheelchair', price_per_day: 375, location: 'Gurugram, Haryana', status: 'available', category: { name: 'Medical', icon: '🩺' } };

const renderCard = (listing) =>
  render(
    <MemoryRouter>
      <ListingCard listing={listing} />
    </MemoryRouter>
  );

describe('ListingCard - same layout for every card', () => {
  it('keeps the verified-seller slot even when the owner is not verified', () => {
    const { container } = renderCard(base);
    const slot = container.querySelector('.listing-card-slot');
    expect(slot).toBeInTheDocument();
    expect(slot).toBeEmptyDOMElement();
  });

  it('fills the slot for a verified owner', () => {
    const { container } = renderCard({ ...base, owner: { verified: true } });
    expect(container.querySelector('.listing-card-slot')).toHaveTextContent('Verified seller');
  });

  it('keeps the location line without a location, and puts paused/rented with the tags', () => {
    const { container } = renderCard({ ...base, location: null, status: 'rented' });
    expect(container.querySelector('.listing-card-location')).toBeInTheDocument();
    expect(container.querySelector('.listing-card-tags')).toHaveTextContent('rented');
    // Nothing after the price row.
    expect(container.querySelector('.listing-card-price-row').nextElementSibling).toBeNull();
  });

  it('still shows price and rating', () => {
    renderCard({ ...base, review_count: 7, avg_rating: 4.4 });
    expect(screen.getByText('★4.4')).toBeInTheDocument();
  });
});
