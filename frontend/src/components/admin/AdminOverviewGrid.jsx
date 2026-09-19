import { Fragment, useEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { DraggableWidgetGrid } from '../ui/draggable-widget-grid';

/* ------------------------------------------------------------------ *
 * Real-data Overview dashboard for the Staff page's Admin Console.
 *
 * Each widget below fetches its own endpoint independently and polls it on
 * its own interval, so one slow/failing query never blocks the others.
 * ------------------------------------------------------------------ */

const POLL_MS = 20000; // 20s - a real database, not client-side noise.

const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const MONO_FONT_URL = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';

function usePolledData(fetcher, intervalMs = POLL_MS) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetcherRef.current()
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return { data, error };
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ------------------------------------------------------------------ *
 * Shared building blocks
 * ------------------------------------------------------------------ */

function Shell({ title, meta, children }) {
  return (
    <section className="flex h-full flex-col gap-3 p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm leading-none">
        <h3 className="truncate text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{title}</h3>
        {meta && <span className="shrink-0 text-[11px] text-muted-foreground">{meta}</span>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Loading({ title }) {
  return (
    <Shell title={title}>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </Shell>
  );
}

function LoadFailed({ title }) {
  return (
    <Shell title={title}>
      <p className="text-sm text-muted-foreground">Couldn't load this.</p>
    </Shell>
  );
}

function Big({ children, unit }) {
  return (
    <p className="text-[26px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
      {children}
      {unit && <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">{unit}</span>}
    </p>
  );
}

const DOT_TONE = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  err: 'bg-rose-500',
  idle: 'bg-muted-foreground/50',
};

function Dot({ tone }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT_TONE[tone] || DOT_TONE.idle}`} />;
}

function Row({ children, value }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <dt className="flex min-w-0 items-center gap-2 truncate text-foreground">{children}</dt>
      <dd className="ml-auto shrink-0 text-muted-foreground tabular-nums">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Site activity - real listings + rental requests, last 5 days
 * ------------------------------------------------------------------ */

const DAY_LABELS = ['4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];
const HEAT = ['bg-foreground/[0.07]', 'bg-blue-500/25', 'bg-blue-500/40', 'bg-blue-500/60', 'bg-blue-500/85'];

function SiteActivity() {
  const { data, error } = usePolledData(api.getAdminActivityStats);
  if (error) return <LoadFailed title="Site activity" />;
  if (!data) return <Loading title="Site activity" />;

  const peak = Math.max(1, ...data.buckets.flat());
  return (
    <Shell title="Site activity" meta="listings + requests · 5d">
      <Big unit="today">{data.today_total}</Big>
      <div className="mt-auto grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        {data.buckets.map((row, d) => (
          <Fragment key={d}>
            <span className={`text-[11px] ${d === data.buckets.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {DAY_LABELS[d]}
            </span>
            <span className="flex gap-1">
              {row.map((v, s) => {
                const level = v === 0 ? 0 : Math.max(1, Math.ceil((v / peak) * 4));
                return (
                  <span
                    key={s}
                    title={`${v} ${v === 1 ? 'event' : 'events'}`}
                    className={`h-3 flex-1 rounded-[3px] ${HEAT[level]}`}
                  />
                );
              })}
            </span>
          </Fragment>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Total users - real headcount, growth, and a role-split donut
 * ------------------------------------------------------------------ */

// Matches this dashboard's own existing role/status color convention
// (ROLE_BADGE's admin=emerald in AdminDashboard.jsx, DOT_TONE.ok above) -
// no new arbitrary colors introduced.
const ROLE_CHART_COLORS = { admin: '#10b981', user: '#71717a' };

function TotalUsers() {
  const { data, error } = usePolledData(api.getAdminUserStats);
  if (error) return <LoadFailed title="Total users" />;
  if (!data) return <Loading title="Total users" />;

  const chartData = data.roles.map((r) => ({ name: r.role, value: r.count }));

  return (
    <Shell title="Total users">
      <Big>{data.total}</Big>
      <dl className="mt-2 space-y-2">
        <Row value={data.new_today}>New today</Row>
        <Row value={data.new_this_week}>New this week</Row>
      </dl>
      <div className="mt-auto flex items-center gap-3">
        <div className="h-14 w-14 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={16} outerRadius={28} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={ROLE_CHART_COLORS[entry.name] || ROLE_CHART_COLORS.user} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <dl className="space-y-1 text-[12px]">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: ROLE_CHART_COLORS[entry.name] || ROLE_CHART_COLORS.user }}
              />
              <span className="capitalize text-foreground">{entry.name}</span>
              <span className="text-muted-foreground">{entry.value}</span>
            </div>
          ))}
        </dl>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Escrow held - real, currently-held renter deposits
 * ------------------------------------------------------------------ */

function EscrowHeld() {
  const { data, error } = usePolledData(api.getAdminEscrowStats);
  if (error) return <LoadFailed title="Escrow held" />;
  if (!data) return <Loading title="Escrow held" />;
  return (
    <Shell title="Escrow held" meta="deposits">
      <Big>₹{Number(data.held_total).toLocaleString('en-IN')}</Big>
      <p className="mt-auto text-[13px] text-muted-foreground">Currently held across active rentals</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 4. Open disputes - flagged reviews + open rental disputes
 * ------------------------------------------------------------------ */

function OpenDisputes() {
  const { data, error } = usePolledData(api.getAdminOverview);
  if (error) return <LoadFailed title="Open disputes" />;
  if (!data) return <Loading title="Open disputes" />;

  const total = (data.open_disputes || 0) + (data.flagged_reviews || 0);
  return (
    <Shell title="Open disputes">
      <Big>{total}</Big>
      <dl className="mt-auto space-y-2">
        <Row value={data.flagged_reviews}>
          <Dot tone={data.flagged_reviews ? 'err' : 'idle'} />
          Flagged reviews
        </Row>
        <Row value={data.open_disputes}>
          <Dot tone={data.open_disputes ? 'err' : 'idle'} />
          Open rental disputes
        </Row>
      </dl>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 5. Recent requests - most recent real rental requests
 * ------------------------------------------------------------------ */

const STATUS_TONE = {
  approved: 'ok',
  completed: 'ok',
  pending: 'warn',
  rejected: 'err',
  disputed: 'err',
  cancelled: 'idle',
};

function RecentRequests() {
  const { data, error } = usePolledData(api.getAdminRentals);
  if (error) return <LoadFailed title="Recent requests" />;
  if (!data) return <Loading title="Recent requests" />;

  const rows = data.slice(0, 5);
  return (
    <Shell title="Recent requests" meta={`${data.length} total`}>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
      <ol className="mt-auto space-y-2 text-[13px]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <Dot tone={STATUS_TONE[r.status] || 'idle'} />
            <span className="min-w-0 flex-1 truncate text-foreground">
              {r.listing?.title || 'Listing'}
              <span className="text-muted-foreground"> · {r.renter?.full_name || 'Unknown'}</span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{timeAgo(r.created_at)}</span>
          </li>
        ))}
      </ol>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 6. Approval rate - real approved vs rejected vs pending
 * ------------------------------------------------------------------ */

const APPROVED_LINEAGE = ['approved', 'completed', 'disputed'];

function ApprovalRate() {
  const { data, error } = usePolledData(api.getAdminRentals);
  if (error) return <LoadFailed title="Approval rate" />;
  if (!data) return <Loading title="Approval rate" />;

  const approved = data.filter((r) => APPROVED_LINEAGE.includes(r.status)).length;
  const rejected = data.filter((r) => r.status === 'rejected').length;
  const pending = data.filter((r) => r.status === 'pending').length;
  const decided = approved + rejected;
  const rate = decided ? Math.round((approved / decided) * 100) : 0;

  return (
    <Shell title="Approval rate">
      <Big unit="%">{rate}</Big>
      <dl className="mt-auto space-y-2">
        <Row value={approved}>Approved</Row>
        <Row value={rejected}>Rejected</Row>
        <Row value={pending}>Pending</Row>
      </dl>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 7. Pending verifications - real seller ID verification queue
 * ------------------------------------------------------------------ */

function PendingVerifications() {
  const { data, error } = usePolledData(api.getKycQueue);
  if (error) return <LoadFailed title="Pending verifications" />;
  if (!data) return <Loading title="Pending verifications" />;

  const recent = [...data].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 5);

  return (
    <Shell title="Pending verifications" meta="seller ID checks">
      <Big>{data.length}</Big>
      {recent.length === 0 && <p className="text-sm text-muted-foreground">No pending submissions.</p>}
      <ol className="mt-auto space-y-2 text-[13px]">
        {recent.map((k) => (
          <li key={k.user_id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-foreground">{k.full_name || k.user?.full_name || 'Unknown'}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{new Date(k.submitted_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ol>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * 8. Listings by category
 * ------------------------------------------------------------------ */

const SWATCHES = ['bg-blue-500', 'bg-blue-500/70', 'bg-blue-500/45', 'bg-blue-500/25', 'bg-foreground/25', 'bg-foreground/10'];

function ListingsByCategory() {
  const { data, error } = usePolledData(api.getAdminListingsByCategory);
  if (error) return <LoadFailed title="Listings by category" />;
  if (!data) return <Loading title="Listings by category" />;

  const total = data.reduce((sum, c) => sum + c.count, 0);
  return (
    <Shell title="Listings by category" meta={`${total} total`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {data.slice(0, 6).map((c, i) => (
          <Row key={c.name} value={`${Math.round(c.share * 100)}%`}>
            <span className={`size-1.5 shrink-0 rounded-full ${SWATCHES[i % SWATCHES.length]}`} />
            <span className="truncate">{c.name}</span>
          </Row>
        ))}
      </dl>
      <div className="mt-4 flex h-[6px] gap-[3px]">
        {data.map((c, i) => (
          <span
            key={c.name}
            className={`h-full rounded-full ${SWATCHES[i % SWATCHES.length]}`}
            style={{ width: `${c.share * 100}%` }}
          />
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */

const WIDGETS = [
  { id: 'site-activity', kind: 'site-activity', size: 'wide', label: 'Site activity' },
  { id: 'total-users', kind: 'total-users', size: 'sm', label: 'Total users' },
  { id: 'escrow-held', kind: 'escrow-held', size: 'sm', label: 'Escrow held' },
  { id: 'open-disputes', kind: 'open-disputes', size: 'sm', label: 'Open disputes' },
  { id: 'recent-requests', kind: 'recent-requests', size: 'wide', label: 'Recent requests' },
  { id: 'approval-rate', kind: 'approval-rate', size: 'sm', label: 'Approval rate' },
  { id: 'pending-verifications', kind: 'pending-verifications', size: 'wide', label: 'Pending verifications' },
  { id: 'listings-by-category', kind: 'listings-by-category', size: 'wide', label: 'Listings by category' },
];

const VIEWS = {
  'site-activity': SiteActivity,
  'total-users': TotalUsers,
  'escrow-held': EscrowHeld,
  'open-disputes': OpenDisputes,
  'recent-requests': RecentRequests,
  'approval-rate': ApprovalRate,
  'pending-verifications': PendingVerifications,
  'listings-by-category': ListingsByCategory,
};

function orderStorageKey(userId) {
  return `admin-widget-order:${userId}`;
}

function loadSavedOrder(userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(orderStorageKey(userId));
    if (!raw) return null;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return null;
    const byId = new Map(WIDGETS.map((w) => [w.id, w]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    // Ignore a stale saved order that doesn't cover every current widget
    // (e.g. after a widget was added/removed) rather than showing a partial board.
    return ordered.length === WIDGETS.length ? ordered : null;
  } catch {
    return null;
  }
}

export default function AdminOverviewGrid() {
  const { user } = useAuth();
  const [items, setItems] = useState(() => loadSavedOrder(user?.id) ?? WIDGETS);

  useEffect(() => {
    const saved = loadSavedOrder(user?.id);
    if (saved) setItems(saved);
  }, [user?.id]);

  function handleChange(next) {
    setItems(next);
    if (!user?.id) return;
    try {
      window.localStorage.setItem(orderStorageKey(user.id), JSON.stringify(next.map((i) => i.id)));
    } catch {
      // localStorage can throw in private browsing - losing the saved order isn't worth surfacing.
    }
  }

  return (
    <div style={{ fontFamily: MONO_STACK }}>
      <link rel="stylesheet" href={MONO_FONT_URL} />
      <DraggableWidgetGrid
        items={items}
        onChange={handleChange}
        renderItem={(item) => {
          const View = VIEWS[item.kind];
          return View ? <View /> : null;
        }}
      />
    </div>
  );
}
