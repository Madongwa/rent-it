import { useEffect, useState } from 'react';
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
const LETTER_STAGGER = 0.03;
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
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
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
          className="relative mx-auto mt-4 flex h-[1.1em] items-center justify-center whitespace-nowrap text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl"
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {reduceMotion ? (
              <motion.span
                key={active.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={displayedIndex % 2 === 0 ? 'text-night-text' : 'text-homeAccent'}
              >
                {active.name}
              </motion.span>
            ) : (
              <motion.span
                key={active.name}
                className={`absolute inset-0 flex items-center justify-center ${
                  displayedIndex % 2 === 0 ? 'text-night-text' : 'text-homeAccent'
                }`}
              >
                {[...active.name].map((ch, i) => (
                  <span key={i} className="inline-block h-[1em] overflow-hidden leading-[1]">
                    <motion.span
                      initial={{ y: '100%' }}
                      animate={{ y: '0%' }}
                      exit={{ y: '-100%' }}
                      transition={{ duration: 0.5, ease: EASE, delay: i * LETTER_STAGGER }}
                      className="inline-block"
                    >
                      {ch === ' ' ? ' ' : ch}
                    </motion.span>
                  </span>
                ))}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <p className="mx-auto mt-6 max-w-md text-base text-night-muted">
          Real equipment, from people near you — ready when you need it.
        </p>
      </div>
    </div>
  );
}
