import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import LegalDocument from '../components/LegalDocument';
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from '../content/legal';
import { PRIVACY_SECTIONS } from '../content/privacy';

// The text lives in content/privacy.js - keep it in step with what the
// Platform actually collects (backend/schema.sql).
export default function Privacy() {
  useSeo({
    title: 'Privacy Policy',
    description: 'Rent It Privacy Policy - what information we collect, why, and how it is handled.',
    path: '/privacy',
  });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-16 sm:px-6">
        <h1 className="text-heading-sm text-night-text">Privacy Policy</h1>
        <p className="mt-2 text-sm text-night-muted">
          Last updated: {LEGAL_LAST_UPDATED} · Version {TERMS_VERSION}
        </p>
        <p className="mt-4 text-body text-night-muted">
          What personal data Rent It collects, why, who can see it, how long we keep it, and your rights.
        </p>
        <LegalDocument sections={PRIVACY_SECTIONS} />
      </div>
    </DarkGradientBg>
  );
}
