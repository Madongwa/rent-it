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
  getPublicProfile: (id) => request(`/profiles/${id}`),
  updateMyProfile: (payload) =>
    request('/profiles/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  createReview: (payload) => request('/reviews', { method: 'POST', body: JSON.stringify(payload) }),

  getFavorites: () => request('/favorites'),
  getFavoriteIds: () => request('/favorites/ids'),
  addFavorite: (listing_id) =>
    request('/favorites', { method: 'POST', body: JSON.stringify({ listing_id }) }),
  removeFavorite: (listingId) => request(`/favorites/${listingId}`, { method: 'DELETE' }),

  getConversations: () => request('/messages/conversations'),
  startConversation: (listing_id) =>
    request('/messages/conversations', { method: 'POST', body: JSON.stringify({ listing_id }) }),
  getMessages: (conversationId) => request(`/messages/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body) =>
    request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  getMyKyc: () => request('/kyc/me'),
  submitKyc: (payload) => request('/kyc/submit', { method: 'POST', body: JSON.stringify(payload) }),

  submitRentalPhotos: (rentalId, stage, photo_urls) =>
    request(`/rentals/${rentalId}/photos`, {
      method: 'POST',
      body: JSON.stringify({ stage, photo_urls }),
    }),
  raiseDispute: (rentalId, reason) =>
    request(`/rentals/${rentalId}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getKycQueue: () => request('/admin/kyc-queue'),
  approveKyc: (userId) => request(`/admin/kyc/${userId}/approve`, { method: 'POST' }),
  rejectKyc: (userId, reason) =>
    request(`/admin/kyc/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getDisputeQueue: () => request('/admin/disputes'),
  resolveDispute: (disputeId, resolution, outcome) =>
    request(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, outcome }),
    }),
};
