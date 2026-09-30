import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../lib/api';
import useSeo from '../hooks/useSeo';
import { formatInr } from '../lib/offers';

// The rental agreement: what the renter and owner agreed, in English plus
// each person's own language (the server translates only the fixed
// wording). "Print / Save as PDF" uses the browser's print dialog, which
// handles every Indian script. The page does its own languages, so the
// site-wide translator is kept off it (translate="no").
function Lines({ text, languages, k }) {
  const [first, ...rest] = languages;
  return (
    <>
      <span className="block">{text[first][k]}</span>
      {rest.map((lang) =>
        text[lang][k] !== text[first][k] ? (
          <span key={lang} lang={lang} className="block text-[0.92em] text-neutral-500">
            {text[lang][k]}
          </span>
        ) : null
      )}
    </>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-neutral-200 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-neutral-600">{label}</dt>
      <dd className="text-neutral-900">{children}</dd>
    </div>
  );
}

function day(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Agreement() {
  const { id } = useParams();
  useSeo({ title: 'Rental agreement', path: `/rentals/${id}/agreement` });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAgreement(id).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-night-muted">
        <p>{error}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-accent hover:underline">Back to Dashboard</Link>
      </div>
    );
  }
  if (!data) return <div className="py-16 text-center text-night-muted">Loading…</div>;

  const { agreement: a, languages, text } = data;
  const L = (k) => <Lines text={text} languages={languages} k={k} />;
  const statusKey = { approved: 'statusApproved', completed: 'statusCompleted', disputed: 'statusDisputed' }[a.status];

  return (
    <div translate="no" className="bg-night-bg px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/dashboard" className="text-sm text-night-muted hover:text-night-text">← Dashboard</Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-btn bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" /> Print / Save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-3xl rounded-card bg-white p-6 text-neutral-900 shadow-xl sm:p-10 print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-neutral-900 pb-4">
          <p className="text-sm font-semibold tracking-wide text-neutral-500">RENT IT</p>
          <h1 className="mt-1 text-2xl font-bold">{L('title')}</h1>
          <p className="mt-2 text-sm text-neutral-600">{L('intro')}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {text.en.reference}: {a.id.slice(0, 8).toUpperCase()} · {day(a.created_at.slice(0, 10))}
          </p>
        </header>

        <dl className="mt-2">
          <Row label={L('owner')}>{a.owner_name}</Row>
          <Row label={L('renter')}>{a.renter_name}</Row>
          <Row label={L('item')}>
            {a.item}
            {a.condition ? ` (${a.condition})` : ''}
          </Row>
          {a.location && <Row label={L('location')}>{a.location}</Row>}
          <Row label={L('period')}>
            {day(a.start_date)} - {day(a.end_date)} · {a.days} {text.en.days}
          </Row>
          <Row label={L('pricePerDay')}>{formatInr(a.price_per_day)}</Row>
          <Row label={L('total')}>
            <strong>{formatInr(a.total)}</strong>
          </Row>
          <Row label={L('deposit')}>{a.deposit ? formatInr(a.deposit) : L('noDeposit')}</Row>
          {a.cancellation_policy && text.en[a.cancellation_policy] && <Row label={L('cancellation')}>{L(a.cancellation_policy)}</Row>}
          <Row label={L('photos')}>
            {a.pickup_photos} {text.en.pickupPhotos} · {a.return_photos} {text.en.returnPhotos}
          </Row>
          {statusKey && <Row label={L('status')}>{L(statusKey)}</Row>}
        </dl>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">{L('termsHeading')}</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            {['term1', 'term2', 'term3', 'term4', 'term5'].map((k) => (
              <li key={k}>{L(k)}</li>
            ))}
          </ol>
        </section>

        <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs text-neutral-500">{L('footer')}</footer>
      </article>
    </div>
  );
}
