import { useState } from 'react';
import { formatDay } from '../lib/offers';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KIND = {
  booked: { cell: 'bg-accent/20 font-semibold text-accent', label: 'Booked' },
  blocked: { cell: 'bg-amber-500/20 font-semibold text-amber-300', label: 'Owner unavailable' },
};

// The listing page's upcoming availability: a month calendar starting this
// month, with booked days and days the owner blocked marked, plus the same
// ranges as a list. `ranges` = [{ start_date, end_date, kind }].
export default function AvailabilityCalendar({ ranges }) {
  const now = new Date();
  const [view, setView] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  const dateStr = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const kindOf = (day) => ranges.find((r) => dateStr(day) >= r.start_date && dateStr(day) <= r.end_date)?.kind;
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="w-full max-w-xs">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView(new Date(year, month - 1, 1))}
            disabled={isThisMonth}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-night-border/15 text-night-muted hover:border-night-muted disabled:opacity-30"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-night-text">{`${MONTHS[month]} ${year}`}</span>
          <button
            type="button"
            onClick={() => setView(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-night-border/15 text-night-muted hover:border-night-muted"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-caption text-night-muted">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-1 font-medium">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const kind = kindOf(day);
            const past = dateStr(day) < todayStr;
            return (
              <div
                key={i}
                data-kind={kind || undefined}
                className={`flex h-8 items-center justify-center rounded-md text-sm ${
                  kind ? KIND[kind].cell : past ? 'text-night-muted/40' : 'text-night-text'
                } ${dateStr(day) === todayStr ? 'ring-1 ring-inset ring-white' : ''}`}
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-caption text-night-muted">
          {Object.values(KIND).map((k) => (
            <span key={k.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${k.cell.split(' ')[0]}`} /> {k.label}
            </span>
          ))}
        </div>
      </div>

      <div className="text-sm">
        {ranges.length === 0 ? (
          <p className="text-night-muted">No dates are taken yet - pick any dates in your request.</p>
        ) : (
          <>
            <p className="mb-2 font-medium text-night-text">Not available:</p>
            <ul className="space-y-1">
              {ranges.map((r) => (
                <li key={`${r.kind}-${r.start_date}-${r.end_date}`} className="text-night-muted">
                  {`${r.start_date === r.end_date ? formatDay(r.start_date) : `${formatDay(r.start_date)} – ${formatDay(r.end_date)}`} · ${KIND[r.kind].label}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
