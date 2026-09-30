import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StaffInsights from './StaffInsights';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { getStaffAnalytics: vi.fn() } }));

describe('StaffInsights', () => {
  it('shows the funnel and the searches that found nothing', async () => {
    api.getStaffAnalytics.mockResolvedValue({
      days: 30, searches: 40, no_result_share: 25,
      top_searches: [{ term: 'tractor', count: 9 }],
      no_result_searches: [{ term: 'crane', count: 4 }],
      funnel: { chats: 20, requests: 10, deals: 5, completed: 2 },
      wanted_open: 3,
    });
    render(
      <MemoryRouter>
        <StaffInsights />
      </MemoryRouter>
    );
    expect(await screen.findByText('crane')).toBeInTheDocument();
    expect(screen.getByText('50% of chats')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'crane' })).toHaveAttribute('href', '/marketplace?q=crane');
  });
});
