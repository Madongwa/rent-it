// Safety warnings under the other person's chat messages - plain rules run
// in the browser, so no chat text is ever sent anywhere to be checked (the
// Privacy Policy promises chats never go to the AI). Covers the common
// rental scams: paying before seeing the item, OTP/PIN theft, "scan this QR
// to receive money", and moving the payment outside Rent It. Kept in step
// with the listing rules in backend/src/lib/safety.js.

const RULES = [
  {
    id: 'advance',
    // A payment context, not just "advance": "can I book in advance?" is fine.
    test: /\b(?:advance (?:payment|amount|money|rent|paise)|pay(?:ment)? (?:in )?advance|pay(?:ment)? first|token (?:amount|money)|booking amount|pehle (?:payment|paise|pay))\b/i,
    warning: 'Asks for payment in advance. Pay only at pickup, once you have seen the item.',
  },
  {
    id: 'otp',
    test: /\b(?:otp|upi pin|atm pin|cvv|password)\b/i,
    warning: 'Mentions an OTP, PIN or password. Never share these - no real owner or renter needs them.',
  },
  {
    id: 'qr',
    test: /\b(?:scan|send|share)\b.{0,30}\bqr\b|\bqr\b.{0,30}\b(?:receive|get) (?:money|payment|the payment)\b/i,
    warning: 'Mentions a QR code. Scanning a QR code only ever sends money - you never scan one to receive it.',
  },
  {
    id: 'upi',
    test: /\b[\w.-]{2,}@(?:okaxis|oksbi|okhdfcbank|okicici|ybl|paytm|upi|ibl|axl|apl|fbl)\b/i,
    warning: 'Shares a UPI ID. Pay only in person at pickup, after checking the item.',
  },
  {
    id: 'link',
    test: /https?:\/\/|\bwww\.|\bbit\.ly\b|\bwa\.me\b/i,
    warning: "Has a link. Don't enter payment or login details on a page you reached from a chat.",
  },
];

// The warnings (in rule order, each at most once) for one message's text.
export function chatWarnings(text) {
  if (!text) return [];
  return RULES.filter((r) => r.test.test(text)).map(({ id, warning }) => ({ id, warning }));
}
