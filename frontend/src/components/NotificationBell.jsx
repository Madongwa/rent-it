import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  function refreshUnreadCount() {
    api.getUnreadNotificationCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }

  useEffect(() => {
    if (!user) return;
    refreshUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Real-time: same caveat as Messages.jsx - requires `notifications` to be
  // added to the supabase_realtime publication (see schema.sql). Without
  // that this connects but never fires, and the badge just relies on the
  // mount-time fetch above plus whatever refreshUnreadCount() calls happen
  // elsewhere (e.g. opening the panel).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => refreshUnreadCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e) {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      api
        .getNotifications()
        .then((data) => {
          setNotifications(data);
          setLoaded(true);
        })
        .catch(() => {});
    }
  }

  async function handleClickNotification(n) {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.markNotificationRead(n.id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      // Best-effort - a failed mark-all just leaves some rows unread server-side, not worth surfacing an error for.
    }
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePanel}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-night-muted transition-colors hover:bg-white/10 hover:text-night-text"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-night-bg/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-night-text">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded && <p className="p-4 text-sm text-night-muted">Loading…</p>}
            {loaded && notifications.length === 0 && (
              <p className="p-4 text-sm text-night-muted">Nothing yet - you'll see rental requests, approvals, and messages here.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClickNotification(n)}
                className={`block w-full border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/5 ${
                  n.read ? '' : 'bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                  <div className={n.read ? 'pl-3.5' : ''}>
                    <p className="text-sm font-medium text-night-text">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-night-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-night-muted/70">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
