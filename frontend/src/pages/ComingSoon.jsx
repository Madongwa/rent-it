import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Generic placeholder for nav destinations that don't have a real page yet
// (currently just About Us). Swap it out for a real page once it's built.
export default function ComingSoon({ title, path }) {
  useSeo({ title, path });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-heading-sm text-night-text">{title}</h1>
      <p className="mt-3 text-body text-night-muted">
        This page is coming soon — we're still building it out.
      </p>
    </div>
    </DarkGradientBg>
  );
}
