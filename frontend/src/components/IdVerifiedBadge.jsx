import { IdCard } from 'lucide-react';

// "ID verified" next to a renter's name, for owners. A yes/no only - the
// owner never sees the document or which ID it was.
export default function IdVerifiedBadge({ verified, className = '' }) {
  if (!verified) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ${className}`}
      title="This renter verified a government ID with Rent It"
    >
      <IdCard className="h-3 w-3" aria-hidden="true" /> ID verified
    </span>
  );
}
