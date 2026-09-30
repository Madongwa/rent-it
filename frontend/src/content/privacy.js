// Rent It Privacy Policy, as data for components/LegalDocument.jsx.
//
// Mirrors what the Platform actually collects and stores (see
// backend/schema.sql): accounts, listings, KYC documents, rentals and the
// offers behind them, chat messages and their photo/document/location
// attachments, notifications, read receipts, terms-acceptance records.
// Written with India's Digital Personal Data Protection Act, 2023 in mind,
// but it is a starting point, not legal advice - have it reviewed before
// relying on it, and fill in the company details in content/legal.js.

export const PRIVACY_SECTIONS = [
  {
    id: 'about',
    title: 'About this policy',
    body: [
      'This Privacy Policy explains how {{legalName}} ("Rent It", "we", "us") collects, uses, shares, stores and protects your personal data when you use the Rent It website at {{website}} and related services (the "Platform"), and the rights you have. It forms part of our Terms of Service. We are the "Data Fiduciary" for your personal data under the Digital Personal Data Protection Act, 2023 ("DPDP Act").',
      'By accepting our Terms and this Policy, you consent to the processing described here for the purposes described here. You can withdraw consent at any time (see "Your rights"), though some features cannot work without the data they need.',
    ],
  },
  {
    id: 'what-we-collect',
    title: 'Personal data we collect',
    body: [
      { heading: 'Data you give us' },
      {
        list: [
          'Account data: your name, email address, password (stored only in hashed form by our authentication provider), and optionally your phone number and profile photo.',
          'Listing data: photos, descriptions, condition, price, deposit, location or area, and other details of Items you list.',
          'Seller verification (KYC) data: a photo of the front and back of the identity document you choose to submit, an optional proof of address, the name, phone number and address you enter, and the verification result. We do not store your identity-document number as separate text.',
          'Rental data: your Requests, every Offer and counter-offer (dates and prices), accepted Deals, cancellations, disputes and their resolution, and pickup/return condition photos.',
          'Chat data: the messages you send and receive, and anything you send from the "+" menu - photos (including camera photos), documents (such as PDFs or Word files) and locations you choose to share (coordinates and any place name).',
          'Reviews, ratings, reports and flags you submit, and messages you send to our support assistant or to us.',
          'Searches you save to be alerted about, and Wanted posts you create.',
        ],
      },
      { heading: 'Data created when you use the Platform' },
      {
        list: [
          'Terms-acceptance records: the version of the Terms and Privacy Policy you accepted, when you accepted, and your browser\'s user-agent string - kept as evidence of your consent.',
          'Read receipts: how far you have read each conversation, used to show unread counts and "read" ticks to you and the other person.',
          'Notifications we send you, favourites you save, and a log of actions taken by Staff.',
          'Technical data: session tokens that keep you signed in, and error reports (which may include your browser type and the page you were on) when something goes wrong.',
        ],
      },
      { heading: 'What we do not collect' },
      {
        list: [
          'We do not track your location in the background. Your device\'s location is only read when you choose "Send my current location" or "Show my location on the map" in the Chat, and only with your browser\'s permission.',
          'We do not collect or process your bank, card or UPI details - payments happen directly between Users.',
          'We do not use advertising trackers or sell your data.',
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: 'How and why we use your data',
    body: [
      {
        list: [
          'To create and run your account and keep you signed in.',
          'To publish Listings and show them to other Users.',
          'To let Users send Requests, bargain with Offers, form Deals and manage Rentals.',
          'To deliver your Chat messages, photos, documents and locations to the other person, and show unread counts and read ticks.',
          'To verify the identity of Owners before they can list Items, and to prevent fraud.',
          'To investigate reports and review disputes, including by looking at the Rental record, Offers, condition photos and the relevant Chat.',
          'To send you notifications and emails about your account, Offers, messages and Rentals.',
          'To keep the Platform secure, detect and fix errors, and prevent abuse.',
          'To keep records of your consent and to comply with legal obligations, lawful requests from authorities, and our Terms.',
        ],
      },
      'We process your data on the basis of your consent and, where the DPDP Act allows, for legitimate uses such as complying with the law, responding to legal proceedings, and handling emergencies involving a threat to life or health.',
    ],
  },
  {
    id: 'what-others-see',
    title: 'What other Users can see',
    body: [
      {
        list: [
          'Everyone can see your name, profile photo and your published Listings (including their photos and area).',
          'The other person in a conversation can see everything in that conversation - messages, Offers, photos, documents and any location you share - and whether you have read their messages.',
          'Your identity documents, phone number, email address and address are never shown to other Users by us. Anything you choose to type or send in a Chat, however, is visible to the other person.',
        ],
      },
    ],
  },
  {
    id: 'kyc',
    title: 'Identity documents get special handling',
    body: [
      'Identity and address-proof documents are stored in a private, access-restricted storage area - separate from public listing photos - and are never shown to other Users. They can be viewed only by you, by Staff reviewing your verification or a dispute, and, where automated verification is used, by our identity-verification provider for that check.',
      'Aadhaar is optional. If you use it, we recommend a masked Aadhaar showing only the last four digits. We do not perform Aadhaar authentication.',
    ],
  },
  {
    id: 'chat-attachments',
    title: 'Chat photos, documents and locations',
    body: [
      'Photos and documents you send in a Chat are stored in a private storage area that only the two people in that conversation (and Staff, for safety and dispute review) can open, using short-lived links. Large photos may be resized in your browser before upload.',
      'Photos can contain information embedded by your camera, such as where and when they were taken. Please check before sending.',
      'When you share a location, only the coordinates and the place name you send are stored with the message. To show maps and search for places, your browser loads map images from OpenStreetMap and sends your search text or the pinned coordinates to OpenStreetMap\'s place-search service (Nominatim); opening a shared location opens Google Maps. Those services receive your IP address and the requested area under their own privacy policies.',
    ],
  },
  {
    id: 'locations',
    title: 'Your location and listing map pins',
    body: [
      'If you choose to use "Nearby" or "Nearest to me" on the Marketplace, your browser asks for your location. It is rounded to about 1 km on your device, sent only to our server to work out distances, and is not stored; your browser remembers it only until you close the tab, and "Stop using my location" forgets it sooner. It is never sent to our AI providers.',
      'If you add a map pin to a Listing, the exact pin is stored in a restricted area only our server can read. Other Users see only the approximate area (about 1 km) and their distance from it; you see the exact pin when editing your Listing. The Marketplace map and pin editor load map images from OpenStreetMap and send place searches to OpenStreetMap\'s Nominatim service, which receive your IP address and the requested area under their own privacy policies.',
    ],
  },
  {
    id: 'wanted',
    title: 'Wanted posts',
    body: [
      'A Wanted post is public: anyone can see what you asked for, the details, town, dates and budget you gave, and your first name - never your full name or contact details. It closes after 30 days or when you close it, and you can delete it at any time. When an Owner replies, a Chat opens between you like any other.',
    ],
  },
  {
    id: 'sharing',
    title: 'Whom we share data with',
    body: [
      'We do not sell or rent your personal data. We share it only as follows:',
      {
        list: [
          'With other Users, as described in "What other Users can see".',
          'With service providers who process data on our behalf to run the Platform: database, authentication and file storage; website and server hosting; email delivery; identity verification; error monitoring; and the AI providers behind our support assistant, automatic translation (including chat translation), search, listing writer, price suggestions and safety checks (which receive the messages you type to the assistant and, when you are logged in, a summary of your own rentals, offers and listings so it can answer questions about them; the text of pages you view in a language other than English; searches you describe in your own words on the Marketplace, and the words of a search that found nothing (to suggest others); what you write in a Wanted post, and the text of open Wanted posts together with a newly published listing (to tell renters it may suit them); listing details and photos, to help write listings, suggest prices and check listings for scams; and, when our staff review a reported problem, the rental records and your report, without names; and chat messages, so the person you are chatting with can read them in the language they chose, and so you can get suggested replies - chat messages are sent only to Groq, not to our other AI providers). They may use the data only to provide their service to us.',
          'With law enforcement, courts, regulators or government agencies, where required by law or a valid order, or where needed to prevent or investigate fraud, crime or harm to any person.',
          'With a buyer or successor if our business is merged, acquired or sold, subject to this Policy.',
        ],
      },
      'Some of these providers store or process data on servers outside India. Where they do, we rely on them to protect it to a standard consistent with this Policy, and transfers are made only to countries not restricted by the Government of India under the DPDP Act.',
    ],
  },
  {
    id: 'security',
    title: 'How we protect your data',
    body: [
      'We use access controls at every layer: row-level security in our database so each person can only read what they are entitled to, a backend that performs all changes and checks permissions, private storage for identity documents and chat attachments with short-lived access links, and encrypted connections (HTTPS). Staff access is limited to what their role needs and is logged.',
      'No system is completely secure. If we become aware of a personal data breach, we will notify affected Users and the Data Protection Board of India as the DPDP Act requires, and take steps to contain it.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    body: [
      {
        list: [
          'Account, Listing, Rental, Offer and Chat data (including attachments) are kept while your account is active and for as long as needed to provide the Platform, resolve disputes and enforce our Terms.',
          'After you close your account, we delete or anonymise your personal data within a reasonable time, except where we must keep it longer - for example, information collected for registration is kept for 180 days after an account is cancelled as required by the IT Rules, records relating to a dispute or investigation are kept until it is resolved, and records may be kept longer where a law, court or authority requires.',
          'Terms-acceptance records are kept for as long as they may be needed as evidence of consent.',
          'Messages you have sent remain visible to the other person in that conversation unless removed, because they form part of their records too.',
        ],
      },
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: [
      'Under the DPDP Act and other Applicable Law, you have the right to:',
      {
        list: [
          'obtain a summary of the personal data we process about you and the processing activities, and the identities of those we have shared it with;',
          'have inaccurate or incomplete data corrected or completed, and have your data updated;',
          'have your data erased when it is no longer needed for the purpose it was collected for, unless we must keep it by law;',
          'withdraw your consent at any time, as easily as you gave it - this will not affect processing already carried out, and some features will stop working;',
          'have a readily available means of grievance redressal;',
          'nominate another person to exercise your rights if you die or become incapacitated.',
        ],
      },
      'You can update much of your information yourself in your profile. For anything else, contact our Grievance Officer at {{grievanceEmail}}. We may need to verify your identity before acting on a request. If you are not satisfied with our response, you may complain to the Data Protection Board of India.',
    ],
  },
  {
    id: 'browser-storage',
    title: 'Cookies and browser storage',
    body: [
      'We do not use advertising or tracking cookies. We use your browser\'s storage to keep you signed in, to remember that you accepted the Terms during the current visit, and for small conveniences such as the layout of the staff dashboard. Clearing your browser storage resets these.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    body: [
      'The Platform is only for people aged 18 and over. We do not knowingly collect personal data from anyone under 18, and we do not track or target advertising at children. If we learn that we hold a child\'s data, we will delete it and close the account.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: [
      'We may update this Policy. The "Last updated" date shows the latest version, and if we make a material change we will ask you to review and accept it when you next open the Platform.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact and grievances',
    body: [
      'Grievance Officer: {{grievanceOfficer}}, {{grievanceEmail}}, {{grievancePhone}}, {{address}}. We acknowledge complaints within 24 hours and aim to resolve them within 15 days. General questions: {{supportEmail}}.',
    ],
  },
];
