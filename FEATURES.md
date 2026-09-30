# Rent It: every feature, in detail

Rent It (live at [renthere.in](https://renthere.in)) is an Indian peer-to-peer
equipment rental marketplace. People who own equipment they aren't using
(tractors, cement mixers, drills, generators, wheelchairs, event gear…) rent it
to people who need it for a day, a weekend or a project.

**No money moves through the app.** Renter and owner agree a price in chat, and
the renter pays the owner directly (plus any deposit) at pickup.

This file describes what the site does today. It is kept up to date with every
change - see [Keeping this file up to date](#keeping-this-file-up-to-date) and
[CHANGELOG.md](CHANGELOG.md) for what changed when.

---

## Contents

1. [Pages anyone can use](#1-pages-anyone-can-use)
2. [Accounts](#2-accounts)
3. [Renting something](#3-renting-something)
4. [Listing your equipment](#4-listing-your-equipment)
5. [Messages (chat)](#5-messages-chat)
6. [Notifications](#6-notifications)
7. [Your dashboard](#7-your-dashboard)
8. [Languages and translation](#8-languages-and-translation)
9. [AI features at a glance](#9-ai-features-at-a-glance)
10. [Trust and safety](#10-trust-and-safety)
11. [Staff dashboard](#11-staff-dashboard)
12. [Privacy and data handling](#12-privacy-and-data-handling)
13. [Under the hood](#13-under-the-hood)

---

## 1. Pages anyone can use

### Home
Animated hero ("Rent the right tool, right when you need it") and a category
showcase for the six categories: **Farming Tools, Construction Tools,
Household & DIY, Events, Moving, Medical**. The "idle equipment" section
describes the problem in plain words (no unsourced statistics).

### Marketplace
Browse everything available to rent.

- **Search box** - two ways to search:
  - A few words ("drill") search listing titles and descriptions as typed.
  - **A sentence, in any language** ("koi ladder hai kya mysuru me",
    "cheap farming equipment under 500 a day", "tractor chahiye ludhiana me")
    is turned into filters by AI. A line under the box shows how it was read,
    with **"Search the exact words instead"**. If the AI is unavailable, the
    words are searched as typed. "Near me" / "nearby" / "mere paas" sorts the
    nearest first, and "within 5 km" sets the distance filter (both ask for
    your location).
- **Quick-filter pill bar** - categories, **Nearby** (asks for your location,
  then shows the nearest first), Available now, Under ₹750/day, Top rated,
  **Verified owners** (only owners who passed seller verification), New listings,
  Free delivery, **Trending**.
- **"Near me" and distances** - once you share your location (Nearby, "Nearest
  to me" sort, or "Use my location" under Distance) every card and listing
  page shows **"3.2 km away"**, and the distance filter measures from you. Your
  location is rounded to about 1 km in your browser, sent only to Rent It's
  server to work out distances, never saved, and remembered only for that
  browser tab. "Stop using my location" forgets it.
- **List / Map switch** - the Map view shows every matching listing as a pin on
  an OpenStreetMap map (tap a pin for the title, price, distance and "View
  listing"). Pins show the area (about 1 km), never the owner's exact spot.
  Listings without a pin are counted under the map.
- **Filter sidebar** - price (₹ buckets or a custom range), availability
  (today / this week - counts agreed bookings and owner-blocked dates), condition (New, Like New, Good, Fair), power source
  (electric, petrol, diesel, manual, battery, not applicable), delivery
  (owner delivers / pickup only / either), deposit, cancellation policy (free /
  flexible / strict), owner type (individual / business), accessories included,
  distance (within 2 / 5 / 10 / 25 km - from you when you've shared your
  location, otherwise the owner-entered distance), rental duration (hourly / daily /
  weekly / monthly), rating (3★ / 4★ and up), minimum rental period.
- **🔔 Alert me** (needs login) - saves the current search and filters (up to
  10). Every morning at 9:00 IST the daily job checks each saved search for
  listings published since the last check - with exactly the Marketplace's
  filters - and sends one notification ("2 new listings for 'tractor near
  Mandya'") that opens the search. Your own listings and "available today"
  don't count. Manage them under Dashboard → Saved searches.
- **🎤 Voice search** - the mic next to the search box listens (up to 15 s, tap
  ■ to stop early); what you said lands in the box and is searched like typed
  words, so a spoken sentence in any language goes through the plain-language
  search. The recording isn't stored.
- **No results?** The AI suggests other search words that do have listings
  ("wedding speakers" → speakers, PA system), and offers to **post it as a
  Wanted request**.
- **"📍 Near <town>"** filter (set by a sentence search), removable as a chip.
- **Sort** - relevance, price low→high / high→low, rating, newest, **trending**
  (most requested and saved in the last 30 days - a request counts 3× a save),
  nearest to me. On phones a Sort menu sits next to the Filters button.
- All filters live in the page address, so a filtered view can be shared as a link.
- Save listings to **Favorites** with the heart on each card (needs login).

### Listing detail
**Photo gallery** (all the owner's photos - arrows, arrow keys, thumbnails), category and condition badges, rating and review count, daily price
(plus **weekly / monthly prices** where the owner set them),
deposit, minimum rental period and supported durations, description, specs
(power source, delivery, cancellation policy, owner type, accessories),
an **availability calendar** (upcoming dates that are booked or that the owner
blocked, plus a list), past rental history, reviews (with an AI **"Renters
say…"** summary and liked/disliked chips once there are 3+ written reviews,
labelled as AI and redone only when reviews change), how far away it is (if
you've shared your location on the Marketplace), and:

- **Request to rent** - pick dates and your own price per day (starts at the
  listed price - the cheaper weekly rate for 7+ days, monthly for 30+). The form shows the total, the deposit, and an **AI price
  check** (see [§3](#3-renting-something)).
- **Message the owner** - opens a chat about this item.

### Wanted (`/wanted`)
Requests from renters for things they can't find ("Need a JCB in Pune next
week"). Linked in the navbar.

- **Browse** open requests (newest first), by category or search. Each shows
  what's needed, details, town, dates, budget, the poster's **first name only**
  and when it was posted.
- **"I have one"** (owners, needs login) - pick one of your available listings;
  a chat opens with the renter about that listing, with a short hello from you,
  and they get a notification. Once per listing per request.
- **Post what you need** (`/wanted/new`, needs login) - what, details,
  category, town, from/until dates, budget per day. An **AI writer** at the top
  fills the form from one sentence in any language ("JCB chahiye Pune me next
  week, budget 4000" → title, town, next Monday-Sunday, ₹4,000/day). After
  posting you see listings that may already match.
- **Rules**: up to 5 open requests each; each closes after 30 days (reopen for
  another 30); no phone numbers, UPI IDs or advance-payment talk (refused - replies
  happen in chat).
- **Your posts** at the top of the page - Close / Reopen / Delete.
- **AI matching** - when an owner publishes a new listing, the AI checks it
  against open requests and notifies the renters it could suit (once per
  listing). Publishing waits at most 8 seconds for this.

### Owner storefront
`/owner/:id` - an owner's public page with their listings and trust badges.

### Trust badges
On every listing page and storefront, from real activity: **Verified seller**
(passed seller verification), **Replies within an hour / a few hours / a day**
(median time to their first reply in their latest chats, once they've
answered at least two), **N rentals completed**, **★ rating from N reviews**
(across all their listings) and **On Rent It since <year>**. Listing cards
show a small **Verified seller** mark. Only a yes/no "verified" is ever
public, never a seller's actual verification status.

### How It Works / Why It Matters
Step-by-step guides for renters and owners, and why renting beats buying.

### Help / FAQ and the help assistant
FAQ page plus a chat bubble with an **AI help assistant**. It:
- answers questions about renting, listing, deposits, cancellations, fees,
  accounts and every feature on this page;
- replies **in the language you picked** with the language button;
- **when you're logged in, knows your own account** - your rentals (both ways),
  open offers and whose turn it is, your listings, seller verification status
  and problems you've reported - so it can answer "what's happening with my
  drill rental?". It only ever sees your own data (looked up from your login,
  never from what you type) and refuses to show anyone else's. It never books
  or changes anything - it tells you where on the site to do it.

### Terms of Service and Privacy Policy
Full pages at `/terms` and `/privacy`. A **terms gate** asks every visitor to
accept them before using the site (logged-in users once per terms version;
recorded as evidence in `terms_acceptances`).

---

## 2. Accounts

- **Sign up** with email and password; a confirmation email must be clicked
  before first login (can be re-sent).
- **Log in / log out**, **forgot password** (emailed reset link) and **reset
  password**.
- **Profile** - name, phone, avatar.
- **Favorites** - listings you've hearted.
- **Language** - the language you pick is remembered in the browser and on your
  account, so it follows you to other devices.

---

## 3. Renting something

1. **Find it** in the Marketplace (filters or a plain-language search).
2. **Send a request with your price** - dates plus the price per day you're
   offering (the listed price, less, or more).
3. **Bargain in chat** - the request lands in Messages as an **offer card**.
   Whoever didn't make the open offer can **Accept**, **Decline** or
   **Counter** (different price and/or dates). The first acceptance confirms
   the rental at those terms. Only one offer is open at a time.
4. **Price check while bargaining** - the offer form shows what items like this
   usually rent for (AI estimate, clearly labelled), any genuinely similar
   Rent It listings with their real prices, and whether the price being
   offered is below, within or above the usual range.
5. **Pick up, check and pay** - meet the owner (or get it delivered, where
   offered), check the item, and pay the owner directly. Rent It never takes
   payments and never asks for money in chat.
6. **Pickup and return photos** - either side can record the item's condition
   at pickup and at return.
7. **Report a problem** - on an agreed rental, either side can raise a
   dispute. The rental freezes (no status changes) for **15 days** while staff
   review it.
8. **Review** - rate the listing 1-5 with a comment (one review per listing;
   not your own). Anyone can flag a review for staff.

Deposits and cancellation policies are set by each owner and shown on the
listing.

---

## 4. Listing your equipment

- **Seller verification first** - owners submit ID documents once (uploaded to
  a private bucket; Rent It stores the files, not parsed Aadhaar/PAN numbers).
  Staff approve or reject them; automated checking via Digio can be switched
  on with API keys. Listing is blocked until approved.
- **List an Item** form - title, description, category, condition, price per
  day, optional **price per week** (used for 7+ day rentals) and **per month**
  (30+ days), location, **up to 8 photos** (first is the cover; "Make cover", remove), power source, delivery option, deposit (and amount),
  cancellation policy, owner type, accessories (and what's included),
  minimum rental period, supported durations.
- **AI listing writer** - at the top of the form: *"Describe your item and
  we'll fill in the form"*. Type a few words in any language (Hinglish too),
  e.g. "mahindra 575 tractor 2019, 45hp, achhi condition, trolley bhi saath me,
  ludhiana", and the title, description, category, condition, power source,
  accessories and location are filled in (in English). If photos are uploaded
  the AI looks at up to three of them too. Everything is checked against the form's real
  options; nothing is saved until you publish.
- **✨ Check my photos** - under the photos: the AI looks at them and marks any
  that are blurry, too dark, don't clearly show the item, have a phone number
  or contact details on them, look like a catalogue/stock photo, or show the
  item too small. Advice only - nothing is blocked.
- **Pin on map** (optional) - search a village or landmark, tap the map, or
  use your current location. The exact pin is visible only to you; renters
  see the area (about 1 km), and it puts the item on the Marketplace map and in
  "Nearby". It's stored in a separate table the public can't read.
- **Suggest a price** - under the price field: what items like this usually
  rent for in India (AI estimate with a one-line reason), genuinely similar
  Rent It listings with their real prices, and a **"Use ₹X"** button.
- **Availability** (on Edit listing) - block dates when the item isn't
  available (repairs, your own use) with a private note; "Make available"
  undoes it. Blocked dates can't be requested or accepted, and the
  "available today / this week" filters skip them. You can't block dates a
  renter already has an agreed booking for.
- **Edit / pause / delete** your listings from the Dashboard.

---

## 5. Messages (chat)

WhatsApp-style chat page at `/messages`, one thread per listing and renter.

- **Chat list** with the latest message, unread counts, and time.
- **Read receipts** (✓ sent, ✓✓ read) and an unread badge on the Messages nav
  link (shown once you're logged in, like Dashboard).
- **Offer cards** for every price offer, with Accept / Counter / Decline, and
  status lines ("Deal agreed", "Declined"…).
- **🎤 Voice messages** - with the message box empty, the mic records a voice
  note (up to 2 minutes; Delete or Send). It uploads to the private chat
  storage, the server writes out what was said (Groq Whisper) and translates
  that text into the other person's language before delivering it - so they
  get a playable recording **plus the words, in their language**. If nothing
  could be made out it still arrives as a recording. The notification reads
  "🎤 <what was said>".
- **"+" menu** - send **photos** (gallery or camera, up to 10 MB), **documents**
  (PDF, Word…, up to 20 MB) and a **location** (current location, search, or
  pin on a map). Attachments are private to the two people (and staff reviewing
  a dispute).
- **Chat translation** - everyone reads the other person's messages in the
  language **they** picked. A Hindi message shows in English to someone who
  picked English, with **"Translated from Hindi · Show original"** under it.
  Works between all 13 languages, including Hindi etc. typed in English
  letters. **Translated before delivery**: when you send, if the other person
  picked a different language, your message is translated first (≈0.2-0.3 s)
  and arrives already in their language - their notification too. If the
  translator is slow or down, the message is sent as typed after 8 seconds and
  translated when opened. Your own messages always show as you typed them.
- **Suggest replies** - one tap gives up to three short reply drafts in your
  language and script, based on the latest messages and where the offer
  stands. Tapping one fills the message box; nothing is sent automatically.
- **Scam warnings** - a warning appears under the other person's message if it
  asks for advance payment, an OTP / PIN / password, a QR scan "to receive
  money", or shares a UPI ID or a link.
- A reminder at the top of every deal: pay the owner at pickup, never in advance.

---

## 6. Notifications

- **Bell** in the navbar with unread count: new rental request, counter-offer,
  deal agreed, declined / completed / cancelled, a problem reported, new
  message (shown in your language), an owner replied to your Wanted post, a new
  listing may match your Wanted post, new listings for a saved search.
- **Reminders** (daily at 9:00 IST, once each): **pickup tomorrow** and **return
  due tomorrow** to both renter and owner of an agreed rental (with a safety
  tip - pay in person, take photos), and **"How was it?"** to the renter the day
  after a rental ends, unless they've already reviewed - it opens the listing
  at the review form.
- **Email** copies of every notification via Resend (when `RESEND_API_KEY` is set).

---

## 7. Your dashboard

`/dashboard` with four tabs:
- **My Listings** - your items, status, edit/delete.
- **My Rental Requests** - what you've asked to rent, with offered/agreed price.
- **Requests on My Items** - incoming requests, with pickup/return photos and
  "report a problem".
- **✨ Compare pickup and return photos** (under Photos, once both sets exist,
  for both people; staff also get it on each dispute) - the AI looks at up to 3
  pickup and 3 return photos and says "No visible change spotted", "Possible new
  damage" (with what it saw) or "Can't tell from these photos". A suggestion to
  check together, never a decision; saved and only redone when the photos
  change. Rental photos are resized in the browser before upload.
- **Saved searches** - searches saved with "Alert me" on the Marketplace; open
  or delete them.

**📄 Rental agreement** (`/rentals/:id/agreement`) - on every agreed,
completed or disputed rental, for both people: owner and renter names, item,
town, dates and days, agreed price per day, total, deposit, cancellation
policy, how many pickup/return photos were taken, and five plain terms (pay in
person at pickup, check and photograph together, renter looks after it, deposit
back less agreed damage, report problems on Rent It). Shown in **English plus
each person's chosen language**, one under the other. Only the fixed wording is
translated (through the site's translation cache) - names, prices and dates
never go to an AI. **Print / Save as PDF** uses the browser's print dialog
(navbar, footer and help bubble are hidden when printing).

---

## 8. Languages and translation

- **Language button** (top right, a short label like "EN" / "हि"): English plus
  **Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Malayalam,
  Odia, Punjabi, Assamese**. The menu lists each in its own script.
- **The whole site is translated** - menus, buttons, filters, listing titles
  and descriptions, the terms popup. Prices, numbers and brand names are kept.
  Digits always stay 0-9.
- **How**: text on screen is sent to the backend, translated by AI once per
  language and stored in `ui_translations`; every later visitor gets it
  instantly from there (and from their browser's own copy).
- **Pre-translation**: `node backend/scripts/pretranslate.js` translates the
  site's text (and every listing) into all languages ahead of visitors, paced
  for free-tier limits, retrying when the AI is busy, and redoing anything a
  backup model translated with the better one. Run it after adding pages or text.
- **Chat translation** - see [§5](#5-messages-chat).
- **Never translated**: what people type in chat (translated per reader
  instead), people's names, file names, the staff dashboard.
- If a translated language's longer labels don't fit the navbar, it switches to
  the menu button instead of overlapping.

---

## 9. AI features at a glance

| Feature | Where | AI used | What it receives |
|---|---|---|---|
| Site translation | Everywhere | Gemini, Groq as backup | Page text (public) |
| Chat translation | Messages | **Groq only** | Chat messages |
| Voice messages → text | Messages | **Groq only** (Whisper) | Your voice recording |
| Voice search | Marketplace | **Groq only** (Whisper), then the search AI | Your spoken search (not stored) |
| Suggested replies | Messages | **Groq only** | Recent chat messages, offer state |
| Help assistant | Help bubble | Groq | Your question; your own account summary when logged in |
| Listing writer | List an Item | Gemini (sees the photos), Groq as backup | Your notes and up to 3 listing photos |
| Price suggestion / price check | Listing form, offer form | Gemini, Groq as backup | Item details and same-category listings (public) |
| Plain-language search (incl. "near me", "within 5 km") | Marketplace | Gemini, Groq as backup | Your search sentence (never your location) |
| "No results" suggestions | Marketplace | Gemini, Groq as backup | Your search words |
| Rental agreement wording | Agreement page | Gemini, Groq as backup (cached once per language) | Only the fixed agreement wording - no names, prices or dates |
| Photo check | List an Item / Edit listing | **Gemini only** (the model that can see images) | Your listing photos (public anyway) and title |
| Review summary | Listing page → Reviews | Gemini, Groq as backup | The listing's written reviews and ratings (no reviewer names) |
| Wanted-post writer | Post what you need | Gemini, Groq as backup | The sentence you type |
| Wanted matching | When a listing is published | Gemini, Groq as backup | The new listing's title, description, town, and open Wanted posts' text (no names) |
| Listing safety review | Staff dashboard → Safety | Gemini, Groq as backup | Public listing text |
| Pickup/return photo compare | Dashboard → Photos; Staff → Disputes | **Groq only** (Qwen, which can see images) - private photos never go to Gemini | Up to 3 pickup + 3 return photos and the item's title |
| Dispute summary | Staff dashboard → Disputes | Gemini, Groq as backup | Rental records and the problem report, **no names, no chat** |

Common rules for all of them:
- **Every AI answer is checked in code** before anyone sees it (allowed values,
  sane numbers, no broken half-transliterated words, local numerals → 0-9).
- **Nothing is decided automatically** - the AI suggests, people choose
  (prices, replies, listing text, staff decisions).
- **Chats never go to Gemini's free tier** (its terms let Google use data);
  they go to Groq only.
- **Results are stored** so the same thing is never paid for twice
  (`ui_translations`, `message_translations`, `price_insights`,
  `listing_safety_reviews`, `rental_disputes.ai_summary`).
- **Fallbacks** - if Gemini is busy or rate-limited the next model is tried; if
  everything fails, the page works without the AI part.

---

## 10. Trust and safety

- **Seller verification** before anyone can list.
- **Listing safety review** - fixed rules (phone numbers, UPI IDs,
  advance-payment asks, OTP mentions, links) plus AI (impossible prices,
  courier-deposit tricks, prohibited items like weapons or medicines, fake or
  offensive text). Flagged listings wait for staff; nothing is removed
  automatically. Edited listings are reviewed again.
- **Chat scam warnings** (see [§5](#5-messages-chat)).
- **Disputes** with a 15-day freeze and staff resolution.
- **Review flagging** and moderation.
- **Client database writes are blocked** - the browser can only read; every
  change goes through the backend, which checks ownership and roles.
- **Rate limits** on every AI endpoint and app-wide.

---

## 11. Staff dashboard

`/admin` (staff only), in English, never sent for translation. Tabs:

- **Overview** - draggable widget grid: totals, pending verifications, charts
  of users, activity and listings by category.
- **Rental requests** - every rental, filterable by status.
- **Disputes** - open problems with the agreed terms and the report; **"Summarise
  with AI"** gives a neutral summary, key facts and what to check before
  deciding (from records only - never the chat - and it never picks a side).
  Resolve by siding with the owner (completed) or renter (cancelled).
- **Reviews** - moderation of flagged reviews (unflag or delete).
- **Seller verification** - approve / reject submitted documents.
- **Users** - roles (user / admin), ban / unban.
- **Listings** - remove or restore any listing.
- **Safety** - listings flagged by the safety review, most serious first, with
  "Remove listing" / "Looks fine". Opening the tab reviews new or edited listings.
- **Activity log** - every staff action.
- **Settings** - maintenance mode.

---

## 12. Privacy and data handling

- Payments never go through Rent It.
- AI providers receive only what the table in [§9](#9-ai-features-at-a-glance)
  lists; the Privacy Policy (`frontend/src/content/privacy.js`) says the same.
- Chat translations are stored per reader language and deleted with the message.
- **Locations**: a renter's location is rounded to ~1 km in the browser, used
  only to work out distances and never stored. A listing's exact map pin is
  kept in `listing_locations` (backend-only, no public access) and shown to
  anyone but its owner rounded to ~1 km. Map tiles and place search come from
  OpenStreetMap.
- KYC documents are in a private storage bucket, visible only to staff.
- Errors are reported to Sentry (when `SENTRY_DSN` is set).

---

## 13. Under the hood

- **Frontend**: React + Vite + Tailwind, React Router. Metal-ring navbar
  pills (metal-fx), dark theme, SEO tags + sitemap. Every page except Home is
  its own download (loaded when first opened), and Supabase / React / motion
  libraries are separate cached files.
- **Backend**: Node.js + Express as a Vercel serverless function (60 s limit).
- **Database / auth / storage**: Supabase (Postgres with row-level security).
  `backend/schema.sql` is the full, re-runnable schema:
  `cd backend && node scripts/run-migration.js`.
- **AI**: Gemini (`GEMINI_API_KEY`, optional) and Groq (`GROQ_API_KEY`) through
  the OpenAI SDK - `backend/src/lib/ai.js`, `translate.js`, and one file per
  feature in `backend/src/lib/`.
- **Tests**: `npx vitest run` in `backend/` and `frontend/`.
- **Deploy**: pushing to `main` redeploys both Vercel projects
  (frontend: renthere.in, backend: rent-it-api.vercel.app).
- **Daily job**: Vercel Cron calls `GET /api/cron/daily` at 03:30 UTC (9:00 IST)
  - `backend/vercel.json`. It runs saved-search alerts and rental reminders
  (`rental_reminders` makes each reminder send once, even if the job reruns). Protected by
  `CRON_SECRET` (set it in the backend's Vercel environment variables; without
  it the endpoint refuses every call and nothing runs).
- **Env vars**: see `backend/.env.example` and `frontend/.env.example`.

---

## Keeping this file up to date

Whenever a feature is added, changed or removed, update this file **and** add
an entry to [CHANGELOG.md](CHANGELOG.md) in the same commit. `CLAUDE.md` tells
Claude Code to do this automatically.
