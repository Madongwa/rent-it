import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import ListingCard from '../components/ListingCard';

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'newest';

  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getListings({ category, q, sort })
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [category, q, sort]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    updateParam('q', searchInput.trim());
  }

  const activeCategory = categories.find((c) => c.slug === category);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
          {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'Marketplace'}
        </h1>
        <p className="text-stone-500 mt-1">
          {activeCategory ? activeCategory.description : 'Browse all equipment available to rent.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateParam('category', '')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              !category
                ? 'bg-stone-900 text-white border-stone-900'
                : 'border-stone-300 text-stone-600 hover:bg-stone-100'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => updateParam('category', cat.slug)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                category === cat.slug
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <form onSubmit={handleSearchSubmit} className="flex">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search listings…"
              className="w-48 sm:w-64 rounded-l-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              className="rounded-r-md bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800"
            >
              Search
            </button>
          </form>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {loading && <div className="py-16 text-center text-stone-500">Loading listings…</div>}
      {error && <div className="py-16 text-center text-red-500">{error}</div>}

      {!loading && !error && listings.length === 0 && (
        <div className="py-16 text-center text-stone-500">
          No listings found. Try a different search or{' '}
          <a href="/list-item" className="text-brand-600 font-medium">
            be the first to list an item
          </a>
          .
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
