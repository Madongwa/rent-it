import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import ListingCard from '../components/ListingCard';
import FilterSidebar, { PRICE_BUCKETS, countActiveFilters } from '../components/FilterSidebar';

const MULTI_KEYS = ['condition', 'powerSource', 'delivery', 'cancellation', 'ownerType'];
// Filter keys whose URL param name differs from the filter-state key name.
const PARAM_NAME = { customMin: 'minPrice', customMax: 'maxPrice' };
const CLEARABLE_PARAMS = [
  'category',
  'sort',
  'priceBucket',
  'minPrice',
  'maxPrice',
  'condition',
  'powerSource',
  'delivery',
  'deposit',
  'cancellation',
  'ownerType',
  'accessories',
];

function readFilters(searchParams) {
  const filters = { category: searchParams.get('category') || '', sort: searchParams.get('sort') || 'relevance' };
  filters.priceBucket = searchParams.get('priceBucket') || '';
  filters.customMin = searchParams.get('minPrice') || '';
  filters.customMax = searchParams.get('maxPrice') || '';
  for (const key of MULTI_KEYS) {
    filters[key] = (searchParams.get(key) || '').split(',').filter(Boolean);
  }
  filters.deposit = searchParams.get('deposit') || '';
  filters.accessories = searchParams.get('accessories') || '';
  return filters;
}

function ChevronRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FilterListIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Pill({ active, disabled, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-disabled={disabled}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed border-line text-text-muted/40'
          : active
          ? 'border-text-primary bg-text-primary text-white'
          : 'border-line text-text-secondary hover:border-text-muted'
      }`}
    >
      {children}
    </button>
  );
}

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const q = searchParams.get('q') || '';

  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  // The API only understands a single continuous min/max price range - a
  // quick bucket and a typed custom range both resolve to that same shape,
  // with custom taking priority (kept mutually exclusive in the setters
  // below, but this also protects against both somehow being set at once).
  const bucket = PRICE_BUCKETS.find((b) => b.id === filters.priceBucket);
  const minPrice = filters.customMin || bucket?.min || '';
  const maxPrice = filters.customMax || bucket?.max || '';

  const multiParams = MULTI_KEYS.map((k) => filters[k].join(',')).join('|');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getListings({
        category: filters.category,
        q,
        sort: filters.sort,
        minPrice,
        maxPrice,
        condition: filters.condition.join(','),
        powerSource: filters.powerSource.join(','),
        delivery: filters.delivery.join(','),
        deposit: filters.deposit,
        cancellation: filters.cancellation.join(','),
        ownerType: filters.ownerType.join(','),
        accessories: filters.accessories,
      })
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, q, filters.sort, minPrice, maxPrice, multiParams, filters.deposit, filters.accessories]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function setSingle(key, value) {
    const param = PARAM_NAME[key] || key;
    const next = new URLSearchParams(searchParams);
    if (value) next.set(param, value);
    else next.delete(param);
    if (param === 'priceBucket' && value) {
      next.delete('minPrice');
      next.delete('maxPrice');
    }
    setSearchParams(next);
  }

  function applyCustomPrice(min, max) {
    const next = new URLSearchParams(searchParams);
    if (min) next.set('minPrice', min);
    else next.delete('minPrice');
    if (max) next.set('maxPrice', max);
    else next.delete('maxPrice');
    next.delete('priceBucket');
    setSearchParams(next);
  }

  function toggleMulti(key, value) {
    const current = filters[key];
    const nextArr = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const next = new URLSearchParams(searchParams);
    if (nextArr.length) next.set(key, nextArr.join(','));
    else next.delete(key);
    setSearchParams(next);
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams);
    CLEARABLE_PARAMS.forEach((k) => next.delete(k));
    setSearchParams(next);
  }

  function toggleUnder1500() {
    const isActive = maxPrice === '1500' && !filters.customMin && !filters.priceBucket;
    isActive ? applyCustomPrice('', '') : applyCustomPrice('', '1500');
  }

  function toggleNewest() {
    setSingle('sort', filters.sort === 'newest' ? 'relevance' : 'newest');
  }

  function toggleFreeDelivery() {
    const isActive = filters.delivery.includes('owner_delivers') && filters.delivery.includes('either');
    const next = new URLSearchParams(searchParams);
    if (isActive) next.delete('delivery');
    else next.set('delivery', 'owner_delivers,either');
    setSearchParams(next);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateParam('q', searchInput.trim());
  }

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const activeCount = countActiveFilters(filters);

  // Horizontal-scroll affordance for the pill bar - fades + an arrow button
  // appear only while there's more content in that direction, similar to
  // Google Shopping's filter row.
  const pillRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = pillRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    const el = pillRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [categories]);

  function scrollPills(dir) {
    pillRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  }

  const under1500Active = maxPrice === '1500' && !filters.customMin && !filters.priceBucket;
  const freeDeliveryActive = filters.delivery.includes('owner_delivers') && filters.delivery.includes('either');

  const sidebarProps = {
    filters,
    categories,
    onSetSingle: setSingle,
    onToggleMulti: toggleMulti,
    onApplyCustomPrice: applyCustomPrice,
    onClearAll: clearAll,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-heading-sm text-text-primary">
          {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'Marketplace'}
        </h1>
        <p className="mt-1 text-body text-text-muted">
          {activeCategory ? activeCategory.description : 'Browse all equipment available to rent.'}
        </p>
      </div>

      {/* Search + sort-adjacent row (kept simple; sort itself lives in the sidebar) */}
      <form onSubmit={handleSearchSubmit} className="mb-4 flex max-w-md gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search listings…"
          className="w-full rounded-btn border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button type="submit" className="shrink-0 rounded-btn bg-text-primary px-4 text-sm font-medium text-white hover:opacity-90">
          Search
        </button>
      </form>

      {/* TOP PILL BAR - quick filters, horizontally scrollable */}
      <div className="relative mb-6">
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-canvas to-transparent" />
        )}
        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-canvas to-transparent" />
            <button
              type="button"
              onClick={() => scrollPills(1)}
              aria-label="Show more filters"
              className="absolute right-0 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-sm hover:border-text-muted"
            >
              <ChevronRightIcon className="h-4 w-4 text-text-secondary" />
            </button>
          </>
        )}

        <div ref={pillRef} className="flex gap-2 overflow-x-auto scroll-smooth pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Pill active={!filters.category} onClick={() => setSingle('category', '')}>
            All
          </Pill>
          {categories.map((cat) => (
            <Pill key={cat.slug} active={filters.category === cat.slug} onClick={() => setSingle('category', filters.category === cat.slug ? '' : cat.slug)}>
              {cat.icon} {cat.slug === 'diy' ? 'Household' : cat.name.replace(' Tools', '')}
            </Pill>
          ))}

          <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden="true" />

          <Pill disabled title="Coming soon - location isn't collected yet">
            📍 Nearby
          </Pill>
          <Pill disabled title="Every listing shown is already available">
            Available Now
          </Pill>
          <Pill active={under1500Active} onClick={toggleUnder1500}>
            Under ₹1,500/day
          </Pill>
          <Pill disabled title="Coming soon - ratings aren't built yet">
            Top Rated
          </Pill>
          <Pill active={filters.sort === 'newest'} onClick={toggleNewest}>
            New Listings
          </Pill>
          <Pill disabled title="Coming soon - owner verification isn't built yet">
            Verified Owners
          </Pill>
          <Pill active={freeDeliveryActive} onClick={toggleFreeDelivery}>
            Free Delivery
          </Pill>
          <Pill disabled title="Coming soon - pickup/delivery timing isn't tracked yet">
            Same-Day Pickup
          </Pill>
          <Pill disabled title="Coming soon - rental counts aren't tracked yet">
            Trending
          </Pill>
        </div>
      </div>

      {/* Mobile filters trigger */}
      <button
        type="button"
        onClick={() => setMobileFiltersOpen(true)}
        className="mb-6 flex items-center gap-2 rounded-btn border border-line px-4 py-2 text-sm font-medium text-text-secondary lg:hidden"
      >
        <FilterListIcon className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{activeCount}</span>
        )}
      </button>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-10">
        {/* LEFT SIDEBAR - desktop */}
        <aside className="hidden lg:block">
          <FilterSidebar {...sidebarProps} />
        </aside>

        {/* Mobile slide-out drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-surface px-5 py-5 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-subheading text-text-primary">Filters</span>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                  <CloseIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              <FilterSidebar {...sidebarProps} />
            </div>
          </div>
        )}

        <div>
          {loading && <div className="py-16 text-center text-text-muted">Loading listings…</div>}
          {error && <div className="py-16 text-center text-red-500">{error}</div>}

          {!loading && !error && listings.length === 0 && (
            <div className="py-16 text-center text-text-muted">
              No listings found. Try a different search or{' '}
              <a href="/list-item" className="font-medium text-accent">
                be the first to list an item
              </a>
              .
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
