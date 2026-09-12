import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { LampContainer } from '../components/Lamp';
import { Reveal, StaggerGroup, IconRevealItem } from '../components/ScrollReveal';

const VIGNETTES = [
  "A farmer buys a tiller for planting season. It runs hard for a few weeks, then goes back into the shed for the rest of the year — paid for in full, used for a fraction of it.",
  "A contractor picks up a mini excavator for one job that needed it. The job wraps in a week. The excavator doesn't go anywhere after that — it just sits on the lot, taking up space between the jobs that actually need it.",
  "A homeowner buys a pressure washer for one weekend of cleaning the driveway. It gets used once or twice a year, if that, and spends the rest of its life leaning against the garage wall.",
  "A family buys a hospital bed or a wheelchair for a few months of home care. When it's no longer needed, it doesn't just disappear — it sits there, taking up a room, doing nothing for anyone.",
];

const COST_DIMENSIONS = [
  {
    icon: '💸',
    title: 'Financial',
    body: "The money's already spent. A depreciating asset costs the same whether it's running every day or sitting in a corner — the sunk cost doesn't care how much use you got out of it.",
  },
  {
    icon: '📦',
    title: 'Space',
    body: 'Somewhere has to hold it. Garages, sheds, closets, job-site storage — all of it costs something, and most of what sits in that space is waiting, not working.',
  },
  {
    icon: '🌍',
    title: 'Environmental',
    body: "It still had to be built. Every unit carries the raw materials, energy, and emissions spent making it, regardless of how little use it gets before it's replaced or thrown out.",
  },
  {
    icon: '🤝',
    title: 'Access',
    body: 'Someone nearby needed it today. While one owner\'s tool sits idle, someone a few streets over is buying — or going without — the exact same thing, for the one weekend they actually need it.',
  },
];

function CtaBar({ text, cta, to }) {
  return (
    <Reveal className="border-y border-night-border/15 bg-night-elevated">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-base text-night-text">{text}</p>
        <Link
          to={to}
          className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-homeAccent"
        >
          {cta}
        </Link>
      </div>
    </Reveal>
  );
}

function Hero() {
  const heroRef = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  // Subtle "zoom out and fade" on the hero as it scrolls past, for
  // continuity with the Home page's Lamp treatment - kept gentle (0.95x,
  // not 0.5x) so it reads as depth, not a jump cut. Skipped entirely under
  // prefers-reduced-motion.
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.94]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.75]);

  return (
    <motion.div ref={heroRef} style={{ scale, opacity }}>
      <LampContainer>
        <motion.h1
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: 'easeInOut' }}
          className="mt-20 max-w-4xl text-center text-4xl font-black leading-[0.95] tracking-tight text-night-text sm:text-6xl"
        >
          We buy things to use them.
          <br />
          Most of the time, we don't.
        </motion.h1>
        <p className="mt-8 max-w-xl text-center text-lg text-night-muted sm:text-xl">
          That gap — between owning something and actually using it — is bigger, and costs more,
          than most people realize.
        </p>
      </LampContainer>
    </motion.div>
  );
}

export default function WhyItMatters() {
  return (
    <div className="bg-night-bg">
      <Hero />

      {/* It shows up everywhere */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              It shows up everywhere.
            </h2>
            <p className="mt-3 text-body text-night-muted">
              Once you start looking for this pattern, you notice it in nearly every garage, shed,
              and storage closet.
            </p>
          </Reveal>

          <div className="mt-10 space-y-6">
            {VIGNETTES.map((text, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p className="text-lg leading-relaxed text-night-text/85">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The cost nobody adds up */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              The cost nobody adds up.
            </h2>
            <p className="mt-3 text-body text-night-muted">
              Idle equipment doesn't cost just one thing. It costs a few things at once, and they
              add up quietly because no one bill ever spells it out.
            </p>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
            {COST_DIMENSIONS.map((d) => (
              <IconRevealItem
                key={d.title}
                icon={d.icon}
                className="rounded-lg border border-night-border/15 bg-night-card p-6 space-y-2"
              >
                <h3 className="text-lg font-semibold text-night-text">{d.title}</h3>
                <p className="text-sm leading-relaxed text-night-muted">{d.body}</p>
              </IconRevealItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* The shift */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              The shift.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-night-muted">
              None of this means people are doing anything wrong. Buying makes sense when you'll
              use something constantly. The problem is how much of what we own doesn't fit that
              description — bought for one job, one season, one project, then left behind.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-4 text-lg leading-relaxed text-night-muted">
              The fix isn't buying more carefully. It's not needing to buy at all for the things we
              only need once in a while. Shared access means the same drill, tractor, or wheelchair
              gets used by more people, more often, instead of sitting idle in one garage between
              jobs.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Where Rent It fits in */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-night-text sm:text-4xl">
              Where Rent It fits in.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed text-night-muted">
              Rent It is a place to rent equipment from people nearby instead of buying it
              outright — and a place to put your own idle equipment to work instead of letting it
              sit.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-4 text-lg leading-relaxed text-night-muted">
              Browse what's available, request what you need for exactly as long as you need it,
              and hand it back when you're done. Or list what you already own and let it earn its
              keep between the times you actually use it.
            </p>
          </Reveal>
          <Reveal delay={0.26}>
            <p className="mt-4 text-lg leading-relaxed text-night-text/85">
              It's not about owning less for its own sake. It's about matching what you have to
              what you'll actually use.
            </p>
          </Reveal>
        </div>
      </section>

      <CtaBar text="Have equipment sitting idle? Put it to work." cta="List your equipment" to="/list-item" />
    </div>
  );
}
