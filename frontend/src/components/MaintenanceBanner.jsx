import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Shown while staff have maintenance mode on (Staff -> Settings): the site
// is read-only for everyone but staff (backend/src/lib/maintenance.js).
// Checked on load and every few minutes.
const CHECK_EVERY_MS = 5 * 60 * 1000;

export default function MaintenanceBanner() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      api
        .getStatus()
        .then((s) => !cancelled && setOn(!!s?.maintenance_mode))
        .catch(() => {});
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!on) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-400/30 bg-amber-950/95 px-4 py-2.5 text-center text-sm text-amber-100"
    >
      🛠️ Rent It is down for maintenance - you can browse, but sending requests, messages and other changes are paused for now.
    </div>
  );
}
