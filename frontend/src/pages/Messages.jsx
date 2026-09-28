import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, IndianRupee, MessageCircle, Search } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import OfferForm from '../components/OfferForm';
import AttachMenu from '../components/chat/AttachMenu';
import AttachmentMessage from '../components/chat/AttachmentMessage';
import { checkAttachment, shrinkImage, uploadAttachment } from '../lib/chatAttachments';
import { MESSAGES_READ_EVENT } from '../hooks/useUnreadMessages';
import { formatDay, formatInr, priceDifference, rentalDays } from '../lib/offers';

// Leaflet (the map) only downloads when someone opens the location picker.
const LocationPicker = lazy(() => import('../components/chat/LocationPicker'));

const ATTACHMENT_KINDS = ['image', 'file', 'location'];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(iso) {
  return Math.round((startOfDay(new Date()) - startOfDay(iso)) / DAY_MS);
}

function formatClock(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

// Chat list: time today, "Yesterday", weekday this week, else the date.
function formatListTime(iso) {
  const ago = daysAgo(iso);
  if (ago === 0) return formatClock(iso);
  if (ago === 1) return 'Yesterday';
  if (ago < 7) return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' });
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Separator between days in a thread.
function formatDaySeparator(iso) {
  const ago = daysAgo(iso);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago < 7) return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long' });
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const AVATAR_COLORS = ['bg-emerald-700', 'bg-sky-700', 'bg-violet-700', 'bg-amber-700', 'bg-rose-700', 'bg-teal-700'];

function Avatar({ name, imageUrl, size = 'h-11 w-11' }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const label = (name || '?').trim();
  const color = AVATAR_COLORS[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden="true"
      className={`${size} ${color} inline-flex shrink-0 items-center justify-center rounded-full text-base font-semibold uppercase text-white`}
    >
      {label.charAt(0)}
    </span>
  );
}

// ✓ sent, ✓✓ read - read means the other person has opened the thread
// since this message arrived.
function Ticks({ read }) {
  return (
    <span className={read ? 'text-sky-300' : 'opacity-70'} aria-label={read ? 'Read' : 'Sent'}>
      {read ? '✓✓' : '✓'}
    </span>
  );
}

const OFFER_STATUS_LABEL = {
  countered: { text: 'Countered', className: 'text-night-muted' },
  accepted: { text: '✓ Accepted', className: 'text-emerald-400' },
  declined: { text: 'Declined', className: 'text-red-400' },
  withdrawn: { text: 'Withdrawn', className: 'text-night-muted' },
};

const DIFF_TEXT = {
  below: 'text-amber-400',
  above: 'text-emerald-400',
  same: 'text-night-muted',
};

// One offer or counter-offer in the thread. Whoever didn't make the open
// offer gets Accept / Counter / Decline on it; the maker just sees that
// it's waiting on the other side.
function OfferCard({ offer, isFirst, mine, isOwner, otherName, listedPrice, listing, busy, onAccept, onCounter, onDecline }) {
  const [countering, setCountering] = useState(false);
  const rental = offer.rental;
  const days = rentalDays(offer.start_date, offer.end_date);
  const diff = priceDifference(offer.price_per_day, listedPrice);
  const isOpen = offer.status === 'open' && rental?.status === 'pending';
  const status = OFFER_STATUS_LABEL[offer.status];

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-sm rounded-card border border-night-border/20 bg-night-elevated/90 p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-night-muted">
          {mine ? 'You' : otherName} {isFirst ? 'sent a request' : 'countered'}
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-heading-sm text-night-text">{formatInr(offer.price_per_day)}</span>
          <span className="text-sm text-night-muted">/day</span>
        </div>
        {listedPrice != null && (
          <p className="text-sm text-night-muted">
            Listed at {formatInr(listedPrice)}/day
            {diff && diff.tone !== 'same' && <span className={DIFF_TEXT[diff.tone]}> · {diff.label}</span>}
          </p>
        )}

        <dl className="mt-3 space-y-1 border-t border-night-border/15 pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-night-muted">Dates</dt>
            <dd className="text-right text-night-text">
              {formatDay(offer.start_date)} → {formatDay(offer.end_date)} · {days} day{days === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-night-muted">Total</dt>
            <dd className="font-semibold text-night-text">{formatInr(offer.price_per_day * days)}</dd>
          </div>
          {listing?.deposit_required && (
            <div className="flex justify-between gap-3">
              <dt className="text-night-muted">Deposit</dt>
              <dd className="text-right text-night-text">
                {listing.deposit_amount ? formatInr(listing.deposit_amount) : 'Required'} · at pickup
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3 border-t border-night-border/15 pt-3">
          {isOpen && !mine && !countering && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => setCountering(true)}
                disabled={busy}
                className="rounded-btn border border-night-border/25 px-3 py-1.5 text-sm font-medium text-night-text hover:bg-white/5 disabled:opacity-60"
              >
                Counter
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="px-2 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          )}
          {isOpen && !mine && countering && (
            <OfferForm
              listingId={listing?.id}
              listedPrice={listedPrice}
              depositRequired={listing?.deposit_required}
              depositAmount={listing?.deposit_amount}
              initial={offer}
              submitLabel="Send counter-offer"
              note={isOwner ? 'The renter pays you directly at pickup.' : undefined}
              onSubmit={async (terms) => {
                await onCounter(terms);
                setCountering(false);
              }}
              onCancel={() => setCountering(false)}
            />
          )}
          {isOpen && mine && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-night-muted">Waiting for {otherName} to respond…</p>
              {!isOwner && (
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={busy}
                  className="text-sm font-medium text-night-muted hover:text-night-text disabled:opacity-60"
                >
                  Withdraw
                </button>
              )}
            </div>
          )}
          {!isOpen && (
            <p className={`text-sm font-medium ${status?.className || 'text-night-muted'}`}>
              {status?.text || `Request ${rental?.status || 'closed'}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function otherPersonOf(conversation, userId) {
  return conversation.owner_id === userId ? conversation.renter : conversation.owner;
}

function ConversationRow({ conversation, userId, active, onOpen }) {
  const other = otherPersonOf(conversation, userId);
  const last = conversation.last_message;
  const mineLast = last && last.sender_id === userId && last.kind !== 'system';
  const unread = conversation.unread_count || 0;
  const read =
    mineLast && conversation.other_last_read_at && new Date(conversation.other_last_read_at) >= new Date(last.created_at);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${active ? 'bg-white/10' : ''}`}
    >
      <Avatar name={other?.full_name} imageUrl={other?.avatar_url} />
      <div className="min-w-0 flex-1 border-b border-night-border/10 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-sm ${unread ? 'font-bold' : 'font-semibold'} text-night-text`}
            translate={other?.full_name ? 'no' : undefined}
          >
            {other?.full_name || 'Rent It user'}
          </p>
          <span className={`shrink-0 text-[11px] ${unread ? 'font-semibold text-emerald-400' : 'text-night-muted'}`}>
            {(last?.created_at || conversation.created_at) && formatListTime(last?.created_at || conversation.created_at)}
          </span>
        </div>
        <p className="truncate text-xs text-night-muted/80">{conversation.listing?.title}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`truncate text-[13px] ${unread ? 'text-night-text' : 'text-night-muted'}`}>
            {mineLast && (
              <>
                <Ticks read={read} />{' '}
              </>
            )}
            {/* What people type stays exactly as typed - the language button
                translates the site, never chats. App-written lines (offers,
                status updates) are ordinary site text and do get translated. */}
            {last ? (
              (last.kind || 'text') === 'text' ? (
                <span translate="no" dir="auto">
                  {last.body}
                </span>
              ) : (
                last.body
              )
            ) : (
              'No messages yet'
            )}
          </p>
          {unread > 0 && (
            <span
              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-black"
              aria-label={`${unread} unread`}
            >
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('c');
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const [conversations, setConversations] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  // Photos/documents on their way up: { id, name, status: 'uploading' | 'failed', error }
  const [uploads, setUploads] = useState([]);
  const bottomRef = useRef(null);

  function loadConversations() {
    return api
      .getConversations()
      .then(setConversations)
      .catch((err) => setError(err.message))
      .finally(() => setListLoaded(true));
  }

  useEffect(() => {
    loadConversations();
  }, []);

  // Like WhatsApp, a thread only counts as read while it's actually on
  // screen - not when a message lands in a background tab.
  const markRead = useCallback((id) => {
    if (!id || document.visibilityState === 'hidden') return;
    api
      .markConversationRead(id)
      .then(() => {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
        window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
      })
      .catch(() => {});
  }, []);

  // Re-fetches the open thread without the "Loading…" flash - used after an
  // offer action, and when an offer card or status line arrives in real
  // time (those need the joined offer/rental data a realtime row lacks).
  function refreshThread() {
    const id = activeIdRef.current;
    if (!id) return Promise.resolve();
    return api
      .getMessages(id)
      .then((data) => {
        if (activeIdRef.current === id) setMessages(data);
      })
      .catch((err) => setThreadError(err.message));
  }

  useEffect(() => {
    setOfferFormOpen(false);
    setLocationOpen(false);
    setUploads([]);
    setThreadError('');
    setDraft('');
    setMessages([]);
    if (!activeId) return;
    setLoadingThread(true);
    api
      .getMessages(activeId)
      .then((data) => {
        if (activeIdRef.current !== activeId) return;
        setMessages(data);
        markRead(activeId);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingThread(false));
  }, [activeId, markRead]);

  // Coming back to the tab reads whatever arrived while it was hidden.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') markRead(activeIdRef.current);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, uploads.length]);

  // Real-time: RLS on `messages`/`conversations` means Supabase only ever
  // delivers rows from this user's own threads, so no manual filtering by
  // participant is needed. New messages go into the open thread (and mark
  // it read); a conversation UPDATE is the other person reading, which
  // turns ✓ into ✓✓. Requires both tables in the `supabase_realtime`
  // publication (see schema.sql).
  useEffect(() => {
    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incoming = payload.new;
        if (incoming.conversation_id === activeIdRef.current) {
          if (incoming.kind === 'offer' || incoming.kind === 'system') {
            // A new offer or status line also changes earlier cards (the
            // offer it replaced is now "Countered"), so reload the thread.
            refreshThread();
          } else {
            setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          }
          if (incoming.sender_id !== userRef.current?.id) markRead(incoming.conversation_id);
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === row.id
              ? {
                  ...c,
                  owner_last_read_at: row.owner_last_read_at,
                  renter_last_read_at: row.renter_last_read_at,
                  other_last_read_at: c.owner_id === userRef.current?.id ? row.renter_last_read_at : row.owner_last_read_at,
                }
              : c
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = conversations.find((c) => c.id === activeId);
  const isOwner = active?.owner_id === user?.id;
  const other = active ? otherPersonOf(active, user?.id) : null;
  const otherName = other?.full_name || 'Rent It user';

  // The newest offer card decides the thread's deal state: still being
  // bargained (pending), agreed (approved), or over - in which case the
  // renter can start a fresh request.
  const offerMessages = messages.filter((m) => m.kind === 'offer' && m.offer);
  const latestOffer = offerMessages[offerMessages.length - 1]?.offer;
  const dealStatus = latestOffer?.rental?.status;
  const negotiating = dealStatus === 'pending';
  const firstOfferIds = new Set();
  const seenRentals = new Set();
  offerMessages.forEach((m) => {
    if (!seenRentals.has(m.offer.rental_id)) {
      seenRentals.add(m.offer.rental_id);
      firstOfferIds.add(m.offer.id);
    }
  });
  const canMakeOffer = active && !isOwner && !negotiating && active.listing?.status === 'available';

  const q = query.trim().toLowerCase();
  const visibleConversations = q
    ? conversations.filter((c) =>
        [otherPersonOf(c, user?.id)?.full_name, c.listing?.title, c.last_message?.body].some((text) =>
          (text || '').toLowerCase().includes(q)
        )
      )
    : conversations;

  async function runOfferAction(action) {
    setThreadError('');
    setOfferBusy(true);
    try {
      await action();
      await refreshThread();
      loadConversations();
    } finally {
      setOfferBusy(false);
    }
  }

  function handleAccept(offer) {
    runOfferAction(() => api.acceptOffer(offer.rental_id)).catch((err) => setThreadError(err.message));
  }

  // Throws on failure so the counter form shows the error inline.
  function handleCounter(offer, terms) {
    return runOfferAction(() => api.counterOffer(offer.rental_id, terms));
  }

  function handleDecline(offer) {
    // The owner declining ends the request; the renter declining a counter
    // (or withdrawing their own offer) cancels it.
    runOfferAction(() => api.updateRentalStatus(offer.rental_id, isOwner ? 'rejected' : 'cancelled')).catch((err) =>
      setThreadError(err.message)
    );
  }

  async function handleNewOffer(terms) {
    await runOfferAction(() => api.createRental({ listing_id: active.listing.id, ...terms }));
    setOfferFormOpen(false);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      const sent = await api.sendMessage(activeId, draft.trim());
      setMessages((m) => (m.some((x) => x.id === sent.id) ? m : [...m, sent]));
      setDraft('');
      loadConversations(); // refresh preview/order
    } catch (err) {
      setThreadError(err.message);
    } finally {
      setSending(false);
    }
  }

  function addSent(sent) {
    setMessages((m) => (m.some((x) => x.id === sent.id) ? m : [...m, sent]));
  }

  // Photos and documents: each file uploads (showing a placeholder bubble
  // meanwhile) and then becomes its own message, like WhatsApp.
  async function sendFiles(files, kind) {
    const conversationId = activeId;
    setThreadError('');
    for (const original of files) {
      const problem = checkAttachment(original, kind);
      if (problem) {
        setThreadError(problem);
        continue;
      }
      const id = `${Date.now()}-${Math.random()}`;
      setUploads((u) => [...u, { id, name: original.name, kind, status: 'uploading' }]);
      try {
        const file = kind === 'image' ? await shrinkImage(original) : original;
        const attachment = await uploadAttachment(conversationId, file);
        const sent = await api.sendAttachment(conversationId, kind, attachment);
        if (activeIdRef.current === conversationId) addSent(sent);
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (err) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: 'failed', error: err.message } : x)));
      }
    }
    loadConversations();
  }

  // Throws on failure so the picker can show the error.
  async function sendLocation(location) {
    const sent = await api.sendAttachment(activeId, 'location', location);
    addSent(sent);
    setLocationOpen(false);
    loadConversations();
  }

  // Pasting a screenshot/photo into the message box sends it as a photo.
  function handlePaste(e) {
    const images = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
    if (images.length) {
      e.preventDefault();
      sendFiles(images, 'image');
    }
  }

  function openConversation(id) {
    setSearchParams({ c: id });
  }

  function closeConversation() {
    setSearchParams({});
  }

  const otherReadAt = active?.other_last_read_at ? new Date(active.other_last_read_at) : null;

  return (
    <DarkGradientBg className="flex min-h-0 flex-1 flex-col" contentClassName="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Messages</h1>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 sm:px-4 sm:py-4">
        <div className="flex min-h-0 flex-1 overflow-hidden border-night-border/15 bg-night-card/60 backdrop-blur sm:rounded-card sm:border">
          {/* Chat list - the whole screen on phones until a chat is opened */}
          <aside
            className={`${activeId ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-night-border/15 md:w-80 md:shrink-0 md:border-r lg:w-96`}
          >
            <div className="border-b border-night-border/15 px-4 pb-3 pt-4">
              <h2 className="text-lg font-bold text-night-text">Chats</h2>
              <label className="relative mt-3 block">
                <span className="sr-only">Search chats</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, item or message"
                  className="w-full rounded-full border border-night-border/15 bg-black/30 py-2 pl-9 pr-3 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!listLoaded && <p className="p-4 text-sm text-night-muted">Loading…</p>}
              {listLoaded && conversations.length === 0 && (
                <p className="p-4 text-sm text-night-muted">
                  No chats yet. Tap "Message the owner" or send a request on any listing to start one.
                </p>
              )}
              {listLoaded && conversations.length > 0 && visibleConversations.length === 0 && (
                <p className="p-4 text-sm text-night-muted">No chats match "{query.trim()}".</p>
              )}
              {visibleConversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  userId={user?.id}
                  active={c.id === activeId}
                  onOpen={() => openConversation(c.id)}
                />
              ))}
            </div>
          </aside>

          {/* Open chat */}
          <section className={`${activeId ? 'flex' : 'hidden md:flex'} relative min-h-0 min-w-0 flex-1 flex-col`}>
            {!activeId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-night-muted">
                <MessageCircle className="h-12 w-12 opacity-40" aria-hidden="true" />
                <p className="text-sm">Pick a chat to start messaging.</p>
              </div>
            ) : !active ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-night-muted">
                {listLoaded ? 'This chat could not be found.' : 'Loading…'}
                {listLoaded && (
                  <button type="button" onClick={closeConversation} className="font-medium text-night-text hover:underline">
                    Back to chats
                  </button>
                )}
              </div>
            ) : (
              <>
                <header className="border-b border-night-border/15 bg-night-elevated/60 px-3 py-2.5 sm:px-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeConversation}
                      aria-label="Back to chats"
                      className="-ml-1 rounded-full p-1.5 text-night-text hover:bg-white/10 md:hidden"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <Avatar name={otherName} imageUrl={other?.avatar_url} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-night-text" translate={other?.full_name ? 'no' : undefined}>
                        {otherName}
                      </p>
                      <p className="truncate text-xs text-night-muted">
                        <Link to={`/listing/${active.listing?.id}`} className="hover:underline">
                          {active.listing?.title}
                        </Link>
                        {active.listing?.price_per_day != null && <> · listed {formatInr(active.listing.price_per_day)}/day</>}
                      </p>
                    </div>
                    {negotiating && (
                      <span className="hidden shrink-0 rounded-badge bg-amber-500/15 px-2.5 py-1 text-caption font-medium text-amber-400 sm:inline">
                        Negotiating · {formatInr(latestOffer.price_per_day)}/day
                      </span>
                    )}
                    {dealStatus === 'approved' && (
                      <span className="hidden shrink-0 rounded-badge bg-emerald-500/15 px-2.5 py-1 text-caption font-medium text-emerald-400 sm:inline">
                        Deal agreed · {formatInr(latestOffer.price_per_day)}/day
                      </span>
                    )}
                  </div>
                  {latestOffer && (
                    <p className="mt-2 text-caption text-night-muted">
                      {isOwner
                        ? 'The renter pays you directly at pickup. Rent It never asks for payment in chat.'
                        : "Pay the owner directly at pickup, once you've seen the item. Never send money in advance."}
                    </p>
                  )}
                </header>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
                  {loadingThread && <p className="text-center text-sm text-night-muted">Loading…</p>}
                  {!loadingThread && messages.length === 0 && (
                    <p className="mx-auto max-w-sm rounded-card bg-white/5 px-4 py-3 text-center text-sm text-night-muted">
                      {isOwner ? 'No messages yet - say hello.' : 'No messages yet - say hello, or make an offer below.'}
                    </p>
                  )}
                  {messages.map((m, i) => {
                    const mine = m.sender_id === user?.id;
                    const prev = messages[i - 1];
                    const newDay = !prev || startOfDay(prev.created_at).getTime() !== startOfDay(m.created_at).getTime();
                    const separator = newDay && (
                      <div className="flex justify-center py-2">
                        <span className="rounded-full bg-night-elevated/90 px-3 py-1 text-[11px] font-medium text-night-muted">
                          {formatDaySeparator(m.created_at)}
                        </span>
                      </div>
                    );

                    let body;
                    if (m.kind === 'system') {
                      body = (
                        <div className="flex justify-center">
                          <p className="max-w-[90%] rounded-card bg-white/5 px-3 py-2 text-center text-xs text-night-muted">
                            {m.body}
                            <span className="ml-1.5 text-[10px] opacity-70">{formatClock(m.created_at)}</span>
                          </p>
                        </div>
                      );
                    } else if (m.kind === 'offer' && m.offer) {
                      body = (
                        <OfferCard
                          offer={m.offer}
                          isFirst={firstOfferIds.has(m.offer.id)}
                          mine={m.offer.proposed_by === user?.id}
                          isOwner={isOwner}
                          otherName={otherName}
                          listedPrice={m.offer.rental?.listed_price_per_day ?? active.listing?.price_per_day}
                          listing={active.listing}
                          busy={offerBusy}
                          onAccept={() => handleAccept(m.offer)}
                          onCounter={(terms) => handleCounter(m.offer, terms)}
                          onDecline={() => handleDecline(m.offer)}
                        />
                      );
                    } else if (ATTACHMENT_KINDS.includes(m.kind) && m.attachment) {
                      body = (
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl p-1.5 text-sm shadow-sm sm:max-w-[65%] ${
                              mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-night-elevated/90 text-night-text'
                            }`}
                          >
                            {/* File names and shared places are what people typed/chose - left as is. */}
                            <div translate="no">
                              <AttachmentMessage message={m} mine={mine} />
                            </div>
                            <p className={`mt-1 flex items-center justify-end gap-1 px-1.5 text-[10px] ${mine ? 'text-white/70' : 'text-night-muted'}`}>
                              {formatClock(m.created_at)}
                              {mine && <Ticks read={!!otherReadAt && otherReadAt >= new Date(m.created_at)} />}
                            </p>
                          </div>
                        </div>
                      );
                    } else {
                      body = (
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%] ${
                              mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-night-elevated/90 text-night-text'
                            }`}
                          >
                            {/* Chats are never translated - see the chat list above. */}
                            <p className="whitespace-pre-line break-words" translate="no" dir="auto">
                              {m.body}
                            </p>
                            <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/70' : 'text-night-muted'}`}>
                              {formatClock(m.created_at)}
                              {mine && <Ticks read={!!otherReadAt && otherReadAt >= new Date(m.created_at)} />}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id}>
                        {separator}
                        {body}
                      </div>
                    );
                  })}
                  {uploads.map((u) => (
                    <div key={u.id} className="flex justify-end">
                      <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-br-md bg-accent/60 px-3.5 py-2 text-sm text-white sm:max-w-[65%]">
                        <span className="truncate">
                          {u.kind === 'image' ? '📷' : '📄'} {u.name}
                        </span>
                        {u.status === 'uploading' ? (
                          <span className="shrink-0 text-[11px] text-white/80">Sending…</span>
                        ) : (
                          <>
                            <span className="shrink-0 text-[11px] text-red-200" title={u.error}>
                              Failed{u.error ? `: ${u.error}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => setUploads((all) => all.filter((x) => x.id !== u.id))}
                              className="shrink-0 text-[11px] underline"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {threadError && <p className="px-4 pb-2 text-sm text-red-400">{threadError}</p>}

                {offerFormOpen && canMakeOffer && (
                  <div className="max-h-[60%] overflow-y-auto border-t border-night-border/15 bg-night-elevated/60 p-4">
                    <p className="mb-3 text-sm font-semibold text-night-text">Make an offer</p>
                    <OfferForm
                      listingId={active.listing?.id}
                      listedPrice={active.listing?.price_per_day}
                      depositRequired={active.listing?.deposit_required}
                      depositAmount={active.listing?.deposit_amount}
                      onSubmit={handleNewOffer}
                      onCancel={() => setOfferFormOpen(false)}
                    />
                  </div>
                )}

                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-night-border/15 bg-night-elevated/60 p-2.5 sm:p-3">
                  {canMakeOffer && !offerFormOpen && (
                    <button
                      type="button"
                      onClick={() => setOfferFormOpen(true)}
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-night-border/25 px-3 text-sm font-medium text-night-text hover:bg-white/5"
                    >
                      <IndianRupee className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Make an offer</span>
                      <span className="sm:hidden">Offer</span>
                    </button>
                  )}
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Type a message"
                    aria-label="Message"
                    className="h-10 min-w-0 flex-1 rounded-full border border-night-border/20 bg-black/30 px-4 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <AttachMenu
                    onImages={(files) => sendFiles(files, 'image')}
                    onDocument={(files) => sendFiles(files, 'file')}
                    onLocation={() => setLocationOpen(true)}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>

                {locationOpen && (
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-elevated text-sm text-night-muted">
                        Loading map…
                      </div>
                    }
                  >
                    <LocationPicker onSend={sendLocation} onClose={() => setLocationOpen(false)} />
                  </Suspense>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {error && <p className="px-4 pb-3 text-center text-sm text-red-400">{error}</p>}
    </DarkGradientBg>
  );
}
