import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, IndianRupee, MapPin, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import { postedAgo, wantedBudget, wantedDates } from '../lib/wanted';

// Wanted posts: what renters are looking for. Owners who have it tap
// "I have one", pick a listing, and a chat opens with the renter.
function WantedCard({ post, onRespond, children }) {
  const dates = wantedDates(post);
  const budget = wantedBudget(post);
  return (
    <article className="flex flex-col rounded-card border border-night-border/15 bg-night-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-night-text" translate="no">{post.title}</h3>
        {post.category && (
          <span className="shrink-0 rounded-full border border-night-border/20 px-2 py-0.5 text-xs text-night-muted">
            {post.category.icon} {post.category.name}
          </span>
        )}
      </div>
      {post.details && <p className="mt-2 text-sm text-night-muted" translate="no">{post.details}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-night-muted">
        {post.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> <span translate="no">{post.location}</span>
          </span>
        )}
        {dates && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {dates}
          </span>
        )}
        {budget && (
          <span className="inline-flex items-center gap-1">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden="true" /> {budget}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-night-border/10 pt-3">
        <span className="text-xs text-night-muted">
          <span translate="no">{post.is_mine ? 'You' : post.poster_name}</span> · posted {postedAgo(post.created_at)}
        </span>
        {onRespond && !post.is_mine && (
          <button type="button" onClick={() => onRespond(post)} className="rounded-btn bg-white px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90">
            I have one
          </button>
        )}
        {children}
      </div>
    </article>
  );
}

// Pick one of your listings to offer for a post.
function RespondDialog({ post, onClose }) {
  const navigate = useNavigate();
  const [listings, setListings] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMyListings()
      .then((all) => setListings(all.filter((l) => l.status === 'available')))
      .catch((err) => setError(err.message));
  }, []);

  async function choose(listing) {
    setBusy(listing.id);
    setError('');
    try {
      const { conversation_id } = await api.respondToWanted(post.id, listing.id);
      navigate(`/messages?c=${conversation_id}`);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-label="Reply with one of your listings">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-card border border-night-border/20 bg-night-elevated p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-night-text">Which of your listings?</h2>
            <p className="mt-1 text-sm text-night-muted">
              For "<span translate="no">{post.title}</span>". A chat opens with the renter, with a short hello from you.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-night-muted hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {listings === null && !error && <p className="mt-4 text-sm text-night-muted">Loading your listings…</p>}
        {listings?.length === 0 && (
          <p className="mt-4 text-sm text-night-muted">
            You don't have an available listing yet.{' '}
            <Link to="/list-item" className="font-medium text-accent hover:underline">List one first</Link>.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {listings?.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => choose(l)}
                disabled={!!busy}
                className="flex w-full items-center gap-3 rounded-btn border border-night-border/15 p-2 text-left hover:border-night-border/40 disabled:opacity-60"
              >
                {l.image_url ? (
                  <img src={l.image_url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/5 text-xl">{l.category?.icon || '🧰'}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-night-text" translate="no">{l.title}</span>
                  <span className="text-xs text-night-muted">₹{Number(l.price_per_day).toLocaleString('en-IN')}/day</span>
                </span>
                {busy === l.id && <span className="text-xs text-night-muted">Opening chat…</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Wanted() {
  useSeo({
    title: 'Wanted',
    description: 'Equipment people near you are looking to rent - owners, reply with your listing.',
    path: '/wanted',
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setError('');
    api
      .getWanted({ category, q: search })
      .then(setPosts)
      .catch((err) => setError(err.message));
  }, [category, search, user]);

  function loadMine() {
    if (user) api.getMyWanted().then(setMine).catch(() => {});
    else setMine([]);
  }
  useEffect(loadMine, [user]);

  function respond(post) {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/wanted' } } });
      return;
    }
    setResponding(post);
  }

  function refresh() {
    loadMine();
    api.getWanted({ category, q: search }).then(setPosts).catch(() => {});
  }

  async function setStatus(post, status) {
    try {
      await api.setWantedStatus(post.id, status);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(post) {
    try {
      await api.deleteWanted(post.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const others = (posts || []).filter((p) => !p.is_mine);

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)] text-night-text">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-heading-sm text-night-text">Wanted</h1>
            <p className="mt-1 max-w-xl text-body text-night-muted">
              What people are looking to rent. Have one of these? Tap "I have one" to offer your listing - it opens a chat.
            </p>
          </div>
          <Link
            to="/wanted/new"
            className="inline-flex items-center gap-1.5 rounded-btn bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Post what you need
          </Link>
        </div>

        {mine.length > 0 && (
          <section className="mt-8">
            <h2 className="text-subheading text-night-text">Your posts</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((post) => {
                const open = post.status === 'open' && !post.expired;
                return (
                  <WantedCard key={post.id} post={post}>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={open ? 'text-emerald-400' : 'text-night-muted'}>{open ? 'Open' : post.expired ? 'Expired' : 'Closed'}</span>
                      <button type="button" onClick={() => setStatus(post, open ? 'closed' : 'open')} className="text-night-text hover:underline">
                        {open ? 'Close' : 'Reopen'}
                      </button>
                      <button type="button" onClick={() => remove(post)} className="text-red-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  </WantedCard>
                );
              })}
            </div>
          </section>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
          className="mt-8 flex max-w-xl gap-2"
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search requests - e.g. tractor, Pune"
            aria-label="Search Wanted posts"
            className="w-full rounded-btn border border-night-border/20 bg-white/5 px-3 py-2 text-sm text-night-text placeholder:text-night-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="submit" className="shrink-0 rounded-btn bg-white px-4 text-sm font-medium text-black hover:opacity-90">
            Search
          </button>
        </form>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[{ slug: '', name: 'All', icon: '' }, ...categories].map((c) => (
            <button
              key={c.slug || 'all'}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${
                category === c.slug ? 'border-white bg-white text-black' : 'border-night-border/20 text-night-muted hover:text-night-text'
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
        {posts === null && !error && <p className="mt-10 text-center text-night-muted">Loading…</p>}
        {posts !== null && others.length === 0 && (
          <p className="mt-10 text-center text-night-muted">
            No open requests{search || category ? ' match that' : ' yet'}.{' '}
            <Link to="/wanted/new" className="font-medium text-accent hover:underline">Post what you need</Link>.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((post) => (
            <WantedCard key={post.id} post={post} onRespond={respond} />
          ))}
        </div>
      </div>

      {responding && <RespondDialog post={responding} onClose={() => setResponding(null)} />}
    </DarkGradientBg>
  );
}
