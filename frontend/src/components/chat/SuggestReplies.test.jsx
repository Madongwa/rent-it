import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { api } = vi.hoisted(() => ({ api: { suggestReplies: vi.fn() } }));
vi.mock('../../lib/api', () => ({ api }));

const { default: SuggestReplies } = await import('./SuggestReplies.jsx');

beforeEach(() => api.suggestReplies.mockClear());

describe('SuggestReplies', () => {
  it("asks in the user's language and puts a picked draft in the message box", async () => {
    api.suggestReplies.mockResolvedValue({ replies: ['हाँ, 7 बजे ठीक है।', 'आप कहाँ मिलेंगे?'] });
    const onPick = vi.fn();
    render(<SuggestReplies conversationId="c1" lang="hi" onPick={onPick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Suggest replies' }));
    expect(api.suggestReplies).toHaveBeenCalledWith('c1', 'hi');

    await userEvent.click(await screen.findByRole('button', { name: 'आप कहाँ मिलेंगे?' }));
    expect(onPick).toHaveBeenCalledWith('आप कहाँ मिलेंगे?');
    // Picked - the drafts go away, nothing was sent.
    expect(screen.queryByRole('button', { name: 'हाँ, 7 बजे ठीक है।' })).not.toBeInTheDocument();
  });

  it('says so when there is nothing to suggest yet', async () => {
    api.suggestReplies.mockResolvedValue({ replies: [] });
    render(<SuggestReplies conversationId="c1" lang="en" onPick={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Suggest replies' }));
    expect(await screen.findByText(/Nothing to suggest yet/)).toBeInTheDocument();
  });
});
