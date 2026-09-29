import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

// "Suggest replies" above the chat's message box: up to three short AI
// drafts in the user's language. Tapping one only puts it in the message
// box - nothing is sent until they press Send.
export default function SuggestReplies({ conversationId, lang, onPick }) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    setReplies([]);
    setNote('');
  }, [conversationId, lang]);

  async function suggest() {
    setLoading(true);
    setNote('');
    try {
      const { replies: found } = await api.suggestReplies(conversationId, lang);
      setReplies(found);
      if (!found.length) setNote('Nothing to suggest yet - wait for their message.');
    } catch (err) {
      setNote(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-night-border/15 bg-night-elevated/40 px-2.5 py-2 sm:px-3">
      {replies.length === 0 ? (
        <>
          <button
            type="button"
            onClick={suggest}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-night-border/20 px-3 py-1 text-xs font-medium text-night-text hover:bg-white/5 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            {loading ? 'Thinking…' : 'Suggest replies'}
          </button>
          {note && <span className="text-xs text-night-muted">{note}</span>}
        </>
      ) : (
        <>
          {replies.map((reply) => (
            <button
              key={reply}
              type="button"
              translate="no"
              dir="auto"
              onClick={() => {
                onPick(reply);
                setReplies([]);
              }}
              className="max-w-full rounded-full bg-white/10 px-3 py-1 text-left text-xs text-night-text hover:bg-white/15"
            >
              {reply}
            </button>
          ))}
          <button type="button" onClick={() => setReplies([])} className="text-xs text-night-muted hover:text-night-text" aria-label="Hide suggestions">
            ✕
          </button>
        </>
      )}
    </div>
  );
}
