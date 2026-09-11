import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Real equipment photography, one per category. "Household" maps to the
// `diy` slug so it actually filters the Marketplace correctly; Events,
// Moving and Medical don't exist as categories in the database yet, so
// clicking them lands on an empty (but not broken) Marketplace result -
// this component is a forward-looking showcase, not a live data view.
const CATEGORIES = [
  {
    name: 'Farming',
    slug: 'farming',
    img: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Kubota_M35GX_tractor_MD1.jpg/960px-Kubota_M35GX_tractor_MD1.jpg',
  },
  {
    name: 'Construction',
    slug: 'construction',
    img: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Caterpillar_330_excavator_on_a_pile_of_dirt.jpg/960px-Caterpillar_330_excavator_on_a_pile_of_dirt.jpg',
  },
  {
    name: 'Household',
    slug: 'diy',
    img: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg/960px-Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg',
  },
  {
    name: 'Events',
    slug: 'events',
    img: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG/960px-Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG',
  },
  {
    name: 'Moving',
    slug: 'moving',
    img: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Sackkarre.jpg',
  },
  {
    name: 'Medical',
    slug: 'medical',
    img: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Medline_F-1_manual_wheelchair_1.JPG/960px-Medline_F-1_manual_wheelchair_1.JPG',
  },
];

const AUTOPLAY_MS = 2800;
const LETTER_STAGGER = 0.028;
const EASE = [0.22, 1, 0.36, 1];

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

