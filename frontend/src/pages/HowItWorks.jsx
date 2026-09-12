import Starfield from '../components/Starfield';

// "How It Works" used to share the generic ComingSoon placeholder with Why
// It Matters / Help / About Us - split out into its own page so the
// starfield background stays scoped to just this one, per spec.
export default function HowItWorks() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-night-bg">
      <div className="absolute inset-0 z-0">
        <Starfield />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-heading-sm text-night-text">How It Works</h1>
        <p className="mt-3 text-body text-night-muted">
          This page is coming soon — we're still building it out.
        </p>
      </div>
    </div>
  );
}
