import { describe, it, expect, vi } from 'vitest';
import { checkIdDocuments, validateIdCheck } from './idCheck.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

describe('validateIdCheck', () => {
  it('keeps only the checks, and scrubs any numbers that slip through', () => {
    expect(
      validateIdCheck({
        looks_like_id: 'yes',
        readable: 'yes',
        name_match: 'match',
        document_type: 'aadhaar',
        issues: ['Number 1234 5678 9012 visible', 'Slight glare'],
        id_number: '123456789012',
      })
    ).toEqual({
      looks_like_id: 'yes',
      readable: 'yes',
      name_match: 'match',
      document_type: 'aadhaar',
      aadhaar_number_visible: false,
      issues: ['Number [number removed] visible', 'Slight glare'],
    });
    expect(validateIdCheck({ looks_like_id: 'yes', aadhaar_number_visible: true }).aadhaar_number_visible).toBe(true);
    expect(validateIdCheck({ looks_like_id: 'yes', aadhaar_number_visible: 'yes' }).aadhaar_number_visible).toBe(false);
    expect(validateIdCheck({ looks_like_id: 'maybe' })).toBeNull();
  });
});

describe('checkIdDocuments', () => {
  const kyc = { user_id: 'u1', full_name: 'Asha Rao', id_document_url: 'u1/front.jpg', id_document_back_url: 'u1/back.pdf' };
  const db = (files) => ({
    storage: { from: () => ({ download: async (p) => ({ data: files[p] ? new Blob([files[p].bytes], { type: files[p].type }) : null }) }) },
    from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: kyc }) }; return q; },
  });
  const model = (reply, calls = []) => [
    { model: 'qwen-test', vision: true, client: { chat: { completions: { create: async (a) => (calls.push(a), { choices: [{ message: { content: JSON.stringify(reply) } }] }) } } } },
  ];

  it('sends only readable images, with the applicant name', async () => {
    const calls = [];
    const out = await checkIdDocuments('u1', {
      db: db({ 'u1/front.jpg': { bytes: new Uint8Array([1, 2]), type: 'image/jpeg' }, 'u1/back.pdf': { bytes: new Uint8Array([1]), type: 'application/pdf' } }),
      models: model({ looks_like_id: 'yes', readable: 'yes', name_match: 'match', document_type: 'pan', issues: [] }, calls),
    });
    expect(out.result).toMatchObject({ name_match: 'match', document_type: 'pan', sides_checked: 1 });
    expect(calls[0].messages[1].content[0].text).toContain('Asha Rao');
    expect(calls[0].messages[1].content.filter((c) => c.type === 'image_url')).toHaveLength(1);
  });

  it('explains when there is nothing it can read', async () => {
    const out = await checkIdDocuments('u1', { db: db({ 'u1/back.pdf': { bytes: new Uint8Array([1]), type: 'application/pdf' } }), models: model({}) });
    expect(out.status).toBe(400);
  });
});
