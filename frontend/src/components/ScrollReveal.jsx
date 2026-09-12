import { motion, useReducedMotion } from 'framer-motion';

// Shared scroll-triggered reveal primitives for the How It Works / Why It
// Matters pages. Built on framer-motion's `whileInView`, which is itself
// backed by an IntersectionObserver under the hood - so "each section
// animates in as it enters the viewport" comes for free, once per element
// (`viewport={{ once: true }}`) rather than re-triggering on every scroll
// past it.
//
// `useReducedMotion` mirrors the OS/browser prefers-reduced-motion setting -
// when it's on, every reveal here drops the y-axis slide and stagger delay
// and falls back to a plain, near-instant opacity fade.

// A single section/block that fades + slides up as it scrolls into view.
export function Reveal({ children, className, delay = 0, y = 28, as = 'div', ...props }) {
  const reduce = useReducedMotion();
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduce ? 0.25 : 0.5, ease: 'easeOut', delay: reduce ? 0 : delay }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Wrap a list of StaggerItems in this - it triggers once in view and cascades
// its children in one after another via framer-motion's staggerChildren.
export function StaggerGroup({ children, className, stagger = 0.1, ...props }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const itemVariantsReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
};

// One entry inside a StaggerGroup - picks up "hidden"/"show" from the
// parent's variants, it doesn't observe the viewport itself.
export function StaggerItem({ children, className, as = 'div', ...props }) {
  const reduce = useReducedMotion();
  const Component = motion[as] || motion.div;
  return (
    <Component className={className} variants={reduce ? itemVariantsReduced : itemVariants} {...props}>
      {children}
    </Component>
  );
}

// For the Trust System / cost-dimension callouts: the icon animates in
// first (a quick scale+fade), then the text follows a beat later - both
// still riding the parent StaggerGroup's cascade for the callout-to-callout
// stagger.
export function IconRevealItem({ icon, children, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? itemVariantsReduced : itemVariants}>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
        whileInView={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: reduce ? 0.2 : 0.35, ease: 'easeOut' }}
        className="text-3xl"
      >
        {icon}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: reduce ? 0.2 : 0.4, delay: reduce ? 0 : 0.12 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
