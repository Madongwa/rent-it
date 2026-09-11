import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Option data for filters that ARE backed by real listing fields.
// ---------------------------------------------------------------------------
export const PRICE_BUCKETS = [
  { id: 'u500', label: 'Under ₹500', min: '', max: '500' },
  { id: '500-1000', label: '₹500 – ₹1,000', min: '500', max: '1000' },
  { id: '1000-2000', label: '₹1,000 – ₹2,000', min: '1000', max: '2000' },
  { id: '2000-3500', label: '₹2,000 – ₹3,500', min: '2000', max: '3500' },
  { id: 'o3500', label: 'Over ₹3,500', min: '3500', max: '' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating_desc', label: 'Rating: high to low', disabled: true },
  { value: 'newest', label: 'Newest' },
  { value: 'nearest', label: 'Nearest', disabled: true },
];

const CONDITION_OPTIONS = ['New', 'Like New', 'Good', 'Fair'];

const POWER_SOURCE_OPTIONS = [
  { value: 'electric', label: 'Electric' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'manual', label: 'Manual' },
  { value: 'battery', label: 'Battery' },
];

const DELIVERY_OPTIONS = [
  { value: 'owner_delivers', label: 'Owner delivers' },
  { value: 'pickup_only', label: 'Pickup only' },
  { value: 'either', label: 'Either' },
];

const CANCELLATION_OPTIONS = [
  { value: 'free', label: 'Free cancellation' },
  { value: 'flexible', label: 'Flexible' },
  { value: 'strict', label: 'Strict' },
];

const OWNER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business / Dealer' },
];

// Empty, default filter state - exported so Marketplace.jsx and the "active
// filter count" logic share one definition of "nothing is applied yet".
export const DEFAULT_FILTERS = {
  category: '',
  sort: 'relevance',
  priceBucket: '',
  customMin: '',
  customMax: '',
  condition: [],
  powerSource: [],
  delivery: [],
  deposit: '',
  cancellation: [],
  ownerType: [],
  accessories: '',
};

export function countActiveFilters(filters) {
  let count = 0;
  if (filters.category) count++;
  if (filters.sort && filters.sort !== 'relevance') count++;
  if (filters.priceBucket) count++;
  if (filters.customMin || filters.customMax) count++;
  count += filters.condition.length;
  count += filters.powerSource.length;
  count += filters.delivery.length;
  if (filters.deposit) count++;
  count += filters.cancellation.length;
  count += filters.ownerType.length;
  if (filters.accessories) count++;
  return count;
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {title}
          {badge && (
            <span className="rounded-badge border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {badge}
            </span>
          )}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="mt-3 space-y-2.5">{children}</div>}
    </div>
  );
}

