import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { formatInr } from '../lib/offers';

// The owner's earnings on their Profile (backend lib/earnings.js): agreed
// rent on their listings - Rent It never handles the money, so it's what
// renters agreed to pay, deposits excluded.
// Bar colour: one step lighter than the site accent, so it clears 3:1
// against the card (validated with the dataviz palette checker).
const BAR = '#43a047';

const monthLabel = (ym, long = false) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', long ? { month: 'long', year: 'numeric' } : { month: 'short' });

function Tile({ label, value, note }) {
  return (
    <div className="rounded-btn border border-night-border/15 bg-black/20 p-4">
      <p className="text-xs text-night-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-night-text">{value}</p>
      {note && <p className="mt-0.5 text-xs text-night-muted">{note}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { month, amount } = payload[0].payload;
  return (
    <div className="rounded-btn border border-night-border/20 bg-night-elevated px-3 py-2 text-xs shadow-lg">
      <p className="text-night-muted">{monthLabel(month, true)}</p>
      <p className="font-semibold text-night-text">{formatInr(amount)}</p>
    </div>
  );
}

export default function Earnings() {
  const [data, setData] = useState(null);
  const [hasListings, setHasListings] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getEarnings(), api.getMyListings()])
      .then(([e, listings]) => {
        setData(e);
        setHasListings(listings.length > 0);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="mt-8 text-sm text-red-400">{error}</p>;
  if (!data || (!hasListings && !data.deals)) return null;

  return (
    <section className="mt-8 rounded-card border border-night-border/15 bg-night-card p-6">
      <h2 className="text-subheading text-night-text">Your earnings</h2>
      <p className="mt-1 text-sm text-night-muted">
        What renters agreed to pay for your items (deposits not included). You're paid in person, so this is the agreed rent, not money Rent It holds.
      </p>

      {data.deals === 0 ? (
        <p className="mt-4 text-sm text-night-muted">
          No agreed rentals yet - they'll show here.{' '}
          <Link to="/dashboard" className="text-accent hover:underline">See 💡 Tips on your listings</Link>.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Earned so far" value={formatInr(data.earned)} note={`${data.completed} rental${data.completed === 1 ? '' : 's'} completed`} />
            <Tile label="Agreed, coming up" value={formatInr(data.upcoming)} />
            <Tile
              label="Most rented"
              value={<span className="text-base" translate="no">{data.top_listing?.title}</span>}
              note={data.top_listing ? `${data.top_listing.rentals} rental${data.top_listing.rentals === 1 ? '' : 's'} · ${formatInr(data.top_listing.amount)}` : ''}
            />
          </div>

          <h3 className="mt-6 text-sm font-medium text-night-text">Agreed rent by month (last 12 months)</h3>
          {data.busiest_month && <p className="text-xs text-night-muted">Busiest: {monthLabel(data.busiest_month, true)}</p>}
          <div className="mt-2 h-56" role="img" aria-label="Bar chart of agreed rent by month - the table below has the same numbers">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} tick={{ fill: '#999999', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  width={56}
                  tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
                  tick={{ fill: '#999999', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
                <Bar dataKey="amount" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-night-muted hover:text-night-text">See as a table</summary>
            <table className="mt-2 w-full text-left text-night-text">
              <thead className="text-xs text-night-muted">
                <tr>
                  <th className="py-1 font-medium">Month</th>
                  <th className="py-1 text-right font-medium">Agreed rent</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-t border-night-border/10">
                    <td className="py-1">{monthLabel(m.month, true)}</td>
                    <td className="py-1 text-right tabular-nums">{formatInr(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {data.listings.length > 1 && (
            <>
              <h3 className="mt-6 text-sm font-medium text-night-text">By item</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {data.listings.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 border-b border-night-border/10 py-1">
                    <Link to={`/listing/${l.id}`} className="truncate text-night-text hover:underline" translate="no">{l.title}</Link>
                    <span className="shrink-0 tabular-nums text-night-muted">
                      {l.rentals} · {formatInr(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
