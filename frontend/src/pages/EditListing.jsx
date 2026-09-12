import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import ListingForm from '../components/ListingForm';

// Normalizes a fetched listing into the shape ListingForm's controlled
// inputs expect - mainly turning `null` (a real, valid DB value for
// several of these) into '' so React doesn't complain about a controlled
// input switching between a value and null.
function toFormInitial(listing) {
  return {
    title: listing.title,
    description: listing.description || '',
    category_id: String(listing.category_id),
    price_per_day: String(listing.price_per_day),
    location: listing.location || '',
    condition: listing.condition || 'Good',
    image_url: listing.image_url || '',
    power_source: listing.power_source || '',
    delivery_option: listing.delivery_option,
    deposit_required: listing.deposit_required,
    deposit_amount: listing.deposit_amount != null ? String(listing.deposit_amount) : '',
    cancellation_policy: listing.cancellation_policy,
    owner_type: listing.owner_type,
    accessories_included: listing.accessories_included,
    accessories_note: listing.accessories_note || '',
    min_rental_period: listing.min_rental_period,
    supported_durations: listing.supported_durations?.length ? listing.supported_durations : ['daily'],
  };
}

export default function EditListing() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getListing(id)
      .then((listing) => {
        if (user && listing.owner_id !== user.id) {
          setError("This isn't your listing to edit.");
          return;
        }
        setInitial(toFormInitial(listing));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user]);

  async function handleSubmit(payload) {
    await api.updateListing(id, payload);
    navigate(`/listing/${id}`);
  }

  if (loading) return <div className="py-24 text-center text-text-muted">Loading…</div>;
  if (error) return <div className="py-24 text-center text-red-500">{error}</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">Edit listing</h1>
      <p className="mt-1 text-body text-text-muted">Update the details renters see for this item.</p>

      <div className="mt-8">
        <ListingForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
      </div>
    </div>
  );
}