function CheckboxRow({ label, checked, onChange, disabled }) {
  return (
    <label
      className={`flex items-center gap-2.5 text-sm ${
        disabled ? 'cursor-not-allowed text-text-muted/50' : 'cursor-pointer text-text-secondary'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      {label}
    </label>
  );
}

function RadioRow({ name, label, checked, onChange, disabled }) {
  return (
    <label
      className={`flex items-center gap-2.5 text-sm ${
        disabled ? 'cursor-not-allowed text-text-muted/50' : 'cursor-pointer text-text-secondary'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 shrink-0 border-line text-accent focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      {label}
    </label>
  );
}

// Sections with no backing data yet - rendered so the UI is fully explorable,
// but every control is disabled and the section itself carries a "Coming
// soon" badge rather than silently doing nothing when clicked.
function ComingSoonSection({ title, options }) {
  return (
    <Section title={title} badge="Coming soon">
      <p className="text-xs text-text-muted">This filter isn't wired up to real data yet.</p>
      <div className="space-y-2.5 opacity-60">
        {options.map((label) => (
          <CheckboxRow key={label} label={label} checked={false} disabled onChange={() => {}} />
        ))}
      </div>
    </Section>
  );
}

export default function FilterSidebar({
  filters,
  categories,
  onSetSingle,
  onToggleMulti,
  onApplyCustomPrice,
  onClearAll,
}) {
  const activeCount = countActiveFilters(filters);
  const selectedCategory = categories.find((c) => c.slug === filters.category);

  // Local, uncontrolled-feeling copies of the price inputs so typing doesn't
  // fire a new request on every keystroke - only "Go" applies them. Synced
  // back to the URL-backed value when it changes from elsewhere (e.g.
  // Clear all, or picking a bucket radio instead).
  const [minInput, setMinInput] = useState(filters.customMin);
  const [maxInput, setMaxInput] = useState(filters.customMax);
  useEffect(() => setMinInput(filters.customMin), [filters.customMin]);
  useEffect(() => setMaxInput(filters.customMax), [filters.customMax]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-sm font-semibold text-text-primary">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm font-medium text-accent hover:underline"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* Sort by - real, expanded by default */}
      <Section title="Sort by" defaultOpen>
        {SORT_OPTIONS.map((opt) => (
          <RadioRow
            key={opt.value}
            name="sort"
            label={opt.label}
            checked={filters.sort === opt.value}
            disabled={opt.disabled}
            onChange={() => onSetSingle('sort', opt.value)}
          />
        ))}
      </Section>

      {/* Availability - not backed by real availability/calendar data */}
      <ComingSoonSection
        title="Availability"
        options={['Available today', 'Available this week', 'Instant book']}
      />

      {/* Price per day - real, expanded by default */}
      <Section title="Price per day" defaultOpen>
        {PRICE_BUCKETS.map((bucket) => (
          <RadioRow
            key={bucket.id}
            name="priceBucket"
            label={bucket.label}
            checked={filters.priceBucket === bucket.id}
            onChange={() => onSetSingle('priceBucket', bucket.id)}
          />
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            className="w-full rounded-btn border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-text-muted">–</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            className="w-full rounded-btn border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => onApplyCustomPrice(minInput, maxInput)}
            className="shrink-0 rounded-btn bg-text-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Go
          </button>
        </div>
      </Section>

      {/* Category - real, synced with the top pill bar */}
      <Section title="Category">
        {categories.map((cat) => (
          <CheckboxRow
            key={cat.slug}
            label={`${cat.icon} ${cat.name}`}
            checked={filters.category === cat.slug}
            onChange={() => onSetSingle('category', filters.category === cat.slug ? '' : cat.slug)}
          />
        ))}
      </Section>

      {/* Subcategory - hidden entirely until a category is picked, per spec;
          no subcategory taxonomy exists yet so it's a coming-soon note. */}
      {selectedCategory && (
        <Section title="Subcategory" badge="Coming soon">
          <p className="text-xs text-text-muted">
            Subcategories for {selectedCategory.name} aren't available yet.
          </p>
        </Section>
      )}

      {/* Condition - real */}
      <Section title="Condition">
        {CONDITION_OPTIONS.map((label) => (
          <CheckboxRow
            key={label}
            label={label}
            checked={filters.condition.includes(label)}
            onChange={() => onToggleMulti('condition', label)}
          />
        ))}
      </Section>

      {/* Distance - no geolocation data */}
      <ComingSoonSection title="Distance" options={['Within 2 km', '5 km', '10 km', '25 km', 'Any']} />

      {/* Rental Duration - no duration-unit field */}
      <ComingSoonSection title="Rental Duration" options={['Hourly', 'Daily', 'Weekly', 'Monthly']} />

      {/* Owner Rating - no reviews yet */}
      <ComingSoonSection title="Owner Rating" options={['4★ & up', '3★ & up']} />

      {/* Delivery - real */}
      <Section title="Delivery">
        {DELIVERY_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.delivery.includes(opt.value)}
            onChange={() => onToggleMulti('delivery', opt.value)}
          />
        ))}
      </Section>

      {/* Deposit - real */}
      <Section title="Deposit">
        <RadioRow name="deposit" label="Required" checked={filters.deposit === 'true'} onChange={() => onSetSingle('deposit', 'true')} />
        <RadioRow name="deposit" label="Not required" checked={filters.deposit === 'false'} onChange={() => onSetSingle('deposit', 'false')} />
        <RadioRow name="deposit" label="Any" checked={filters.deposit === ''} onChange={() => onSetSingle('deposit', '')} />
      </Section>

      {/* Power Source - real */}
      <Section title="Power Source">
        {POWER_SOURCE_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.powerSource.includes(opt.value)}
            onChange={() => onToggleMulti('powerSource', opt.value)}
          />
        ))}
      </Section>

      {/* Minimum Rental Period - no such field/logic yet */}
      <ComingSoonSection
        title="Minimum Rental Period"
        options={['No minimum', '1 day min', '3 day min', 'Weekly min']}
      />

      {/* Cancellation Policy - real */}
      <Section title="Cancellation Policy">
        {CANCELLATION_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.cancellation.includes(opt.value)}
            onChange={() => onToggleMulti('cancellation', opt.value)}
          />
        ))}
      </Section>

      {/* Owner Type - real */}
      <Section title="Owner Type">
        {OWNER_TYPE_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.ownerType.includes(opt.value)}
            onChange={() => onToggleMulti('ownerType', opt.value)}
          />
        ))}
      </Section>

      {/* Accessories Included - real */}
      <Section title="Accessories Included">
        <RadioRow name="accessories" label="Comes with accessories" checked={filters.accessories === 'true'} onChange={() => onSetSingle('accessories', 'true')} />
        <RadioRow name="accessories" label="Bare equipment only" checked={filters.accessories === 'false'} onChange={() => onSetSingle('accessories', 'false')} />
        <RadioRow name="accessories" label="Any" checked={filters.accessories === ''} onChange={() => onSetSingle('accessories', '')} />
      </Section>
    </div>
  );
}
