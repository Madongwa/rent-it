import * as Sentry from '@sentry/node';

// Optional, same pattern as every other third-party integration in this repo
// (Resend, Razorpay, Digio): leave SENTRY_DSN unset and this just no-ops -
// nothing else in the app needs to know whether it's configured.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
} else {
  console.warn('[sentry] SENTRY_DSN is missing - error tracking is disabled.');
}

export { Sentry };
