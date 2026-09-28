import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES, getLanguage } from '../lib/languages';

// The navbar language button: English or one of 12 Indian languages. The
// whole menu is translate="no" - each language is listed in its own script
// (plus its English name), so it stays readable whatever is picked.
export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const current = getLanguage(lang) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Focus the selected language when the menu opens, for keyboard users.
  useEffect(() => {
    if (open) wrapRef.current?.querySelector('[aria-checked="true"]')?.focus();
  }, [open]);

  function choose(code) {
    setLang(code);
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Up/down arrows move between languages.
  function onMenuKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={wrapRef} className="rh-lang" translate="no">
      <button
        ref={buttonRef}
        type="button"
        className="rh-btn rh-btn-login rh-lang-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${current.name}. Change language`}
      >
        <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span lang={current.code}>{current.native}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose a language"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(10,10,12,.92)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,.55)] backdrop-blur-xl"
        >
          {LANGUAGES.map((l) => {
            const selected = l.code === lang;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => choose(l.code)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none ${
                  selected ? 'bg-white/10' : ''
                }`}
              >
                <span lang={l.code} className="flex-1 text-[15px] text-night-text">
                  {l.native}
                </span>
                {l.code !== 'en' && <span className="text-xs text-night-muted">{l.name}</span>}
                <Check className={`h-4 w-4 shrink-0 text-emerald-400 ${selected ? '' : 'invisible'}`} aria-hidden="true" />
              </button>
            );
          })}
          <p className="px-3 pb-1.5 pt-2 text-[11px] leading-snug text-night-muted">
            Translated automatically by AI - some words may not be perfect.
          </p>
        </div>
      )}
    </div>
  );
}
