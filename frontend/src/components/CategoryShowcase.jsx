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

const EASE = [0.22, 1, 0.36, 1];

// --- PART 1: letter transition timing --------------------------------------
// LETTER_TRANSITION_DURATION/LETTER_STAGGER_DELAY are exact per spec, not
// derived from anything else. Longest word check ("Construction", 12
// letters): last letter starts at (12-1) * 18 = 198ms, finishes at
// 198 + 320 = 518ms total - fast, not sluggish, confirmed visually.
// Same cubic-bezier as EASE above (already ease-out-expo-like), reused
// rather than duplicated.
const LETTER_TRANSITION_DURATION = 320; // ms
const LETTER_STAGGER_DELAY = 18; // ms
const LETTER_EASE = EASE;

// --- PART 3: hover hold-and-resume state machine ---------------------------
const HOLD_DURATION_MS = 1500; // exact, not approximate
// Was 2800ms. The old per-letter animation this replaced took noticeably
// longer to resolve than the new 518ms-max transition above, so 2800ms of
// dwell time now reads a little slow next to how quickly the word rolls in.
// Landed on 2500ms - still comfortably inside the requested 2200-2800ms
// range, and leaves ~2000ms+ of settled reading time after even the
// longest word's roll finishes.
const AUTOPLAY_INTERVAL_MS = 2500;

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

// --- PART 2: color is purely index-based ------------------------------------
// Never touched by hover/focus/click - a category's color is a fixed
// property of its position, full stop.
function colorClassForIndex(index) {
  return index % 2 === 0 ? 'text-night-text' : 'text-homeAccent';
}

// One letter "slot" mid-transition: a two-layer roll (old letter sliding
// out, new letter sliding in, same time window, staggered per slot by the
// caller via `delayMs`). The parent below only renders this WHILE
// transitioning, keyed by the from/to pair - so every transition, including
// one that interrupts an in-flight one, mounts a fresh instance and
// `initial` reliably re-applies each time instead of only firing once ever
// for a given letter position. Deliberately not AnimatePresence: nested
// per-letter children under AnimatePresence were what caused exit-tracking
// to get stuck previously.
function RollingLetterSlot({ fromChar, toChar, fromColor, toColor, delayMs }) {
  return (
    <span className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
      {/* Reserves width for the taller of the two characters stacked on it. */}
      <span className="invisible">{toChar}</span>
      <motion.span
        initial={{ y: '0%' }}
        animate={{ y: '-115%' }}
        transition={{ duration: LETTER_TRANSITION_DURATION / 1000, delay: delayMs / 1000, ease: LETTER_EASE }}
        className={`absolute inset-0 inline-block ${fromColor}`}
      >
        {fromChar}
      </motion.span>
      <motion.span
        initial={{ y: '115%' }}
        animate={{ y: '0%' }}
        transition={{ duration: LETTER_TRANSITION_DURATION / 1000, delay: delayMs / 1000, ease: LETTER_EASE }}
        className={`absolute inset-0 inline-block ${toColor}`}
      >
        {toChar}
      </motion.span>
    </span>
  );
}

