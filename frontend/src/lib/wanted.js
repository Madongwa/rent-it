import { formatDay, formatInr } from './offers';

// Small display helpers for Wanted posts.

// "5 Oct - 7 Oct", "From 5 Oct", "Until 7 Oct", or '' when no dates.
export function wantedDates(post) {
  const { needed_from: from, needed_until: until } = post;
  if (from && until) return from === until ? formatDay(from) : `${formatDay(from)} - ${formatDay(until)}`;
  if (from) return `From ${formatDay(from)}`;
  if (until) return `Until ${formatDay(until)}`;
  return '';
}

export function wantedBudget(post) {
  return post.max_price_per_day ? `Up to ${formatInr(post.max_price_per_day)}/day` : '';
}

export function postedAgo(iso, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
