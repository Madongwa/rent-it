import { formatInr } from './offers';

// Helpers for plain-language search on the Marketplace (the AI turns a
// sentence into filters - backend/src/lib/searchIntent.js).

const MULTI = ['condition', 'powerSource', 'delivery', 'availability'];

// The AI's filters as Marketplace URL parameters - a fresh search, so any
// earlier filters are dropped (the sort order is kept).
export function intentToParams(intent, sort) {
  const params = new URLSearchParams();
  if (intent.q) params.set('q', intent.q);
  if (intent.category) params.set('category', intent.category);
  if (intent.minPrice) params.set('minPrice', String(intent.minPrice));
  if (intent.maxPrice) params.set('maxPrice', String(intent.maxPrice));
  for (const key of MULTI) if (intent[key]?.length) params.set(key, intent[key].join(','));
  if (intent.near) params.set('near', intent.near);
  if (sort && sort !== 'relevance') params.set('sort', sort);
  return params;
}

const POWER = { electric: 'electric', petrol: 'petrol', diesel: 'diesel', manual: 'manual', battery: 'battery-powered' };

// "auger or "post hole digger" · available this week · near Mandya"
export function describeIntent(intent, categories = []) {
  const parts = [];
  if (intent.q) parts.push(intent.q.replace(/"/g, ''));
  const category = categories.find((c) => c.slug === intent.category);
  if (category) parts.push(category.name);
  if (intent.minPrice && intent.maxPrice) parts.push(`${formatInr(intent.minPrice)}-${formatInr(intent.maxPrice)} a day`);
  else if (intent.maxPrice) parts.push(`under ${formatInr(intent.maxPrice)} a day`);
  else if (intent.minPrice) parts.push(`from ${formatInr(intent.minPrice)} a day`);
  if (intent.condition?.length) parts.push(intent.condition.join(' or '));
  if (intent.powerSource?.length) parts.push(intent.powerSource.map((p) => POWER[p] || p).join(' or '));
  if (intent.delivery?.includes('owner_delivers')) parts.push('delivered');
  if (intent.availability?.includes('today')) parts.push('available today');
  else if (intent.availability?.includes('week')) parts.push('available this week');
  if (intent.near) parts.push(`near ${intent.near}`);
  return parts.join(' · ');
}
