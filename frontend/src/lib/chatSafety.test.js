import { describe, it, expect } from 'vitest';
import { chatWarnings } from './chatSafety';

const ids = (text) => chatWarnings(text).map((w) => w.id);

describe('chatWarnings', () => {
  it('spots the common rental scams, in English and Hinglish', () => {
    expect(ids('Please pay 500 token amount first')).toEqual(['advance']);
    expect(ids('bhai pehle payment karo phir milega')).toEqual(['advance']);
    expect(ids('Send me the OTP you got')).toEqual(['otp']);
    expect(ids('Scan this QR to receive money')).toEqual(['qr']);
    expect(ids('pay on ravi.k@okaxis')).toEqual(['upi']);
    expect(ids('photos here https://example.com')).toEqual(['link']);
  });

  it('can give more than one warning', () => {
    expect(ids('Pay in advance to ravi@ybl and share OTP')).toEqual(['advance', 'otp', 'upi']);
    expect(ids('Send advance payment today')).toEqual(['advance']);
  });

  it('stays quiet on normal messages', () => {
    for (const text of ['Is it free on Saturday?', 'Can you do ₹1,200 a day?', 'kal subah 7 baje milega?', 'My email is a@gmail.com', 'Can I book in advance for next Saturday?', '']) {
      expect(ids(text)).toEqual([]);
    }
  });
});
