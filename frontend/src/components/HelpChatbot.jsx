import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { api } from '../lib/api';

const GREETING = "Hi! I'm here to help with anything about renting, listing, or using Rent It. What can I help with?";

const STARTER_QUESTIONS = [
  'How do deposits work?',
  'How do I list my equipment?',
  'What if I need to cancel?',
];

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

// Three-dot typing indicator - each dot bounces on its own delay so the
// wave reads left-to-right. Falls back to a plain (non-animated) set of
// dots under prefers-reduced-motion rather than a transform-based bounce.
function TypingDots({ reduceMotion }) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-night-muted"
          animate={reduceMotion ? { opacity: [0.4, 1, 0.4] } : { y: [0, -6, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ role, content, reduceMotion }) {
  const isUser = role === 'user';
  const variants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
      };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-2xl rounded-br-md bg-accent text-white'
            : 'rounded-2xl rounded-bl-md bg-night-elevated text-night-text'
        }`}
      >
        {content}
      </div>
    </motion.div>
  );
}

export default function HelpChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ id: 'greeting', role: 'assistant', content: GREETING }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  const hasOpenedRef = useRef(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const triggerRef = useRef(null);
  const reduceMotion = useReducedMotion();

  // Idle pulse: arm once, 5s after mount, and only if the widget has never
  // been opened. Opening it - this session - retires the pulse for good,
  // even if the panel is later closed again.
  useEffect(() => {
    if (isOpen || hasOpenedRef.current) return;
    const timer = setTimeout(() => setShowPulse(true), 5000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Escape-to-close + a minimal focus trap while the panel is open.
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function openWidget() {
    hasOpenedRef.current = true;
    setShowPulse(false);
    setIsOpen(true);
  }

  function closeWidget() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setHasInteracted(true);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { id: uid(), role: 'user', content: trimmed }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { reply } = await api.sendChatMessage(trimmed, history);
      setMessages((m) => [...m, { id: uid(), role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          content: err.message || "Sorry, I'm having trouble responding right now — please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(inputValue);
  }

  const panelVariants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
      };

  const pillListVariants = {
    hidden: {},
    visible: { transition: { delayChildren: reduceMotion ? 0 : 0.35, staggerChildren: reduceMotion ? 0 : 0.06 } },
  };
  const pillVariants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

  return (
    <>
      {/* Trigger button */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={openWidget}
        aria-label="Open help chat"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        whileHover={reduceMotion ? undefined : { scale: 1.08 }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="fixed bottom-6 right-6 z-50 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(46,125,50,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {!reduceMotion && showPulse && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full bg-accent"
            initial={{ opacity: 0.4, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <MessageCircle size={26} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Rent It support chat"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: 'bottom right' }}
            className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-night-border/15 bg-night-card shadow-[0_24px_60px_rgba(0,0,0,0.5)] max-sm:bottom-[80px] max-sm:right-4 max-sm:left-4 max-sm:h-[calc(100vh-100px)] max-sm:w-auto"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-night-border/15 px-4 py-3">
              <div>
                <p className="font-semibold text-night-text">Rent It Support</p>
                <p className="text-xs text-night-muted">Powered by an open-source LLM (via Groq)</p>
              </div>
              <button
                type="button"
                onClick={closeWidget}
                aria-label="Close help chat"
                className="rounded-full p-1.5 text-night-muted hover:bg-white/5 hover:text-night-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} reduceMotion={reduceMotion} />
              ))}

              {!hasInteracted && (
                <motion.div
                  variants={pillListVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-wrap gap-2"
                >
                  {STARTER_QUESTIONS.map((q) => (
                    <motion.button
                      key={q}
                      variants={pillVariants}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="rounded-full border border-night-border/25 bg-white/[0.03] px-3 py-1.5 text-xs text-night-text transition-colors hover:border-night-border/50 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {q}
                    </motion.button>
                  ))}
                </motion.div>
              )}

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    className="flex justify-start"
                  >
                    <div className="rounded-2xl rounded-bl-md bg-night-elevated">
                      <TypingDots reduceMotion={reduceMotion} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={scrollAnchorRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex shrink-0 items-center gap-2 border-t border-night-border/15 p-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question…"
                maxLength={1000}
                className="flex-1 rounded-full border border-night-border/20 bg-white/[0.03] px-3.5 py-2 text-sm text-night-text placeholder:text-night-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <motion.button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
              >
                <Send size={16} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
