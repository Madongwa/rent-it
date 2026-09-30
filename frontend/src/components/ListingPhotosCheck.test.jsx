import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingPhotos from './ListingPhotos';
import { api } from '../lib/api';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/api', () => ({ api: { checkPhotos: vi.fn() } }));

describe('ListingPhotos - Check my photos', () => {
  it('marks the photos the AI had problems with, as advice', async () => {
    api.checkPhotos.mockResolvedValue({
      photos: [
        { url: 'a.jpg', problems: [] },
        { url: 'b.jpg', problems: [{ code: 'dark', label: 'Too dark to see the item' }] },
      ],
    });
    render(<ListingPhotos userId="u1" photos={['a.jpg', 'b.jpg']} title="Drill" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Check my photos/ }));
    expect(await screen.findByText(/1 photo could be better/)).toBeInTheDocument();
    expect(screen.getByText(/Too dark to see the item/)).toBeInTheDocument();
    expect(api.checkPhotos).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 'Drill');
  });
});
