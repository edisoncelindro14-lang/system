export const MONTHLY_REDEEM_TARGET = 5;

// First day of the calendar month containing `date`, shifted by `offset` months
export function monthStart(date = new Date(), offset = 0) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d;
}

// Last day of the calendar month starting at `start`
export function monthEnd(start) {
  const e = new Date(start);
  e.setMonth(e.getMonth() + 1);
  e.setDate(0);
  return e;
}

// Number of days in the month starting at `start`
export function monthDayCount(start) {
  return monthEnd(start).getDate();
}

// Day labels (1..N) for the month starting at `start`
export function monthDayLabels(start) {
  const count = monthDayCount(start);
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

// Returns [1..N] counts of the given used-at timestamps within the month starting at `start`
export function monthlyCounts(usedAts, start) {
  const count = monthDayCount(start);
  const counts = new Array(count).fill(0);
  const from = start.getTime();
  const end = monthEnd(start);
  end.setHours(23, 59, 59, 999);
  const to = end.getTime();
  usedAts.forEach(ts => {
    const t = new Date(ts).getTime();
    if (t >= from && t <= to) {
      const dayIndex = new Date(ts).getDate() - 1;
      if (dayIndex >= 0 && dayIndex < count) counts[dayIndex]++;
    }
  });
  return counts;
}
