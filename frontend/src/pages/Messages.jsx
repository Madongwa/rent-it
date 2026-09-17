import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

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

  useEffect(() => {
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
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
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

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      const sent = await api.sendMessage(activeId, draft.trim());
      setMessages((m) => [...m, sent]);
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
      <p className="mt-1 text-body text-night-muted">Conversations with owners and renters about a specific listing.</p>

      <div className="mt-8 grid gap-4 overflow-hidden rounded-card border border-night-border/15 bg-night-card md:grid-cols-[280px_1fr]">
        <div className="max-h-[65vh] overflow-y-auto border-b border-night-border/15 md:max-h-[70vh] md:border-b-0 md:border-r">
          {loadingList && <p className="p-4 text-sm text-night-muted">Loading…</p>}
          {!loadingList && conversations.length === 0 && (
            <p className="p-4 text-sm text-night-muted">
              No conversations yet. Message an owner from a listing page to start one.
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

        <div className="flex min-h-[50vh] flex-col md:min-h-[70vh]">
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-night-muted">
              Select a conversation to view it.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-night-border/15 px-4 py-3">
                <div>
                  <Link to={`/listing/${active.listing?.id}`} className="text-sm font-semibold text-night-text hover:underline">
                    {active.listing?.title}
                  </Link>
                  <p className="text-xs text-night-muted">
                    with {(active.owner_id === user?.id ? active.renter : active.owner)?.full_name || 'Rent It user'}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread && <p className="text-sm text-night-muted">Loading…</p>}
                {!loadingThread && messages.length === 0 && (
                  <p className="text-sm text-night-muted">No messages yet - say hello.</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
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

              <form onSubmit={handleSend} className="flex gap-2 border-t border-night-border/15 p-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
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
