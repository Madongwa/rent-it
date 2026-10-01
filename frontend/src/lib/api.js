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
  // near: the renter's rounded location, for "X km away" (optional).
  getListingInsights: (id) => request(`/listings/${id}/insights`),
  getReviewSummary: (id) => request(`/listings/${id}/review-summary`),
  getListing: (id, near) =>
    request(`/listings/${id}${near ? `?lat=${near.lat}&lng=${near.lng}` : ''}`),
  getMyListings: () => request('/listings/mine'),
  createListing: (payload) =>
    request('/listings', { method: 'POST', body: JSON.stringify(payload) }),
  updateListing: (id, payload) =>
    request(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteListing: (id) => request(`/listings/${id}`, { method: 'DELETE' }),
  getBlockedDates: (id) => request(`/listings/${id}/blocked-dates`),
  addBlockedDates: (id, payload) => request(`/listings/${id}/blocked-dates`, { method: 'POST', body: JSON.stringify(payload) }),
  removeBlockedDates: (id, blockId) => request(`/listings/${id}/blocked-dates/${blockId}`, { method: 'DELETE' }),
  checkPhotos: (imageUrls, title) =>
    request('/listings/photo-check', { method: 'POST', body: JSON.stringify({ image_urls: imageUrls, title }) }),
  draftListing: (payload) => request('/listings/draft', { method: 'POST', body: JSON.stringify(payload) }),
  interpretSearch: (text) => request('/listings/search-intent', { method: 'POST', body: JSON.stringify({ text }) }),
  // Voice search: the recording itself as the body; returns { text }.
  voiceSearch: (blob, type) =>
    request('/listings/voice-search', { method: 'POST', body: blob, headers: { 'Content-Type': type } }),
  searchAlternatives: (text) => request('/listings/alternatives', { method: 'POST', body: JSON.stringify({ text }) }),

  getSavedSearches: () => request('/saved-searches'),
  saveSearch: (payload) => request('/saved-searches', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSavedSearch: (id) => request(`/saved-searches/${id}`, { method: 'DELETE' }),

  // Wanted posts
  getWanted: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/wanted${qs ? `?${qs}` : ''}`);
  },
  getMyWanted: () => request('/wanted/mine'),
  draftWanted: (text) => request('/wanted/draft', { method: 'POST', body: JSON.stringify({ text }) }),
  createWanted: (payload) => request('/wanted', { method: 'POST', body: JSON.stringify(payload) }),
  setWantedStatus: (id, status) => request(`/wanted/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteWanted: (id) => request(`/wanted/${id}`, { method: 'DELETE' }),
  respondToWanted: (id, listingId) =>
    request(`/wanted/${id}/respond`, { method: 'POST', body: JSON.stringify({ listing_id: listingId }) }),

  createRental: (payload) => request('/rentals', { method: 'POST', body: JSON.stringify(payload) }),
  getMyRentals: () => request('/rentals/mine'),
  getIncomingRentals: () => request('/rentals/incoming'),
  updateRentalStatus: (id, status) =>
    request(`/rentals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  counterOffer: (id, terms) =>
    request(`/rentals/${id}/offers`, { method: 'POST', body: JSON.stringify(terms) }),
  acceptOffer: (id) => request(`/rentals/${id}/accept`, { method: 'POST' }),
  getEarnings: () => request('/rentals/earnings'),
  getAgreement: (id) => request(`/rentals/${id}/agreement`),
  comparePhotos: (id) => request(`/rentals/${id}/compare-photos`, { method: 'POST' }),
  adminComparePhotos: (id) => request(`/admin/rentals/${id}/compare-photos`, { method: 'POST' }),

  signUp: (payload) => request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  getMyProfile: () => request('/profiles/me'),
  getPublicProfile: (id) => request(`/profiles/${id}`),
  acceptTerms: (version) =>
    request('/profiles/me/accept-terms', { method: 'POST', body: JSON.stringify({ version }) }),
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
  sendAttachment: (conversationId, kind, attachment) =>
    request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ kind, attachment }),
    }),
  markConversationRead: (conversationId) =>
    request(`/messages/conversations/${conversationId}/read`, { method: 'POST' }),
  getUnreadMessageCount: () => request('/messages/unread-count'),
  suggestReplies: (conversationId, lang) =>
    request(`/messages/conversations/${conversationId}/suggest-replies`, { method: 'POST', body: JSON.stringify({ lang }) }),
  // lang: the sender's own language - the server translates the message into
  // the recipient's before delivering it, unless they match.
  sendMessage: (conversationId, body, lang) =>
    request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, lang }),
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
  getStaffAnalytics: () => request('/admin/analytics'),
  aiCheckKyc: (userId) => request(`/admin/kyc/${userId}/ai-check`, { method: 'POST' }),
  approveKyc: (userId) => request(`/admin/kyc/${userId}/approve`, { method: 'POST' }),
  rejectKyc: (userId, reason) =>
    request(`/admin/kyc/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  sendChatMessage: (message, history = [], lang) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, history, lang }) }),

  suggestPrice: (payload) => request('/pricing/suggest', { method: 'POST', body: JSON.stringify(payload) }),
  getPriceCheck: (listingId) => request(`/pricing/listing/${listingId}`),

  translateUi: (lang, texts) =>
    request('/translate/ui', { method: 'POST', body: JSON.stringify({ lang, texts }) }),
  translateMessages: (lang, ids) =>
    request('/translate/messages', { method: 'POST', body: JSON.stringify({ lang, ids }) }),

  getDisputeQueue: () => request('/admin/disputes'),
  getDisputeSummary: (disputeId, refresh = false) =>
    request(`/admin/disputes/${disputeId}/summary`, { method: 'POST', body: JSON.stringify({ refresh }) }),
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
  getSafetyQueue: () => request('/admin/safety'),
  runSafetyScan: () => request('/admin/safety/scan', { method: 'POST' }),
  dismissSafetyFlag: (listingId) => request(`/admin/safety/${listingId}/dismiss`, { method: 'POST' }),
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
  getAdminUserStats: () => request('/admin/stats/users'),
  getAdminActivityStats: () => request('/admin/stats/activity'),
  getAdminListingsByCategory: () => request('/admin/stats/listings-by-category'),
};
