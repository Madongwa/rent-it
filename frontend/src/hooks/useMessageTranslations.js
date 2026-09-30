import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const BATCH_SIZE = 50; // the backend's per-request limit

// The other person's chat messages in the language this reader picked with
// the language button: { [messageId]: { text, source, translated } }.
// `translated` is false when a message was already in that language. Each
// message is fetched once per language - the backend keeps the result, so
// reopening a chat costs nothing. Messages still waiting (or that failed)
// show as written, and are tried again the next time the chat changes.
export default function useMessageTranslations(messages, userId, lang) {
  const [translations, setTranslations] = useState({});
  const requestedRef = useRef(new Set());
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
    requestedRef.current = new Set();
    setTranslations({});
  }, [lang]);

  useEffect(() => {
    if (!userId) return;
    const ids = messages
      .filter(
        (m) =>
          m?.id &&
          ((m.kind || 'text') === 'text' || (m.kind === 'voice' && m.attachment?.transcribed)) &&
          m.body &&
          m.sender_id !== userId &&
          !requestedRef.current.has(m.id)
      )
      .map((m) => m.id);
    if (ids.length === 0) return;
    ids.forEach((id) => requestedRef.current.add(id));

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      api
        .translateMessages(lang, batch)
        .then(({ translations: result }) => {
          if (langRef.current === lang) setTranslations((prev) => ({ ...prev, ...result }));
        })
        .catch(() => {
          batch.forEach((id) => requestedRef.current.delete(id));
        });
    }
  }, [messages, userId, lang]);

  return translations;
}
