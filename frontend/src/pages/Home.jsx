import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import CategoryCard from '../components/CategoryCard';

// Shown immediately while categories load, and as a fallback if the API
// call fails, so the page never renders empty.
const FALLBACK_CATEGORIES = [
  { id: 'farming', slug: 'farming', name: 'Farming Tools', description: 'Tractors, tillers, irrigation gear and more', icon: '🌾' },
  { id: 'construction', slug: 'construction', name: 'Construction Tools', description: 'Power tools, scaffolding, heavy equipment', icon: '🏗️' },
  { id: 'diy', slug: 'diy', name: 'Household & DIY', description: 'Drills, ladders, and everyday tools', icon: '🛠️' },
];

export default function Home() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

  useEffect(() => {
    api
      .getCategories()
      .then((data) => data?.length && setCategories(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <section className="bg-gradient-to-b from-stone-900 to-stone-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Rent the right tool. <span className="text-brand-400">Right when you need it.</span>
          </h1>
          <p className="mt-4 text-lg text-stone-300 max-w-2xl mx-auto">
            Rent It connects neighbors who own equipment with people who need it — for a day, a
            weekend, or a whole project. No buying, no clutter, no problem.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/marketplace"
              className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Browse the marketplace
            </Link>
            <Link
              to="/list-item"
              className="rounded-lg border border-stone-500 px-6 py-3 font-semibold text-white hover:bg-stone-700 transition-colors"
            >
              List your equipment
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">What are you looking for?</h2>
          <p className="mt-2 text-stone-500">Pick a category to start browsing gear near you.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <CategoryCard key={cat.slug} category={cat} />
          ))}
        </div>
      </section>

      <section className="bg-stone-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid gap-8 sm:grid-cols-3 text-center">
          <div>
            <div className="text-3xl mb-2">🔍</div>
            <h3 className="font-semibold text-stone-900">Find gear nearby</h3>
            <p className="text-sm text-stone-500 mt-1">
              Search and filter listings by category, price and keyword.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">📅</div>
            <h3 className="font-semibold text-stone-900">Request to rent</h3>
            <p className="text-sm text-stone-500 mt-1">
              Pick your dates and send a request — owners approve it from their dashboard.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">💰</div>
            <h3 className="font-semibold text-stone-900">Earn from what you own</h3>
            <p className="text-sm text-stone-500 mt-1">
              List tools sitting in your garage and start earning when they're idle.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
