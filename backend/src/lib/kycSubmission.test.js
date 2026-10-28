import { describe, it, expect } from 'vitest';
import { validateKycSubmission } from './kycSubmission.js';

const good = {
  full_name: '  Asha   Rao ',
  phone: '+91 98765-43210',
  address: '12 MG Road, Mysuru',
  id_document_url: 'u1/front.jpg',
  id_document_back_url: 'u1/back.jpg',
  address_proof_url: 'u1/proof.pdf',
};

describe('validateKycSubmission', () => {
  it('cleans a good submission', () => {
    expect(validateKycSubmission('u1', good).value).toEqual({ ...good, full_name: 'Asha Rao' });
    expect(validateKycSubmission('u1', { ...good, address_proof_url: '' }).value.address_proof_url).toBeNull();
  });

  it("refuses documents outside the seller's own folder", () => {
    for (const p of ['u2/front.jpg', 'u1/../u2/front.jpg', 'front.jpg', 42]) {
      expect(validateKycSubmission('u1', { ...good, id_document_url: p }).error).toBeTruthy();
      expect(validateKycSubmission('u1', { ...good, address_proof_url: p }).error).toBeTruthy();
    }
  });

  it('needs every required field', () => {
    for (const field of ['full_name', 'phone', 'address', 'id_document_url', 'id_document_back_url']) {
      expect(validateKycSubmission('u1', { ...good, [field]: '' }).error).toMatch(/required/);
    }
  });

  it('checks lengths and the phone number', () => {
    expect(validateKycSubmission('u1', { ...good, full_name: 'x'.repeat(101) }).error).toMatch(/name/);
    expect(validateKycSubmission('u1', { ...good, address: 'x'.repeat(501) }).error).toMatch(/address/);
    expect(validateKycSubmission('u1', { ...good, phone: 'call me' }).error).toMatch(/phone/);
  });
});
