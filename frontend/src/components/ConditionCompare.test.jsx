import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConditionCompare from './ConditionCompare';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { comparePhotos: vi.fn(), adminComparePhotos: vi.fn() } }));

describe('ConditionCompare', () => {
  it('shows the AI read as a suggestion', async () => {
    api.comparePhotos.mockResolvedValue({
      result: { verdict: 'possible_new_damage', findings: ['New crack on the handle'], note: 'Check the handle.', pickup_photos: 2, return_photos: 1 },
    });
    render(<ConditionCompare rentalId="r1" />);
    await userEvent.click(screen.getByRole('button', { name: /Compare pickup and return photos/ }));
    expect(await screen.findByText('Possible new damage')).toBeInTheDocument();
    expect(screen.getByText('New crack on the handle')).toBeInTheDocument();
    expect(screen.getByText(/look at the item together/)).toBeInTheDocument();
    expect(api.comparePhotos).toHaveBeenCalledWith('r1');
  });

  it('uses the staff endpoint for staff', async () => {
    api.adminComparePhotos.mockResolvedValue({ result: { verdict: 'unclear', findings: [], note: '', pickup_photos: 1, return_photos: 1 } });
    render(<ConditionCompare rentalId="r2" staff />);
    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Can't tell/)).toBeInTheDocument();
    expect(api.adminComparePhotos).toHaveBeenCalledWith('r2');
  });
});
