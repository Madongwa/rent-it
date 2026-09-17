import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import ListingForm from '../components/ListingForm';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const GATE_COPY = {
  not_submitted: {
    title: 'Verify your account to start listing',
    body: "For everyone's safety, sellers need to pass a quick identity check before listing equipment.",
    cta: 'Get verified',
  },
  pending: {
    title: 'Verification in progress',
    body: "We're reviewing your documents - you'll be able to list items once approved.",
    cta: 'Check status',
  },
  rejected: {
    title: 'Verification was not approved',
    body: 'Resubmit your documents to try again.',
    cta: 'Resubmit',
  },
};

export default function ListItem() {
  const navigate = useNavigate();
  const [sellerStatus, setSellerStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyProfile()
      .then((p) => setSellerStatus(p.seller_status))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(payload) {
    const created = await api.createListing(payload);
    navigate(`/listing/${created.id}`);
  }

  if (loading) return <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center text-night-muted">Loading…</DarkGradientBg>;

  if (sellerStatus !== 'approved') {
    const copy = GATE_COPY[sellerStatus] || GATE_COPY.not_submitted;
    return (
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="text-heading-sm text-night-text">{copy.title}</h1>
        <p className="mt-2 text-body text-night-muted">{copy.body}</p>
        <Link
          to="/become-seller"
          className="mt-6 inline-block rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
        >
          {copy.cta}
        </Link>
      </div>
      </DarkGradientBg>
    );
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-night-text">List an item for rent</h1>
      <p className="mt-1 text-body text-night-muted">
        Have a tool sitting idle? List it here and start earning when someone rents it.
      </p>

      <div className="mt-8">
        <ListingForm onSubmit={handleSubmit} submitLabel="Publish listing" />
      </div>
    </div>
    </DarkGradientBg>
  );
}
