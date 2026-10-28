# Changelog

What changed on Rent It, newest first. Every change to a feature gets an
entry here (and [FEATURES.md](FEATURES.md) is updated to match) in the same
commit. Dates are when the change was pushed to `main`, which deploys it.

## 2026-10-03

- **Translation store guarded** - anyone could make the site translate and
  permanently store any text they liked. Visitor requests now save at most
  5,000 new translations a day (the shared rate limits also apply); past
  that, text is still translated, just not saved.
- **Fewer emails** - a busy chat used to send an email for every single
  message. Now you get one email per chat until you've read it. There's also a
  new "Email me notifications" switch on the Profile page (in-app
  notifications always arrive), and every email links to it.
- **Limits that actually hold** - limits like "5 sign-ups an hour" and the
  caps on AI features were counted separately on each of Vercel's servers, so
  they were much looser than intended. They're now counted in one place.
- **Faster chat list** - the Messages list and its unread badge are now worked
  out in the database instead of loading every message ever sent, so they stay
  quick as chats grow.
- **Review reports stay private** - listing pages no longer reveal who
  reported a review, or why; only staff see that.
- **Names you can trust** - names can no longer pose as Rent It ("Rent It
  Support", "official"...), at sign-up or on the Profile page, and an
  ID-verified account can't change its name any more (the "ID verified" badge
  would otherwise stay on a name that was never checked). The Profile page no
  longer claims your phone is shown to the other person - it never was; only
  staff can see it.
- **India time everywhere** - the booking calendar, "available today / this
  week" filters and blocked dates used UTC, so between midnight and 5:30 am
  "today" was still yesterday. Staff stats ("new today", "this week", the
  activity heatmap) now count in India time too, and the staff overview's
  "pending verification" count includes applications waiting for a person.
- **Sensible rental dates** - requests and counter-offers can no longer be for
  dates in the past, start more than a year ahead, or run longer than a year
  (only the form checked before). An offer whose start date has passed can't
  be accepted; counter with new dates instead.
- **Maintenance mode actually works** - the switch on the staff Settings tab
  used to do nothing. Now, while it's on, people can still browse and search,
  but changes (requests, messages, listings, sign-ups) are paused with a clear
  message and a banner on every page. Staff can keep working as normal.
- **You hear back from staff** - when staff decide a reported problem, both
  people now get a notification (and a line in their chat) saying how it was
  closed. Sellers are notified when their verification is approved, or
  rejected with the reason. Two staff can no longer resolve the same problem
  at once.
- **Problems can be reported after completion** - "Report a problem" now also
  works for a week after a rental's end date even if it was marked complete, so
  an owner can't mark it complete to stop a renter reporting (say, a deposit not
  returned). A double click can no longer create two reports.
- **Booked listings stay bookable** - agreeing a deal used to mark the listing
  "rented" straight away, hiding it from the Marketplace and refusing every other
  request even when the booking was months off. Now a booking only blocks its
  own dates; the listing shows "Rented today" only while it's actually out, and
  other dates can still be requested.
- **Rentals finish on their own** - an agreed rental nobody marked complete is
  completed automatically 7 days after its end date (unless a problem was
  reported), so listings no longer get stuck as "rented" forever.
- **Sturdier help assistant** - if the AI is slow it now gives up after 25
  seconds with the usual "try again" message instead of hanging, and the
  conversation history the page sends is checked (bad entries are dropped and
  each message is capped), so the assistant can't be fed huge or broken input.
- **Seller verification checks its documents** - an application must now use
  ID photos the seller uploaded themselves (it could name someone else's
  uploaded files before), the files must really exist, and the name, phone and
  address are checked for sensible lengths and a valid phone number.
- **Listing photos must be your own uploads** - new listing photos have to be
  uploaded from your device (resized in the browser so they load faster); links
  to images elsewhere on the web are no longer accepted, since they could track
  who views a listing. Photos already on listings are kept. Photo and ID
  uploads are now limited to 10 MB and image files (PDF too for ID documents),
  and nobody can upload into another person's photo folder.
- **Private profile details locked down** - the site's public database key could
  read every account's role (who the staff are), seller and ID verification
  status, and phone number. Now it can only read name, photo and join date;
  everything else goes through the server, which already showed only what
  each page needs.
- **Listings with a booking or a reported problem can't be deleted** - deleting
  a listing also deletes its rentals and chats, so an owner could have wiped a
  dispute. Now delete is refused while a booking is agreed or once a problem
  was reported on it; pausing hides it instead.
- **Rental photos can't be tampered with** - pickup and return photos can now
  only be added, never removed or swapped, and only while the rental is agreed.
  Once a problem is reported (or the rental is completed or cancelled) they're
  locked, and pickup photos lock once return photos exist - so the evidence
  staff look at in a dispute is what was actually taken at the time.
- **Only real renters can review** - a listing can now be reviewed only by
  someone who rented it (a completed rental, or an agreed one that has ended),
  so owners can't pad their ratings with new accounts. Existing reviews stay.
  Reviews are capped at 2,000 characters.
- **Safer notification emails** - anything people type (chat messages, names,
  listing titles) now shows up in emails as plain text. Before, a chat message
  could slip its own links or formatting into an email sent from Rent It.
- **Staff takedowns now stick** - when staff remove a listing, the owner can no
  longer just switch it back on from their Dashboard (it shows "Removed by Rent
  It staff"), it can't be booked, and its page stops opening for anyone but the
  owner. Banning someone takes their listings down too (unbanning lifts that,
  leaving them paused), and rejecting a seller's verification pauses their
  listings until they're verified again.

## 2026-10-01

- **New logo** - the Rent It logo (purple ring with a tool) is now the browser-tab
  icon (there wasn't one before) and replaces the 🛠️ emoji next to "Rent It"
  in the navbar.
- **Continue with Google** - log in or sign up with a Google account (instant,
  with your Google name and photo). The button appears as soon as Google is
  switched on in the Supabase dashboard. Privacy Policy updated.
- **Renter ID verification** - renters verify one government ID (masked
  Aadhaar, driving licence, voter ID, PAN or passport) when a deal is agreed,
  or before requesting items whose owner ticked "Only ID-verified renters".
  Clear IDs are verified within a minute by an AI check; unclear ones go to
  staff; full Aadhaar numbers are refused and the photo deleted. Owners see an
  "ID verified" badge, never the document. Privacy Policy updated.
- **Instant sign-up** - new accounts work straight away: you're logged in as
  soon as you sign up, with no confirmation email to wait for (those emails
  often didn't arrive). One account stuck waiting since 17 September was let in.
- **Even listing cards** - every card in a Marketplace row (and on Favorites and
  owner pages) is now the same height, with titles, towns and prices lined up,
  whether or not a listing has "Verified seller", a rating or a town. Long
  category names and towns are cut short with "…" instead of wrapping, and
  "Rented"/"Paused" now sits with the tags instead of under the price.
- **Sample Wanted posts** - six example requests (one per category, from
  three sample renter accounts) so the Wanted page isn't empty; most have a
  matching sample listing nearby. Re-runnable with
  `node backend/scripts/seed-wanted-posts.js`.

## 2026-09-30

- **Sharper "no results" suggestions** - words whose listings are a different
  kind of thing (e.g. a patient lift for someone searching for a crane) are no
  longer suggested.
- **Help assistant accuracy** - it describes voice messages, voice search and
  the earnings page exactly as they work, and no longer guesses at buttons or
  pages it hasn't been told about.
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
