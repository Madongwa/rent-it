import { describe, it, expect, vi } from 'vitest';
import { draftListing, loadListingPhoto, validateDraft } from './listingDraft.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const categories = [
  { id: 1, name: 'Farming Tools' },
  { id: 3, name: 'Household & DIY' },
];
const db = { from: () => ({ select: async () => ({ data: categories, error: null }) }) };

function fakeModel(model, answer) {
  const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  return { model, client: { chat: { completions: { create } } }, create };
}

const good = {
  title: 'Mahindra 575 DI Tractor (45 HP)',
  description: 'A 2019 tractor in good condition.',
  category: 'farming tools',
  condition: 'Good',
  power_source: 'diesel',
  accessories_included: true,
  accessories_note: 'Trolley',
  location: 'Ludhiana, Punjab',
};

describe('validateDraft', () => {
  it('maps the category name to its id and keeps valid values', () => {
    expect(validateDraft(good, categories)).toEqual({
      title: 'Mahindra 575 DI Tractor (45 HP)',
      description: 'A 2019 tractor in good condition.',
      category_id: 1,
      condition: 'Good',
      power_source: 'diesel',
      accessories_included: true,
      accessories_note: 'Trolley',
      location: 'Ludhiana, Punjab',
    });
  });

  it('drops values the form cannot take, and needs a title', () => {
    const d = validateDraft({ ...good, category: 'Weapons', condition: 'Mint', power_source: 'nuclear', accessories_included: 'yes' }, categories);
    expect(d).toMatchObject({ category_id: null, condition: null, power_source: null, accessories_included: null });
    expect(validateDraft({ ...good, title: '' }, categories)).toBeNull();
    expect(validateDraft(null, categories)).toBeNull();
  });
});

describe('loadListingPhoto', () => {
  const base = 'https://proj.supabase.co';
  const ok = (type, size = 10) => vi.fn(async () => ({ ok: true, headers: new Headers({ 'content-type': type }), arrayBuffer: async () => new ArrayBuffer(size) }));

  it("only loads images from our own listing photo bucket", async () => {
    const fetchImpl = ok('image/jpeg');
    expect(await loadListingPhoto('https://evil.example/x.jpg', { fetchImpl, supabaseUrl: base })).toBeNull();
    expect(await loadListingPhoto(`${base}/storage/v1/object/public/kyc-documents/id.jpg`, { fetchImpl, supabaseUrl: base })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    const url = await loadListingPhoto(`${base}/storage/v1/object/public/listing-images/u/1.jpg`, { fetchImpl, supabaseUrl: base });
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('refuses non-images and huge files', async () => {
    const url = `${base}/storage/v1/object/public/listing-images/u/1.jpg`;
    expect(await loadListingPhoto(url, { fetchImpl: ok('text/html'), supabaseUrl: base })).toBeNull();
    expect(await loadListingPhoto(url, { fetchImpl: ok('image/png', 5 * 1024 * 1024), supabaseUrl: base })).toBeNull();
  });
});

describe('draftListing', () => {
  it('shows the photo to Gemini only, and says whether it was used', async () => {
    const gemini = fakeModel('gemini-test', good);
    const loadPhoto = async () => 'data:image/jpeg;base64,AAAA';

    const d = await draftListing({ notes: 'tractor', imageUrl: 'x' }, { db, models: [gemini], loadPhoto });
    expect(d.used_photo).toBe(true);
    expect(gemini.create.mock.calls[0][0].messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });

    const groq = fakeModel('qwen/test', good);
    const d2 = await draftListing({ notes: 'tractor', imageUrl: 'x' }, { db, models: [groq], loadPhoto });
    expect(d2.used_photo).toBe(false);
    expect(typeof groq.create.mock.calls[0][0].messages[1].content).toBe('string');
  });

  it('returns null when no model gives a usable draft', async () => {
    expect(await draftListing({ notes: 'tractor' }, { db, models: [fakeModel('m', { title: '' })] })).toBeNull();
  });
});
