import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

// Adapted from Aceternity UI's "Lamp" effect. Two changes from the
// original: every cyan-* class is swapped for our Home page's own
// `homeAccent` token (see index.css's --home-accent variable - keeps this
// in sync with the rest of the dark Home page, and lets the whole lamp
// re-theme in one line later), and every bg-slate-950 is swapped for our
// actual page background (`bg-night-bg`) since those divs work by
// matching the container's background exactly to fade the glow out -
// slate-950 would leave a visible seam against our pure black canvas.
export const LampContainer = ({ children, className }) => {
  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-night-bg w-full rounded-md z-0',
        className
      )}
    >
      {/* Fixed-rem geometry (w-[30rem] etc.) is scaled down as one unit on
          narrow screens rather than reflowed, since the effect is a single
          composed shape - reflowing the pieces independently would break it. */}
      <div className="w-full origin-top scale-[0.55] sm:scale-75 md:scale-100">
        <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center isolate z-0 ">
          <motion.div
            initial={{ opacity: 0.5, width: '15rem' }}
            whileInView={{ opacity: 1, width: '30rem' }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeInOut' }}
            style={{
              backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
            }}
            className="absolute inset-auto right-1/2 h-56 overflow-visible w-[30rem] bg-gradient-conic from-homeAccent via-transparent to-transparent text-white [--conic-position:from_70deg_at_center_top]"
          >
            <div className="absolute w-[100%] left-0 bg-night-bg h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
            <div className="absolute w-40 h-[100%] left-0 bg-night-bg bottom-0 z-20 [mask-image:linear-gradient(to_right,white,transparent)]" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0.5, width: '15rem' }}
            whileInView={{ opacity: 1, width: '30rem' }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeInOut' }}
            style={{
              backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))`,
            }}
            className="absolute inset-auto left-1/2 h-56 w-[30rem] bg-gradient-conic from-transparent via-transparent to-homeAccent text-white [--conic-position:from_290deg_at_center_top]"
          >
            <div className="absolute w-40 h-[100%] right-0 bg-night-bg bottom-0 z-20 [mask-image:linear-gradient(to_left,white,transparent)]" />
            <div className="absolute w-[100%] right-0 bg-night-bg h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
          </motion.div>
          <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-night-bg blur-2xl"></div>
          <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md"></div>
          {/* Widened vertically (h-36 -> h-[28rem]) and re-centered
              (-translate-y-1/2 -> -translate-y-1/4) so the glow reaches down
              far enough to cover both headline lines; radial mask fades it
              on every side instead of just left/right. Baseline opacity
              dropped to 0.4 (was 0.5) so the bigger shape doesn't wash the
              text out; kept the breathing pulse from the previous pass,
              recentered on that same 0.4 baseline. */}
          <motion.div
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-auto z-50 h-[28rem] w-[56rem] -translate-y-1/4 rounded-full bg-homeAccent blur-3xl [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,white,transparent_75%)]"
          ></motion.div>
          <motion.div
            initial={{ width: '16rem' }}
            whileInView={{ width: '32rem' }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{
              width: { delay: 0.3, duration: 0.8, ease: 'easeInOut' },
              opacity: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute inset-auto z-30 h-[20rem] -translate-y-[2rem] rounded-full bg-homeAccent blur-3xl [mask-image:radial-gradient(ellipse_55%_50%_at_50%_35%,white,transparent_75%)]"
          ></motion.div>
          <motion.div
            initial={{ width: '30rem' }}
            whileInView={{ width: '60rem' }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{
              width: { delay: 0.3, duration: 0.8, ease: 'easeInOut' },
              opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute inset-auto z-50 h-0.5 w-[60rem] -translate-y-[7rem] bg-homeAccent [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]"
          ></motion.div>
          <div className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem] bg-night-bg "></div>
        </div>
      </div>

      <div className="relative z-50 flex -translate-y-12 flex-col items-center px-5 sm:-translate-y-20 md:-translate-y-28">
        {children}
      </div>
    </div>
  );
};
