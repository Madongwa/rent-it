import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import ListingCard from '../components/ListingCard';
import FilterSidebar, { PRICE_BUCKETS, SORT_OPTIONS, countActiveFilters } from '../components/FilterSidebar';
import { useFavorites } from '../hooks/useFavorites';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import { Bell, LayoutGrid, Loader2, Map as MapIcon, Mic, Sparkles, Square } from 'lucide-react';
import { describeIntent, intentToParams } from '../lib/searchIntent';
import { forgetLocation, locateMe, locationError, savedLocation } from '../lib/myLocation';
import { micError, recordingSupported, startRecording } from '../lib/voiceRecorder';

// Voice search listens for at most this long.
const VOICE_SEARCH_SECONDS = 15;

// Leaflet only downloads when someone opens the map.
const ListingsMap = lazy(() => import('../components/ListingsMap'));

const MULTI_KEYS = ['condition', 'powerSource', 'delivery', 'cancellation', 'ownerType', 'duration', 'availability'];
// Filter keys whose URL param name differs from the filter-state key name.
const PARAM_NAME = { customMin: 'minPrice', customMax: 'maxPrice', maxDistance: 'distance' };
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
  'availability',
  'distance',
  'duration',
  'minRating',
  'minRentalPeriod',
  'page',
  'verified',
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
  filters.maxDistance = searchParams.get('distance') || '';
  filters.minRating = searchParams.get('minRating') || '';
  filters.minRentalPeriod = searchParams.get('minRentalPeriod') || '';
  filters.near = searchParams.get('near') || '';
  filters.verified = searchParams.get('verified') || '';
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
          ? 'cursor-not-allowed border-night-border/10 text-night-muted/30'
          : active
          ? 'border-white bg-white text-black'
          : 'border-night-border/20 text-night-muted hover:border-night-border/40 hover:text-night-text'
      }`}
    >
      {children}
    </button>
  );
}

export default function Marketplace() {
  useSeo({
    title: 'Marketplace',
    description: 'Browse farming, construction, household, events, moving, and medical equipment available to rent near you.',
    path: '/marketplace',
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const q = searchParams.get('q') || '';
  const { favoriteIds, toggle: toggleFavorite, isLoggedIn } = useFavorites();

  function handleToggleFavorite(listingId) {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: '/marketplace' } } });
      return;
    }
    toggleFavorite(listingId);
  }

  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(q);
  // Plain-language search: how the AI read the last sentence typed, so the
  // results can say so (and offer the exact words instead).
  const [aiReading, setAiReading] = useState(null);
  const [interpreting, setInterpreting] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // When a search finds nothing: other words to try (AI, only ones that
  // have listings) - see backend lib/wanted.js searchAlternatives.
  const [alternatives, setAlternatives] = useState([]);
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const mapView = searchParams.get('view') === 'map';
  // "Near me": the renter's location, rounded to ~1 km (lib/myLocation.js).
  const [me, setMe] = useState(savedLocation);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

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

  // The filters as the server understands them - also what a saved search
  // stores, so its daily alert matches exactly what this page shows.
  const apiFilters = {
    category: filters.category,
    q,
    minPrice,
    maxPrice,
    condition: filters.condition.join(','),
    powerSource: filters.powerSource.join(','),
    delivery: filters.delivery.join(','),
    deposit: filters.deposit,
    cancellation: filters.cancellation.join(','),
    ownerType: filters.ownerType.join(','),
    accessories: filters.accessories,
    distance: filters.maxDistance,
    duration: filters.duration.join(','),
    minRating: filters.minRating,
    minRentalPeriod: filters.minRentalPeriod,
    near: filters.near,
    verified: filters.verified,
  };
  const hasSearch = Object.values(apiFilters).some(Boolean);
  const [saved, setSaved] = useState(''); // '' | 'saving' | 'saved' | error text

  const multiParams = MULTI_KEYS.map((k) => filters[k].join(',')).join('|');
  const filterKey = [
    filters.category, q, filters.sort, minPrice, maxPrice, multiParams, filters.deposit,
    filters.accessories, filters.maxDistance, filters.minRating, filters.minRentalPeriod, filters.near, filters.verified,
    me ? `${me.lat},${me.lng}` : '', mapView ? 'map' : 'list',
  ].join('::');
  // Tracks the previous filterKey so a filter change (as opposed to a plain
  // page change) can snap the page back to 1 - browsing page 4 of one filter
  // set shouldn't carry over as "page 4" of a completely different one.
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    const filtersChanged = prevFilterKeyRef.current !== filterKey;
    prevFilterKeyRef.current = filterKey;

    if (filtersChanged && page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.delete('page');
      setSearchParams(next);
      return; // the resulting param change re-triggers this effect at page 1
    }

    setLoading(true);
    setError('');
    setSaved('');
    api
      .getListings({
        ...apiFilters,
        sort: filters.sort,
        availability: filters.availability.join(','),
        lat: me?.lat,
        lng: me?.lng,
        view: mapView ? 'map' : undefined,
        page,
      })
      .then((result) => {
        setListings(result.data);
        setHasMore(result.hasMore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page]);

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

  function goToPage(p) {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams);
    CLEARABLE_PARAMS.forEach((k) => next.delete(k));
    setSearchParams(next);
  }

  function toggleUnder750() {
    const isActive = maxPrice === '750' && !filters.customMin && !filters.priceBucket;
    isActive ? applyCustomPrice('', '') : applyCustomPrice('', '750');
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

  function toggleAvailableToday() {
    toggleMulti('availability', 'today');
  }

  // Asks the browser for the renter's location; resolves to it, or null
  // (with a message) when they said no or it failed.
  async function requestLocation() {
    setLocating(true);
    setLocError('');
    try {
      const here = await locateMe();
      setMe(here);
      return here;
    } catch (err) {
      setLocError(locationError(err));
      return null;
    } finally {
      setLocating(false);
    }
  }

  const nearbyActive = !!me && filters.sort === 'nearest';

  async function toggleNearby() {
    if (nearbyActive) {
      setSingle('sort', 'relevance');
      return;
    }
    if (me || (await requestLocation())) setSingle('sort', 'nearest');
  }

  function stopUsingLocation() {
    forgetLocation();
    setMe(null);
    if (filters.sort === 'nearest') setSingle('sort', 'relevance');
  }

  function setView(view) {
    updateParam('view', view === 'map' ? 'map' : '');
  }

  // "Alert me": saves this search; a daily check notifies about new matches.
  async function saveThisSearch() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: '/marketplace' } } });
      return;
    }
    const parts = [];
    if (q) parts.push(q.replace(/"/g, ''));
    if (activeCategory) parts.push(activeCategory.name);
    if (filters.near) parts.push(`near ${filters.near}`);
    if (maxPrice) parts.push(`under ₹${Number(maxPrice).toLocaleString('en-IN')}/day`);
    const label = (aiReading?.text || parts.join(', ') || 'My filtered search').slice(0, 200);
    const urlQuery = new URLSearchParams(searchParams);
    ['page', 'view'].forEach((k) => urlQuery.delete(k));
    setSaved('saving');
    try {
      await api.saveSearch({ label, filters: apiFilters, url_query: urlQuery.toString() });
      setSaved('saved');
    } catch (err) {
      setSaved(err.message);
    }
  }

  const openListing = useCallback((id) => navigate(`/listing/${id}`), [navigate]);

  function toggleTopRated() {
    setSingle('minRating', filters.minRating === '4' ? '' : '4');
  }

  // A few words ("drill") search as typed. A sentence ("something to dig
  // post holes near Mandya this weekend") goes to the AI, which turns it
  // into the usual filters - and if it can't, the words are searched as
  // typed, like before.
  async function handleSearchSubmit(e) {
    e.preventDefault();
    await runSearch(searchInput.trim());
  }

  // Voice search: speak instead of typing - the words land in the box and
  // are searched like typed ones (Groq Whisper on the server).
  const [voice, setVoice] = useState({ state: 'idle' }); // idle | listening | working
  const voiceRecRef = useRef(null);
  const voiceTimerRef = useRef(null);

  async function toggleVoiceSearch() {
    if (voice.state === 'listening') return finishVoiceSearch();
    if (voice.state !== 'idle') return;
    setVoice({ state: 'listening' });
    try {
      voiceRecRef.current = await startRecording();
      voiceTimerRef.current = setTimeout(finishVoiceSearch, VOICE_SEARCH_SECONDS * 1000);
    } catch (err) {
      setVoice({ state: 'idle', error: micError(err) });
    }
  }

  async function finishVoiceSearch() {
    clearTimeout(voiceTimerRef.current);
    const rec = voiceRecRef.current;
    voiceRecRef.current = null;
    if (!rec) return;
    setVoice({ state: 'working' });
    try {
      const { blob, type } = await rec.stop();
      const { text } = await api.voiceSearch(blob, type);
      setSearchInput(text);
      setVoice({ state: 'idle' });
      await runSearch(text);
    } catch (err) {
      setVoice({ state: 'idle', error: err.message });
    }
  }

  useEffect(
    () => () => {
      clearTimeout(voiceTimerRef.current);
      voiceRecRef.current?.cancel();
    },
    []
  );

  async function runSearch(text) {
    setAiReading(null);
    if (text.split(/\s+/).length < 3) {
      updateParam('q', text);
      return;
    }
    setInterpreting(true);
    try {
      const intent = await api.interpretSearch(text);
      // "near me" / "within 5 km" need the renter's location; without it
      // the rest of the search still runs.
      if ((intent.nearMe || intent.maxDistance) && !me) await requestLocation();
      const next = intentToParams(intent, filters.sort);
      if (mapView) next.set('view', 'map'); // stay on the map
      setSearchParams(next);
      setAiReading({ text, intent });
    } catch {
      updateParam('q', text);
    } finally {
      setInterpreting(false);
    }
  }

  function searchExactWords() {
    const text = aiReading.text;
    setAiReading(null);
    setSearchInput(text);
    setSearchParams(new URLSearchParams({ q: text }));
  }

  // What the person searched for, in their own words.
  const searchText = aiReading?.text || q;
  useEffect(() => {
    setAlternatives([]);
    if (loading || error || listings.length || !searchText) return undefined;
    let cancelled = false;
    api
      .searchAlternatives(searchText)
      .then((r) => !cancelled && setAlternatives(r.alternatives || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, error, listings.length, searchText]);

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

  const under750Active = maxPrice === '750' && !filters.customMin && !filters.priceBucket;
  const freeDeliveryActive = filters.delivery.includes('owner_delivers') && filters.delivery.includes('either');

  const sidebarProps = {
    filters,
    categories,
    onSetSingle: setSingle,
    onToggleMulti: toggleMulti,
    onApplyCustomPrice: applyCustomPrice,
    onClearAll: clearAll,
    hasLocation: !!me,
    locating,
    onUseLocation: requestLocation,
  };

  return (
    // Whole-page dark theme (not just a boxed insert around the grid) - see
    // App.jsx's isDarkPage list for the matching footer treatment. Reuses
    // the site's existing night.* tokens from the Home hero rather than
    // introducing a new palette.
    <DarkGradientBg className="min-h-[calc(100vh-4rem)] text-night-text">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-heading-sm text-night-text">
            {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'Marketplace'}
          </h1>
          <p className="mt-1 text-body text-night-muted">
            {activeCategory ? activeCategory.description : 'Browse all equipment available to rent.'}
          </p>
        </div>

        {/* Search + sort-adjacent row (kept simple; sort itself lives in the sidebar) */}
        <form onSubmit={handleSearchSubmit} className="mb-4 flex max-w-xl gap-2">
          {recordingSupported() && (
            <button
              type="button"
              onClick={toggleVoiceSearch}
              disabled={voice.state === 'working'}
              aria-label={voice.state === 'listening' ? 'Stop and search' : 'Search by voice'}
              title="Say what you need, in any language"
              className={`inline-flex h-auto w-10 shrink-0 items-center justify-center rounded-btn border ${
                voice.state === 'listening' ? 'animate-pulse border-red-500 bg-red-500/20 text-red-300' : 'border-night-border/20 text-night-text hover:border-night-border/40'
              } disabled:opacity-60`}
            >
              {voice.state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : voice.state === 'listening' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search, or describe what you need - e.g. a ladder near Mysuru this week"
            aria-label="Search listings"
            className="w-full rounded-btn border border-night-border/20 bg-white/5 px-3 py-2 text-sm text-night-text placeholder:text-night-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={interpreting}
            className="shrink-0 rounded-btn bg-white px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
          >
            {interpreting ? 'Searching…' : 'Search'}
          </button>
          {hasSearch && (
            <button
              type="button"
              onClick={saveThisSearch}
              disabled={saved === 'saving' || saved === 'saved'}
              title="Get a notification when new listings match this search"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-night-border/20 px-3 text-sm font-medium text-night-text hover:border-night-border/40 disabled:opacity-60"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {saved === 'saved' ? 'Alert on' : saved === 'saving' ? 'Saving…' : 'Alert me'}
            </button>
          )}
        </form>
        {saved === 'saved' && (
          <p className="-mt-2 mb-4 text-sm text-emerald-400" role="status">
            Saved. We'll notify you each morning if new listings match - manage it under Dashboard → Saved searches.
          </p>
        )}
        {saved && !['saved', 'saving'].includes(saved) && <p className="-mt-2 mb-4 text-sm text-red-400">{saved}</p>}

        {voice.state === 'listening' && (
          <p className="-mt-2 mb-4 text-sm text-red-300" role="status">Listening… say what you need, then tap ■ to search.</p>
        )}
        {voice.error && <p className="-mt-2 mb-4 text-sm text-red-400">{voice.error}</p>}
        {aiReading && (
          <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-night-muted" role="status">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>{`Showing: ${describeIntent(aiReading.intent, categories)}`}</span>
            <button type="button" onClick={searchExactWords} className="text-night-text underline-offset-2 hover:underline">
              Search the exact words instead
            </button>
          </p>
        )}

        {filters.near && (
          <div className="-mt-2 mb-4">
            <button
              type="button"
              onClick={() => updateParam('near', '')}
              className="inline-flex items-center gap-1.5 rounded-full border border-night-border/20 px-3 py-1 text-sm text-night-text hover:border-night-border/40"
              aria-label={`Remove filter: near ${filters.near}`}
            >
              {`📍 Near ${filters.near}`}
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* TOP PILL BAR - quick filters, horizontally scrollable */}
        <div className="relative mb-6">
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-night-bg to-transparent" />
          )}
          {canScrollRight && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-night-bg to-transparent" />
              <button
                type="button"
                onClick={() => scrollPills(1)}
                aria-label="Show more filters"
                className="absolute right-0 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-night-border/20 bg-night-bg shadow-sm hover:border-night-border/40"
              >
                <ChevronRightIcon className="h-4 w-4 text-night-muted" />
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

            <span className="mx-1 w-px shrink-0 self-stretch bg-night-border/15" aria-hidden="true" />

            <Pill active={nearbyActive} onClick={toggleNearby} title="Show the nearest listings first">
              {locating ? '📍 Finding you…' : '📍 Nearby'}
            </Pill>
            <Pill active={filters.availability.includes('today')} onClick={toggleAvailableToday}>
              Available Now
            </Pill>
            <Pill active={under750Active} onClick={toggleUnder750}>
              Under ₹750/day
            </Pill>
            <Pill active={filters.minRating === '4'} onClick={toggleTopRated}>
              Top Rated
            </Pill>
            <Pill active={filters.sort === 'newest'} onClick={toggleNewest}>
              New Listings
            </Pill>
            <Pill active={filters.verified === 'true'} onClick={() => updateParam('verified', filters.verified === 'true' ? '' : 'true')} title="Only owners who passed seller verification">
              Verified Owners
            </Pill>
            <Pill active={freeDeliveryActive} onClick={toggleFreeDelivery}>
              Free Delivery
            </Pill>
            <Pill active={filters.sort === 'trending'} onClick={() => setSingle('sort', filters.sort === 'trending' ? 'relevance' : 'trending')} title="Most requested and saved in the last 30 days">
              Trending
            </Pill>
          </div>
        </div>

        {(me || locError) && (
          <div className="-mt-3 mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
            {locError && <span className="text-red-400">{locError}</span>}
            {me && (
              <>
                <span className="text-night-muted">Showing distances from your approximate location.</span>
                <button type="button" onClick={stopUsingLocation} className="text-night-text underline-offset-2 hover:underline">
                  Stop using my location
                </button>
              </>
            )}
          </div>
        )}

        {/* Mobile filters trigger + the sort order, visible without opening
            the drawer */}
        <div className="mb-6 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="flex items-center gap-2 rounded-btn border border-night-border/20 px-4 py-2 text-sm font-medium text-night-muted"
        >
          <FilterListIcon className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{activeCount}</span>
          )}
        </button>
        <label className="flex min-w-0 items-center gap-2 text-sm text-night-muted">
          <span className="shrink-0">Sort</span>
          <select
            value={filters.sort}
            onChange={async (e) => {
              const value = e.target.value;
              if (value === 'nearest' && !me && !(await requestLocation())) return;
              setSingle('sort', value);
            }}
            className="min-w-0 rounded-btn border border-night-border/20 bg-night-bg px-2 py-2 text-sm text-night-text [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        </div>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-10">
          {/* LEFT SIDEBAR - desktop. Sticky below the navbar (top-16 matches
              its h-16 height) and independently scrollable if the filter
              list itself is taller than the viewport - the grid's default
              stretch alignment means this column's containing block spans
              the full row height (matching the listings column), so the
              sticky element travels the whole page and only stops once it
              hits the bottom of that row, before the footer. Only active at
              lg+, where the sidebar renders alongside the grid instead of
              in the mobile drawer. Scrollbar hidden (same [scrollbar-width]/
              [&::-webkit-scrollbar] pattern as the pill bar above) - stays
              scrollable by wheel/trackpad/touch, just without the visible
              track/thumb down the right edge. */}
          <aside className="hidden lg:sticky lg:top-16 lg:block lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterSidebar {...sidebarProps} />
          </aside>

          {/* Mobile slide-out drawer */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto border-r border-night-border/15 bg-night-bg px-5 py-5 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-subheading text-night-text">Filters</span>
                  <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">
                    <CloseIcon className="h-5 w-5 text-night-muted" />
                  </button>
                </div>
                <FilterSidebar {...sidebarProps} />
              </div>
            </div>
          )}

          {/* Listings grid - sits directly on the page's own dark background
              now (see the wrapper above), no boxed insert. */}
          <div>
            <div className="mb-4 flex justify-end">
              <div className="inline-flex rounded-full border border-night-border/20 p-0.5" role="group" aria-label="Show listings as">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={!mapView}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${!mapView ? 'bg-white text-black' : 'text-night-muted hover:text-night-text'}`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" /> List
                </button>
                <button
                  type="button"
                  onClick={() => setView('map')}
                  aria-pressed={mapView}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${mapView ? 'bg-white text-black' : 'text-night-muted hover:text-night-text'}`}
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" /> Map
                </button>
              </div>
            </div>

            {loading && <div className="py-16 text-center text-night-muted">Loading listings…</div>}
            {error && <div className="py-16 text-center text-red-400">{error}</div>}

            {!loading && !error && listings.length === 0 && (
              <div className="py-16 text-center text-night-muted">
                <p>No listings found.</p>
                {alternatives.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="status">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" /> Try:
                    </span>
                    {alternatives.map((a) => (
                      <button
                        key={a.term}
                        type="button"
                        onClick={() => {
                          setAiReading(null);
                          setSearchInput(a.term);
                          setSearchParams(new URLSearchParams({ q: a.term }));
                        }}
                        className="rounded-full border border-night-border/20 px-3 py-1 text-sm text-night-text hover:border-night-border/40"
                      >
                        {a.term} <span className="text-night-muted">({a.count})</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-4">
                  {searchText ? (
                    <Link to={`/wanted/new?text=${encodeURIComponent(searchText)}`} className="font-medium text-accent hover:underline">
                      Post it as a Wanted request
                    </Link>
                  ) : (
                    <Link to="/wanted/new" className="font-medium text-accent hover:underline">
                      Post what you need
                    </Link>
                  )}{' '}
                  - owners who have one will reply.
                </p>
              </div>
            )}

            {mapView && !error && (
              <Suspense fallback={<div className="flex justify-center py-16 text-night-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ListingsMap listings={loading ? [] : listings} me={me} onOpen={openListing} />
              </Suspense>
            )}

            <div className={mapView ? 'hidden' : 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3'}>
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorited={favoriteIds.has(listing.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>

            {!mapView && !loading && !error && (page > 1 || hasMore) && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-btn border border-night-border/20 px-4 py-2 text-sm font-medium text-night-text disabled:cursor-not-allowed disabled:opacity-30 hover:border-night-border/40"
                >
                  Previous
                </button>
                <span className="text-sm text-night-muted">Page {page}</span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={!hasMore}
                  className="rounded-btn border border-night-border/20 px-4 py-2 text-sm font-medium text-night-text disabled:cursor-not-allowed disabled:opacity-30 hover:border-night-border/40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DarkGradientBg>
  );
}
