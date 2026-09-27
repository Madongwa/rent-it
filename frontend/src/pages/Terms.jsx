import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const LAST_UPDATED = 'September 27, 2026';

// Drafted to match what's actually built (see rentals.js/reviews.js/kyc.js) -
// no invented fees, and no payment terms - the Platform doesn't process payments.
// This is a starting template, not a substitute for review by a lawyer
// qualified in your jurisdiction before a public launch.
function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-subheading text-night-text">{title}</h2>
      <div className="mt-2 space-y-3 text-body text-night-muted">{children}</div>
    </section>
  );
}

export default function Terms() {
  useSeo({
    title: 'Terms of Service',
    description: 'Rent It Terms of Service - the rules for using the Rent It marketplace.',
    path: '/terms',
  });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Terms of Service</h1>
      <p className="mt-2 text-sm text-night-muted">Last updated: {LAST_UPDATED}</p>
      <p className="mt-4 text-body text-night-muted">
        These Terms govern your use of Rent It (the "Platform"). By creating an account or using
        the Platform, you agree to them. Please read them carefully.
      </p>

      <Section title="1. What Rent It is">
        <p>
          Rent It is a marketplace that connects people who own equipment ("Owners") with people
          who want to rent it ("Renters"). We are not a party to any rental agreement formed
          between an Owner and a Renter, and we do not own, inspect, or guarantee the condition of
          any listed item unless explicitly stated.
        </p>
      </Section>

      <Section title="2. Accounts and eligibility">
        <p>
          You must be at least 18 years old and able to form a binding contract to use Rent It.
          You're responsible for keeping your login credentials secure and for all activity under
          your account. Listing an item requires completing our seller verification process first.
        </p>
      </Section>

      <Section title="3. Listings">
        <p>
          Owners are solely responsible for the accuracy of their listings — description,
          condition, pricing, availability, and any terms (deposit, cancellation policy, delivery
          options) attached to them. Rent It may remove a listing that violates these Terms or
          applicable law without prior notice.
        </p>
      </Section>

      <Section title="4. Rental requests, offers, and cancellation">
        <p>
          A Renter's request states the rental dates and the daily price the Renter offers, which
          may differ from the listed price. The Owner may accept, decline, or counter it with a
          different price or dates, and the Renter may do the same in response. A rental is only
          confirmed once one party accepts the other's current offer; the accepted dates and price
          are recorded on the rental and form the agreement between Owner and Renter.
        </p>
        <p>
          Either party may withdraw from a pending request; a confirmed rental follows the
          cancellation policy shown on that listing at the time of booking. Rent It does not
          guarantee that a request will be accepted.
        </p>
      </Section>

      <Section title="5. Payments and fees">
        <p>
          Rent It does not process payments and does not charge a fee to browse, list, make an
          offer, or rent. The Renter pays the Owner directly, on the price and terms agreed on the
          Platform, by whatever method the two of them choose. Rent It is not a party to that
          payment and cannot collect, hold, refund, or guarantee it. If fees are ever introduced,
          they will be disclosed clearly before you confirm a rental, and these Terms will be
          updated first.
        </p>
      </Section>

      <Section title="6. Deposits, condition, and disputes">
        <p>
          Deposits, where required, are set by the Owner, paid by the Renter directly to the Owner,
          and are intended to cover loss or damage to the item during the rental period. The Owner
          is responsible for returning the deposit once the item comes back as agreed. Both parties are encouraged to document the item's
          condition (Rent It supports uploading pickup and return photos on a rental) before and
          after handoff.
        </p>
        <p>
          If either party believes the item was damaged, lost, or not returned as agreed, they may
          raise a dispute instead of confirming a clean return. Rent It staff will review the
          available evidence and reach a resolution; you agree to cooperate with that process and
          accept its outcome as final for the purposes of the Platform.
        </p>
      </Section>

      <Section title="7. Prohibited items and conduct">
        <p>
          You may not list or request items that are illegal to own, rent, or transport, or that
          are unsafe without proper certification (e.g. certain medical or power equipment) unless
          you hold the necessary licenses. You may not use Rent It to harass another user, attempt
          to defraud anyone, or circumvent our verification, messaging, or dispute processes.
        </p>
      </Section>

      <Section title="8. Messaging">
        <p>
          In-platform messaging is provided to help Owners and Renters coordinate a rental. Don't
          use it to send spam, unsolicited advertising, or unlawful content. Messages may be
          reviewed by Rent It staff if reported or where necessary to investigate a dispute.
        </p>
      </Section>

      <Section title="9. Disclaimers and limitation of liability">
        <p>
          The Platform is provided "as is." Rent It makes no warranty about the quality, safety,
          or legality of any listed item, or the reliability of any user. To the fullest extent
          permitted by law, Rent It is not liable for any damage, injury, or loss arising from a
          rental transaction between users, and our aggregate liability for any claim relating to
          the Platform is limited to the fees you paid us (if any) in the twelve months preceding
          the claim.
        </p>
      </Section>

      <Section title="10. Suspension and termination">
        <p>
          We may suspend or terminate your account if you violate these Terms, provide false
          information during verification, or if we reasonably believe your continued use poses a
          risk to other users or the Platform.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These Terms are governed by the laws of India. Any dispute arising from these Terms or
          your use of the Platform will be subject to the exclusive jurisdiction of the courts
          located in India.
        </p>
      </Section>

      <Section title="12. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we'll update
          the "Last updated" date above. Continuing to use Rent It after a change takes effect
          means you accept the updated Terms.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Questions about these Terms? Reach out through the Help / FAQ page or the support
          assistant there.
        </p>
      </Section>
    </div>
    </DarkGradientBg>
  );
}
