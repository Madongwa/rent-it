# Rent It - notes for Claude Code

Indian peer-to-peer equipment rental marketplace. React + Vite frontend
(`frontend/`), Express backend (`backend/`) on Vercel, Supabase for database,
auth and storage. What the site does, in detail: [FEATURES.md](FEATURES.md).

## Always keep the feature docs current

Whenever a change adds, changes or removes anything a user or staff member can
see or do (a feature, a page, a setting, what data goes where), in the **same
commit**:

1. Update **FEATURES.md** so it still describes the site accurately - the
   relevant section, and the AI table in §9 if an AI feature changed.
2. Add an entry at the top of **CHANGELOG.md** under today's date (create the
   date heading if it isn't there), in plain language for the owner.
3. If the change affects what data an AI provider receives, update the Privacy
   Policy text in `frontend/src/content/privacy.js` too.

Pure refactors, test-only changes and typo fixes don't need entries.

## Conventions that matter

- **Schema**: `backend/schema.sql` is the single, re-runnable schema (`if not
  exists`, drop-then-create). Append new changes to the end; apply with
  `cd backend && node scripts/run-migration.js`. New backend-only tables get
  RLS enabled with no policies.
- **Tests**: `npx vitest run` in `backend/` and in `frontend/`; `npx vite build`
  in `frontend/`. Run all three before committing.
- **AI calls** go through `backend/src/lib/ai.js` (`chatJson`) or
  `backend/src/lib/translate.js`: Gemini first, Groq as backup, short
  timeouts, no SDK retries, and every answer validated in code before use.
  **Chat content goes to Groq only** (`chatModels()`), never Gemini's free tier.
- **Page translation**: `frontend/src/lib/pageTranslator.js` translates all
  visible text. Mark anything people typed or personal (chat messages, names,
  file names, staff pages) with `translate="no"`. After adding pages or text,
  run `node backend/scripts/pretranslate.js`.
- **Navbar pills** use metal-fx (`MetalNavLink`); render links conditionally
  rather than hiding them with CSS - metal-fx's inline styles override hiding.
- Files use CRLF line endings on this machine; shell edits must preserve them.
- `frontend/src/components/ui/draggable-widget-grid.jsx` has the owner's own
  uncommitted change - don't commit or revert it.
