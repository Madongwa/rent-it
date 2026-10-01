import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfferForm from './OfferForm.jsx';

function setDates(container, start, end) {
  const [startInput, endInput] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(startInput, { target: { value: start } });
  fireEvent.change(endInput, { target: { value: end } });
}

describe('OfferForm', () => {
  it('starts at the listed price and shows it alongside', () => {
    render(<OfferForm listedPrice={600} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Your price per day')).toHaveValue(600);
    expect(screen.getByText('Listed ₹600/day')).toBeInTheDocument();
    expect(screen.getByText('Listed price')).toBeInTheDocument();
  });

  it('shows how far the offer is from the listed price, the total, and the deposit', async () => {
    const { container } = render(
      <OfferForm listedPrice={600} depositRequired depositAmount={2000} onSubmit={vi.fn()} />
    );
    const price = screen.getByLabelText('Your price per day');
    await userEvent.clear(price);
    await userEvent.type(price, '450');
    setDates(container, '2099-10-12', '2099-10-15');

    expect(screen.getByText('₹150/day below listed')).toBeInTheDocument();
    expect(screen.getByText('₹450 × 4 days')).toBeInTheDocument();
    expect(screen.getByText('₹1,800')).toBeInTheDocument();
    expect(screen.getByText(/₹2,000 refundable deposit, paid to the owner at pickup/)).toBeInTheDocument();
  });

  it('submits the dates and price as numbers', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const { container } = render(<OfferForm listedPrice={600} onSubmit={onSubmit} />);
    const price = screen.getByLabelText('Your price per day');
    await userEvent.clear(price);
    await userEvent.type(price, '525');
    setDates(container, '2099-10-12', '2099-10-15');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(onSubmit).toHaveBeenCalledWith({ start_date: '2099-10-12', end_date: '2099-10-15', price_per_day: 525 });
  });

  it("won't submit without dates or with a zero price", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<OfferForm listedPrice={600} onSubmit={onSubmit} />);

    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('Please choose a start and end date.')).toBeInTheDocument();

    setDates(container, '2099-10-12', '2099-10-15');
    fireEvent.change(screen.getByLabelText('Your price per day'), { target: { value: '0' } });
    fireEvent.submit(container.querySelector('form'));
    expect(await screen.findByText('Enter the price you want to pay per day.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an error thrown by the request inline', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('This item is already booked for part of those dates'));
    const { container } = render(<OfferForm listedPrice={600} onSubmit={onSubmit} />);
    setDates(container, '2099-10-12', '2099-10-15');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText('This item is already booked for part of those dates')).toBeInTheDocument();
  });

  it('switches to the weekly rate for 7+ days, until the renter types their own price', async () => {
    const rates = { price_per_day: 1000, price_per_week: 5600 };
    const { container } = render(<OfferForm listedPrice={1000} rates={rates} onSubmit={vi.fn()} />);
    const price = screen.getByLabelText('Your price per day');

    setDates(container, '2099-10-01', '2099-10-03');
    expect(price).toHaveValue(1000);

    setDates(container, '2099-10-01', '2099-10-07');
    expect(await screen.findByText('Weekly price applies for 7 days: ₹800/day instead of ₹1,000.')).toBeInTheDocument();
    expect(price).toHaveValue(800);
    expect(screen.getByText('Listed ₹800/day')).toBeInTheDocument();

    await userEvent.clear(price);
    await userEvent.type(price, '700');
    setDates(container, '2099-10-01', '2099-10-03');
    expect(price).toHaveValue(700); // their own price stays
  });
});

describe('OfferForm - ID-verified renters only', () => {
  it('offers a "Verify your ID" link when the owner requires it', async () => {
    const { MemoryRouter } = await import('react-router-dom');
    const err = Object.assign(new Error('The owner only rents this to ID-verified renters.'), { code: 'renter_id_required' });
    const { container } = render(
      <MemoryRouter>
        <OfferForm listedPrice={600} onSubmit={vi.fn(async () => { throw err; })} />
      </MemoryRouter>
    );
    setDates(container, '2099-01-05', '2099-01-06');
    await userEvent.click(screen.getByRole('button', { name: /send|request/i }));
    expect(await screen.findByRole('link', { name: 'Verify your ID' })).toHaveAttribute('href', '/verify-id');
  });
});
