import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GitBranch, Search, ArrowRight, Users, ZoomIn, ZoomOut, User, Clock, Activity, UserPlus, X, Heart, ChevronLeft, ArrowUpDown } from "lucide-react";
import { useTable, useCurrentMember, updateRecord } from "../lib/useData";
import { Button } from "./ui";
import { maintenanceStatus, formatTime } from "../lib/helpers";
import { distributePlacementCommissions } from "../lib/commissions";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

export default function Genealogy() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const panStart = useRef(null);
  const treeRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [placementTarget, setPlacementTarget] = useState(null);
  const [swapSource, setSwapSource] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [placing, setPlacing] = useState(false);
  const [, setTick] = useState(0);
  const selectedRef = useRef(null);
  const { data: members = [], isLoading, refetch: refetchMembers } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { currentMember } = useCurrentMember(members);

  // Live countdown — re-render every second so maintenance timers tick down.
  // Paused during drag to keep panning smooth on mobile.
  useEffect(() => {
    if (isDragging) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isDragging]);

  useEffect(() => {
    if (currentMember && !selected) setSelected(currentMember);
    selectedRef.current = selected;
  }, [currentMember, selected]);

  // Navigate to a member: push current selection onto history stack, reset pan to top.
  // Uses a ref for the current selection so the callback identity never changes —
  // this keeps TreeNode stable and prevents the entire tree from remounting on every click.
  const selectMember = useCallback((member) => {
    if (selectedRef.current && selectedRef.current.id !== member.id) {
      setHistory(h => [...h, selectedRef.current]);
    }
    setSelected(member);
    setPan({ x: 0, y: 0 });
  }, []);

  // Go back to the previous member in history.
  const goBack = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setSelected(prev);
      setPan({ x: 0, y: 0 });
      return h.slice(0, -1);
    });
  }, []);

  const allApproved = useMemo(() => members.filter(m => m.status === "approved"), [members]);
  const lobbyMembers = useMemo(() => members.filter(m => m.status === "pending" && m.referrer_id === currentMember?.id), [members, currentMember?.id]);
  const isSuperAdmin = currentMember?.username === "supadmin" || currentMember?.username === "admin";

  // Non-super-admin viewers only see their own downline tree — supadmin, admin,
  // and crosslines (members outside their downline lineage) are hidden.
  const visibleIds = useMemo(() => {
    if (isSuperAdmin || !currentMember) return null;
    const ids = new Set([currentMember.id]);
    const stack = [currentMember.id];
    while (stack.length) {
      const id = stack.pop();
      allApproved.filter(m => (m.placement_id || m.referrer_id) === id).forEach(m => {
        if (!ids.has(m.id)) { ids.add(m.id); stack.push(m.id); }
      });
    }
    return ids;
  }, [isSuperAdmin, currentMember, allApproved]);

  const approvedMembers = useMemo(() => visibleIds
    ? allApproved.filter(m => visibleIds.has(m.id))
    : allApproved, [allApproved, visibleIds]);

  const searchResults = useMemo(() => search
    ? approvedMembers.filter(m =>
        m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.username?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.referral_code?.toLowerCase().includes(search.toLowerCase())
      )
    : [], [search, approvedMembers]);

  // Swap search: exclude source, its descendants, and non-direct ancestors
  const swapSearchResults = useMemo(() => {
    if (!swapSource) return [];
    const descIds = new Set();
    const stack = [swapSource.id];
    const visited = new Set([swapSource.id]);
    while (stack.length) {
      const id = stack.pop();
      const children = approvedMembers.filter(m => (m.placement_id || m.referrer_id) === id && !visited.has(m.id));
      for (const c of children) { descIds.add(c.id); visited.add(c.id); stack.push(c.id); }
    }
    const ancIds = new Set();
    let cur = approvedMembers.find(m => m.id === swapSource.id);
    const guard = new Set();
    while (cur) {
      const pid = cur.placement_id || cur.referrer_id;
      if (!pid || guard.has(pid)) break;
      ancIds.add(pid);
      guard.add(pid);
      cur = approvedMembers.find(m => m.id === pid);
    }
    const directParentId = swapSource.placement_id || swapSource.referrer_id;
    const q = swapSearch.toLowerCase().trim();
    return approvedMembers.filter(m =>
      m.id !== swapSource.id &&
      !descIds.has(m.id) &&
      !(ancIds.has(m.id) && m.id !== directParentId) &&
      (!q || (m.username || "").toLowerCase().includes(q) || (m.full_name || "").toLowerCase().includes(q))
    ).slice(0, 50);
  }, [swapSource, swapSearch, approvedMembers]);

  const maxDepth = isSuperAdmin ? Infinity : 5;

  const TreeNode = useCallback(function TreeNode({ member, level = 0, ancestors = [] }) {
    // Cycle guard — prevents infinite recursion if data is inconsistent
    if (ancestors.includes(member.id)) return null;
    const nextAncestors = [...ancestors, member.id];
    const downlines = approvedMembers.filter(m => (m.placement_id || m.referrer_id) === member.id);
    const isRoot = level === 0;
    const status = maintenanceStatus(member, codes);
    const isActive = status.isGreen;
    const slots = `${downlines.length}/8`;
    const canPlace = lobbyMembers.length > 0 && downlines.length < 8;

    return (
      <div className="flex flex-col items-center">
        {/* Node card */}
        <div
          data-node
          onClick={() => selectMember(member)}
          className={`group cursor-pointer relative w-48 rounded-2xl px-3.5 py-3.5 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 ${
            isActive
              ? "bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300/50 text-white"
              : "bg-gradient-to-br from-gray-700 to-black border-gray-700/50 text-white"
          } ${isRoot ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-gray-50" : ""}`}
        >
          {/* Subtle inner glow overlay */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-white/10 pointer-events-none" />

          {/* Top row: avatar + username + level badge */}
          <div className="relative flex items-center gap-2 mb-2.5">
            <span className={`font-bold flex-1 text-center px-1 drop-shadow-sm break-words leading-tight ${
              (member.username || member.full_name || "").length > 22 ? "text-[10px]" :
              (member.username || member.full_name || "").length > 16 ? "text-[11px]" :
              (member.username || member.full_name || "").length > 12 ? "text-xs" : "text-sm"
            }`}>{member.username || member.full_name}</span>
            <div className="min-w-8 h-8 px-1.5 rounded-lg bg-white/40 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-2 ring-white/50 shadow-md">
              <span className="text-xs font-extrabold text-white drop-shadow-md tracking-wide">{isRoot ? "You" : `L${level}`}</span>
            </div>
          </div>

          {/* Status row */}
          <div className="relative flex items-center justify-between text-[11px] mb-1.5">
            {isActive ? (
              <span className="flex items-center gap-1 font-medium bg-white/15 rounded-full px-1.5 py-0.5">
                <motion.span animate={{ scale: [1, 1.4, 1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} className="flex items-center">
                  <Heart className="w-3 h-3 text-white fill-white" />
                </motion.span>
                {formatTime(status.secondsLeft)}
              </span>
            ) : status.secondsLeft > 0 ? (
              <span className="flex items-center gap-1 font-medium bg-white/10 rounded-full px-1.5 py-0.5">
                <Heart className="w-3 h-3 text-white/60" />
                {formatTime(status.secondsLeft)}
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium bg-white/10 rounded-full px-1.5 py-0.5">
                <Heart className="w-3 h-3 text-white/60" />
                Expired
              </span>
            )}
            <span className="font-bold bg-white/20 rounded-full px-1.5 py-0.5">{slots}</span>
          </div>

          {/* Slot progress bar */}
          <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isActive ? "bg-white/80" : "bg-white/50"}`}
              style={{ width: `${(downlines.length / 8) * 100}%` }}
            />
          </div>

          {canPlace && (
            <button
              onClick={(e) => { e.stopPropagation(); setPlacementTarget(member); }}
              className="relative mt-2 w-full bg-white/25 hover:bg-white/40 backdrop-blur-sm rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-all border border-white/30 hover:border-white/50"
            >
              <UserPlus className="w-3 h-3" /> Place Here
            </button>
          )}
          {level > 0 && isSuperAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSwapSource(swapSource?.id === member.id ? null : member);
                setSwapTarget(null);
                setSwapSearch("");
              }}
              className={`relative mt-2 w-full backdrop-blur-sm rounded-lg py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-all border ${
                swapSource?.id === member.id
                  ? "bg-amber-500 text-white border-amber-300"
                  : "bg-white/25 hover:bg-white/40 text-white border-white/30 hover:border-white/50"
              }`}
            >
              <ArrowUpDown className="w-3 h-3" /> {swapSource?.id === member.id ? "Cancel Swap" : "Swap Position"}
            </button>
          )}
        </div>

        {/* Children with T-junction connectors */}
        {downlines.length > 0 && level < maxDepth && (
          <>
            {/* Vertical line from parent bottom to horizontal bar */}
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-blue-500" />
            {/* Children row */}
            <div className="flex flex-nowrap justify-center gap-4">
              {downlines.slice(0, 8).map((d, i, arr) => {
                const isOnly = arr.length === 1;
                const isFirst = i === 0;
                const isLast = i === arr.length - 1;
                return (
                  <div key={d.id} className="relative flex flex-col items-center">
                    {/* Horizontal bar segment */}
                    {!isOnly && (
                      <div
                        className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                        style={{
                          left: isFirst ? '50%' : '-8px',
                          right: isLast ? '50%' : '-8px',
                        }}
                      />
                    )}
                    {/* Vertical drop from horizontal bar to child card */}
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-emerald-400" />
                    <TreeNode member={d} level={level + 1} ancestors={nextAncestors} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Depth limit indicator — shown when downlines exist but are hidden */}
        {downlines.length > 0 && level >= maxDepth && (
          <div className="mt-2 text-xs text-gray-400 italic">
            {downlines.length} more downline{downlines.length !== 1 ? "s" : ""} (visible to admins only)
          </div>
        )}
      </div>
    );
  }, [approvedMembers, codes, selectMember, lobbyMembers, setPlacementTarget, setSwapSource, swapSource, maxDepth, isSuperAdmin]);

  async function handlePlaceMember(lobbyMember) {
    setPlacing(true);
    try {
      const treeLevel = (placementTarget.tree_level || 0) + 1;
      const { error: placeError } = await updateRecord("members", lobbyMember.id, {
        placement_id: placementTarget.id,
        status: "approved",
        tree_level: treeLevel,
        approved_date: new Date().toISOString(),
      });
      if (placeError) {
        toast.error(placeError.message?.includes("placement_id")
          ? "Placement is not configured in this database. Apply migration 005_genealogy_placement.sql in Supabase, then try again."
          : placeError.message || "Failed to place member");
        setPlacing(false);
        return;
      }
      const { error: countError } = await updateRecord("members", placementTarget.id, {
        direct_downlines_count: (placementTarget.direct_downlines_count || 0) + 1,
      });
      if (countError) console.error("Failed to update downline count:", countError.message);
      // If the member already redeemed a code while in the lobby, distribute commissions now
      const { data: freshMembers } = await supabase.from("members").select("*");
      const { data: freshCodes } = await supabase.from("maintenance_codes").select("*");
      const placedMember = (freshMembers || members).find(m => m.id === lobbyMember.id);
      if (placedMember) {
        const count = await distributePlacementCommissions(placedMember, freshMembers || members, freshCodes || codes);
        if (count > 0) toast.success(`${lobbyMember.username} placed under ${placementTarget.username}. ${count} upline bonus(es) distributed.`);
        else toast.success(`${lobbyMember.username} placed under ${placementTarget.username}`);
      } else {
        toast.success(`${lobbyMember.username} placed under ${placementTarget.username}`);
      }
      setPlacementTarget(null);
      await refetchMembers();
    } catch (err) {
      toast.error(err.message || "Failed to place member");
    }
    setPlacing(false);
  }

  // Collect all ancestor ids of a member (follows placement_id || referrer_id up the tree)
  function getAncestorIds(memberId, allMembers) {
    const ids = new Set();
    let current = allMembers.find(m => m.id === memberId);
    const guard = new Set();
    while (current) {
      const pid = current.placement_id || current.referrer_id;
      if (!pid || guard.has(pid)) break;
      ids.add(pid);
      guard.add(pid);
      current = allMembers.find(m => m.id === pid);
    }
    return ids;
  }

  // Recursively update tree_level for all descendants of a member
  async function updateSubtreeLevels(memberId, parentLevel, allMembers) {
    const visited = new Set([memberId]);
    const stack = [{ id: memberId, level: parentLevel }];
    while (stack.length) {
      const { id, level } = stack.pop();
      const children = allMembers.filter(m => (m.placement_id || m.referrer_id) === id && !visited.has(m.id));
      for (const child of children) {
        visited.add(child.id);
        await updateRecord("members", child.id, { tree_level: level + 1 });
        stack.push({ id: child.id, level: level + 1 });
      }
    }
  }

  // Recount direct_downlines_count from actual children for given member IDs
  async function recountDownlines(memberIds, allMembers) {
    const affected = new Set();
    for (const id of memberIds) {
      if (!id) continue;
      const actualCount = allMembers.filter(m => (m.placement_id || m.referrer_id) === id).length;
      const member = allMembers.find(m => m.id === id);
      if (member && (member.direct_downlines_count || 0) !== actualCount) {
        await updateRecord("members", id, { direct_downlines_count: actualCount });
        member.direct_downlines_count = actualCount;
      }
    }
    return affected;
  }

  async function handleSwapPosition() {
    if (!swapSource || !swapTarget) return;
    setPlacing(true);
    try {
      const { data: freshMembers } = await supabase.from("members").select("*");
      const allMembers = freshMembers || members;
      const a = allMembers.find(m => m.id === swapSource.id);
      const b = allMembers.find(m => m.id === swapTarget.id);
      if (!a || !b) { toast.error("Member not found"); return; }
      if (a.id === b.id) { toast.error("Cannot swap a member with themselves"); return; }

      const aParentId = a.placement_id || a.referrer_id;
      const bParentId = b.placement_id || b.referrer_id;

      // Check if this is a direct parent-child swap
      const aIsParentOfB = aParentId && b.placement_id === a.id;
      const bIsParentOfA = bParentId && a.placement_id === b.id;
      const isParentChild = aIsParentOfB || bIsParentOfA;

      // Prevent swapping a non-direct ancestor with a descendant (creates a cycle)
      const ancestorsOfA = getAncestorIds(a.id, allMembers);
      const ancestorsOfB = getAncestorIds(b.id, allMembers);
      if (ancestorsOfA.has(b.id) && !bIsParentOfA) { toast.error(`${b.username} is an upline of ${a.username} — cannot swap ancestor with descendant`); return; }
      if (ancestorsOfB.has(a.id) && !aIsParentOfB) { toast.error(`${a.username} is an upline of ${b.username} — cannot swap ancestor with descendant`); return; }

      if (isParentChild) {
        // Parent-child swap: the child (now parent) needs a free slot
        const child = aIsParentOfB ? b : a;
        const parent = aIsParentOfB ? a : b;
        if ((child.direct_downlines_count || 0) >= 8) {
          toast.error(`${child.username}'s downline is full (8/8) — cannot swap`);
          return;
        }
        const grandparentId = parent.placement_id || parent.referrer_id;
        // Child takes parent's position
        const childUpdates = {
          placement_id: grandparentId || null,
          tree_level: parent.tree_level || 0,
        };
        if (!grandparentId) childUpdates.referrer_id = null;
        await updateRecord("members", child.id, childUpdates);
        child.placement_id = grandparentId || null;
        // Parent takes child's position
        await updateRecord("members", parent.id, {
          placement_id: child.id,
          tree_level: child.tree_level || 0,
        });
        parent.placement_id = child.id;
        // Recount downlines from actual data — no manual +1/-1
        await recountDownlines([child.id, parent.id, grandparentId].filter(Boolean), allMembers);
        // Update subtree levels for both swapped members
        await updateSubtreeLevels(child.id, parent.tree_level || 0, allMembers);
        await updateSubtreeLevels(parent.id, child.tree_level || 0, allMembers);
        toast.success(`Positions swapped: ${child.username} ↔ ${parent.username}`);
      } else {
        // Crossline swap: exchange placement_id and tree_level
        await updateRecord("members", a.id, {
          placement_id: bParentId || null,
          tree_level: b.tree_level || 0,
        });
        a.placement_id = bParentId || null;
        await updateRecord("members", b.id, {
          placement_id: aParentId || null,
          tree_level: a.tree_level || 0,
        });
        b.placement_id = aParentId || null;
        // Recount downlines from actual data for all affected members
        await recountDownlines([a.id, b.id, aParentId, bParentId].filter(Boolean), allMembers);
        // Update subtree levels for both swapped members
        await updateSubtreeLevels(a.id, b.tree_level || 0, allMembers);
        await updateSubtreeLevels(b.id, a.tree_level || 0, allMembers);
        toast.success(`Positions swapped: ${a.username} ↔ ${b.username}`);
      }

      setSwapSource(null);
      setSwapTarget(null);
      await refetchMembers();
    } catch (err) {
      toast.error(err?.message || "Failed to swap positions");
    }
    setPlacing(false);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading genealogy...</div>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <GitBranch className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Zistem Tree</h1>
          <p className="text-gray-600 mb-6">Please login to view your genealogy.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const handlePointerDown = (e) => {
    // Keep button presses out of canvas panning: capture redirects their click.
    if (e.button !== 0 || e.target.closest("button, a, input, select, textarea, [data-node]")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !treeRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Update the DOM directly — bypassing React re-renders for smooth 60fps panning.
    const nx = panStart.current.x + dx;
    const ny = panStart.current.y + dy;
    treeRef.current.style.transform = `translate3d(${nx}px, ${ny}px, 0) scale(${zoom / 100})`;
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      // Commit final position to React state once, after the drag ends.
      if (treeRef.current) {
        const match = treeRef.current.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
        if (match) setPan({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
      }
    }
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const resetView = () => { setPan({ x: 0, y: 0 }); setZoom(100); };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 genealogy-scroll">
      <style>{`
        html::-webkit-scrollbar { width: 40px !important; }
        html::-webkit-scrollbar-track { background: #e5e7eb !important; border-radius: 20px; }
        html::-webkit-scrollbar-thumb { background: #6366f1 !important; border-radius: 20px; border: 4px solid #e5e7eb; }
        html::-webkit-scrollbar-thumb:hover { background: #4f46e5 !important; }
        html { scrollbar-width: thick !important; scrollbar-color: #6366f1 #e5e7eb !important; }
        .scroll-thick::-webkit-scrollbar { width: 40px !important; height: 40px !important; }
        .scroll-thick::-webkit-scrollbar-track { background: #e5e7eb !important; border-radius: 20px; }
        .scroll-thick::-webkit-scrollbar-thumb { background: #6366f1 !important; border-radius: 20px; border: 4px solid #e5e7eb; }
        .scroll-thick::-webkit-scrollbar-thumb:hover { background: #4f46e5 !important; }
        .scroll-thick { scrollbar-width: thick !important; scrollbar-color: #6366f1 #e5e7eb !important; }
      `}</style>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Zistem Tree</h1>
            <p className="text-gray-500">{isSuperAdmin ? "Full network — up to 8 downlines per member" : "6-level network — up to 8 downlines per member"}</p>
          </div>
        </div>
      </motion.div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 animate-pulse shadow-sm shadow-blue-500/50" />
          <span className="text-sm font-semibold text-blue-700">Active — Maintenance redeemed</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 shadow-sm">
          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-black shadow-sm shadow-gray-800/50" />
          <span className="text-sm font-semibold text-gray-800">Inactive — No maintenance</span>
        </div>
      </div>

      {/* Lobby — unplaced members who used the current user's referral link */}
      {lobbyMembers.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4">
          <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4" /> Lobby — {lobbyMembers.length} member{lobbyMembers.length !== 1 ? "s" : ""} waiting for placement
          </h3>
          <p className="text-xs text-amber-700 mb-3">These members registered using your referral link. Click "Place Here" on any node in your tree to position them.</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scroll-thick">
            {lobbyMembers.map(m => (
              <div key={m.id} className="flex-shrink-0 bg-white rounded-xl border border-amber-200 px-3 py-2 flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xs">
                  {(m.username || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{m.username || m.full_name}</p>
                  <p className="text-xs text-gray-400">{new Date(m.created_date || m.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Members list panel */}
        <div className="w-full lg:w-56 flex-shrink-0 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-fit lg:sticky lg:top-4">
          <div className="p-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-gray-500" /> Members</h3>
          </div>
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members..."
                className="pl-8 w-full rounded-lg border border-gray-200 h-9 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="max-h-[168px] overflow-y-auto scroll-thick">
            {(search ? searchResults : approvedMembers).map(m => {
              const status = maintenanceStatus(m, codes);
              const isActive = status.isGreen;
              return (
                <button
                  key={m.id}
                  onClick={() => { selectMember(m); setSearch(""); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors flex items-center gap-2 ${
                    selected?.id === m.id ? "bg-blue-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-blue-500" : "bg-black"}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{m.username || m.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{isSuperAdmin ? `L${m.tree_level || 0}` : (m.id === currentMember?.id ? "You" : `L${(m.tree_level || 0) - (currentMember?.tree_level || 0)}`)} · {m.direct_downlines_count || 0}/8</p>
                  </div>
                </button>
              );
            })}
            {search && searchResults.length === 0 && (
              <p className="text-center py-6 text-sm text-gray-400">No members found.</p>
            )}
          </div>
        </div>

        {/* Right: Tree visualization */}
        <div className="flex-1 min-h-[700px] flex flex-col bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl shadow-lg border border-gray-200">
          {/* Zoom controls — sticky below the mobile header so they never scroll under it */}
          <div className="sticky top-16 lg:static z-30 bg-white flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 rounded-t-2xl">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              <span>Network tree — <strong className="text-gray-700">{selected?.username || selected?.full_name || "—"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={goBack} className="h-11 px-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center gap-1 text-white shadow-lg hover:scale-105 active:scale-95 transition-all text-sm font-bold">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button onClick={() => setZoom(z => z <= 10 ? Math.max(1, z - 1) : Math.max(1, z - 10))} className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all">
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-gray-700 w-14 text-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all">
                <ZoomIn className="w-5 h-5" />
              </button>

            </div>
          </div>
          <div
            className="flex-1 overflow-hidden p-4 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div ref={treeRef} style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`, transformOrigin: 'top center', transition: isDragging ? 'none' : 'transform 0.15s ease-out', willChange: 'transform' }}>
              {selected ? <TreeNode member={selected} /> : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Users className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">No genealogy data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Placement modal */}
      {placementTarget && lobbyMembers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPlacementTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Place under</h3>
                <p className="text-sm text-amber-600 font-medium">@{placementTarget.username || placementTarget.full_name}</p>
              </div>
              <button onClick={() => setPlacementTarget(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select a lobby member to place as their downline:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto scroll-thick">
              {lobbyMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => handlePlaceMember(m)}
                  disabled={placing}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-sm">
                    {(m.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{m.username || m.full_name}</p>
                    <p className="text-xs text-gray-400">Registered {new Date(m.created_date || m.created_at).toLocaleDateString()}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-amber-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Swap Search Modal — pick a member to swap with */}
      {swapSource && !swapTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSwapSource(null); setSwapSearch(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Swap Position</h3>
                <p className="text-sm text-amber-600 font-medium">
                  Source: @{swapSource.username}
                </p>
              </div>
              <button onClick={() => { setSwapSource(null); setSwapSearch(""); }} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                value={swapSearch}
                onChange={e => setSwapSearch(e.target.value)}
                placeholder="Search username to swap with..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {swapSearchResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No members found. Search excludes downlines and uplines (except direct parent).</p>
              ) : (
                swapSearchResults.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSwapTarget(m); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {(m.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">@{m.username}</p>
                      <p className="text-xs text-gray-500 truncate">{m.full_name || "—"} · Level {m.tree_level || 0}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Swap</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Swap Position Confirmation Modal */}
      {swapTarget && swapSource && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSwapTarget(null); setSwapSource(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Swap Positions</h3>
                <p className="text-sm text-amber-600 font-medium">
                  @{swapSource.username} ↔ @{swapTarget.username}
                </p>
              </div>
              <button onClick={() => { setSwapTarget(null); setSwapSource(null); }} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This will swap the positions of these two members in the genealogy tree. Each member keeps their own downlines — no username is duplicated.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleSwapPosition} disabled={placing} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white">Confirm Swap</Button>
              <Button onClick={() => { setSwapTarget(null); setSwapSource(null); }} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
