import React, { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "./ui";
import SearchableDropdown from "./SearchableDropdown";
import { formatTime } from "../lib/helpers";
import { WEEKLY_REDEEM_TARGET, DAY_LABELS, weekStart, weekEnd, dailyCounts } from "../lib/weekly";

const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Monday–Sunday redeem monitor. `rows` = [{ username, usedAts: [timestamps of redeemed codes] }]
 * Each member needs at least WEEKLY_REDEEM_TARGET redeemed codes per calendar week.
 */
export default function WeeklyRedeemMonitor({ rows, title = "Weekly Redeem Monitor", showFilter = true }) {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const start = weekStart(new Date(), offset);
  const end = weekEnd(start);
  // Week closes Sunday 23:59:59 local time
  const secondsLeft = Math.max(0, Math.floor((weekStart(new Date(now), offset).getTime() + 7 * 86400000 - now) / 1000));
  const days = Math.floor(secondsLeft / 86400);
  const data = rows.filter(r => !filter || r.username === filter).map(r => {
    const days = dailyCounts(r.usedAts, start);
    return { username: r.username, days, total: days.reduce((a, b) => a + b, 0) };
  }).sort((a, b) => a.total - b.total || a.username.localeCompare(b.username));

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-violet-500" /> {title}</h2>
          <p className="text-sm text-gray-500">Minimum {WEEKLY_REDEEM_TARGET} redeemed codes every calendar week (Monday – Sunday).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(o => o - 1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-sm font-semibold text-gray-700 min-w-[150px] text-center">
            {fmt(start)} – {fmt(end)}{offset === 0 && <span className="ml-1 text-xs text-violet-600">(this week)</span>}
          </div>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="px-6 py-3 border-b border-gray-100 grid sm:grid-cols-[1fr_auto] gap-3 items-center bg-gray-50/50">
        {showFilter ? <div className="max-w-sm"><SearchableDropdown value={filter} onChange={setFilter} options={rows.map(r => r.username).sort()} placeholder="Filter by username" /></div> : <div />}
        <div className="text-sm font-semibold text-violet-700">
          {offset === 0
            ? `⏱ Week ends in ${days > 0 ? `${days}d ` : ""}${formatTime(secondsLeft % 86400)}`
            : "Week closed"}
        </div>
      </div>
      <div className="overflow-auto max-h-[536px]"> {/* header 56px + 10 rows x 48px */}
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-100 h-14">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
              {DAY_LABELS.map((l, i) => {
                const d = new Date(start); d.setDate(d.getDate() + i);
                return <th key={l} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase">{l}<div className="font-normal normal-case text-gray-400">{fmt(d)}</div></th>;
              })}
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan="10" className="text-center py-10 text-gray-400">No users to monitor</td></tr> :
            data.map(r => (
              <tr key={r.username} className="border-b border-gray-50 h-12">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">@{r.username}</td>
                {r.days.map((n, i) => <td key={i} className={`text-center px-2 py-3 text-sm ${n ? "font-semibold text-emerald-700" : "text-gray-300"}`}>{n || "–"}</td>)}
                <td className="text-center px-4 py-3 text-sm font-bold text-gray-900">{r.total}/{WEEKLY_REDEEM_TARGET}</td>
                <td className="px-4 py-3">
                  <Badge className={r.total >= WEEKLY_REDEEM_TARGET ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                    {r.total >= WEEKLY_REDEEM_TARGET ? "Met" : `${WEEKLY_REDEEM_TARGET - r.total} more needed`}
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
