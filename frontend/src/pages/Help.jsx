import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import HelpChatbot from '../components/HelpChatbot';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Real answers, tied to what's actually built - no invented policy details.
const FAQ_ITEMS = [
  {
    q: 'How does renting work?',
    a: "Search the marketplace, pick your dates, and send a rental request to the owner. Once they approve it, you meet up (or arrange delivery, where offered), confirm the item's condition together, and you're set. Return it in the same shape you got it, and any deposit held is released back to you.",
  },
  {
    q: 'How do I list my own equipment?',
    a: "First, complete a one-time seller verification — upload a photo of your ID and your address, and our staff review it (usually within a couple of days). Once approved, you can list an item with photos, a description, your price, and your terms (deposit, cancellation policy, delivery options) any time.",
  },
  {
    q: 'How do deposits work?',
    a: 'Deposits are optional and set by each owner, not a platform-wide rule. When one applies, it\'s held separately from the rental fee and refunded once both sides confirm the item came back in good condition.',
  },
  {
    q: 'What if I need to cancel a booking?',
    a: 'Every listing shows its own cancellation policy (Free, Flexible, or Strict) before you book. As a renter, you can also cancel your own pending or approved request directly from your Dashboard at any time.',
  },
  {
    q: "What happens if equipment is damaged or isn't returned?",
    a: 'Either the renter or the owner can report a problem instead of confirming a clean return. That pauses the booking so Rent It staff can review what happened and resolve it fairly, rather than leaving it for the two of you to sort out alone.',
  },
  {
    q: 'Is there a fee for using Rent It?',
    a: "Rent It doesn't charge a fee to browse, list, or send a rental request. Any transaction costs that apply once payments are fully live will always be shown clearly before you confirm a booking — nothing hidden.",
  },
  {
    q: 'What categories of equipment can I find?',
    a: 'Farming, Construction, Household & DIY, Events, Moving, and Medical — everything from tillers and mini excavators to tents, dollies, and mobility aids.',
  },
  {
    q: 'Can I message an owner before booking?',
    a: 'Yes — every listing has a "Message the owner" option, so you can ask about condition, pickup logistics, or anything else before you send a request.',
  },
];

function AccordionItem({ item, isOpen, onToggle, reduceMotion }) {
  return (
    <div className="border-b border-night-border/15">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-homeAccent"
      >
        <span className="font-medium text-night-text">{item.q}</span>
        {reduceMotion ? (
          <ChevronDown
            size={20}
            className={`shrink-0 text-night-muted transition-opacity ${isOpen ? 'opacity-100' : 'opacity-70'}`}
          />
        ) : (
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 text-night-muted"
          >
            <ChevronDown size={20} />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: reduceMotion ? 0 : 0.1 }}
              className="pb-5 pr-8 text-body text-night-muted"
            >
              {item.a}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Help() {
  useSeo({
    title: 'Help / FAQ',
    description: 'Answers to common questions about renting, listing, deposits, cancellations, and disputes on Rent It.',
    path: '/help',
  });
  const [openIndex, setOpenIndex] = useState(null);
  const reduceMotion = useReducedMotion();

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-heading-sm text-night-text">Help &amp; FAQ</h1>
        <p className="mt-3 text-body text-night-muted">
          Ask our support assistant in the corner for a quick answer, or browse the common
          questions below.
        </p>

        <div className="mt-10">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.q}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>
      </div>

      <HelpChatbot />
    </DarkGradientBg>
  );
}
