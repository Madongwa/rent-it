import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';
import LegalDocument from '../components/LegalDocument';
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from '../content/legal';
import { TERMS_SECTIONS } from '../content/terms';

// The text lives in content/terms.js - see the notes there before editing,
// and bump TERMS_VERSION in content/legal.js for material changes.
export default function Terms() {
  useSeo({
    title: 'Terms of Service',
    description: 'Rent It Terms of Service - the rules for using the Rent It equipment rental marketplace.',
    path: '/terms',
  });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-16 sm:px-6">
        <h1 className="text-heading-sm text-night-text">Terms of Service</h1>
        <p className="mt-2 text-sm text-night-muted">
          Last updated: {LEGAL_LAST_UPDATED} · Version {TERMS_VERSION}
        </p>
        <p className="mt-4 text-body text-night-muted">
          These Terms explain the rules for using Rent It, what we are and aren't responsible for, and what you're
          responsible for when you rent or rent out equipment. Please read them in full.
        </p>
        <LegalDocument sections={TERMS_SECTIONS} />
      </div>
    </DarkGradientBg>
  );
}
