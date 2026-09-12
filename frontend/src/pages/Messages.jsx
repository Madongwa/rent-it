import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('c');

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  function loadConversations() {
    setLoadingList(true);
    api
      .getConversations()
      .then(setConversations)
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">Messages</h1>
      <p className="mt-1 text-body text-text-muted">Conversations with owners and renters about a specific listing.</p>

      <div className="mt-8 grid gap-4 overflow-hidden rounded-card border border-line bg-surface md:grid-cols-[280px_1fr]">
        <div className="max-h-[65vh] overflow-y-auto border-b border-line md:max-h-[70vh] md:border-b-0 md:border-r">
          {loadingList && <p className="p-4 text-sm text-text-muted">Loading…</p>}
          {!loadingList && conversations.length === 0 && (
            <p className="p-4 text-sm text-text-muted">
              No conversations yet. Message an owner from a listing page to start one.
            </p>
          )}
          {conversations.map((c) => {
            const otherPerson = c.owner_id === user?.id ? c.renter : c.owner;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSearchParams({ c: c.id })}
                className={`block w-full border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-canvas ${
                  activeId === c.id ? 'bg-canvas' : ''
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">{c.listing?.title}</p>
                <p className="text-xs text-text-muted">with {otherPerson?.full_name || 'Rent It user'}</p>
                {c.last_message && (
                  <p className="mt-1 truncate text-xs text-text-muted">{c.last_message.body}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[50vh] flex-col md:min-h-[70vh]">
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-text-muted">
              Select a conversation to view it.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <Link to={`/listing/${active.listing?.id}`} className="text-sm font-semibold text-text-primary hover:underline">
                    {active.listing?.title}
                  </Link>
                  <p className="text-xs text-text-muted">
                    with {(active.owner_id === user?.id ? active.renter : active.owner)?.full_name || 'Rent It user'}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread && <p className="text-sm text-text-muted">Loading…</p>}
                {!loadingThread && messages.length === 0 && (
                  <p className="text-sm text-text-muted">No messages yet - say hello.</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-card px-3.5 py-2 text-sm ${
                          mine ? 'bg-text-primary text-white' : 'bg-canvas text-text-primary'
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-text-muted'}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-btn border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="shrink-0 rounded-btn bg-text-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
