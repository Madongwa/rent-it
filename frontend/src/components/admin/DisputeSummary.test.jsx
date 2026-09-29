import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({ api: { getDisputeSummary: vi.fn() } }));
vi.mock('../../lib/api', () => ({ api }));

const { default: DisputeSummary } = await import('./DisputeSummary.jsx');

const summary = {
  summary: 'The Owner reports a bent blade; the Renter says it was already bent.',
  facts: ['No pickup photos were uploaded'],
  check: ['Ask the Renter for photos taken at pickup'],
};

beforeEach(() => api.getDisputeSummary.mockClear());

describe('DisputeSummary', () => {
  it('summarises on request and shows the facts and what to check', async () => {
    api.getDisputeSummary.mockResolvedValue(summary);
    render(<DisputeSummary disputeId="d1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Summarise with AI' }));

    expect(await screen.findByText(summary.summary)).toBeInTheDocument();
    expect(screen.getByText('No pickup photos were uploaded')).toBeInTheDocument();
    expect(screen.getByText('Ask the Renter for photos taken at pickup')).toBeInTheDocument();
    expect(screen.getByText(/not the chat/)).toBeInTheDocument();
    expect(api.getDisputeSummary).toHaveBeenCalledWith('d1', false);
  });

  it('shows a saved summary straight away, and can make a new one', async () => {
    api.getDisputeSummary.mockResolvedValue({ ...summary, summary: 'Updated.' });
    render(<DisputeSummary disputeId="d1" initial={summary} />);

    expect(screen.getByText(summary.summary)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make a new summary' }));
    expect(await screen.findByText('Updated.')).toBeInTheDocument();
    expect(api.getDisputeSummary).toHaveBeenCalledWith('d1', true);
  });

  it('shows the error when summaries are unavailable', async () => {
    api.getDisputeSummary = vi.fn(() => Promise.reject(new Error('Summaries are unavailable right now - please try again in a minute.')));
    render(<DisputeSummary disputeId="d1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Summarise with AI' }));
    expect(await screen.findByText(/unavailable right now/)).toBeInTheDocument();
  });
});
