import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrustBadges from './TrustBadges';

describe('TrustBadges', () => {
  it('shows each badge the owner has earned', () => {
    render(
      <TrustBadges
        trust={{ verified: true, reply_label: 'Replies within an hour', completed_rentals: 1, rating: 4.6, reviews: 12, member_since: 2025 }}
      />
    );
    for (const text of ['Verified seller', 'Replies within an hour', '1 rental completed', '4.6 from 12 reviews', 'On Rent It since 2025']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('leaves out badges without data, and shows nothing at all without trust info', () => {
    const { container, rerender } = render(
      <TrustBadges trust={{ verified: false, reply_label: null, completed_rentals: 0, rating: null, reviews: 0, member_since: 2026 }} />
    );
    expect(screen.queryByText('Verified seller')).not.toBeInTheDocument();
    expect(screen.getByText('On Rent It since 2026')).toBeInTheDocument();

    rerender(<TrustBadges trust={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
