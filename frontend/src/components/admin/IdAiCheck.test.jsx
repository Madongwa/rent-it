import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdAiCheck from './IdAiCheck';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { aiCheckKyc: vi.fn() } }));

describe('IdAiCheck', () => {
  it('shows the checks as a suggestion', async () => {
    api.aiCheckKyc.mockResolvedValue({ looks_like_id: 'yes', readable: 'yes', name_match: 'mismatch', document_type: 'pan', issues: ['Name differs'], sides_checked: 2 });
    render(<IdAiCheck userId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: /AI check/ }));
    expect(await screen.findByText(/name doesn't match the application/)).toBeInTheDocument();
    expect(screen.getByText('Name differs')).toBeInTheDocument();
    expect(screen.getByText(/decide yourself/)).toBeInTheDocument();
  });
});
