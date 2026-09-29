import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({ api: { getBlockedDates: vi.fn(), addBlockedDates: vi.fn(), removeBlockedDates: vi.fn() } }));
vi.mock('../lib/api', () => ({ api }));
const { default: BlockedDatesEditor } = await import('./BlockedDatesEditor.jsx');

describe('BlockedDatesEditor', () => {
  it("adds and removes the owner's blocked dates", async () => {
    api.getBlockedDates.mockResolvedValue([{ id: 'b1', start_date: '2099-10-01', end_date: '2099-10-03', note: 'Servicing' }]);
    api.addBlockedDates.mockResolvedValue({ id: 'b2', start_date: '2099-11-05', end_date: '2099-11-05', note: null });
    api.removeBlockedDates.mockResolvedValue(null);
    const { container } = render(<BlockedDatesEditor listingId="l1" />);

    expect(await screen.findByText(/Servicing/)).toBeInTheDocument();

    const [from, to] = container.querySelectorAll('input[type="date"]');
    fireEvent.change(from, { target: { value: '2099-11-05' } });
    fireEvent.change(to, { target: { value: '2099-11-05' } });
    await userEvent.click(screen.getByRole('button', { name: 'Block dates' }));
    expect(api.addBlockedDates).toHaveBeenCalledWith('l1', { start_date: '2099-11-05', end_date: '2099-11-05', note: '' });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Make available' })).toHaveLength(2));

    await userEvent.click(screen.getAllByRole('button', { name: 'Make available' })[0]);
    expect(api.removeBlockedDates).toHaveBeenCalledWith('l1', 'b1');
    await waitFor(() => expect(screen.queryByText(/Servicing/)).not.toBeInTheDocument());
  });
});
