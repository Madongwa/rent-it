import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IndianRupee } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import OfferForm from '../components/OfferForm';
import { formatDay, formatInr, priceDifference, rentalDays } from '../lib/offers';

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Per-conversation "read up to" timestamps, kept in localStorage since
// there's no read-receipts table - good enough for a personal unread dot,
// not meant to sync across devices.
const LAST_READ_KEY = 'rentit_messages_last_read';

function loadLastRead() {
  try {
    return JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLastRead(map) {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(map));
  } catch {
    // Private browsing / storage disabled - unread dots just won't persist across reloads.
  }
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
      <div className="w-full max-w-sm rounded-card border border-night-border/20 bg-white/[0.06] p-4">
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

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('c');
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [lastRead, setLastRead] = useState(loadLastRead);
  const bottomRef = useRef(null);

  function loadConversations() {
    setLoadingList(true);
    api
      .getConversations()
      .then((data) => {
        setConversations(data);
        // First time this feature runs there's no read history at all -
        // seed everything as "read" instead of flashing every existing
        // conversation as unread the moment it ships.
        setLastRead((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const seeded = {};
          data.forEach((c) => {
            seeded[c.id] = c.last_message?.created_at || new Date().toISOString();
          });
          saveLastRead(seeded);
          return seeded;
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingList(false));
  }

  useEffect(loadConversations, []);

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
    setThreadError('');
    if (!activeId) return;
    setLoadingThread(true);
    api
      .getMessages(activeId)
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingThread(false));
  }, [activeId]);

  // Opening a thread (or receiving a message while it's open) counts as
  // reading it.
  useEffect(() => {
    if (!activeId) return;
    setLastRead((prev) => {
      const next = { ...prev, [activeId]: new Date().toISOString() };
      saveLastRead(next);
      return next;
    });
  }, [activeId, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Real-time: RLS on the `messages` table means Supabase only ever
  // delivers rows this user could already SELECT, so no manual filtering
  // by participant is needed here - just route each insert to the open
  // thread if it belongs there, and refresh the sidebar's previews/order.
  // Requires the `messages`/`conversations` tables to be added to the
  // `supabase_realtime` publication (see schema.sql) - without that this
  // subscription connects but never receives anything, and the page
  // silently falls back to updating only on send/reload.
  useEffect(() => {
    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incoming = payload.new;
        if (incoming.conversation_id === activeIdRef.current) {
          if (incoming.kind && incoming.kind !== 'text') {
            // A new offer or status line also changes earlier cards (the
            // offer it replaced is now "Countered"), so reload the thread.
            refreshThread();
          } else {
            setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          }
        }
        loadConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = conversations.find((c) => c.id === activeId);
  const isOwner = active?.owner_id === user?.id;
  const otherName = (isOwner ? active?.renter : active?.owner)?.full_name || 'Rent It user';

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
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Messages</h1>
      <p className="mt-1 text-body text-night-muted">
        Chat with owners and renters, send offers, and agree on a price.
      </p>

      <div className="mt-8 grid gap-4 overflow-hidden rounded-card border border-night-border/15 bg-night-card md:grid-cols-[280px_1fr]">
        <div className="max-h-[65vh] overflow-y-auto border-b border-night-border/15 md:max-h-[75vh] md:border-b-0 md:border-r">
          {loadingList && <p className="p-4 text-sm text-night-muted">Loading…</p>}
          {!loadingList && conversations.length === 0 && (
            <p className="p-4 text-sm text-night-muted">
              No conversations yet. Message an owner or send a request from a listing page to start one.
            </p>
          )}
          {conversations.map((c) => {
            const otherPerson = c.owner_id === user?.id ? c.renter : c.owner;
            const isUnread =
              activeId !== c.id &&
              c.last_message &&
              c.last_message.sender_id !== user?.id &&
              new Date(c.last_message.created_at) > new Date(lastRead[c.id] || 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSearchParams({ c: c.id })}
                className={`block w-full border-b border-night-border/15 px-4 py-3 text-left last:border-b-0 hover:bg-white/5 ${
                  activeId === c.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  <p className={`truncate text-sm ${isUnread ? 'font-bold text-night-text' : 'font-semibold text-night-text'}`}>
                    {c.listing?.title}
                  </p>
                </div>
                <p className="text-xs text-night-muted">with {otherPerson?.full_name || 'Rent It user'}</p>
                {c.last_message && (
                  <p className="mt-1 truncate text-xs text-night-muted">{c.last_message.body}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[50vh] flex-col md:max-h-[75vh] md:min-h-[75vh]">
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-night-muted">
              Select a conversation to view it.
            </div>
          ) : (
            <>
              <div className="border-b border-night-border/15 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/listing/${active.listing?.id}`} className="text-sm font-semibold text-night-text hover:underline">
                      {active.listing?.title}
                    </Link>
                    <p className="text-xs text-night-muted">
                      with {otherName}
                      {active.listing?.price_per_day != null && <> · listed {formatInr(active.listing.price_per_day)}/day</>}
                    </p>
                  </div>
                  {negotiating && (
                    <span className="shrink-0 rounded-badge bg-amber-500/15 px-2.5 py-1 text-caption font-medium text-amber-400">
                      Negotiating · {formatInr(latestOffer.price_per_day)}/day
                    </span>
                  )}
                  {dealStatus === 'approved' && (
                    <span className="shrink-0 rounded-badge bg-emerald-500/15 px-2.5 py-1 text-caption font-medium text-emerald-400">
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
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread && <p className="text-sm text-night-muted">Loading…</p>}
                {!loadingThread && messages.length === 0 && (
                  <p className="text-sm text-night-muted">
                    {isOwner ? 'No messages yet - say hello.' : 'No messages yet - say hello, or make an offer below.'}
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  if (m.kind === 'system') {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <p className="max-w-[90%] rounded-card bg-white/5 px-3 py-2 text-center text-xs text-night-muted">
                          {m.body}
                          <span className="ml-1.5 text-[10px] opacity-70">{formatTime(m.created_at)}</span>
                        </p>
                      </div>
                    );
                  }
                  if (m.kind === 'offer' && m.offer) {
                    return (
                      <OfferCard
                        key={m.id}
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
                  }
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-card px-3.5 py-2 text-sm ${
                          mine ? 'bg-accent text-white' : 'bg-white/10 text-night-text'
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-night-muted'}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {threadError && <p className="px-4 pb-2 text-sm text-red-400">{threadError}</p>}

              {offerFormOpen && canMakeOffer && (
                <div className="border-t border-night-border/15 p-4">
                  <p className="mb-3 text-sm font-semibold text-night-text">Make an offer</p>
                  <OfferForm
                    listedPrice={active.listing?.price_per_day}
                    depositRequired={active.listing?.deposit_required}
                    depositAmount={active.listing?.deposit_amount}
                    onSubmit={handleNewOffer}
                    onCancel={() => setOfferFormOpen(false)}
                  />
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-2 border-t border-night-border/15 p-3">
                {canMakeOffer && !offerFormOpen && (
                  <button
                    type="button"
                    onClick={() => setOfferFormOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-night-border/25 px-3 text-sm font-medium text-night-text hover:bg-white/5"
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
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="shrink-0 rounded-btn bg-white px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
    </DarkGradientBg>
  );
}
