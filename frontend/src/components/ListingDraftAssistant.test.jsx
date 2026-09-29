import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({ api: { draftListing: vi.fn() } }));
vi.mock('../lib/api', () => ({ api }));

const { default: ListingDraftAssistant } = await import('./ListingDraftAssistant.jsx');

beforeEach(() => api.draftListing.mockClear());

describe('ListingDraftAssistant', () => {
  it('sends the notes (and photo) and hands the draft to the form', async () => {
    const draft = { title: 'Bosch 18V Cordless Drill', category_id: 3, used_photo: true };
    api.draftListing.mockResolvedValue(draft);
    const onApply = vi.fn();
    render(<ListingDraftAssistant imageUrls={['https://x/listing-images/a.jpg']} onApply={onApply} />);

    expect(screen.getByRole('button', { name: 'Fill in the form' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Describe your item/), 'bosch drill 18v');
    await userEvent.click(screen.getByRole('button', { name: 'Fill in the form' }));

    expect(api.draftListing).toHaveBeenCalledWith({ notes: 'bosch drill 18v', image_urls: ['https://x/listing-images/a.jpg'] });
    expect(onApply).toHaveBeenCalledWith(draft);
    expect(await screen.findByText(/from your notes and photos - check every field/)).toBeInTheDocument();
  });

  it('shows the error when the writer is unavailable', async () => {
    api.draftListing = vi.fn(() => Promise.reject(new Error('The listing writer is unavailable right now - please try again in a minute.')));
    const onApply = vi.fn();
    render(<ListingDraftAssistant onApply={onApply} />);
    await userEvent.type(screen.getByLabelText(/Describe your item/), 'tractor');
    await userEvent.click(screen.getByRole('button', { name: 'Fill in the form' }));
    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});
