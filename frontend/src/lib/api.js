import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  getCategories: () => request('/categories'),

  getListings: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/listings${qs ? `?${qs}` : ''}`);
  },
  getListing: (id) => request(`/listings/${id}`),
  getMyListings: () => request('/listings/mine'),
  createListing: (payload) =>
    request('/listings', { method: 'POST', body: JSON.stringify(payload) }),
  updateListing: (id, payload) =>
    request(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteListing: (id) => request(`/listings/${id}`, { method: 'DELETE' }),

  createRental: (payload) => request('/rentals', { method: 'POST', body: JSON.stringify(payload) }),
  getMyRentals: () => request('/rentals/mine'),
  getIncomingRentals: () => request('/rentals/incoming'),
  updateRentalStatus: (id, status) =>
    request(`/rentals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getMyProfile: () => request('/profiles/me'),
  updateMyProfile: (payload) =>
    request('/profiles/me', { method: 'PATCH', body: JSON.stringify(payload) }),
};
