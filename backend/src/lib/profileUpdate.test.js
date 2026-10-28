import { describe, it, expect } from 'vitest';
import { validateProfileUpdate } from './profileUpdate.js';

const me = { full_name: 'Asha Rao', phone: null };

describe('validateProfileUpdate', () => {
  it('cleans a name and phone', () => {
    expect(validateProfileUpdate({ full_name: '  Asha   R ', phone: ' +91 98765 43210 ' }, me).updates).toEqual({
      full_name: 'Asha R',
      phone: '+91 98765 43210',
    });
    expect(validateProfileUpdate({ phone: '' }, me).updates).toEqual({ phone: null });
  });

  it('refuses empty, over-long and staff-looking names', () => {
    expect(validateProfileUpdate({ full_name: '  ' }, me).error).toBeTruthy();
    expect(validateProfileUpdate({ full_name: 42 }, me).error).toBeTruthy();
    expect(validateProfileUpdate({ full_name: 'x'.repeat(101) }, me).error).toMatch(/too long/);
    for (const name of ['Rent It Support', 'RentIt Team', 'rent-it', 'Official Help', 'Customer Support']) {
      expect(validateProfileUpdate({ full_name: name }, me).error).toMatch(/can't include/);
    }
  });

  it('locks the name on an ID-verified account, but allows re-saving it unchanged', () => {
    expect(validateProfileUpdate({ full_name: 'Someone Else' }, me, { idVerified: true }).code).toBe(403);
    expect(validateProfileUpdate({ full_name: 'Asha Rao', phone: '9876543210' }, me, { idVerified: true }).updates).toEqual({ phone: '9876543210' });
  });

  it('refuses a bad phone number', () => {
    expect(validateProfileUpdate({ phone: 'call me maybe' }, me).error).toMatch(/phone/);
    expect(validateProfileUpdate({ phone: '1'.repeat(25) }, me).error).toMatch(/phone/);
  });
});

describe('validateProfileUpdate - email setting', () => {
  it('takes a true/false email setting', () => {
    expect(validateProfileUpdate({ email_notifications: false }, me).updates).toEqual({ email_notifications: false });
    expect(validateProfileUpdate({ email_notifications: 'no' }, me).error).toBeTruthy();
  });
});
