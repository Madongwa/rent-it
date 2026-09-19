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
  // body.reply fallback: /api/chat's error responses use { reply } rather
  // than { error } (its "reply" is itself the user-facing message, e.g.
  // the rate-limit notice), so this surfaces that instead of a generic
  // "Request failed (429)" for that one endpoint - harmless no-op for
  // every other endpoint's error bodies, which never set `reply`.
  if (!res.ok) throw new Error(body.error || body.reply || `Request failed (${res.status})`);
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
  checkoutRental: (id) => request(`/rentals/${id}/checkout`, { method: 'POST' }),
  verifyRentalPayment: (id, payload) =>
    request(`/rentals/${id}/verify-payment`, { method: 'POST', body: JSON.stringify(payload) }),

  getMyProfile: () => request('/profiles/me'),
  getPublicProfile: (id) => request(`/profiles/${id}`),
  updateMyProfile: (payload) =>
    request('/profiles/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  createReview: (payload) => request('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  flagReview: (id, reason) => request(`/reviews/${id}/flag`, { method: 'POST', body: JSON.stringify({ reason }) }),

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
  sendChatMessage: (message, history = []) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

  getDisputeQueue: () => request('/admin/disputes'),
  resolveDispute: (disputeId, resolution, outcome) =>
    request(`/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, outcome }),
    }),

  getAdminUsers: () => request('/admin/users'),
  updateUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  banUser: (userId) => request(`/admin/users/${userId}/ban`, { method: 'POST' }),
  unbanUser: (userId) => request(`/admin/users/${userId}/unban`, { method: 'POST' }),

  getAdminListings: () => request('/admin/listings'),
  updateAdminListingStatus: (listingId, status) =>
    request(`/admin/listings/${listingId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getNotifications: () => request('/notifications'),
  getUnreadNotificationCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  getAdminOverview: () => request('/admin/overview'),
  getAdminRentals: (status) => request(`/admin/rentals${status ? `?status=${status}` : ''}`),
  getAdminReviews: (flagged) => request(`/admin/reviews${flagged ? `?flagged=${flagged}` : ''}`),
  unflagReview: (id) => request(`/admin/reviews/${id}/unflag`, { method: 'POST' }),
  deleteAdminReview: (id) => request(`/admin/reviews/${id}`, { method: 'DELETE' }),
  getActivityLog: (page = 1) => request(`/admin/activity-log?page=${page}`),

  getAdminSettings: () => request('/admin/settings'),
  updateAdminSettings: (maintenance_mode) =>
    request('/admin/settings', { method: 'PATCH', body: JSON.stringify({ maintenance_mode }) }),
  getAdminActivityStats: () => request('/admin/stats/activity'),
  getAdminEscrowStats: () => request('/admin/stats/escrow'),
  getAdminRequestsByCategory: () => request('/admin/stats/requests-by-category'),
  getAdminListingsByCategory: () => request('/admin/stats/listings-by-category'),
};