export default function CategoryShowcase() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // currentIndex is the single source of truth for what the headline shows
  // and, per Part 2, what color it renders - never anything else.
  const [currentIndex, setCurrentIndex] = useState(0);

  // Explicit state machine per spec, purely for interaction bookkeeping
  // (pausing/resuming timers) - it has no bearing on color (Part 2) and no
  // bearing on which letters render beyond driving currentIndex itself.
  const [interactionState, setInteractionState] = useState('IDLE_AUTOPLAY');

  const autoplayTimerId = useRef(null);
  const holdTimerId = useRef(null);

  // Rapid hover across several thumbnails fires all their handlers
  // synchronously in one React batch, before any re-render - so the plain
  // `currentIndex` closure inside handleThumbEnter is still the PRE-batch
  // value for every one of those calls, not whatever an earlier call in the
  // same burst just queued. Comparing against a ref instead (updated the
  // instant we decide to change it, not on the next commit) means each
  // successive call in the burst correctly sees the previous call's target,
  // so a same-tick "is this already current" check can't misfire.
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  function clearAutoplay() {
    if (autoplayTimerId.current) {
      clearInterval(autoplayTimerId.current);
      autoplayTimerId.current = null;
    }
  }
  function clearHold() {
    if (holdTimerId.current) {
      clearTimeout(holdTimerId.current);
      holdTimerId.current = null;
    }
  }
  function startAutoplay() {
    clearAutoplay();
    autoplayTimerId.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, AUTOPLAY_INTERVAL_MS);
  }

  // Mount: start normal cycling. Unmount: clear both timers so nothing
  // fires a state update after this component is gone (e.g. a route change
  // while hovering or holding).
  useEffect(() => {
    startAutoplay();
    return () => {
      clearAutoplay();
      clearHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ON HOVER (-> HOVERING). autoplayTimerId and holdTimerId are mutually
  // exclusive by construction: this is the only place either timer starts
  // from a non-idle state, and it always clears both first.
  function handleThumbEnter(i) {
    clearAutoplay();
    clearHold();
    setInteractionState('HOVERING');
    // Re-hovering the already-displayed category is a no-op for the
    // headline (no re-triggering a roll for a word that's already shown),
    // but the timer cancellation above still applies.
    if (i !== currentIndexRef.current) {
      currentIndexRef.current = i;
      setCurrentIndex(i);
    }
  }

  // ON MOUSE LEAVE (-> HOLDING, provisionally). If the very next thing that
  // happens is entering a different thumbnail, that handler's clearHold()
  // cancels this before it ever fires - so a straight sweep across
  // thumbnails never actually spends time in HOLDING. Only a genuine "left
  // the whole row" leaves this timer to run to completion.
  function handleThumbLeave() {
    setInteractionState('HOLDING');
    clearHold();
    holdTimerId.current = setTimeout(() => {
      // HOLDING -> IDLE_AUTOPLAY: advance forward from here, then resume
      // normal cycling from this new position onward.
      setCurrentIndex((prev) => (prev + 1) % CATEGORIES.length);
      setInteractionState('IDLE_AUTOPLAY');
      startAutoplay();
    }, HOLD_DURATION_MS);
  }

  function handleSelect(index) {
    clearAutoplay();
    clearHold();
    setCurrentIndex(index);
    navigate(`/marketplace?category=${CATEGORIES[index].slug}`);
  }

  // --- Letter-roll transition driver -----------------------------------------
  // display.fromIndex === display.toIndex means idle (nothing in flight);
  // whenever currentIndex changes, this kicks off a transition FROM
  // whatever the most recently targeted index was TO the new one (not from
  // whatever was last fully settled) - so interrupting an in-flight roll by
  // hovering somewhere else continues from where it visually was heading,
  // rather than snapping back to an older word first.
  const [display, setDisplay] = useState({ fromIndex: 0, toIndex: 0 });
  const lastTargetRef = useRef(0);
  const transitionTimeout = useRef(null);

  useEffect(() => {
    if (lastTargetRef.current === currentIndex) return;
    const fromIndex = lastTargetRef.current;
    lastTargetRef.current = currentIndex;

    if (reduceMotion) {
      setDisplay({ fromIndex: currentIndex, toIndex: currentIndex });
      return;
    }

    const fromName = CATEGORIES[fromIndex].name;
    const toName = CATEGORIES[currentIndex].name;
    const maxLen = Math.max(fromName.length, toName.length);
    const totalMs = (maxLen - 1) * LETTER_STAGGER_DELAY + LETTER_TRANSITION_DURATION;

    setDisplay({ fromIndex, toIndex: currentIndex });
    clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => {
      setDisplay({ fromIndex: currentIndex, toIndex: currentIndex });
    }, totalMs);

    return () => clearTimeout(transitionTimeout.current);
  }, [currentIndex, reduceMotion]);

  const isTransitioning = display.fromIndex !== display.toIndex;
  const fromName = CATEGORIES[display.fromIndex].name;
  const toName = CATEGORIES[display.toIndex].name;
  const letterCount = isTransitioning ? Math.max(fromName.length, toName.length) : toName.length;

  return (
    <div className="flex flex-col items-center gap-12 sm:gap-16" data-interaction-state={interactionState}>
      <div
        role="tablist"
        aria-label="Equipment categories"
        className="-mx-4 flex w-[calc(100%+2rem)] justify-start gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {CATEGORIES.map((cat, i) => {
          const isDisplayed = i === currentIndex;
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
          className="mx-auto mt-4 flex h-[1.3em] items-center justify-center whitespace-nowrap text-[clamp(40px,9vw,112px)] font-extrabold leading-[1.15]"
          aria-live="polite"
        >
          {isTransitioning
            ? Array.from({ length: letterCount }, (_, i) => (
                <RollingLetterSlot
                  key={`${display.fromIndex}-${display.toIndex}-${i}`}
                  fromChar={fromName[i] ?? ' '}
                  toChar={toName[i] ?? ' '}
                  fromColor={colorClassForIndex(display.fromIndex)}
                  toColor={colorClassForIndex(display.toIndex)}
                  delayMs={i * LETTER_STAGGER_DELAY}
                />
              ))
            : Array.from({ length: letterCount }, (_, i) => (
                <span key={`static-${i}`} className={`inline-block ${colorClassForIndex(display.toIndex)}`}>
                  {toName[i] === ' ' ? ' ' : toName[i]}
                </span>
              ))}
        </div>

        <p className="mx-auto mt-6 max-w-md text-base text-night-muted">
          Real equipment, from people near you — ready when you need it.
        </p>
      </div>
    </div>
  );
}
