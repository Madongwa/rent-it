import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Fired by the Messages page after it marks a thread read, so the navbar
// badge drops straight away instead of waiting for the next realtime event.
export const MESSAGES_READ_EVENT = 'rentit:messages-read';

// Number of chats with unread messages, for the navbar's Messages badge.
// Refreshes on any new message (RLS means realtime only delivers rows from
// this user's own threads) and whenever a thread is marked read - here, or
// on another device (that updates the conversation row).
export default function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadChats(0);
      return undefined;
    }

    let cancelled = false;
    const refresh = () =>
      api
        .getUnreadMessageCount()
        .then((r) => {
          if (!cancelled) setUnreadChats(r.conversations);
        })
        .catch(() => {});

    refresh();
    const channel = supabase
      .channel('messages-unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, refresh)
      .subscribe();
    window.addEventListener(MESSAGES_READ_EVENT, refresh);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener(MESSAGES_READ_EVENT, refresh);
    };
  }, [user]);

  return unreadChats;
}
