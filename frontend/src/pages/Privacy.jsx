import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const LAST_UPDATED = 'September 17, 2026';

// Mirrors what's actually collected/stored today (see schema.sql,
// SellerVerification.jsx, ListingForm.jsx) rather than a generic boilerplate
// policy. Still a starting template - have it reviewed against India's
// Digital Personal Data Protection Act, 2023 (and any other applicable law)
// before a public launch.
function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-subheading text-night-text">{title}</h2>
      <div className="mt-2 space-y-3 text-body text-night-muted">{children}</div>
    </section>
  );
}

export default function Privacy() {
  useSeo({
    title: 'Privacy Policy',
    description: 'Rent It Privacy Policy - what information we collect, why, and how it is handled.',
    path: '/privacy',
  });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Privacy Policy</h1>
      <p className="mt-2 text-sm text-night-muted">Last updated: {LAST_UPDATED}</p>
      <p className="mt-4 text-body text-night-muted">
        This policy explains what information Rent It collects, why, and how it's handled.
      </p>

      <Section title="1. Information we collect">
        <p>
          <strong className="text-night-text">Account information:</strong> name, email, and
          phone number you provide at signup or in your profile.
        </p>
        <p>
          <strong className="text-night-text">Listing information:</strong> anything you add to
          a listing, including photos, description, price, and location.
        </p>
        <p>
          <strong className="text-night-text">Verification information:</strong> if you become a
          seller, a photo of a government ID (Aadhaar or PAN) and, optionally, a proof of address,
          plus the name/phone/address you submit with them.
        </p>
        <p>
          <strong className="text-night-text">Messages:</strong> the content of conversations you
          have with other users through the Platform.
        </p>
        <p>
          <strong className="text-night-text">Usage information:</strong> basic technical data
          (like session activity) needed to keep you signed in and the Platform working.
        </p>
      </Section>

      <Section title="2. How we use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>To operate your account, listings, rental requests, and messages.</li>
          <li>To verify seller identity before allowing someone to list equipment.</li>
          <li>To investigate a reported dispute between a Renter and an Owner.</li>
          <li>To communicate with you about your account or a transaction.</li>
          <li>To keep the Platform secure and prevent fraud or abuse.</li>
        </ul>
      </Section>

      <Section title="3. Identity documents get special handling">
        <p>
          ID and address-proof photos are stored in a private, access-restricted location — never
          in the same place as your public listing photos, and never shown to other users. Only
          Rent It staff reviewing your verification (or an automated verification provider, where
          that integration is active) can access them. We do not store your Aadhaar or PAN number
          as text, only the document photo itself.
        </p>
      </Section>

      <Section title="4. What other users can see">
        <p>
          Your name and any listings you publish are visible to other users. If you message
          someone or send a rental request, they can see your name in that context. Your identity
          documents, phone number, and address are never shown to other users — only to Rent It
          staff for verification and dispute purposes.
        </p>
      </Section>

      <Section title="5. Sharing with third parties">
        <p>
          We don't sell your personal information. We share it only with service providers that
          help us run the Platform (for example, our database/hosting provider, and — where
          configured — an identity-verification or payment provider), and only to the extent
          needed for them to perform that service. We may also disclose information if required by
          law.
        </p>
      </Section>

      <Section title="6. Data storage and security">
        <p>
          Your data is stored with industry-standard access controls (role-based database
          permissions and private file storage for sensitive documents). No system is perfectly
          secure, but we restrict access to what each part of the Platform actually needs.
        </p>
      </Section>

      <Section title="7. Cookies and local storage">
        <p>
          We use your browser's local storage for things like keeping you signed in and
          remembering which messages you've already read — not for third-party advertising or
          tracking. Clearing your browser storage will reset these.
        </p>
      </Section>

      <Section title="8. Data retention">
        <p>
          We keep your information for as long as your account is active, or as needed to resolve
          a dispute, comply with a legal obligation, or enforce our Terms. You can request deletion
          of your account as described below.
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>
          You can access and update most of your information directly from your profile. You may
          request a copy of your data, or ask us to delete your account and associated data
          (subject to what we need to retain for legal or dispute-resolution reasons), by reaching
          out through the Help / FAQ page.
        </p>
      </Section>

      <Section title="10. Children">
        <p>Rent It is not intended for use by anyone under 18, and we don't knowingly collect information from children.</p>
      </Section>

      <Section title="11. Changes to this policy">
        <p>
          If we make material changes to this policy, we'll update the "Last updated" date above.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>Questions about this policy? Reach out through the Help / FAQ page or the support assistant there.</p>
      </Section>
    </div>
    </DarkGradientBg>
  );
}
