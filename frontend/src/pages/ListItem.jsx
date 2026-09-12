import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import ListingForm from '../components/ListingForm';

export default function ListItem() {
  const navigate = useNavigate();

  async function handleSubmit(payload) {
    const created = await api.createListing(payload);
    navigate(`/listing/${created.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">List an item for rent</h1>
      <p className="mt-1 text-body text-text-muted">
        Have a tool sitting idle? List it here and start earning when someone rents it.
      </p>

      <div className="mt-8">
        <ListingForm onSubmit={handleSubmit} submitLabel="Publish listing" />
      </div>
    </div>
  );
}
