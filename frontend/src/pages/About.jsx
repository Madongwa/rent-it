import { Link } from 'react-router-dom';
import { Reveal, StaggerGroup, IconRevealItem } from '../components/ScrollReveal';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const VALUES = [
  {
    icon: '🤝',
    title: 'Trust, built in',
    body: 'Seller verification, condition photos at pickup and return, and ratings on every completed rental — so both sides know who they’re dealing with.',
  },
  {
    icon: '🌍',
    title: 'Less sitting idle',
    body: 'Equipment that only gets used a few days a year shouldn’t spend the rest of its life in a garage. Renting it out puts it back to work.',
  },
  {
    icon: '💰',
    title: 'Fair to both sides',
    body: 'Owners set their own price, terms, and cancellation policy. Renters get equipment for exactly as long as they need it, at a fraction of the cost of buying.',
  },
  {
    icon: '🧭',
    title: 'Straightforward, end to end',
    body: 'Search, request, pick up, return, review — no phone tag, no guessing what a deal actually includes.',
  },
];

export default function About() {
  useSeo({
    title: 'About Us',
    description: 'Rent It is a peer-to-peer marketplace for renting equipment from people nearby, instead of buying it outright.',
    path: '/about',
  });

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h1 className="text-4xl font-black tracking-tight text-night-text sm:text-5xl">About Rent It</h1>
            <p className="mt-6 text-lg leading-relaxed text-night-muted">
              Rent It is a marketplace for renting equipment from people nearby — farming and
              construction tools, household and event gear, moving and medical equipment — instead
              of buying it outright for something you'll only use a handful of times.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-4 text-lg leading-relaxed text-night-muted">
              We built it around a simple idea: most equipment sits idle far more than it gets
              used. Connecting the people who own it with the people who need it, just for the
              time they need it, is better for both — and for everything that didn't need to be
              manufactured twice.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              What we care about.
            </h2>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
            {VALUES.map((v) => (
              <IconRevealItem
                key={v.title}
                icon={v.icon}
                className="rounded-lg border border-night-border/15 bg-night-card p-6 space-y-2"
              >
                <h3 className="text-lg font-semibold text-night-text">{v.title}</h3>
                <p className="text-sm leading-relaxed text-night-muted">{v.body}</p>
              </IconRevealItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              Want to know more about why this matters?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-night-muted">
              Read about the hidden cost of ownership, or jump straight into browsing what's
              available near you.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/why-it-matters" className="lm-btn lm-btn-outline">
                Why it matters
              </Link>
              <Link to="/marketplace" className="lm-btn lm-btn-solid">
                Browse the marketplace
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </DarkGradientBg>
  );
}
