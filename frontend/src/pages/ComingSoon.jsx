// Generic placeholder for nav destinations that don't have a real page yet
// (How It Works, Why It Matters, Help / FAQ, About Us). Swap each one out
// for a real page as it gets built.
export default function ComingSoon({ title }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-heading-sm text-text-primary">{title}</h1>
      <p className="mt-3 text-body text-text-muted">
        This page is coming soon — we're still building it out.
      </p>
    </div>
  );
}
