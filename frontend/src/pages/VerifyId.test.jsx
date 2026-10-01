import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api, upload } = vi.hoisted(() => ({
  api: { getMyRenterId: vi.fn(), submitRenterId: vi.fn() },
  upload: vi.fn(async () => ({ error: null })),
}));
vi.mock('../lib/api', () => ({ api }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { storage: { from: () => ({ upload }) } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../hooks/useSeo', () => ({ default: () => {} }));
vi.mock('../lib/chatAttachments', () => ({ shrinkImage: async (f) => f }));

const { default: VerifyId } = await import('./VerifyId.jsx');
const renderPage = () => render(<MemoryRouter><VerifyId /></MemoryRouter>);

beforeEach(() => {
  api.getMyRenterId.mockReset();
  api.submitRenterId.mockReset();
  upload.mockClear();
});

describe('VerifyId', () => {
  it('uploads to my own private folder and shows the result', async () => {
    api.getMyRenterId.mockResolvedValue({ verified: false, status: 'none' });
    api.submitRenterId.mockResolvedValue({ status: 'verified' });
    renderPage();
    await userEvent.click(await screen.findByText('Driving licence'));
    await userEvent.upload(screen.getByLabelText(/Photo of the front/), new File(['x'], 'dl.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /Verify my ID/ }));
    expect(await screen.findByText('Your ID is verified')).toBeInTheDocument();
    expect(upload.mock.calls[0][0]).toMatch(/^u1\/renter-id-/);
    expect(api.submitRenterId).toHaveBeenCalledWith(expect.objectContaining({ id_type: 'driving_licence' }));
  });

  it('asks for the masked Aadhaar', async () => {
    api.getMyRenterId.mockResolvedValue({ verified: false, status: 'none' });
    renderPage();
    await userEvent.click(await screen.findByText('Aadhaar (masked)'));
    expect(screen.getByText(/myaadhaar.uidai.gov.in/)).toBeInTheDocument();
  });

  it('shows the reason when an ID was refused', async () => {
    api.getMyRenterId.mockResolvedValue({ verified: false, status: 'rejected', rejection_reason: 'Your full Aadhaar number was visible.' });
    renderPage();
    expect(await screen.findByText(/Your full Aadhaar number was visible/)).toBeInTheDocument();
  });
});
