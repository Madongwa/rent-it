import { Link } from 'react-router-dom';
import { Reveal, StaggerGroup, StaggerItem, IconRevealItem } from '../components/ScrollReveal';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const RENTER_STEPS = [
  {
    title: 'Search and compare',
    body: "Filter by category, price, distance, and condition until you're looking at equipment that actually fits the job. Photos, condition notes, ratings, and rental history are right there on every listing.",
  },
  {
    title: 'Send a request',
    body: 'Pick your dates and send a rental request straight to the owner. No phone tag, no back-and-forth over text.',
  },
  {
    title: 'Get approved',
    body: 'The owner reviews your request and confirms the dates. Once approved, the rental is locked in.',
  },
  {
    title: 'Pick up and check the condition',
    body: 'Meet the owner (or arrange delivery, where that option exists), and confirm the condition together before you take it.',
  },
  {
    title: 'Return it and get your deposit back',
    body: "Bring it back in the shape you got it in. Once the owner confirms everything checks out, any deposit held is released.",
  },
  {
    title: 'Leave a review',
    body: "Rate how it went. It's how the next renter knows what to expect, and how good owners build a reputation over time.",
  },
];

const OWNER_STEPS = [
  {
    title: 'List your equipment',
    body: 'Add photos, a description, and the details that matter — condition, power source, delivery options. Takes a few minutes.',
  },
  {
    title: 'Set your price and terms',
    body: "You decide the daily rate, minimum rental period, deposit, and cancellation policy. It's your equipment, your terms.",
  },
  {
    title: 'Review requests',
    body: 'When someone wants to rent it, you see their requested dates and decide whether to approve or decline.',
  },
  {
    title: 'Hand it off',
    body: "Meet the renter and walk through the equipment's condition together, so there's a shared record of what state it left in.",
  },
  {
    title: 'Get it back',
    body: 'When the rental period ends, you get your equipment back and confirm its condition before any deposit is released.',
  },
  {
    title: 'Build your reputation',
    body: 'Every completed rental adds to your rating and rental history — making your listings more trusted, and more likely to get booked.',
  },
];

const TRUST_FEATURES = [
  {
    icon: '📸',
    title: 'Condition, documented',
    body: 'Every listing shows its condition, and both sides confirm it again at pickup and return — a shared record of what changed hands.',
  },
  {
    icon: '🔒',
    title: 'Deposits held, not just promised',
    body: "Where a deposit applies, it's held until the rental is confirmed complete — not just a line in the listing description.",
  },
  {
    icon: '⭐',
    title: 'Ratings that mean something',
    body: 'Reviews come from actual completed rentals, so a high rating reflects real history, not just good listing photos.',
  },
  {
    icon: '🗓️',
    title: 'Rental history, visible',
    body: "Every past rental on a listing is right there to see — how often it's used and how it's gone for other renters.",
  },
  {
    icon: '📋',
    title: 'Terms up front',
    body: 'Price, minimum rental period, delivery options, and cancellation policy are all on the listing before you ever send a request.',
  },
];

function StepList({ steps }) {
  return (
    <StaggerGroup className="mt-12 space-y-8" stagger={0.1}>
      {steps.map((step, i) => (
        <StaggerItem key={step.title} className="flex gap-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-night-border/20 bg-white/5 text-sm font-semibold text-night-text">
            {i + 1}
          </span>
          <div>
            <h3 className="font-semibold text-night-text">{step.title}</h3>
            <p className="mt-1 text-body text-night-muted">{step.body}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

function CtaBar({ text, cta, to }) {
  return (
    <Reveal className="border-y border-night-border/15 bg-night-elevated">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-base text-night-text">{text}</p>
        <Link
          to={to}
          className="lm-btn lm-btn-solid shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-homeAccent"
        >
          {cta}
        </Link>
      </div>
    </Reveal>
  );
}

export default function HowItWorks() {
  useSeo({
    title: 'How It Works',
    description: 'From search to return - how renting and listing equipment works on Rent It.',
    path: '/how-it-works',
  });

  return (
    // DarkGradientBg's own noise/gradient/streak layers replace the old
    // flat bg-black + .lm-grain treatment - see components/ui/elegant-dark-pattern.jsx.
    <DarkGradientBg>
      <div>
        {/* Hero */}
        <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
          <span className="lm-badge">
            <svg className="lm-badge-star" width="14" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
            </svg>
            From request to return
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-night-text sm:text-6xl">
            <span className="lm-mask">
              <span className="lm-mask-i" style={{ '--lm-d': '0.05s' }}>
                How Rent It
              </span>
            </span>
            <span className="lm-mask">
              <span className="lm-mask-i" style={{ '--lm-d': '0.16s' }}>
                <span className="lm-em">actually</span> works.
              </span>
            </span>
          </h1>
          <Reveal delay={0.3}>
            <p className="mt-6 max-w-xl text-lg text-night-muted">
              Whether you're renting something for the weekend or listing equipment that's been
              sitting idle, here's exactly what happens — for both sides.
            </p>
          </Reveal>
        </section>

        {/* For Renters */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
                For Renters
              </h2>
              <p className="mt-3 text-body text-night-muted">
                From finding the right equipment to getting your deposit back.
              </p>
            </Reveal>
            <StepList steps={RENTER_STEPS} />
          </div>
        </section>

        {/* For Owners */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
                For Owners
              </h2>
              <p className="mt-3 text-body text-night-muted">
                From listing what's sitting idle to building a reputation that gets it booked again.
              </p>
            </Reveal>
            <StepList steps={OWNER_STEPS} />
          </div>
        </section>

        {/* Trust System */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
                The trust system
              </h2>
              <p className="mt-3 text-body text-night-muted">
                Renting from someone you've never met only works if both sides can trust what
                they're seeing. Here's what's actually built to make that possible.
              </p>
            </Reveal>

            <StaggerGroup className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5" stagger={0.08}>
              {TRUST_FEATURES.map((f) => (
                <IconRevealItem key={f.title} icon={f.icon} className="space-y-2">
                  <h3 className="font-semibold text-night-text">{f.title}</h3>
                  <p className="text-caption text-night-muted">{f.body}</p>
                </IconRevealItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        <CtaBar text="Ready to see what's available near you?" cta="Browse the marketplace" to="/marketplace" />
      </div>
    </DarkGradientBg>
  );
}
