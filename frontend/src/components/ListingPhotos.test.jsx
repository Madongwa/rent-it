import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
const { default: ListingPhotos } = await import('./ListingPhotos.jsx');

describe('ListingPhotos', () => {
  it('marks the first photo as the cover and can make another one the cover', async () => {
    const onChange = vi.fn();
    render(<ListingPhotos userId="u1" photos={['a.jpg', 'b.jpg']} onChange={onChange} />);

    expect(screen.getByText('Cover')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make cover' }));
    expect(onChange).toHaveBeenCalledWith(['b.jpg', 'a.jpg']);
  });

  it('removes a photo', async () => {
    const onChange = vi.fn();
    render(<ListingPhotos userId="u1" photos={['a.jpg', 'b.jpg']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(onChange).toHaveBeenCalledWith(['b.jpg']);
  });

  it('hides the upload button once there are 8 photos', () => {
    render(<ListingPhotos userId="u1" photos={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}.jpg`)} onChange={vi.fn()} />);
    expect(screen.queryByText(/Add more photos/)).not.toBeInTheDocument();
  });
});
