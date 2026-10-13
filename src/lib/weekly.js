export const WEEKLY_REDEEM_TARGET = 5;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday 00:00 (local) of the calendar week containing `date`, shifted by `offset` weeks
export function weekStart(date = new Date(), offset = 0) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

export function weekEnd(start) {
  const e = new Date(start);
  e.setDate(e.getDate() + 6);
  return e;
}

// Returns [Mon..Sun] counts of the given used-at timestamps within the week starting at `start`
export function dailyCounts(usedAts, start) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const from = start.getTime();
  const to = from + 7 * 86400000;
  usedAts.forEach(ts => {
    const t = new Date(ts).getTime();
    if (t >= from && t < to) counts[Math.min(6, Math.floor((t - from) / 86400000))]++;
  });
  return counts;
}
