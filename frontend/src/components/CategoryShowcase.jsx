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
// How long a hovered category keeps holding the display after the mouse
// leaves, before autoplay resumes (continuing forward from that item).
const SETTLE_MS = 2500;
const EASE = [0.22, 1, 0.36, 1];
// Back-out cubic-bezier (y briefly exceeds 1) for the headline crossfade -
// gives the word a slight organic overshoot as it settles instead of a
// mechanical linear/easeOut stop, closer to Skiper6's reveal feel.
const TEXT_EASE = [0.34, 1.56, 0.64, 1];

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

  // Hovering IS the real selection now - there's no separate preview index
  // that reverts on mouse-leave. activeIndex is the single source of truth,
  // updated directly by hover, focus, click, and autoplay alike.
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CATEGORIES[activeIndex];

  // isHovering drives the headline's hover color and pauses autoplay
  // outright; autoplayEnabled is the separate, slightly-delayed gate that
  // actually lets the interval run again - kept apart so leaving a
  // thumbnail doesn't immediately resume autoplay, it schedules a resume
  // after the settle pause below instead.
  const [isHovering, setIsHovering] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  // Sweeping the cursor across the row fires a mouseenter on every
  // thumbnail it passes over; a short debounce on the "enter" side only
  // (not "leave") means a fast pass-through doesn't fire a transition for
  // every thumbnail it grazes, while an actual pause on one still reads as
  // instant. resumeTimeout is the separate "settle" timer from point 2 -
  // restarted (not stacked) on every new hover, per point 4.
  const enterTimeout = useRef(null);
  const resumeTimeout = useRef(null);

  function handleThumbEnter(i) {
    clearTimeout(enterTimeout.current);
    clearTimeout(resumeTimeout.current);
    setIsHovering(true);
    setAutoplayEnabled(false);
    enterTimeout.current = setTimeout(() => setActiveIndex(i), 60);
  }

  function handleThumbLeave() {
    clearTimeout(enterTimeout.current);
    setIsHovering(false);
    clearTimeout(resumeTimeout.current);
    resumeTimeout.current = setTimeout(() => setAutoplayEnabled(true), SETTLE_MS);
  }

  useEffect(
    () => () => {
      clearTimeout(enterTimeout.current);
      clearTimeout(resumeTimeout.current);
    },
    []
  );

  // Headline word swap - a single motion.span per word (no nested
  // per-letter spans), so AnimatePresence's exit-tracking works the way
  // it's meant to: exactly one element enters, exactly one exits, no
  // overlapping stragglers stuck in the tree. That's what let this drop
  // the old manual setTimeout choreography entirely.

  // Autoplay only runs once autoplayEnabled flips back on (after the
  // settle pause), and always advances forward from whatever activeIndex
  // currently is - which, right after a hover, is the hovered item itself,
  // so this naturally continues forward from there instead of resuming
  // wherever it was before the hover.
  useEffect(() => {
    if (!autoplayEnabled) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplayEnabled]);

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
          const isDisplayed = i === activeIndex;
          return (
            <button
              key={cat.slug}
              type="button"
              role="tab"
              aria-selected={isDisplayed}
              aria-label={`View ${cat.name} equipment`}
              onMouseEnter={() => handleThumbEnter(i)}
              onMouseLeave={handleThumbLeave}
              onFocus={() => handleThumbEnter(i)}
              onBlur={handleThumbLeave}
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
          <AnimatePresence initial={false}>
            <motion.span
              key={active.slug}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
              transition={reduceMotion ? { duration: 0.15 } : { duration: 0.36, ease: TEXT_EASE }}
              className={`absolute inset-0 flex items-center justify-center ${
                isHovering ? 'text-homeAccent' : 'text-night-text'
              }`}
            >
              {active.name}
            </motion.span>
          </AnimatePresence>
        </div>

        <p className="mx-auto mt-6 max-w-md text-base text-night-muted">
          Real equipment, from people near you — ready when you need it.
        </p>
      </div>
    </div>
  );
}