export default function CategoryShowcase() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const displayedIndex = hoverIndex ?? activeIndex;
  const active = CATEGORIES[displayedIndex];

  // Sweeping the cursor across the thumbnail row fires a mouseenter on
  // every thumbnail it passes over; committing each one instantly used to
  // queue up several overlapping headline transitions that never fully
  // resolved. Debouncing the "enter" side (not "leave") means only the
  // thumbnail the cursor actually settles on triggers a transition.
  const hoverTimeout = useRef(null);

  function handleThumbEnter(i) {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverIndex(i), 80);
  }

  function handleThumbLeave() {
    clearTimeout(hoverTimeout.current);
    setHoverIndex(null);
  }

  useEffect(() => () => clearTimeout(hoverTimeout.current), []);

  // Headline word swap - deliberately NOT built on AnimatePresence's
  // exit-tracking. With this component's nested letter-spans,
  // AnimatePresence was never reporting the exit as complete: DOM
  // inspection showed every category name that had ever been shown
  // (all 6) permanently stuck in the tree, simultaneously visible and
  // overlapping - which is what produced the illegible, seemingly
  // "wrong letters" garble. Only ONE word is ever rendered at a time
  // here; a plain `animate` prop change (not `exit`) slides its letters
  // up and out, and a setTimeout matched to that animation's real
  // duration swaps in the next word once it's actually finished.
  const [displayedCategory, setDisplayedCategory] = useState(CATEGORIES[0]);
  const [wordPhase, setWordPhase] = useState('resting'); // 'resting' | 'exiting'
  const displayedColorIndex = CATEGORIES.findIndex((c) => c.slug === displayedCategory.slug);
  const swapTimeout = useRef(null);

  // Every word swap gives its letters a fresh React key (see the `key`
  // below), which counts as a new mount as far as Framer Motion is
  // concerned - so `initial` normally fires on every single transition,
  // not just page load. We only want to skip it once, for the very first
  // paint, so this stays `true` through that first render and flips to
  // `false` before anything else re-renders.
  const isFirstMount = useRef(true);
  useEffect(() => {
    isFirstMount.current = false;
  }, []);

  useEffect(() => {
    if (active.slug === displayedCategory.slug) return;
    if (reduceMotion) {
      setDisplayedCategory(active);
      return;
    }
    setWordPhase('exiting');
    const exitMs = (displayedCategory.name.length - 1) * LETTER_STAGGER * 1000 + 550;
    clearTimeout(swapTimeout.current);
    swapTimeout.current = setTimeout(() => {
      setDisplayedCategory(active);
      setWordPhase('resting');
    }, exitMs);
    return () => clearTimeout(swapTimeout.current);
  }, [active, displayedCategory, reduceMotion]);

  // Autoplay advances the committed selection; pauses while a thumbnail is
  // hovered or focused (hoverIndex not null re-triggers this effect, which
  // clears the previous interval).
  useEffect(() => {
    if (hoverIndex !== null) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [hoverIndex]);

  function handleSelect(index) {
    setActiveIndex(index);
    navigate(`/marketplace?category=${CATEGORIES[index].slug}`);
  }

  return (
    <div className="flex flex-col items-center gap-12 sm:gap-16">
      <div
        role="tablist"
        aria-label="Equipment categories"
        className="-mx-4 flex w-[calc(100%+2rem)] justify-start gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {CATEGORIES.map((cat, i) => {
          const isDisplayed = i === displayedIndex;
          return (
            <button
              key={cat.slug}
              type="button"
              role="tab"
              aria-selected={isDisplayed}
              aria-label={`View ${cat.name} equipment`}
              onMouseEnter={() => handleThumbEnter(i)}
              onMouseLeave={handleThumbLeave}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
              onClick={() => handleSelect(i)}
              className="relative shrink-0 rounded-2xl bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-homeAccent"
            >
              <motion.div
                animate={{ scale: isDisplayed ? 1.25 : 1 }}
                whileTap={{ scale: 1.45, transition: { duration: 0.15, ease: EASE } }}
                transition={{ duration: 0.45, ease: EASE }}
                className="h-20 w-20 overflow-hidden rounded-2xl bg-night-card sm:h-24 sm:w-24 lg:h-28 lg:w-28"
              >
                <motion.img
                  src={cat.img}
                  alt={`${cat.name} equipment`}
                  animate={{
                    filter: isDisplayed ? 'grayscale(0%) brightness(1)' : 'grayscale(45%) brightness(0.75)',
                    scale: isDisplayed ? 1.08 : 1,
                  }}
                  transition={{ duration: 0.4 }}
                  className="h-full w-full object-cover"
                />
              </motion.div>

              <AnimatePresence>
                {isDisplayed && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 420, damping: 22 }}
                    className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-homeAccent text-night-bg"
                  >
                    <ArrowUpRightIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <div className="text-center">
        <p className="text-sm text-night-muted">Browse by category</p>

        <div
          className="relative mx-auto mt-4 flex h-[1.3em] items-center justify-center whitespace-nowrap text-[clamp(40px,9vw,112px)] font-extrabold leading-[1.15]"
          aria-live="polite"
        >
          {reduceMotion ? (
            <span
              className={`transition-opacity duration-200 ${
                wordPhase === 'exiting' ? 'opacity-0' : 'opacity-100'
              } ${displayedColorIndex % 2 === 0 ? 'text-night-text' : 'text-homeAccent'}`}
            >
              {displayedCategory.name}
            </span>
          ) : (
            <span
              className={`flex items-center justify-center ${
                displayedColorIndex % 2 === 0 ? 'text-night-text' : 'text-homeAccent'
              }`}
            >
              {[...displayedCategory.name].map((ch, i) => (
                <span
                  key={`${displayedCategory.slug}-${i}`}
                  className="inline-block h-[1.15em] overflow-hidden leading-[1.15]"
                >
                  <motion.span
                    initial={isFirstMount.current ? false : { y: '115%' }}
                    animate={{ y: wordPhase === 'exiting' ? '-115%' : '0%' }}
                    transition={{ duration: 0.55, ease: EASE, delay: i * LETTER_STAGGER }}
                    className="inline-block"
                  >
                    {ch === ' ' ? ' ' : ch}
                  </motion.span>
                </span>
              ))}
            </span>
          )}
        </div>

        <p className="mx-auto mt-6 max-w-md text-base text-night-muted">
          Real equipment, from people near you — ready when you need it.
        </p>
      </div>
    </div>
  );
}
