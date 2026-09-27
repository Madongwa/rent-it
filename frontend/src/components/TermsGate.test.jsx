import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api, auth } = vi.hoisted(() => ({
  api: { getMyProfile: vi.fn(), acceptTerms: vi.fn() },
  auth: { user: null, loading: false },
}));
vi.mock('../lib/api', () => ({ api }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const { default: TermsGate, TERMS_SESSION_KEY } = await import('./TermsGate.jsx');
const { TERMS_VERSION } = await import('../content/legal.js');

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TermsGate />
    </MemoryRouter>
  );
}

async function acceptBoth() {
  await userEvent.click(screen.getByLabelText('I am 18 years of age or older.'));
  await userEvent.click(screen.getByLabelText(/I have read and agree to the/));
}

beforeEach(() => {
  sessionStorage.clear();
  auth.user = null;
  auth.loading = false;
  api.getMyProfile.mockReset();
  api.acceptTerms.mockReset().mockResolvedValue({});
  document.body.style.overflow = '';
});

describe('TermsGate - visitors without an account', () => {
  it('blocks the site with the terms dialog on a new visit', () => {
    renderAt();
    expect(screen.getByRole('dialog', { name: 'Before you use Rent It' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('only enables "I agree" once both boxes are ticked', async () => {
    renderAt();
    const button = screen.getByRole('button', { name: /I agree/ });
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText('I am 18 years of age or older.'));
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/I have read and agree to the/));
    expect(button).toBeEnabled();
  });

  it('lets them in after accepting, and a refresh in the same visit does not ask again', async () => {
    const { unmount } = renderAt();
    await acceptBoth();
    await userEvent.click(screen.getByRole('button', { name: /I agree/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(TERMS_SESSION_KEY)).toBe(TERMS_VERSION);
    expect(api.acceptTerms).not.toHaveBeenCalled();

    unmount(); // "refresh"
    renderAt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks again on a new visit (fresh session)', async () => {
    const { unmount } = renderAt();
    await acceptBoth();
    await userEvent.click(screen.getByRole('button', { name: /I agree/ }));
    unmount();

    sessionStorage.clear(); // tab closed, site opened again
    renderAt();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('asks again when the terms version changes', () => {
    sessionStorage.setItem(TERMS_SESSION_KEY, '2000-01-01');
    renderAt();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the Terms page readable, with the agreement as a bar instead of a dialog', async () => {
    renderAt('/terms');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/please read these documents and accept them below/)).toBeInTheDocument();
    await acceptBoth();
    await userEvent.click(screen.getByRole('button', { name: /I agree/ }));
    expect(screen.queryByText(/please read these documents/)).not.toBeInTheDocument();
  });
});

describe('TermsGate - account holders', () => {
  beforeEach(() => {
    auth.user = { id: 'user-1' };
  });

  it('never asks someone who already accepted this version', async () => {
    api.getMyProfile.mockResolvedValue({ terms_version: TERMS_VERSION });
    renderAt();
    await waitFor(() => expect(api.getMyProfile).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.acceptTerms).not.toHaveBeenCalled();
  });

  it('asks once and records acceptance on the account', async () => {
    api.getMyProfile.mockResolvedValue({ terms_version: null });
    renderAt();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await acceptBoth();
    await userEvent.click(screen.getByRole('button', { name: /I agree/ }));

    expect(api.acceptTerms).toHaveBeenCalledWith(TERMS_VERSION);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks again when an older version was accepted', async () => {
    api.getMyProfile.mockResolvedValue({ terms_version: '2000-01-01' });
    renderAt();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('records an acceptance made as a guest earlier in this visit, without asking twice', async () => {
    sessionStorage.setItem(TERMS_SESSION_KEY, TERMS_VERSION);
    api.getMyProfile.mockResolvedValue({ terms_version: null });
    renderAt();
    await waitFor(() => expect(api.acceptTerms).toHaveBeenCalledWith(TERMS_VERSION));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for sign-in to finish before deciding, so a signed-in user never sees a flash of the dialog', () => {
    auth.loading = true;
    auth.user = null;
    renderAt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
