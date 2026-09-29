import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingGallery from './ListingGallery';

const photos = ['a.jpg', 'b.jpg', 'c.jpg'];

describe('ListingGallery', () => {
  it('steps through photos with the buttons, arrow keys and thumbnails', async () => {
    render(<ListingGallery photos={photos} title="Tractor" fallback="🚜" />);
    const main = () => screen.getByAltText(/Tractor - photo/);

    expect(main()).toHaveAttribute('src', 'a.jpg');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(main()).toHaveAttribute('src', 'b.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(main()).toHaveAttribute('src', 'c.jpg'); // wraps around

    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    expect(main()).toHaveAttribute('src', 'a.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Show photo 2' }));
    expect(main()).toHaveAttribute('src', 'b.jpg');
  });

  it('shows just the photo when there is one, and the fallback when there are none', () => {
    const { rerender } = render(<ListingGallery photos={['a.jpg']} title="Drill" fallback="🧰" />);
    expect(screen.getByAltText('Drill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();

    rerender(<ListingGallery photos={[]} title="Drill" fallback="🧰" />);
    expect(screen.getByText('🧰')).toBeInTheDocument();
  });
});
