import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, Ticket, Wallet, Smartphone, Settings, Check, X, Plus,
  Eye, EyeOff, DollarSign, Trash2, RotateCcw, UserCog, GitBranch, Search,
  Download, Copy, Crown, ArrowRight, ChevronDown, X as XIcon, FileText,
  Key, Clock, Lock, Pencil, User, Save, Upload, Image as ImageIcon,
  UserPlus, ArrowLeft, ShoppingBag, Store,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTable, updateRecord, createRecord, deleteRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { getSessionMemberId } from "../lib/auth";
import { money, formatDate, generateReferralCode, maintenanceStatus, formatTime, LEVEL_CONFIG, MAX_BONUS_LEVEL } from "../lib/helpers";
import { distributePlacementCommissions } from "../lib/commissions";
import { Button, Input, Label, Badge } from "./ui";
import { Megaphone } from "lucide-react";
import Genealogy from "./Genealogy";
import MonitoringView from "./MonitoringView";
import AdminStoreTab from "./AdminStoreTab";
import AdminTransactionHistory from "./AdminTransactionHistory";
import MaintenanceOverrideModal from "./MaintenanceOverrideModal";
import EditBalanceModal from "./EditBalanceModal";

export default function Admin() {
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const [editMember, setEditMember] = useState(null);
  const [redeemModal, setRedeemModal] = useState(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [sponsorModal, setSponsorModal] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const [profileSearch, setProfileSearch] = useState("");
  const [profileSearchOpen, setProfileSearchOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newCode, setNewCode] = useState({ count: "1", assignedUsername: "" });
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [gcash, setGcash] = useState({ gcash_number: "", gcash_name: "" });
  const [minAmount, setMinAmount] = useState("300");
  const [savingMin, setSavingMin] = useState(false);
  const [autoRedeemTime, setAutoRedeemTime] = useState("");
  const [autoRedeemEnabled, setAutoRedeemEnabled] = useState(true);
  const [txSearch, setTxSearch] = useState("");
  const [tabVisibility, setTabVisibility] = useState({ monitoring: true, subadmin: true, terms: true, complan: true, product_conversion: true });
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [monitorMember, setMonitorMember] = useState(null);
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});
  const [, setTick] = useState(0);
  const [subAdminSearch, setSubAdminSearch] = useState("");
  const [transferSubAdminId, setTransferSubAdminId] = useState("");
  const [transferCodeCount, setTransferCodeCount] = useState("1");
  const [transferring, setTransferring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [balanceModal, setBalanceModal] = useState(null);

  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: withdrawals = [] } = useTable("conversion_requests");
  const { data: gcashInfo = [] } = useTable("gcash_info");
  const { data: settings = [], refetch: refetchSettings } = useTable("system_settings");
  const { data: transactions = [] } = useTable("transactions");
  const { data: receipts = [] } = useTable("gcash_receipts");
  const { data: storeQuotas = [], refetch: refetchQuotas } = useTable("store_code_quotas");

  useEffect(() => {
    const map = {};
    settings.forEach(s => { map[s.setting_key] = s.setting_value; });
    setTabVisibility({
      monitoring: map.tab_monitoring_visible !== "false",
      subadmin: map.tab_subadmin_visible !== "false",
      terms: map.tab_terms_visible !== "false",
      complan: map.tab_complan_visible !== "false",
      product_conversion: map.tab_product_conversion_visible !== "false",
    });
    const minSetting = settings.find(s => s.setting_key === "withdrawal_minimum_amount");
    if (minSetting) setMinAmount(minSetting.setting_value);
    setAutoRedeemTime(map.auto_redeem_start_time || "");
    setAutoRedeemEnabled(map.auto_redeem_enabled !== "false");
    setAnnouncementText(map.announcement_text || "");
    setAnnouncementEnabled(map.announcement_enabled === "true");
  }, [settings]);

  // Live countdown — re-render every second so maintenance timers tick down
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Resolve receipt image URLs — data URLs are used directly, storage paths get signed URLs
  useEffect(() => {
    if (receipts.length === 0) return;
    let cancelled = false;
    (async () => {
      const urls = {};
      for (const r of receipts) {
        if (!r.receipt_url) continue;
        if (r.receipt_url.startsWith("data:") || r.receipt_url.startsWith("http")) {
          urls[r.id] = r.receipt_url;
          continue;
        }
        const { data } = await supabase.storage.from("receipts").createSignedUrl(r.receipt_url, 3600);
        if (data?.signedUrl) urls[r.id] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [receipts]);

  const activeGcash = gcashInfo.find(g => g.is_active) || gcashInfo[0];
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
  const currentMemberId = getSessionMemberId();
  const isSupAdmin = members.find(m => m.id === currentMemberId)?.username === "supadmin";
  const isOwner = members.find(m => m.id === currentMemberId)?.username === "admin";
  const canManageTabs = isSupAdmin || isOwner;
  const activeMembers = members.filter(m => {
    if (m.status === "deleted") return false;
    if (!isSupAdmin && (m.username === "supadmin" || m.username === "admin")) return false;
    return true;
  });
  const deletedMembers = members.filter(m => m.status === "deleted");
  const pendingMembers = activeMembers.filter(m => m.status === "pending");
  const approvedMembers = activeMembers.filter(m => m.status === "approved");
  const adminMembers = activeMembers.filter(m => m.role === "admin");
  const subAdminMembers = activeMembers.filter(m => m.role === "sub_admin");
  const filteredMembers = activeMembers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q) || (m.referral_code || "").toLowerCase().includes(q);
  });

  const filteredTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at))
    .filter(t => {
      if (!txSearch) return true;
      const q = txSearch.toLowerCase();
      const member = members.find(m => m.id === t.member_id);
      return (member?.full_name || "").toLowerCase().includes(q) || (member?.username || "").toLowerCase().includes(q) || (t.type || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    });

  const tabs = [
    { id: "members", label: `Members (${activeMembers.length})`, icon: Users, active: "from-amber-500 to-orange-600", inactive: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    { id: "pending", label: `Pending Placements${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ""}`, icon: Clock, active: "from-yellow-500 to-amber-600", inactive: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
    { id: "codes", label: "Codes", icon: Ticket, active: "from-teal-500 to-emerald-600", inactive: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" },
    { id: "withdrawals", label: `Withdrawals${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ""}`, icon: Wallet, active: "from-blue-500 to-indigo-600", inactive: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
    { id: "history", label: "Transaction History", icon: FileText, active: "from-violet-500 to-purple-600", inactive: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
    ...(tabVisibility.product_conversion ? [{ id: "product_conversion", label: "Product Conversion", icon: ShoppingBag, active: "from-purple-500 to-fuchsia-600", inactive: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" }] : []),
    { id: "genealogy", label: "Genealogy", icon: GitBranch, active: "from-pink-500 to-rose-600", inactive: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
    ...(tabVisibility.monitoring ? [{ id: "monitoring", label: "Monitoring", icon: Eye, active: "from-cyan-500 to-sky-600", inactive: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100" }] : []),
    { id: "gcash", label: "GCash", icon: Smartphone, active: "from-indigo-500 to-blue-600", inactive: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
    ...(deletedMembers.length > 0 ? [{ id: "deleted", label: `Deleted (${deletedMembers.length})`, icon: Trash2, active: "from-red-500 to-rose-600", inactive: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" }] : []),
    ...(canManageTabs ? [{ id: "roles", label: "Roles", icon: UserCog, active: "from-fuchsia-500 to-pink-600", inactive: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100" }] : []),
    ...(tabVisibility.subadmin ? [{ id: "subadmins", label: "Sub-Admins", icon: Shield, active: "from-emerald-500 to-green-600", inactive: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" }] : []),
    { id: "store", label: "Store", icon: Store, active: "from-teal-500 to-cyan-600", inactive: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" },
    { id: "announcement", label: "Announcement", icon: Megaphone, active: "from-amber-500 to-orange-600", inactive: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
    { id: "settings", label: "Settings", icon: Settings, active: "from-slate-500 to-gray-600", inactive: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" },
    { id: "profile", label: "My Profile", icon: User, active: "from-violet-500 to-indigo-600", inactive: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
  ];

  function getMemberEarnings(memberId) {
    const txns = transactions.filter(t => t.member_id === memberId);
    const l1 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 1).reduce((s, t) => s + (t.amount || 0), 0);
    const l2 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 2).reduce((s, t) => s + (t.amount || 0), 0);
    const l3 = txns.filter(t => t.type === "level_bonus" && t.bonus_level === 3).reduce((s, t) => s + (t.amount || 0), 0);
    const total = txns.reduce((s, t) => s + (t.amount || 0), 0);
    return { l1, l2, l3, total };
  }

  // Compute actual withdrawable balance from transactions (same logic as Dashboard)
  function getMemberBalance(memberId) {
    const txns = transactions.filter(t => t.member_id === memberId);
    const lastWithdrawal = txns
      .filter(t => (t.type === "withdrawal" || t.type === "product_conversion") && t.status === "completed")
      .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at))[0];
    const lastWDate = lastWithdrawal ? new Date(lastWithdrawal.created_date || lastWithdrawal.created_at) : null;
    return txns
      .filter(t => ["level_bonus", "referral_bonus", "adjustment"].includes(t.type) && (!lastWDate || new Date(t.created_date || t.created_at) > lastWDate))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }

  // Compute actual direct downline count from member relationships (same logic as Genealogy)
  function getDirectDownlineCount(memberId) {
    return approvedMembers.filter(m => (m.placement_id || m.referrer_id) === memberId).length;
  }

  async function generateCodes() {
    const count = parseInt(newCode.count) || 1;
    try {
      const records = [];
      for (let i = 0; i < count; i++) {
        const base = "MAINT-" + generateReferralCode();
        const code = newCode.assignedUsername ? `${base}-@${newCode.assignedUsername.toUpperCase()}` : base;
        records.push({
          code,
          is_used: false,
          assigned_username: newCode.assignedUsername || null,
        });
      }
      await supabase.from("maintenance_codes").insert(records);
      toast.success(`${count} code(s) generated!`);
      setNewCode({ ...newCode, assignedUsername: "" });
      refetchCodes();
    } catch { toast.error("Failed to generate codes"); }
  }

  async function deleteCode(id) {
    try { await deleteRecord("maintenance_codes", id); toast.success("Code deleted"); window.location.reload(); }
    catch { toast.error("Failed to delete code"); }
  }

  async function confirmDeleteAction() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);
    if (type === "member") await deleteMember(id);
    else if (type === "code") await deleteCode(id);
  }

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); toast.success("Code copied!"); }
    catch { toast.error("Failed to copy"); }
  }

  async function approveWithdrawal(id) {
    try {
      const req = withdrawals.find(w => w.id === id);
      await updateRecord("conversion_requests", id, { status: "approved" });
      await createRecord("transactions", {
        member_id: req.member_id,
        type: "withdrawal",
        amount: -(req.amount || 0),
        status: "completed",
        description: "Withdrawal approved by admin",
      });
      toast.success("Withdrawal approved & balance deducted");
      window.location.reload();
    } catch { toast.error("Failed to approve"); }
  }

  async function rejectWithdrawal(id) {
    try { await updateRecord("conversion_requests", id, { status: "rejected" }); toast.success("Withdrawal rejected"); window.location.reload(); }
    catch { toast.error("Failed to reject"); }
  }

  async function approveMember(id) {
    try {
      const member = members.find(m => m.id === id);
      const referrer = members.find(m => m.id === member.referrer_id);
      let placementId = null;
      if (referrer) {
        const available = [referrer, ...findDownline(referrer.id)].find(m => (m.direct_downlines_count || 0) < 8);
        placementId = available?.id || null;
      }
      const treeLevel = placementId ? (members.find(m => m.id === placementId)?.tree_level || 0) + 1 : 1;
      await updateRecord("members", id, {
        status: "approved",
        approved_date: new Date().toISOString(),
        placement_id: placementId,
        tree_level: treeLevel,
      });
      if (placementId) {
        const p = members.find(m => m.id === placementId);
        if (p) await updateRecord("members", p.id, { direct_downlines_count: (p.direct_downlines_count || 0) + 1 });
      }
      // If the member already redeemed a code while in the lobby, distribute commissions now
      const { data: freshCodes } = await supabase.from("maintenance_codes").select("*");
      const { data: freshMembers } = await supabase.from("members").select("*");
      const placedMember = (freshMembers || members).find(m => m.id === id);
      if (placedMember) {
        const count = await distributePlacementCommissions(placedMember, freshMembers || members, freshCodes || codes);
        if (count > 0) toast.success(`Member approved & placed. ${count} upline bonus(es) distributed.`);
        else toast.success("Member approved & placed");
      } else {
        toast.success("Member approved & placed");
      }
      window.location.reload();
    } catch { toast.error("Failed to approve member"); }
  }

  function findDownline(memberId, visited = new Set()) {
    if (visited.has(memberId)) return [];
    visited.add(memberId);
    const direct = members.filter(m => m.placement_id === memberId && m.status === "approved");
    return [...direct, ...direct.flatMap(d => findDownline(d.id, visited))];
  }

  async function rejectMember(id) {
    try { await updateRecord("members", id, { status: "rejected" }); toast.success("Member rejected"); window.location.reload(); }
    catch { toast.error("Failed to reject"); }
  }

  async function deleteMember(id) {
    try {
      let { error } = await updateRecord("members", id, { status: "deleted", deleted_date: new Date().toISOString() });
      // Fallback: external DB may not have the deleted_date column
      if (error) ({ error } = await supabase.from("members").update({ status: "deleted" }).eq("id", id));
      if (error) throw error;
      toast.success("Account deleted");
      window.location.reload();
    } catch (err) { toast.error(err?.message || "Failed to delete"); }
  }

  async function restoreMember(id) {
    try {
      let { error } = await updateRecord("members", id, { status: "approved", deleted_date: null });
      if (error) ({ error } = await supabase.from("members").update({ status: "approved" }).eq("id", id));
      if (error) throw error;
      toast.success("Account restored");
      window.location.reload();
    } catch (err) { toast.error(err?.message || "Failed to restore"); }
  }

  async function saveEditMember() {
    try {
      await updateRecord("members", editMember.id, {
        password: editMember.password,
      });
      toast.success("Credentials updated");
      setEditMember(null);
      window.location.reload();
    } catch { toast.error("Failed to update credentials"); }
  }

  async function redeemCodeForMember() {
    if (!redeemModal || !redeemCode.trim()) { toast.error("Enter a code"); return; }
    setRedeemBusy(true);
    try {
      const member = redeemModal;
      const { data: found, error } = await supabase
        .from("maintenance_codes").select("*").ilike("code", redeemCode.replace(/[%_\\]/g, c => `\\${c}`)).eq("is_used", false).limit(1);
      if (error || !found?.length) { toast.error("Invalid or already used code"); setRedeemBusy(false); return; }
      const codeRecord = found[0];
      if (codeRecord.assigned_username && codeRecord.assigned_username !== member.username) {
        toast.error(`This code is assigned to @${codeRecord.assigned_username}`); setRedeemBusy(false); return;
      }
      await supabase.from("maintenance_codes").update({
        is_used: true, used_by_member_id: member.id, used_at: new Date().toISOString(),
      }).eq("id", codeRecord.id);
      await supabase.from("transactions").insert({
        member_id: member.id, type: "maintenance_code", amount: 0,
        description: `Redeemed maintenance code: ${codeRecord.code}`, status: "completed",
      });
      const { data: freshMembers } = await supabase.from("members").select("*");
      const { data: freshCodes } = await supabase.from("maintenance_codes").select("*");
      const allMembers = freshMembers || members;
      // Only distribute upline bonuses after the member has been placed under a chosen upline (status === "approved")
      const freshMember = allMembers.find(m => m.id === member.id);
      if (freshMember && freshMember.status !== "approved") {
        toast.success("Code redeemed. Member must be placed under an upline before commissions are distributed.");
        setRedeemModal(null); setRedeemCode("");
        window.location.reload();
        setRedeemBusy(false);
        return;
      }
      const canEarn = (m) => {
        if (!m || m.status !== "approved") return false;
        return maintenanceStatus(m, freshCodes || codes).isGreen;
      };
      let current = member;
      for (let level = 1; level <= MAX_BONUS_LEVEL; level++) {
        const upline = allMembers.find(m => m.id === current.referrer_id);
        if (!upline) break;
        if (canEarn(upline)) {
          const bonus = LEVEL_CONFIG.find(l => l.level === level)?.bonus_amount || 0;
          if (bonus > 0) await supabase.from("transactions").insert({
            member_id: upline.id, type: "referral_bonus", amount: bonus, bonus_level: level,
            description: `Level ${level} bonus from ${member.username}`, status: "completed", from_member_id: member.id,
          });
        }
        current = upline;
      }
      toast.success("Code redeemed successfully! Upline bonuses distributed.");
      setRedeemModal(null); setRedeemCode("");
      window.location.reload();
    } catch (err) { toast.error(err.message || "Failed to redeem code"); }
    setRedeemBusy(false);
  }

  function selectProfileMember(m) {
    setProfileMember(m);
    setProfileForm({
      full_name: m.full_name || "",
      age: m.age || "",
      email: m.email || "",
      phone: m.phone || "",
      gcash_number: m.gcash_number || "",
      gcash_name: m.gcash_name || "",
      facebook_name: m.facebook_name || "",
      address: m.address || "",
      backup_mobile: m.backup_mobile || "",
      password: "",
    });
    setProfileSearchOpen(false);
    setProfileSearch("");
  }

  async function saveProfile() {
    if (!profileMember) return;
    setSavingProfile(true);
    try {
      const updates = { ...profileForm };
      if (!updates.password) delete updates.password;
      await updateRecord("members", profileMember.id, updates);
      toast.success("Profile updated successfully!");
      setProfileMember({ ...profileMember, ...profileForm });
      window.location.reload();
    } catch { toast.error("Failed to update profile"); }
    setSavingProfile(false);
  }

  async function changeSponsor(memberId, newSponsorId) {
    try {
      const member = members.find(m => m.id === memberId);
      const oldSponsor = members.find(m => m.id === member.referrer_id);
      const newSponsor = newSponsorId ? members.find(m => m.id === newSponsorId) : null;
      await updateRecord("members", memberId, { referrer_id: newSponsorId || null });
      if (oldSponsor) await updateRecord("members", oldSponsor.id, { direct_downlines_count: Math.max(0, (oldSponsor.direct_downlines_count || 0) - 1) });
      if (newSponsor) await updateRecord("members", newSponsor.id, { direct_downlines_count: (newSponsor.direct_downlines_count || 0) + 1 });
      toast.success("Sponsor updated");
      setSponsorModal(null);
      window.location.reload();
    } catch { toast.error("Failed to change sponsor"); }
  }

  async function setRole(id, role) {
    try { await updateRecord("members", id, { role }); toast.success(role === "member" ? "Role removed" : `Promoted to ${role}`); window.location.reload(); }
    catch { toast.error("Failed to update role"); }
  }

  async function transferCodesToSubAdmin() {
    if (!transferSubAdminId) { toast.error("Select a sub-admin first"); return; }
    const count = parseInt(transferCodeCount) || 0;
    if (count < 1) { toast.error("Enter a valid count"); return; }
    setTransferring(true);
    try {
      const availableCodes = codes.filter(c => !c.is_used && !c.assigned_sub_admin_id && !c.assigned_username);
      if (availableCodes.length < count) { toast.error(`Only ${availableCodes.length} unassigned codes available`); setTransferring(false); return; }
      const toTransfer = availableCodes.slice(0, count);
      for (const c of toTransfer) {
        await supabase.from("maintenance_codes").update({ assigned_sub_admin_id: transferSubAdminId }).eq("id", c.id);
      }
      toast.success(`${count} code(s) transferred to ${subAdminMembers.find(sa => sa.id === transferSubAdminId)?.full_name || "sub-admin"}`);
      setTransferSubAdminId("");
      setTransferCodeCount("1");
      window.location.reload();
    } catch { toast.error("Failed to transfer codes"); }
    setTransferring(false);
  }

  async function saveGcash() {
    if (!gcash.gcash_number.trim() || !gcash.gcash_name.trim()) { toast.error("Please fill in both fields"); return; }
    try {
      for (const g of gcashInfo) await updateRecord("gcash_info", g.id, { is_active: false });
      await createRecord("gcash_info", { ...gcash, is_active: true });
      toast.success("GCash info saved!");
      setGcash({ gcash_number: "", gcash_name: "" });
      window.location.reload();
    } catch { toast.error("Failed to save GCash info"); }
  }

  function receiptUrl(r) {
    if (!r.receipt_url) return null;
    if (r.receipt_url.startsWith("http")) return r.receipt_url;
    // Strip leading "receipts/" if present — the bucket name is already "receipts"
    const path = r.receipt_url.replace(/^receipts\//, "");
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function verifyReceipt(id) {
    try { await updateRecord("gcash_receipts", id, { status: "verified" }); toast.success("Receipt verified"); window.location.reload(); }
    catch { toast.error("Failed to verify receipt"); }
  }

  async function deleteReceipt(id) {
    try {
      const receipt = receipts.find(r => r.id === id);
      if (receipt?.receipt_url && !receipt.receipt_url.startsWith("data:") && !receipt.receipt_url.startsWith("http")) {
        const path = receipt.receipt_url.replace(/^receipts\//, "");
        await supabase.storage.from("receipts").remove([path]);
      }
      await deleteRecord("gcash_receipts", id);
      toast.success("Receipt deleted");
      window.location.reload();
    } catch { toast.error("Failed to delete receipt"); }
  }

  async function saveMinAmount() {
    const val = parseFloat(minAmount);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid amount"); return; }
    setSavingMin(true);
    try {
      const existing = settings.find(s => s.setting_key === "withdrawal_minimum_amount");
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: String(val) });
      else await createRecord("system_settings", { setting_key: "withdrawal_minimum_amount", setting_value: String(val) });
      toast.success(`Minimum withdrawal set to ₱${val.toLocaleString()}`);
    } catch { toast.error("Failed to update"); }
    setSavingMin(false);
  }

  async function saveAutoRedeemTime() {
    if (!autoRedeemTime) { toast.error("Set a start time"); return; }
    try {
      const existing = settings.find(s => s.setting_key === "auto_redeem_start_time");
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: autoRedeemTime });
      else await createRecord("system_settings", { setting_key: "auto_redeem_start_time", setting_value: autoRedeemTime });
      // Reset today's run so the new time takes effect: if it is still ahead today it will fire then,
      // if it has already passed today it waits until tomorrow.
      const tzSetting = settings.find(s => s.setting_key === "auto_redeem_timezone")?.setting_value || "Asia/Manila";
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tzSetting, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value]));
      const [th, tm] = autoRedeemTime.split(":").map(Number);
      const passed = th * 60 + tm <= (+p.hour) * 60 + (+p.minute);
      const lastRunValue = passed ? `${p.year}-${p.month}-${p.day}` : "";
      const lastRun = settings.find(s => s.setting_key === "auto_redeem_last_run");
      if (lastRun) await updateRecord("system_settings", lastRun.id, { setting_value: lastRunValue });
      else if (passed) await createRecord("system_settings", { setting_key: "auto_redeem_last_run", setting_value: lastRunValue });
      toast.success("Auto-redeem start time saved");
    } catch { toast.error("Failed to update"); }
  }

  async function toggleAutoRedeem() {
    const newVal = !autoRedeemEnabled;
    setAutoRedeemEnabled(newVal);
    try {
      const existing = settings.find(s => s.setting_key === "auto_redeem_enabled");
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: String(newVal) });
      else await createRecord("system_settings", { setting_key: "auto_redeem_enabled", setting_value: String(newVal) });
      toast.success(`Auto-redeem ${newVal ? "enabled" : "disabled"}`);
    } catch { toast.error("Failed to update"); setAutoRedeemEnabled(!newVal); }
  }

  async function saveAnnouncement() {
    setSavingAnnouncement(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          [
            { setting_key: "announcement_text", setting_value: announcementText },
            { setting_key: "announcement_enabled", setting_value: String(announcementEnabled) },
          ],
          { onConflict: "setting_key" }
        );
      if (error) throw error;
      toast.success("Announcement saved");
      refetchSettings();
      window.dispatchEvent(new CustomEvent("system_settings_changed"));
    } catch (err) { toast.error(err?.message || "Failed to save announcement"); }
    setSavingAnnouncement(false);
  }

  async function toggleTab(key) {
    const settingKey = `tab_${key}_visible`;
    const newVal = !tabVisibility[key];
    setTabVisibility(v => ({ ...v, [key]: newVal }));
    try {
      const existing = settings.find(s => s.setting_key === settingKey);
      if (existing) await updateRecord("system_settings", existing.id, { setting_value: String(newVal) });
      else await createRecord("system_settings", { setting_key: settingKey, setting_value: String(newVal) });
      toast.success(`Tab ${newVal ? "shown" : "hidden"}`);
    } catch { toast.error("Failed to update"); }
  }

  function exportCSV() {
    const headers = ["Full Name", "Username", "Password", "Email", "Phone", "Role", "Status", "Referral Code", "Referrer", "Direct Downlines", "Tree Level", "Balance", "Total Earnings", "Approved Date"];
    const rows = activeMembers.map(m => {
      const referrer = members.find(r => r.id === m.referrer_id);
      return [m.full_name, m.username, m.password, m.email || "", m.phone || "", m.role, m.status, m.referral_code || "", referrer?.username || "", getDirectDownlineCount(m.id), m.tree_level || 0, getMemberBalance(m.id), getMemberEarnings(m.id).total, m.approved_date ? formatDate(m.approved_date, "MMM d, yyyy") : ""];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productprime-members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Spreadsheet exported!");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <style>{`
        .scroll-thick::-webkit-scrollbar { width: 42px !important; }
        .scroll-thick::-webkit-scrollbar-track { background: #e5e7eb !important; border-radius: 21px; }
        .scroll-thick::-webkit-scrollbar-thumb { background: #6b7280 !important; border-radius: 21px; border: 4px solid #e5e7eb; }
        .scroll-thick::-webkit-scrollbar-thumb:hover { background: #4b5563 !important; }
        .scroll-thick { scrollbar-width: thick !important; scrollbar-color: #6b7280 #e5e7eb !important; }
      `}</style>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage ProductPrime members and maintenance codes</p>
          </div>
        </div>
        <Button onClick={exportCSV} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Members", value: activeMembers.length, icon: Users, color: "from-amber-500 to-orange-600" },
          { label: "Pending Placements", value: pendingMembers.length, icon: Users, color: "from-yellow-500 to-amber-600" },
          { label: "Unused Codes", value: codes.filter(c => !c.is_used).length, icon: Ticket, color: "from-teal-500 to-emerald-600" },
          { label: "Pending Withdrawals", value: pendingWithdrawals.length, icon: Wallet, color: "from-blue-500 to-indigo-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all border ${tab === t.id ? `bg-gradient-to-r ${t.active} text-white shadow-lg border-transparent` : t.inactive}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-6">
          {/* Search & Password Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
            </div>
            <button onClick={() => setShowPasswords(v => !v)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border transition-all ${showPasswords ? "bg-orange-500 text-white border-transparent" : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"}`}>
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPasswords ? "Hide" : "Unhide"}
            </button>
          </div>

          {/* Members List — Card Layout */}
          {(() => {
            const approved = filteredMembers.filter(m => m.status === "approved");
            const activeMaintenance = approved.filter(m => maintenanceStatus(m, codes).isGreen);
            const expiredMaintenance = approved.filter(m => !maintenanceStatus(m, codes).isGreen);

            const renderRow = (m, index, isExpired = false) => {
              const status = maintenanceStatus(m, codes);
              return (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-900 last:border-0 px-2 hover:bg-gray-50 rounded-xl transition-colors">
                  {/* Index badge */}
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{index + 1}</div>
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{m.full_name}</p>
                    <p className="text-sm text-gray-400 truncate">@{m.username}</p>
                    {showPasswords && <p className="text-sm font-mono text-orange-600 truncate">🔑 {m.password || "—"}</p>}
                  </div>
                  {/* Status badge */}
                  <div className="flex-shrink-0">
                    {status.isGreen ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm font-medium text-green-700">{formatTime(status.secondsLeft)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm font-medium text-red-700">{status.secondsLeft > 0 ? formatTime(status.secondsLeft) : "Expired"}</span>
                      </div>
                    )}
                  </div>
                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className="text-sm font-bold text-gray-900">{money(getMemberBalance(m.id))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Downlines</p>
                      <p className="text-sm font-bold text-gray-900">{getDirectDownlineCount(m.id)}/8</p>
                    </div>
                  </div>
                  {/* Action pills */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setSponsorModal({ member: m, newSponsorId: "" })} className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-colors" title="Change Sponsor"><GitBranch className="w-4 h-4" /></button>
                    <button onClick={() => setEditMember({ ...m })} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors" title="Edit Member"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { setRedeemModal(m); setRedeemCode(""); }} className="p-2 bg-teal-100 text-teal-600 rounded-lg hover:bg-teal-200 transition-colors" title="Redeem Code"><Key className="w-4 h-4" /></button>
                    {(isSupAdmin || isOwner) && <button onClick={() => setOverrideModal(m)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors" title="Maintenance Override"><Clock className="w-4 h-4" /></button>}

                    {(isSupAdmin || isOwner) && <button onClick={() => setBalanceModal(m)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors" title="Edit Balance"><Wallet className="w-4 h-4" /></button>}
                    {isExpired && getDirectDownlineCount(m.id) === 0 && (
                      <button onClick={() => setConfirmDelete({ type: "member", id: m.id, name: m.full_name || m.username })} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete Account"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                {/* Active Maintenance */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-green-50">
                    <h3 className="font-bold text-green-900 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                      Active Maintenance ({activeMaintenance.length})
                    </h3>
                  </div>
                  <div className="p-2 max-h-[640px] overflow-y-auto overscroll-contain touch-pan-y scroll-thick">
                    {activeMaintenance.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">No active members</p>
                    ) : activeMaintenance.map((m, i) => renderRow(m, i))}
                  </div>
                </div>

                {/* Expired / No Maintenance */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-red-50">
                    <h3 className="font-bold text-red-900 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                      Expired / No Maintenance ({expiredMaintenance.length})
                    </h3>
                  </div>
                  <div className="p-2 max-h-[640px] overflow-y-auto overscroll-contain touch-pan-y scroll-thick">
                    {expiredMaintenance.length === 0 ? (
                      <p className="text-center py-8 text-gray-400">No expired members</p>
                    ) : expiredMaintenance.map((m, i) => renderRow(m, i, true))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Pending Approvals Tab */}
      {tab === "pending" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Pending Placements</h3>
                  <p className="text-sm text-gray-500">Monitoring only — referrers place these members via their Lobby.</p>
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700">{pendingMembers.length} waiting</Badge>
            </div>
            <div className="p-4 space-y-3">
              {pendingMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">No pending placements.</p>
                </div>
              ) : (
                pendingMembers.map(m => {
                  const status = maintenanceStatus(m, codes);
                  return (
                    <div key={m.id} className="flex items-center justify-between bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <div>
                        <p className="font-medium text-gray-900">{m.full_name} <span className="text-gray-400 text-sm">@{m.username}</span></p>
                        <p className="text-xs text-gray-500 mt-0.5">Referral: {m.referral_code || "—"} • Referred by: {members.find(r => r.id === m.referrer_id)?.username || "Direct"}</p>
                        <p className="text-xs text-amber-600 font-medium mt-1">Waiting for @{members.find(r => r.id === m.referrer_id)?.username || "—"} to place via Lobby</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status.isGreen ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-sm font-medium text-green-700">{formatTime(status.secondsLeft)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 rounded-lg">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            <span className="text-sm font-medium text-red-700">{status.secondsLeft > 0 ? formatTime(status.secondsLeft) : "Expired"}</span>
                          </div>
                        )}
                        <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Codes Tab */}
      {tab === "codes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-500" /> Generate Maintenance Codes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Count</Label><Input type="number" value={newCode.count} onChange={e => setNewCode({ ...newCode, count: e.target.value })} /></div>
              <div className="relative">
                <Label>Assign To (optional — locks code to this user)</Label>
                {newCode.assignedUsername && !assignedOpen ? (
                  <div className="flex items-center justify-between w-full h-12 rounded-xl border border-gray-200 px-4 bg-white">
                    <span className="text-sm font-medium text-gray-900">
                      {activeMembers.find(m => m.username === newCode.assignedUsername)?.full_name || ""} <span className="text-gray-400">(@{newCode.assignedUsername})</span>
                    </span>
                    <button type="button" onClick={() => { setNewCode({ ...newCode, assignedUsername: "" }); setAssignedSearch(""); setAssignedOpen(true); }} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={assignedSearch}
                    onChange={e => { setAssignedSearch(e.target.value); setAssignedOpen(true); }}
                    onFocus={() => setAssignedOpen(true)}
                    onBlur={() => setTimeout(() => setAssignedOpen(false), 200)}
                    placeholder={newCode.assignedUsername ? "Search to change..." : "Search username or name..."}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                )}
                {assignedOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg">
                    <button type="button" onClick={() => { setNewCode({ ...newCode, assignedUsername: "" }); setAssignedSearch(""); setAssignedOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${!newCode.assignedUsername ? "bg-amber-50 font-medium text-amber-700" : "text-gray-600"}`}>
                      Anyone (no lock)
                    </button>
                    {activeMembers
                      .filter(m => {
                        if (!assignedSearch) return true;
                        const q = assignedSearch.toLowerCase();
                        return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
                      })
                      .slice(0, 50)
                      .map(m => (
                        <button key={m.id} type="button"
                          onClick={() => { setNewCode({ ...newCode, assignedUsername: m.username }); setAssignedSearch(""); setAssignedOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors ${newCode.assignedUsername === m.username ? "bg-amber-50 font-medium text-amber-700" : "text-gray-700"}`}>
                          {m.full_name} <span className="text-gray-400">(@{m.username})</span>
                        </button>
                      ))}
                    {assignedSearch && activeMembers.filter(m => {
                      const q = assignedSearch.toLowerCase();
                      return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400">No members found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={generateCodes} className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white"><Plus className="w-4 h-4 mr-2" /> Generate Codes</Button>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Code", "Assigned To", "Status", "Used By", "Date", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {codes.slice(0, 100).map(c => {
                    const usedBy = members.find(m => m.id === c.used_by_member_id);
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td onClick={() => copyCode(c.code)} className="px-6 py-4 text-sm font-mono font-bold text-gray-900 cursor-pointer hover:text-amber-600 transition-colors select-none" title="Click to copy">{c.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "—"}</td>
                        <td className="px-6 py-4"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{usedBy?.username || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at, "MMM d, yyyy") : "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button onClick={() => copyCode(c.code)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                            {c.is_used && <button onClick={() => setConfirmDelete({ type: "code", id: c.id, name: c.code })} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawals Tab */}
      {tab === "withdrawals" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> Minimum Withdrawal Amount</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Amount (₱)</Label><Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></div>
              <Button onClick={saveMinAmount} disabled={savingMin} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Save</Button>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  {["Member", "Amount", "Status", "Date", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {withdrawals.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-gray-400">No withdrawal requests</td></tr> :
                  withdrawals.map(w => {
                    const member = members.find(m => m.id === w.member_id);
                    return (
                      <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{member?.full_name || "—"}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{money(w.amount)}</td>
                        <td className="px-6 py-4"><Badge className={w.status === "pending" ? "bg-yellow-100 text-yellow-700" : w.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{w.status}</Badge></td>
                        <td className="px-6 py-4 text-sm text-gray-400">{formatDate(w.created_date || w.created_at, "MMM d, yyyy")}</td>
                        <td className="px-6 py-4">
                          {w.status === "pending" && (
                            <div className="flex gap-2">
                              <Button onClick={() => approveWithdrawal(w.id)} size="sm" className="bg-green-600 text-white h-8 px-3 text-xs"><Check className="w-3 h-3" /></Button>
                              <Button onClick={() => rejectWithdrawal(w.id)} size="sm" className="bg-red-600 text-white h-8 px-3 text-xs"><X className="w-3 h-3" /></Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Tab */}
      {tab === "history" && <AdminTransactionHistory members={members} transactions={transactions} />}

      {/* Product Conversion Tab */}
      {tab === "product_conversion" && (
        <div className="space-y-6">
          {(() => {
            const productConversions = transactions
              .filter(t => t.type === "product_conversion")
              .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
            const totalConverted = productConversions
              .filter(t => t.status === "completed")
              .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
            const uniqueMembers = new Set(productConversions.map(t => t.member_id)).size;

            return (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center mb-3">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{productConversions.length}</p>
                    <p className="text-sm text-gray-500">Total Conversions</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-3">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{money(totalConverted)}</p>
                    <p className="text-sm text-gray-500">Total Amount Converted</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-3">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{uniqueMembers}</p>
                    <p className="text-sm text-gray-500">Members Who Converted</p>
                  </div>
                </div>

                {/* Conversion list */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-purple-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Product Wallet Conversions</h3>
                        <p className="text-sm text-gray-500">Members who converted their balance to Product Wallet.</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700">{productConversions.length} total</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {["Member", "Amount", "Status", "Description", "Date"].map(h => (
                            <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {productConversions.length === 0 ? (
                          <tr><td colSpan="5" className="text-center py-12 text-gray-400">No product conversions yet</td></tr>
                        ) : productConversions.map(t => {
                          const member = members.find(m => m.id === t.member_id);
                          return (
                            <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                                {member?.full_name || "—"} <span className="text-gray-400 text-xs">@{member?.username || ""}</span>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-purple-600 whitespace-nowrap">{money(Math.abs(t.amount || 0))}</td>
                              <td className="px-6 py-4">
                                <Badge className={t.status === "completed" ? "bg-green-100 text-green-700" : t.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{t.status}</Badge>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{t.description || "—"}</td>
                              <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(t.created_date || t.created_at, "MMM d, yyyy")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Genealogy Tab */}
      {tab === "genealogy" && <Genealogy />}

      {/* Monitoring Tab */}
      {tab === "monitoring" && (
        <div className="space-y-6">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-gray-900">Downline Monitoring</h2>
            <p className="text-gray-500 text-sm">Track each 1st-level downline's maintenance-code redemptions, cycle by cycle.</p>
          </div>
          {/* Member selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Select member:</label>
            <select
              value={monitorMember?.id || ""}
              onChange={e => {
                const m = approvedMembers.find(m => m.id === e.target.value);
                setMonitorMember(m || null);
              }}
              className="flex-1 max-w-sm h-10 rounded-xl border border-gray-200 px-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-white"
            >
              <option value="">Choose a member...</option>
              {approvedMembers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name} (@{m.username})</option>
              ))}
            </select>
          </div>
          {monitorMember ? (
            <MonitoringView member={monitorMember} members={members} codes={codes} />
          ) : (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
              <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">Select a member above to view their 1st-level downline monitoring.</p>
            </div>
          )}
        </div>
      )}

      {/* GCash Tab */}
      {tab === "gcash" && (
        <div className="space-y-6">
          {/* GCash Setup */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> GCash Payment Info</h2>
            {activeGcash && (
              <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Current Active GCash</p>
                <p className="font-bold text-blue-700 text-xl">{activeGcash.gcash_name}</p>
                <p className="font-bold text-blue-700 text-lg">{activeGcash.gcash_number}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>GCash Name</Label><Input value={gcash.gcash_name} onChange={e => setGcash({ ...gcash, gcash_name: e.target.value })} placeholder="e.g. Juan Dela Cruz" /></div>
              <div><Label>GCash Number</Label><Input value={gcash.gcash_number} onChange={e => setGcash({ ...gcash, gcash_number: e.target.value })} placeholder="e.g. 09XXXXXXXX" /></div>
            </div>
            <Button onClick={saveGcash} className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white"><Smartphone className="w-4 h-4 mr-2" /> Save GCash Info</Button>
          </div>

          {/* Member GCash Receipts */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Member GCash Receipts</h3>
                  <p className="text-sm text-gray-500">Receipts uploaded by members as proof of payment.</p>
                </div>
              </div>
              <Badge className="bg-purple-100 text-purple-700">{receipts.length} total</Badge>
            </div>
            <div className="p-4 space-y-3">
              {receipts.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">No receipts uploaded yet.</p>
                </div>
              ) : (
                [...receipts].sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)).map(r => {
                  const member = members.find(m => m.id === r.member_id);
                  const name = r.member_name || member?.full_name || member?.username || "Unknown";
                  const date = r.created_at || r.created_date;
                  return (
                    <div key={r.id} className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      {/* Receipt thumbnail — click to view full size */}
                      <button
                        onClick={() => setPreviewReceipt(r)}
                        className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all relative group"
                        title="Click to view receipt"
                      >
                        {signedUrls[r.id] ? (
                          <img src={signedUrls[r.id]} alt="Receipt" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                      {/* Receipt info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{date ? new Date(date).toLocaleString("en-PH", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }) : "—"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {r.status === "pending" && <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>}
                          {r.status === "verified" && <Badge className="bg-green-100 text-green-700">Verified</Badge>}
                          {r.status === "rejected" && <Badge className="bg-red-100 text-red-700">Rejected</Badge>}
                          <div className="flex gap-2">
                            {r.status === "pending" && (
                              <Button onClick={() => verifyReceipt(r.id)} size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"><Check className="w-3 h-3 mr-1" /> Verify</Button>
                            )}
                            <Button onClick={() => deleteReceipt(r.id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs"><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deleted Accounts Tab */}
      {tab === "deleted" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-red-50">
            <h2 className="font-semibold text-red-900 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Deleted Accounts</h2>
            <p className="text-sm text-red-600 mt-1">These accounts have been deleted. You can restore them at any time.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Name", "Username", "Deleted On", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {deletedMembers.length === 0 ? <tr><td colSpan="4" className="text-center py-12 text-gray-400">No deleted accounts</td></tr> :
                deletedMembers.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{m.deleted_date ? formatDate(m.deleted_date, "MMM d, yyyy") : "—"}</td>
                    <td className="px-6 py-4">
                      <Button onClick={() => restoreMember(m.id)} size="sm" className="bg-teal-600 text-white h-8 px-3 text-xs"><RotateCcw className="w-3 h-3 mr-1" /> Restore</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {tab === "roles" && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-indigo-50">
            <h2 className="font-semibold text-indigo-900 flex items-center gap-2"><UserCog className="w-4 h-4" /> Admin Role Management</h2>
            <p className="text-sm text-indigo-600 mt-1">Promote approved members to admin or sub-admin so they can manage the system.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {["Name", "Username", "Current Role", "Actions"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {approvedMembers.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">@{m.username}</td>
                    <td className="px-6 py-4"><Badge className="bg-gray-100 text-gray-600 capitalize">{m.role}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {m.role !== "admin" && <Button onClick={() => setRole(m.id, "admin")} size="sm" className="bg-purple-600 text-white h-8 px-3 text-xs"><Crown className="w-3 h-3 mr-1" /> Make Admin</Button>}
                        {m.role === "admin" && <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50 h-8 px-3 text-xs">Remove Admin</Button>}
                        {m.role !== "sub_admin" && m.role !== "admin" && <Button onClick={() => setRole(m.id, "sub_admin")} size="sm" className="bg-amber-500 text-white h-8 px-3 text-xs"><Shield className="w-3 h-3 mr-1" /> Make Sub-Admin</Button>}
                        {m.role === "sub_admin" && <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 h-8 px-3 text-xs">Remove Sub-Admin</Button>}
                        {m.role !== "store" && m.role !== "admin" && m.role !== "sub_admin" && <Button onClick={() => setRole(m.id, "store")} size="sm" className="bg-emerald-600 text-white h-8 px-3 text-xs"><Store className="w-3 h-3 mr-1" /> Make Store</Button>}
                        {m.role === "store" && <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 h-8 px-3 text-xs">Remove Store</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Admins Tab */}
      {tab === "subadmins" && (
        <div className="space-y-6">
          {/* Sub-Admin Role Management */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden border-t-4 border-t-purple-500">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" /> Sub-Admin Role Management
              </h2>
              <p className="text-sm text-gray-500 mt-1">Promote approved members to sub-admin so they can redeem codes for users and manage their assigned users.</p>
            </div>
            <div className="p-5">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={subAdminSearch} onChange={e => setSubAdminSearch(e.target.value)} placeholder="Search members by name, email, or username..." className="pl-10" />
              </div>
              {/* Member list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {approvedMembers.filter(m => {
                  if (m.role === "admin") return false;
                  if (!subAdminSearch) return true;
                  const q = subAdminSearch.toLowerCase();
                  return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
                }).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{m.username}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {m.role === "sub_admin" ? "Sub-Admin" : "Member"}{m.email ? ` · ${m.email}` : ""}{m.full_name ? ` · ${m.full_name}` : ""}
                      </p>
                    </div>
                    {m.role === "sub_admin" ? (
                      <Button onClick={() => setRole(m.id, "member")} size="sm" variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 h-9 px-4 text-xs whitespace-nowrap">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Remove
                      </Button>
                    ) : (
                      <Button onClick={() => setRole(m.id, "sub_admin")} size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 text-white h-9 px-4 text-xs whitespace-nowrap">
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Make Sub-Admin
                      </Button>
                    )}
                  </div>
                ))}
                {approvedMembers.filter(m => {
                  if (m.role === "admin") return false;
                  if (!subAdminSearch) return true;
                  const q = subAdminSearch.toLowerCase();
                  return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-center py-8 text-gray-400">No members found.</p>
                )}
              </div>
            </div>
          </div>

          {/* Transfer Maintenance Codes to Sub-Admin */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden border-t-4 border-t-teal-500">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-teal-500" /> Transfer Maintenance Codes to Sub-Admin
              </h2>
              <p className="text-sm text-gray-500 mt-1">Transfer unused codes to a sub-admin. Only that sub-admin can redeem them for users.</p>
            </div>
            <div className="p-5">
              {subAdminMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">No sub-admins yet. Promote a member above first.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sub-Admin selector */}
                  <div>
                    <Label>Select Sub-Admin</Label>
                    <select value={transferSubAdminId} onChange={e => setTransferSubAdminId(e.target.value)}
                      className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 bg-white">
                      <option value="">Select a sub-admin</option>
                      {subAdminMembers.map(sa => {
                        const assignedCodes = codes.filter(c => c.assigned_sub_admin_id === sa.id);
                        const unusedCount = assignedCodes.filter(c => !c.is_used).length;
                        return (
                          <option key={sa.id} value={sa.id}>{sa.full_name} (@{sa.username}) — {unusedCount} unused codes</option>
                        );
                      })}
                    </select>
                  </div>
                  {/* Code count */}
                  <div>
                    <Label>Number of Codes to Transfer</Label>
                    <Input type="number" value={transferCodeCount} onChange={e => setTransferCodeCount(e.target.value)} placeholder="e.g. 5" />
                  </div>
                  <p className="text-xs text-gray-400">
                    {codes.filter(c => !c.is_used && !c.assigned_sub_admin_id && !c.assigned_username).length} unassigned codes available.
                  </p>
                  <Button onClick={transferCodesToSubAdmin} disabled={transferring || !transferSubAdminId}
                    className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white">
                    <ArrowRight className="w-4 h-4 mr-2" /> {transferring ? "Transferring..." : "Transfer Codes"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Existing Sub-Admin Overview */}
          {subAdminMembers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Current Sub-Admins</h3>
              {subAdminMembers.map(sa => {
                const assignedCodes = codes.filter(c => c.assigned_sub_admin_id === sa.id);
                const unusedCodes = assignedCodes.filter(c => !c.is_used);
                const managedMembers = approvedMembers.filter(m => m.referrer_id === sa.id);
                return (
                  <div key={sa.id} className="bg-white rounded-2xl border border-gray-100 shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-amber-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{sa.full_name}</p>
                        <p className="text-xs text-gray-500">@{sa.username}</p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-600"><strong>{assignedCodes.length}</strong> codes</span>
                        <span className="text-gray-600"><strong>{unusedCodes.length}</strong> unused</span>
                        <span className="text-gray-600"><strong>{managedMembers.length}</strong> members</span>
                      </div>
                    </div>
                    {managedMembers.length > 0 && (
                      <div className="p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Managed Members</p>
                        <div className="space-y-1">
                          {managedMembers.map(mm => (
                            <div key={mm.id} className="flex items-center justify-between text-sm py-1">
                              <span className="text-gray-700">{mm.full_name} <span className="text-gray-400">@{mm.username}</span></span>
                              <Badge className={mm.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{mm.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Store Tab */}
      {tab === "store" && (
        <AdminStoreTab approvedMembers={approvedMembers} members={members} codes={codes} quotas={storeQuotas}
          currentMemberId={currentMemberId} setRole={setRole} refetchQuotas={refetchQuotas} refetchCodes={refetchCodes} />
      )}

      {/* Announcement Tab */}
      {tab === "announcement" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-500" /> Announcement</h2>
            <p className="text-sm text-gray-500 mb-4">Write a text announcement that appears above "Welcome back" on every user dashboard. Turn on "Visible to users" before saving, or it stays hidden.</p>
            <div className="space-y-4">
              <div>
                <Label>Announcement Text</Label>
                <textarea
                  value={announcementText}
                  onChange={e => setAnnouncementText(e.target.value)}
                  rows={4}
                  placeholder="Enter your announcement here..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setAnnouncementEnabled(v => !v)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${announcementEnabled ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${announcementEnabled ? "translate-x-6" : ""}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">{announcementEnabled ? "Visible to users" : "Hidden from users"}</span>
                </label>
                <Button onClick={saveAnnouncement} disabled={savingAnnouncement} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  {savingAnnouncement ? "Saving..." : "Save Announcement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> Minimum Withdrawal Amount</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Amount (₱)</Label><Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></div>
              <Button onClick={saveMinAmount} disabled={savingMin} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Save</Button>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Auto-Redeem</h2>
            <p className="text-sm text-gray-500 mb-4">Members' auto-redeem for store-generated codes starts at this time of day.</p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 mb-4">
              <div>
                <span className="font-medium text-gray-700">Auto-Redeem Enabled</span>
                <p className="text-xs text-gray-400">When off, the auto-redeem section is hidden from members' Code Cabinet.</p>
              </div>
              <button onClick={toggleAutoRedeem}
                className={`relative w-12 h-6 rounded-full transition-colors ${autoRedeemEnabled ? "bg-green-500" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoRedeemEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label>Start time</Label><Input type="time" value={autoRedeemTime} onChange={e => setAutoRedeemTime(e.target.value)} /></div>
              <Button onClick={saveAutoRedeemTime} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">Save</Button>
            </div>
          </div>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500" /> Sidebar Tab Visibility</h2>
            <div className="space-y-3">
              {[
                ...(canManageTabs ? [{ key: "monitoring", label: "Downline Monitoring" }] : []),
                ...(canManageTabs ? [{ key: "subadmin", label: "Sub-Admins" }] : []),
                ...(canManageTabs ? [{ key: "product_conversion", label: "Product Conversion" }] : []),
                { key: "terms", label: "Terms & Conditions" },
                { key: "complan", label: "ProductPrime ComPlan" },
              ].map(t => (
                <div key={t.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <span className="font-medium text-gray-700">{t.label}</span>
                  <button onClick={() => toggleTab(t.key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${tabVisibility[t.key] ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${tabVisibility[t.key] ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My Profile Tab */}
      {tab === "profile" && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Member Search Selector */}
          <div className="relative">
            <button onClick={() => setProfileSearchOpen(o => !o)}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 h-12 hover:border-amber-400 transition-colors">
              <span className={profileMember ? "text-gray-900 font-medium" : "text-gray-400"}>
                {profileMember ? `${profileMember.full_name} (@${profileMember.username})` : "Choose a member..."}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {profileSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 z-20 max-h-80 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input value={profileSearch} onChange={e => setProfileSearch(e.target.value)} placeholder="Search members by name or username..." className="pl-10" autoFocus />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {activeMembers.filter(m => {
                    if (!profileSearch) return true;
                    const q = profileSearch.toLowerCase();
                    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
                  }).map(m => (
                    <button key={m.id} onClick={() => selectProfileMember(m)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 ${profileMember?.id === m.id ? "bg-gray-100" : ""}`}>
                      <span className="font-medium text-gray-900">{m.full_name}</span> <span className="text-gray-400">(@{m.username})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {profileMember && profileForm ? (
            <>
              {/* Account info card */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {(profileMember.full_name || "U").charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-gray-900">{profileMember.full_name || profileMember.username}</p>
                    <p className="text-sm text-gray-500">@{profileMember.username}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 capitalize">{profileMember.role}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div><p className="text-xs text-gray-500">Referral Code</p><p className="font-mono font-bold text-gray-900">{profileMember.referral_code || "—"}</p></div>
                  <div><p className="text-xs text-gray-500">Status</p><p className="font-bold text-gray-900 capitalize">{profileMember.status}</p></div>
                  <div><p className="text-xs text-gray-500">Tree Level</p><p className="font-bold text-gray-900">{profileMember.tree_level || 0}</p></div>
                  <div><p className="text-xs text-gray-500">Direct Downlines</p><p className="font-bold text-gray-900">{profileMember.direct_downlines_count || 0}</p></div>
                </div>
                {profileMember.referral_code && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Referral Link</p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-amber-200 text-sm text-gray-700 truncate">{window.location.origin}/Register?ref={profileMember.referral_code}</div>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/Register?ref=${profileMember.referral_code}`); toast.success("Referral link copied!"); }} className="px-4 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex-shrink-0" title="Copy referral link"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Personal Information */}
              <div className="bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Personal Information</h2>
                <div className="space-y-4">
                  {[
                    { key: "full_name", label: "Full Name" },
                    { key: "age", label: "Age", type: "number" },
                    { key: "email", label: "Email", type: "email" },
                    { key: "phone", label: "Phone" },
                    { key: "facebook_name", label: "Facebook Name" },
                    { key: "backup_mobile", label: "Complete Address" },
                    { key: "address", label: "Saan malapit ang Address" },
                  ].map(f => (
                    <div key={f.key}>
                      <Label className="text-white">{f.label}</Label>
                      <Input value={profileForm[f.key] || ""} onChange={e => setProfileForm({ ...profileForm, [f.key]: e.target.value })} type={f.type || "text"} className="bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* GCash Details */}
              <div className="bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-6">
                <h2 className="text-lg font-bold text-white mb-4">GCash Details</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white">GCash Number</Label>
                    <div className="flex gap-2">
                      <Input value={profileForm.gcash_number || ""} onChange={e => setProfileForm({ ...profileForm, gcash_number: e.target.value })} placeholder="09XX XXX XXXX" className="flex-1 bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
                      <button onClick={() => { if (profileForm.gcash_number) { navigator.clipboard.writeText(profileForm.gcash_number); toast.success("GCash number copied!"); } }} className="px-4 bg-white border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0" title="Copy GCash number"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div><Label className="text-white">GCash Name</Label><Input value={profileForm.gcash_name || ""} onChange={e => setProfileForm({ ...profileForm, gcash_name: e.target.value })} placeholder="Registered name" className="bg-white border-gray-300 text-gray-900 placeholder-gray-400" /></div>
                </div>
              </div>

              {/* Change Password */}
              <div className="bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Change Password</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Current Password</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-gray-900 flex-1 break-all">{profileMember.password || "—"}</p>
                    <button onClick={() => { navigator.clipboard.writeText(profileMember.password || ""); toast.success("Password copied!"); }} className="p-2 bg-yellow-100 text-orange-600 rounded-lg hover:bg-yellow-200 transition-colors flex-shrink-0" title="Copy password"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <Label className="text-white">New Password</Label>
                  <Input value={profileForm.password || ""} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} type="password" placeholder="Leave blank to keep current password" className="bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
                </div>
              </div>

              <Button onClick={saveProfile} disabled={savingProfile} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white h-12 rounded-xl font-bold">
                <Save className="w-4 h-4 mr-2" /> {savingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-12 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">Select a member above to view and edit their profile.</p>
            </div>
          )}
        </div>
      )}

      {/* Reset Credentials Modal */}
      {editMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditMember(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Reset Credentials — {editMember.username}</h2>
                <button onClick={() => setEditMember(null)} className="p-1 rounded-lg hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label>Username</Label>
                  <div className="flex items-center gap-2">
                    <Input value={editMember.username || ""} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" />
                    <button onClick={() => { navigator.clipboard.writeText(editMember.username || ""); toast.success("Username copied!"); }} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex-shrink-0" title="Copy username"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Current Password</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-gray-900 flex-1 break-all">{editMember.password || "—"}</p>
                    <button onClick={() => { navigator.clipboard.writeText(editMember.password || ""); toast.success("Password copied!"); }} className="p-2 bg-yellow-100 text-orange-600 rounded-lg hover:bg-yellow-200 transition-colors flex-shrink-0" title="Copy password"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
                <div><Label>New Password</Label><Input value={editMember.password || ""} onChange={e => setEditMember({ ...editMember, password: e.target.value })} /></div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <Button onClick={() => setEditMember(null)} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={saveEditMember} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white">Save Changes</Button>
              </div>
          </div>
        </div>
      )}

      {/* Redeem Code Modal */}
      {redeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setRedeemModal(null); setRedeemCode(""); }}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Key className="w-5 h-5 text-teal-600" /> Redeem Code — {redeemModal.username}</h2>
                <button onClick={() => { setRedeemModal(null); setRedeemCode(""); }} className="p-1 rounded-lg hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <p className="text-sm text-teal-800">Enter a maintenance code to redeem on behalf of this member. The 5-level upline bonuses will be distributed automatically using the same rules as the member's own redemption.</p>
                </div>
                <div>
                  <Label>Maintenance Code</Label>
                  <Input value={redeemCode} onChange={e => setRedeemCode(e.target.value)} placeholder="e.g. MAINT-XXXXXX" className="font-mono" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <Button onClick={() => { setRedeemModal(null); setRedeemCode(""); }} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={redeemCodeForMember} disabled={redeemBusy} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white">{redeemBusy ? "Redeeming..." : "Redeem Code"}</Button>
              </div>
          </div>
        </div>
      )}

      {/* Change Sponsor Modal */}
      {sponsorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSponsorModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GitBranch className="w-5 h-5 text-amber-500" /> Change Sponsor — {sponsorModal.member?.full_name}</h2>
                <button onClick={() => setSponsorModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500">Current sponsor: {members.find(m => m.id === sponsorModal.member?.referrer_id)?.username || "None (root)"}</p>
                <p className="text-sm text-gray-500">Changing the sponsor will update downline counts for both old and new sponsors.</p>
                <div>
                  <Label>Select New Sponsor</Label>
                  <select value={sponsorModal.newSponsorId} onChange={e => setSponsorModal({ ...sponsorModal, newSponsorId: e.target.value })}
                    className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                    <option value="">None (root — no sponsor)</option>
                    {approvedMembers.filter(m => m.id !== sponsorModal.member?.id).map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} (@{m.username}) — {m.direct_downlines_count || 0}/8 downlines</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <Button onClick={() => changeSponsor(sponsorModal.member.id, sponsorModal.newSponsorId)} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white">Update Sponsor</Button>
                <Button onClick={() => setSponsorModal(null)} variant="outline" className="flex-1">Cancel</Button>
              </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      <AnimatePresence>
        {previewReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewReceipt(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {members.find(m => m.id === previewReceipt.member_id)?.full_name || previewReceipt.member_name || "Receipt"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {previewReceipt.created_at ? new Date(previewReceipt.created_at).toLocaleString("en-PH") : "—"}
                  </p>
                </div>
                <button onClick={() => setPreviewReceipt(null)} className="p-1 rounded-lg hover:bg-gray-100">
                  <XIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center bg-gray-50 min-h-[300px] max-h-[70vh] overflow-auto">
                {signedUrls[previewReceipt.id] ? (
                  <img
                    src={signedUrls[previewReceipt.id]}
                    alt="Receipt"
                    className="max-w-full max-h-[60vh] rounded-xl object-contain"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div className="flex flex-col items-center text-gray-400" style={{ display: signedUrls[previewReceipt.id] ? 'none' : 'flex' }}>
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p className="text-sm">No image available for this receipt.</p>
                </div>
              </div>
              {previewReceipt.status === "pending" && (
                <div className="p-4 border-t border-gray-100 flex gap-3 justify-end">
                  <Button
                    onClick={() => { verifyReceipt(previewReceipt.id); setPreviewReceipt(null); }}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" /> Verify
                  </Button>
                  <Button
                    onClick={() => { deleteReceipt(previewReceipt.id); setPreviewReceipt(null); }}
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Delete</h3>
              <p className="text-sm text-gray-500 mb-1">
                {confirmDelete.type === "member"
                  ? "Are you sure you want to delete this account?"
                  : "Are you sure you want to delete this code?"}
              </p>
              <p className="text-sm font-semibold text-gray-700 mb-6 break-all">{confirmDelete.name}</p>
              {confirmDelete.type === "member" && (
                <p className="text-xs text-gray-400 mb-4">They can be restored later from the Deleted tab.</p>
              )}
              <div className="flex gap-3">
                <Button onClick={() => setConfirmDelete(null)} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={confirmDeleteAction} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {overrideModal && (
        <MaintenanceOverrideModal
          member={overrideModal}
          codes={codes}
          onClose={() => setOverrideModal(null)}
          onApplied={() => window.location.reload()}
        />
      )}

      {balanceModal && (
        <EditBalanceModal
          member={balanceModal}
          currentBalance={getMemberBalance(balanceModal.id)}
          onClose={() => setBalanceModal(null)}
          onApplied={() => window.location.reload()}
        />
      )}
    </div>
  );
}
