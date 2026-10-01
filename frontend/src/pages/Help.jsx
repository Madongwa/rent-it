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
    a: "Search the marketplace, pick your dates, and send a request with the price you want to pay per day. The owner can accept it, decline it, or counter in your chat. Once one of you accepts, you meet up (or arrange delivery, where offered), confirm the item's condition together, and pay the owner directly. Return it in the same shape you got it, and the owner gives back any deposit you paid.",
  },
  {
    q: 'How do I list my own equipment?',
    a: "First, complete a one-time seller verification — upload a photo of your ID and your address, and our staff review it (usually within a couple of days). Once approved, you can list an item with photos, a description, your price, and your terms (deposit, cancellation policy, delivery options) any time.",
  },
  {
    q: 'How do deposits work?',
    a: "Deposits are optional and set by each owner, not a platform-wide rule. Rent It doesn't hold deposits: when a listing needs one, you pay it to the owner at pickup, and they return it once you both confirm the item came back in good condition.",
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
    q: 'Can I negotiate the price?',
    a: "Yes. The listed price is where the owner starts, not a fixed rate. When you send a request you enter your own price per day, and the owner sees it next to their listed price. Either of you can counter with a different price or dates in the chat, and the rental is confirmed as soon as one of you accepts the other's offer.",
  },
  {
    q: 'How do I pay?',
    a: "Directly to the owner, usually at pickup — cash, UPI, or whatever you both agree on. Rent It doesn't process payments, so it can't refund or reverse them. Pay only once you've seen the item in person, and never send money in advance to someone you haven't met.",
  },
  {
    q: 'Is there a fee for using Rent It?',
    a: "No. Rent It doesn't charge anything to browse, list, send offers, or rent — the price you agree with the owner is what you pay them.",
  },
  {
    q: 'What categories of equipment can I find?',
    a: 'Farming, Construction, Household & DIY, Events, Moving, and Medical — everything from tillers and mini excavators to tents, dollies, and mobility aids.',
  },
  {
    q: 'Can I send photos, documents or my location in chat?',
    a: 'Yes — tap the + next to Send. You can send photos (or take one with your camera), documents such as a PDF rental agreement, and a location: either where you are right now, or any place you search for or pin on the map, like a pickup gate. Only the person you are chatting with (and Rent It staff, if there is a dispute) can open them. Never send OTPs, UPI PINs or an unmasked Aadhaar.',
  },
  {
    q: 'How do I find equipment near me?',
    a: 'Tap "Nearby" on the Marketplace (or pick "Nearest to me"). Your browser asks for your location once; listings then show how far away they are, closest first, and the Map button shows them on a map. Your location is rounded to about 1 km and never stored, and owners\' exact addresses are never shown - just the area.',
  },
  {
    q: "What if I can't find what I need?",
    a: 'Post a Wanted request - "Need a JCB in Pune next week" - from the Wanted page, or from the "Post it as a Wanted request" link when a search finds nothing. Owners who have one can reply with their listing, which opens a chat with you, and when someone lists a matching item you get a notification. You can also tap "Alert me" on any search to hear about new matches each morning.',
  },
  {
    q: 'Can I chat in my own language, or send voice messages?',
    a: 'Yes. Pick your language with the button at the top, and messages from the other person appear in it (with "Show original" underneath). With the message box empty, tap the mic to record a voice note - the other person gets the recording plus the words, written out in their language.',
  },
  {
    q: 'Is there a written agreement for a rental?',
    a: 'Yes. Once a deal is agreed, open "📄 Agreement" on your Dashboard. It lists the item, dates, agreed price, total, deposit and the plain rules you both agreed to, in English and both of your languages, and "Print / Save as PDF" gives you a copy.',
  },
  {
    q: 'Do I need to show an ID to rent?',
    a: 'Only when it matters: once a deal is agreed we ask you to verify an ID before pickup, and some owners of expensive equipment only accept ID-verified renters. It takes a minute on the Verify your ID page - use any of Aadhaar (masked only), driving licence, voter ID, PAN or passport. Owners just see an "ID verified" badge, never your document.',
  },
  {
    q: 'How do I know an owner can be trusted?',
    a: 'Every owner passes an ID check before they can list. Listing pages show their trust badges - verified seller, how fast they usually reply, rentals completed, rating and how long they have been on Rent It - and real reviews from completed rentals. Still: meet in person, check the item, take photos, and never pay in advance.',
  },
  {
    q: 'What does the AI do on Rent It?',
    a: "It helps with typing and guesswork: translating the site and chats, understanding searches in your own words, writing a listing from a few words, suggesting prices and replies, checking photos, summarising reviews, and comparing pickup and return photos. It only ever suggests - people make every decision. Chats, voice notes, rental photos and ID photos only go to one AI provider (Groq), never to Google's free AI. The Privacy Policy lists exactly what goes where.",
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
