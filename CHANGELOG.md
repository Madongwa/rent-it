# Changelog

What changed on Rent It, newest first. Every change to a feature gets an
entry here (and [FEATURES.md](FEATURES.md) is updated to match) in the same
commit. Dates are when the change was pushed to `main`, which deploys it.

## 2026-09-30

- **Home, How It Works and Help/FAQ brought up to date** - they now describe
  Nearby and the map, voice and plain-language search, Wanted posts, alerts,
  reminders, the written agreement, trust badges, voice messages and every AI
  helper (with what they do and don't see). The help assistant knows about all
  of it too.
- **Staff Insights** - a new Staff tab: chat → request → deal funnel, top
  searches, and searches that found nothing (what people want but nobody
  lists), over the last 30 days.
- **Your earnings** on the Profile page for owners - earned so far, coming up,
  most-rented item, a month-by-month chart and a by-item list (agreed rent,
  deposits excluded).
- **AI help for staff checking IDs** - an optional "AI check" on each seller
  application: real-looking ID, readable, name matches, document type. It
  never reads out ID numbers, stores nothing and staff still decide. Groq
  only. Privacy Policy updated.
- **💡 Tips for owners** - Dashboard → My Listings → Tips: what to improve on
  each listing, how many recent searches match it, and an AI seasonal hint
  (e.g. "tractor demand in Punjab rises before rabi sowing"). Searches are now
  logged anonymously for this (kept 90 days). Privacy Policy updated.
- **"Renters say…" review summaries** - listings with 3+ written reviews show
  a one-line AI summary with what renters liked and didn't.
- **Compare pickup and return photos** - the AI points out visible new damage
  (or says it sees none, or can't tell) for the renter, owner and staff. A
  suggestion only; private photos go to Groq only. Privacy Policy updated.
- **Check my photos** - on the listing form, the AI points out photos renters
  won't like (blurry, dark, not the item, contact details, stock photos).
  Advice only.
- **Voice messages** - record a voice note in chat (up to 2 minutes); the other
  person gets the recording plus what was said, written out and translated
  into their language. **Voice search** on the Marketplace - speak instead of
  typing. Both use Groq's Whisper (never Gemini). Privacy Policy updated.
- **Rental agreement** - every agreed rental gets a printable agreement (items,
  dates, price, total, deposit, terms) in English and both people's languages,
  from "📄 Agreement" on the Dashboard; "Print / Save as PDF" makes a PDF.
- **Reminders** - "Pickup tomorrow" and "Return due tomorrow" notifications to
  both people on an agreed rental, and a "How was it?" review nudge to the
  renter the day after it ends (sent each morning, once each).
- **Saved searches and alerts** - "Alert me" on the Marketplace saves a search;
  every morning (9:00 IST) you get a notification if new listings match it.
  Manage them under Dashboard → Saved searches. Needs `CRON_SECRET` set on the
  backend in Vercel for the daily run.
- **Wanted posts** - renters post what they need ("Need a JCB in Pune next
  week") at /wanted; owners tap "I have one", pick a listing, and a chat opens.
  An **AI writer** fills the post from one sentence in any language, and **AI
  matching** tells renters when a newly published listing could suit their
  request. Posts show the first name only and close after 30 days.
- **"No results" helper** - when a Marketplace search finds nothing, the AI
  suggests other words that do have listings, and offers to post a Wanted
  request. Privacy Policy updated.
- **Marketplace clean-up** - "Trending" works (most requested and saved in the
  last 30 days); the greyed-out "Same-Day Pickup", "Instant book" and
  "Subcategory" placeholders are gone; phones get a Sort menu next to Filters.
- **Messages link** only shows once you're logged in.
- **Home page** - the made-up statistics (6 weeks, 80%, 13 minutes) are
  replaced with plain wording.
- **Faster first load** - each page downloads only when it's opened.
- **"Near me" search and a Marketplace map** - the Nearby pill (and "Nearest
  to me" sort) ask for your location and show the closest items first, with
  "3.2 km away" on every card and listing page; the distance filter now
  measures from you. A List / Map switch shows matching listings as pins.
  Owners can add an optional **map pin** on List an Item / Edit listing.
  Privacy: your location is rounded to ~1 km and never stored; renters only
  ever see a listing's area (~1 km), never the exact spot. Plain-language
  search understands "near me" and "within 5 km". Privacy Policy updated.
- **"Verified Owners" filter and "Rating: high to low" sort** now work on the
  Marketplace (both were greyed out as "coming soon").

## 2026-09-29

- **Trust badges** - verified seller, typical reply time, rentals completed,
  overall rating and member-since year on listing pages and storefronts; a
  "Verified seller" mark on listing cards.
- **Owner availability calendar** - owners block dates (repairs, own use) on
  Edit listing; those dates can't be requested or accepted, the availability
  filters skip them (now also counting agreed bookings), and the listing page
  shows an availability calendar of booked and blocked dates.
- **Weekly and monthly prices** - owners can set cheaper weekly/monthly prices;
  a rental of 7+ days uses the weekly rate (30+ the monthly) as its listed
  price, and the offer form says so.
- **Several photos per listing** - up to 8, uploaded together; the first is
  the cover ("Make cover", remove). The listing page shows them as a gallery
  with arrows and thumbnails, and the AI listing writer looks at up to 3.
- **Help assistant knows your account and speaks your language** - replies in
  the language picked with the language button; when logged in it can answer
  about your own rentals, offers (and whose turn it is), listings, seller
  verification and reported problems - looked up from your login only, so it
  can't show anyone else's data.
- **Suggested chat replies** - "Suggest replies" drafts up to three short
  replies in your language and script; tapping one fills the message box.
  Groq only; drafts with contact/payment details or advance-payment asks are dropped.
- **Chat: translate first, deliver second** - a message is translated into the
  recipient's language before it's delivered (≈0.2-0.3 s), so it arrives
  already translated, notification included. Sent as typed after 8 s if the
  translator is slow.
- **Chat translation** - each person reads the other's messages in their own
  language, with "Show original". Groq only (never Gemini's free tier).
  Privacy Policy updated.
- **Plain-language search** on the Marketplace, plus a new "Near <town>" filter.
- **AI listing writer** on List an Item (notes in any language, plus the photo).
- **AI dispute summaries** for staff, from the rental's records - never the chat.
- **Navbar fixes** - no logo overlap; all 8 links (Home … Staff) are identical
  metal pills; Dashboard/Staff only render when they apply (fixed them showing
  over the logo for logged-out visitors); bell sized to match; burger menu when
  a translated navbar doesn't fit; React StrictMode removed so the metal halo
  also shows in local development.

## 2026-09-28

- **Safety checks** - rule + AI review of every listing, shown to staff in a
  new Safety tab (remove / looks fine); scam warnings under risky chat messages.
- **AI price help** - "Suggest a price" on the listing form; a price check in
  the offer / counter-offer form.
- **Language button** - the site in English and 12 Indian languages, translated
  by AI (Gemini first, Groq as backup) and stored; pre-translation script.

## 2026-09-27

- Chat attachments (photos, documents, location) via a "+" menu.
- Accept-the-terms gate; full Terms of Service and Privacy Policy pages.
- Browser can no longer write to the database directly - all writes go through
  the backend.
- WhatsApp-style Messages page in the nav, with unread counts and read receipts.
- Fixed booking races and dropped notifications.
- **Replaced Razorpay payments with in-chat price offers and counter-offers** -
  no money moves through the app any more.

## 2026-09-24

- Razorpay checkout error messages and receipt fixes (since replaced by offers).
- Fixed the "Message the owner" button on Listing Detail.

## 2026-09-19

- Staff Overview as a draggable widget grid with real data.
- Razorpay payments, Digio KYC document checks, email notifications (Resend),
  Sentry error tracking and CI.

## 2026-09-17

- Notifications, staff user and listing management, dark theme, SEO.
- Home hero, navbar and typography redesign.

## 2026-09-12 - 2026-09-14

- Core marketplace: rentals, favorites, messaging, reviews.
- Seller verification (KYC), staff admin panel, rental disputes.
- Help/FAQ page with an AI support chatbot (Groq).
- Password reset flow and email templates.
- Marketplace filters (pill bar + sidebar) and a rebuilt Listing Detail with
  reviews and rental history; How It Works and Why It Matters pages.
- Allowed Vercel preview URLs through CORS.

## 2026-09-06 - 2026-09-11

- First version of Rent It; deployable to Vercel (frontend + serverless backend).
- Rebrand, dark Home, category expansion, prices in ₹ and Indian locations,
  redesigned login/signup with a demo account.
