import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api } = vi.hoisted(() => ({
  api: { getSafetyQueue: vi.fn(), runSafetyScan: vi.fn(), dismissSafetyFlag: vi.fn(), updateAdminListingStatus: vi.fn() },
}));
vi.mock('../../lib/api', () => ({ api }));

const { default: SafetyTab } = await import('./SafetyTab.jsx');

const flag = {
  listing_id: 'l2',
  severity: 'high',
  reasons: ['Asks for payment in advance', 'Price far too low'],
  listing: { id: 'l2', title: 'JCB Backhoe', price_per_day: 150, status: 'available', owner: { full_name: 'Ravi' } },
};

function renderTab(props = {}) {
  return render(
    <MemoryRouter>
      <SafetyTab {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => Object.values(api).forEach((fn) => fn.mockClear()));

describe('SafetyTab', () => {
  it('reviews new listings when opened, then shows what was flagged', async () => {
    api.getSafetyQueue.mockResolvedValueOnce({ flagged: [], pending: 3 }).mockResolvedValue({ flagged: [flag], pending: 0 });
    api.runSafetyScan.mockResolvedValue({ reviewed: 3, flagged: 1, failed: 0, remaining: 0 });
    renderTab();

    expect(await screen.findByRole('link', { name: 'JCB Backhoe' })).toHaveAttribute('href', '/listing/l2');
    expect(api.runSafetyScan).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Asks for payment in advance')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('says so when the AI could not check everything', async () => {
    api.getSafetyQueue.mockResolvedValue({ flagged: [], pending: 2 });
    api.runSafetyScan.mockResolvedValue({ reviewed: 0, flagged: 0, failed: 2, remaining: 2 });
    renderTab();
    expect(await screen.findByText("2 listings couldn't be checked right now - try again in a few minutes.")).toBeInTheDocument();
  });

  it('marks a listing fine, or removes it', async () => {
    api.getSafetyQueue.mockResolvedValue({ flagged: [flag], pending: 0 });
    api.dismissSafetyFlag.mockResolvedValue({});
    api.updateAdminListingStatus.mockResolvedValue({});
    const onListingRemoved = vi.fn();
    renderTab({ onListingRemoved });

    await userEvent.click(await screen.findByRole('button', { name: 'Looks fine' }));
    expect(api.dismissSafetyFlag).toHaveBeenCalledWith('l2');

    await userEvent.click(screen.getByRole('button', { name: 'Remove listing' }));
    await waitFor(() => expect(api.updateAdminListingStatus).toHaveBeenCalledWith('l2', 'inactive'));
    expect(onListingRemoved).toHaveBeenCalled();
    expect(api.runSafetyScan).not.toHaveBeenCalled();
  });
});
