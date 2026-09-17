import { Link } from 'react-router-dom';
import CategoryShowcase from '../components/CategoryShowcase';
import HomeHero from '../components/HomeHero';
import Starfield from '../components/Starfield';
import useSeo from '../hooks/useSeo';

// ---------------------------------------------------------------------------
// NOTE ON FIGURES BELOW: every number in this file (355 days, 6 weeks/year,
// 80% idle, 13 minutes lifetime use) is an illustrative placeholder chosen
// to make the "equipment sits idle" narrative concrete - none of them are
// sourced or verified statistics. They must be replaced with properly
// cited figures (or softened to non-numeric language) before this copy
// goes live.
// ---------------------------------------------------------------------------
const IDLE_EXAMPLES = [
  {
    icon: '🌾',
    category: 'Farming',
    stat: '6',
    unit: 'weeks a year',
    detail: "A tractor bought for the whole season only actually runs the fields for a few weeks of it.",
  },
  {
    icon: '🏗️',
    category: 'Construction',
    stat: '80%',
    unit: 'of its life in storage',
    detail: 'A generator bought for one job sits in a truck or a shed between every job after that.',
  },
  {
    icon: '🛠️',
    category: 'Household & DIY',
    stat: '13',
    unit: 'minutes, total',
    detail: 'A drill bought "just in case" is often cited as getting only minutes of use across its entire lifetime.',
  },
];

const COST_POINTS = [
  {
    title: 'Money',
    text: "A depreciating asset costs the same whether it runs every day or sits in a corner — the money's already spent either way.",
  },
  {
    title: 'Space',
    text: "Garages, sheds, and job-site storage all cost something, and most of what's sitting in them is waiting, not working.",
  },
  {
    title: 'Manufacturing footprint',
    text: "Every unit still carries the raw-material extraction, energy, and emissions spent to build it — regardless of how little it gets used before it's replaced or thrown out.",
  },
];

function CtaBar({ text, cta, to }) {
  return (
    <div className="border-y border-night-border/15 bg-night-elevated">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-base text-night-text">{text}</p>
        <Link
          to={to}
          className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-homeAccent"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  useSeo({ title: null, path: '/' });

  return (
    <div className="relative bg-night-bg">
      {/* Fixed so it stays a consistent viewport-sized backdrop as this long
          page scrolls, instead of stretching (and thinning out) across the
          whole page's height. Sits behind everything (z-0); the Lamp hero
          and the CtaBar strips paint their own opaque backgrounds over it
          by design - those already have their own effect/contrast going on. */}
      <div className="fixed inset-0 z-0">
        <Starfield />
      </div>

      <div className="relative z-10">
      {/* SECTION 1 - Hero */}
      <HomeHero />

      {/* SECTION 2 - Introducing Rent It (moved up to sit right after the
          hero, filling the gap that used to be here before the narrative
          sections) */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-night-text sm:text-5xl">
            Introducing Rent It
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-night-muted">
            Rent It connects people who own equipment with people who need it — for a day, a
            weekend, or exactly as long as the job takes.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <CategoryShowcase />
        </div>
      </section>

      {/* SECTION 3 - The Pattern */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-tight text-night-text sm:text-5xl">
            It shows up everywhere, once you look for it.
          </h2>

          <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
            {IDLE_EXAMPLES.map((item) => (
              <div key={item.category}>
                <p className="text-sm font-medium text-night-muted">
                  {item.icon} {item.category}
                </p>
                <p className="mt-4 text-6xl font-black leading-none tracking-tight text-night-text sm:text-7xl">
                  {item.stat}
                </p>
                <p className="mt-2 text-sm text-night-muted">{item.unit}</p>
                <p className="mt-4 text-base leading-relaxed text-night-text/80">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBar text="See what's sitting idle near you." cta="Browse the marketplace" to="/marketplace" />

      {/* SECTION 4 - The Cost of Wasted Equipment */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-tight text-night-text sm:text-5xl">
            Idle equipment keeps costing you, even at rest.
          </h2>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {COST_POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-lg border border-night-border/15 bg-night-card p-6"
              >
                <h3 className="text-lg font-semibold text-night-text">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-night-muted">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBar text="Turn your idle equipment into income." cta="List your equipment" to="/list-item" />

      {/* SECTION 5 - The Shift */}
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <h2 className="max-w-3xl text-4xl font-extrabold leading-[0.95] tracking-tight text-night-text sm:text-6xl">
          Access, not ownership.
        </h2>
        <p className="mt-6 max-w-xl text-lg text-night-muted">
          The fix isn't buying more carefully — it's not needing to buy at all. Shared access means
          the same drill, tractor, or generator gets used by more people, more often, instead of
          sitting idle in one garage between jobs.
        </p>
      </section>
      <CtaBar text="See how it works." cta="How it works" to="/how-it-works" />
      </div>
    </div>
  );
}
