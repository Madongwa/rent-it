import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RenterIdsTab from './RenterIdsTab';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { adminRenterIds: vi.fn(), adminReviewRenterId: vi.fn() } }));
const DocLink = ({ children }) => <span>doc:{children}</span>;

describe('RenterIdsTab', () => {
  it('lists IDs waiting for staff and verifies one', async () => {
    api.adminRenterIds.mockResolvedValue([
      { user_id: 'u1', id_type: 'pan', document_path: 'u1/x.jpg', status: 'pending', method: null, ai_result: { looks_like_id: 'yes', readable: 'partly', name_match: 'unclear', issues: ['glare'] }, submitted_at: '2026-10-01T10:00:00Z', person: { full_name: 'Asha Rao' } },
    ]);
    api.adminReviewRenterId.mockResolvedValue({ status: 'verified' });
    render(<RenterIdsTab DocLink={DocLink} />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText(/glare/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(api.adminReviewRenterId).toHaveBeenCalledWith('u1', 'verify', undefined);
  });
});
