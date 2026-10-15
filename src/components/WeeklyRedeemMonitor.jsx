import React, { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "./ui";
import SearchableDropdown from "./SearchableDropdown";
import { formatTime } from "../lib/helpers";
import { MONTHLY_REDEEM_TARGET, monthStart, monthEnd, monthDayLabels, monthlyCounts } from "../lib/monthly";

const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtMonth = d => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

/**
 * Monthly redeem monitor. `rows` = [{ username, usedAts: [timestamps of redeemed codes] }]
 * Each member needs at least MONTHLY_REDEEM_TARGET redeemed codes per calendar month.
 */
export default function WeeklyRedeemMonitor({ rows, title = "Monthly Redeem Monitor", showFilter = true }) {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const start = monthStart(new Date(), offset);
  const end = monthEnd(start);
  const days = monthDayLabels(start);
  // Month closes last day 23:59:59 local time
  const monthEndWithTime = new Date(end);
  monthEndWithTime.setHours(23, 59, 59, 999);
  const secondsLeft = Math.max(0, Math.floor((monthEndWithTime.getTime() - now) / 1000));
  const daysLeft = Math.floor(secondsLeft / 86400);
  const data = rows.filter(r => !filter || r.username === filter).map(r => {
    const counts = monthlyCounts(r.usedAts, start);
    return { username: r.username, days: counts, total: counts.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => a.total - b.total || a.username.localeCompare(b.username));

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-violet-500" /> {title}</h2>
          <p className="text-sm text-gray-500">Minimum {MONTHLY_REDEEM_TARGET} redeemed codes every calendar month.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(o => o - 1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-sm font-semibold text-gray-700 min-w-[150px] text-center">
            {fmtMonth(start)}{offset === 0 && <span className="ml-1 text-xs text-violet-600">(this month)</span>}
          </div>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="px-6 py-3 border-b border-gray-100 grid sm:grid-cols-[1fr_auto] gap-3 items-center bg-gray-50/50">
        {showFilter ? <div className="max-w-sm"><SearchableDropdown value={filter} onChange={setFilter} options={rows.map(r => r.username).sort()} placeholder="Filter by username" /></div> : <div />}
        <div className="text-sm font-semibold text-violet-700">
          {offset === 0
            ? `⏱ Month ends in ${daysLeft > 0 ? `${daysLeft}d ` : ""}${formatTime(secondsLeft % 86400)}`
            : "Month closed"}
        </div>
      </div>
      <div className="overflow-auto max-h-[536px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-100 h-14">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-white">User</th>
              {days.map((l, i) => {
                const d = new Date(start); d.setDate(d.getDate() + i);
                return <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[48px]">{l}<div className="font-normal normal-case text-gray-400">{fmt(d)}</div></th>;
              })}
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan={days.length + 3} className="text-center py-10 text-gray-400">No users to monitor</td></tr> :
            data.map(r => (
              <tr key={r.username} className="border-b border-gray-50 h-12">
                <td className="px-6 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">@{r.username}</td>
                {r.days.map((n, i) => <td key={i} className={`text-center px-2 py-3 text-sm ${n ? "font-semibold text-emerald-700" : "text-gray-300"}`}>{n || "–"}</td>)}
                <td className="text-center px-4 py-3 text-sm font-bold text-gray-900">{r.total}/{MONTHLY_REDEEM_TARGET}</td>
                <td className="px-4 py-3">
                  <Badge className={r.total >= MONTHLY_REDEEM_TARGET ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                    {r.total >= MONTHLY_REDEEM_TARGET ? "Met" : `${MONTHLY_REDEEM_TARGET - r.total} more needed`}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
