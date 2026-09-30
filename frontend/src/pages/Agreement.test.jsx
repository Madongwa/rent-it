import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Agreement from './Agreement';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { getAgreement: vi.fn() } }));
vi.mock('../hooks/useSeo', () => ({ default: () => {} }));

const en = {
  title: 'Rental agreement', intro: 'A record.', reference: 'Reference', owner: 'Owner', renter: 'Renter', item: 'Item',
  location: 'Location', period: 'Rental period', days: 'days', pricePerDay: 'Agreed price per day', total: 'Total rent',
  deposit: 'Deposit', noDeposit: 'No deposit', cancellation: 'Cancellation policy', photos: 'Condition photos',
  pickupPhotos: 'taken at pickup', returnPhotos: 'taken at return', status: 'Status', statusApproved: 'Agreed',
  statusCompleted: 'Completed', statusDisputed: 'A problem was reported', termsHeading: 'What both people agreed to',
  term1: 'T1', term2: 'T2', term3: 'T3', term4: 'T4', term5: 'T5', footer: 'Footer', free: 'Free cancellation', flexible: 'Flexible', strict: 'Strict',
};

describe('Agreement', () => {
  it('shows the deal in English with the other language underneath', async () => {
    api.getAgreement.mockResolvedValue({
      agreement: {
        id: 'abcdef12-3456', status: 'approved', created_at: '2026-09-30T10:00:00Z', owner_name: 'Gurpreet', renter_name: 'Asha',
        item: 'Tractor', location: 'Ludhiana', condition: 'Good', start_date: '2026-10-05', end_date: '2026-10-07', days: 3,
        price_per_day: 1500, total: 4500, deposit: 5000, cancellation_policy: 'flexible', pickup_photos: 2, return_photos: 0,
      },
      languages: ['en', 'hi'],
      text: { en, hi: { ...en, title: 'किरायानामा' } },
    });
    render(
      <MemoryRouter initialEntries={['/rentals/r1/agreement']}>
        <Routes>
          <Route path="/rentals/:id/agreement" element={<Agreement />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('किरायानामा')).toBeInTheDocument();
    expect(screen.getByText('Rental agreement')).toBeInTheDocument();
    expect(screen.getByText('₹4,500')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save as PDF/ })).toBeInTheDocument();
    expect(screen.getByText(/ABCDEF12/)).toBeInTheDocument();
  });

  it('explains when the deal is not agreed yet', async () => {
    api.getAgreement.mockRejectedValue(new Error('The agreement is ready once both of you have agreed the deal.'));
    render(
      <MemoryRouter initialEntries={['/rentals/r1/agreement']}>
        <Routes>
          <Route path="/rentals/:id/agreement" element={<Agreement />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/once both of you have agreed/)).toBeInTheDocument();
  });
});
