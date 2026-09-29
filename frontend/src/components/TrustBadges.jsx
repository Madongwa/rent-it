import { BadgeCheck, Clock, Handshake, Star, CalendarDays } from 'lucide-react';

// An owner's trust badges (backend/src/lib/trust.js): verified seller, how
// quickly they reply, rentals completed, their overall rating, and how long
// they've been on Rent It. Badges without enough data just don't show.
export function trustBadges(trust) {
  if (!trust) return [];
  const badges = [];
  if (trust.verified) badges.push({ key: 'verified', icon: BadgeCheck, text: 'Verified seller', tone: 'text-emerald-400' });
  if (trust.reply_label) badges.push({ key: 'reply', icon: Clock, text: trust.reply_label });
  if (trust.completed_rentals > 0) {
    badges.push({ key: 'rentals', icon: Handshake, text: `${trust.completed_rentals} rental${trust.completed_rentals === 1 ? '' : 's'} completed` });
  }
  if (trust.reviews > 0) {
    badges.push({ key: 'rating', icon: Star, text: `${trust.rating} from ${trust.reviews} review${trust.reviews === 1 ? '' : 's'}`, tone: 'text-amber-300' });
  }
  if (trust.member_since) badges.push({ key: 'since', icon: CalendarDays, text: `On Rent It since ${trust.member_since}` });
  return badges;
}

export default function TrustBadges({ trust, className = '' }) {
  const badges = trustBadges(trust);
  if (!badges.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="About this owner">
      {badges.map(({ key, icon: Icon, text, tone }) => (
        <li key={key} className="inline-flex items-center gap-1.5 rounded-full border border-night-border/15 bg-white/5 px-2.5 py-1 text-xs text-night-text">
          <Icon className={`h-3.5 w-3.5 ${tone || 'text-night-muted'}`} aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
