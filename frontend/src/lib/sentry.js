import * as Sentry from '@sentry/react';

// Optional, mirrors the backend's SENTRY_DSN pattern (see
// backend/src/lib/sentry.js): leave VITE_SENTRY_DSN unset and this no-ops,
// errors just stay in the browser console like before.
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0 });
} else {
  console.warn('[sentry] VITE_SENTRY_DSN is missing - error tracking is disabled.');
}
