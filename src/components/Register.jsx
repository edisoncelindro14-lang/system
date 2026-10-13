import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { User, Lock, UserPlus, Eye, EyeOff, GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { saveMemberSession } from "../lib/auth";
import { generateReferralCode } from "../lib/helpers";
import AuthShell, { ORANGE_GRADIENT, GOLD_GRADIENT } from "./AuthShell";
import AuthInput from "./AuthInput";

export default function Register() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || "";
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", confirm_password: "" });
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | checking | taken | available
  const [termsVisible, setTermsVisible] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_settings").select("setting_value").eq("setting_key", "tab_terms_visible").limit(1);
      if (data?.[0]) setTermsVisible(data[0].setting_value !== "false");
    })();
  }, []);

  useEffect(() => {
    if (!ref) return;
    (async () => {
      const { data } = await supabase.from("members").select("username,referral_code,full_name").eq("referral_code", ref).limit(1);
      if (data?.[0]) setReferrerInfo(data[0]);
    })();
  }, [ref]);

  // Live username availability check (debounced)
  useEffect(() => {
    const username = form.username.trim();
    if (!username) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const { data: existing } = await supabase.from("members").select("id").ilike("username", username).limit(1);
      setUsernameStatus(existing?.length > 0 ? "taken" : "available");
    }, 400);
    return () => clearTimeout(timer);
  }, [form.username]);

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (usernameStatus === "taken") {
      toast.error("Username is already taken. Please choose another.");
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase.from("members").select("id").ilike("username", form.username.trim()).limit(1);
      if (existing?.length > 0) {
        toast.error("Username already taken");
        setBusy(false);
        return;
      }
      let referrerId = null;
      let referrer = null;
      let autoPlace = false;
      if (ref) {
        const { data: refRows } = await supabase.from("members").select("id,tree_level,direct_downlines_count").eq("referral_code", ref).limit(1);
        referrer = refRows?.[0] || null;
        if (referrer) {
          referrerId = referrer.id;
          // Place directly under the referrer while they have fewer than 8 direct downlines; otherwise lobby
          const { count } = await supabase
            .from("members")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved")
            .or(`placement_id.eq.${referrerId},and(placement_id.is.null,referrer_id.eq.${referrerId})`);
          autoPlace = (count ?? 8) < 8;
        }
      }
      const { data: newMember, error } = await supabase
        .from("members")
        .insert({
          username: form.username,
          password: form.password,
          full_name: form.username,
          referral_code: generateReferralCode(),
          referrer_id: referrerId,
          status: referrerId && !autoPlace ? "pending" : "approved",
          role: "member",
          tree_level: autoPlace ? (referrer.tree_level || 0) + 1 : 0,
          ...(autoPlace ? { placement_id: referrerId, approved_date: new Date().toISOString() } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      if (autoPlace) {
        await supabase.from("members").update({ direct_downlines_count: (referrer.direct_downlines_count || 0) + 1 }).eq("id", referrerId);
      }
      saveMemberSession(newMember.id);
      toast.success(`Welcome, ${newMember.full_name}!`);
      nav("/Dashboard");
    } catch (err) {
      toast.error(err.message || "Registration failed");
    }
    setBusy(false);
  }

  const usernameBorder =
    usernameStatus === "taken" ? "!border-red-400" : usernameStatus === "available" ? "!border-green-400" : "";

  const usernameBadge = {
    taken: <span className="text-red-400 text-sm font-medium">✕ Taken</span>,
    available: <span className="text-green-400 text-sm font-medium">✓ Available</span>,
    checking: <span className="text-white/60 text-sm">Checking...</span>,
  }[usernameStatus];

  return (
    <AuthShell title="ProductPrime Registration Form" backTo="/MemberLogin">
      <form onSubmit={submit} className="space-y-6">
        {referrerInfo && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/30" style={{ background: "rgba(255,255,255,0.12)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ORANGE_GRADIENT }}>
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-orange-300 font-medium">Referred by</p>
              <p className="text-sm font-bold text-white truncate">@{referrerInfo.username}</p>
              <p className="text-xs text-white/60">Referral Code: {referrerInfo.referral_code}</p>
            </div>
          </div>
        )}

        <div>
          <AuthInput
            label="Username"
            required
            icon={User}
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            placeholder="Choose a username"
            className={`${usernameBorder} !pr-28`}
            trailing={usernameBadge}
          />
          {usernameStatus === "taken" && (
            <p className="mt-2 text-sm text-red-400 font-medium">This username is already taken. Please choose another.</p>
          )}
        </div>

        <AuthInput
          label="Password"
          required
          icon={Lock}
          type={showPwd ? "text" : "password"}
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="At least 6 characters"
          trailing={
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="hover:opacity-80">
              {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
        />

        <AuthInput
          label="Confirm Password"
          required
          icon={Lock}
          type={showPwd ? "text" : "password"}
          value={form.confirm_password}
          onChange={e => setForm({ ...form, confirm_password: e.target.value })}
          placeholder="Re-enter your password"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full h-[52px] rounded-xl text-white text-base font-medium flex items-center justify-center gap-3 shadow-lg hover:brightness-110 transition disabled:opacity-60"
          style={{ background: ORANGE_GRADIENT }}
        >
          {busy ? "Submitting..." : "Submit Registration"} <UserPlus className="w-5 h-5" />
        </button>

        <p className="text-center text-white text-[17px]">
          Already have an account? <Link to="/MemberLogin" className="text-orange-400 hover:underline">Login here</Link>
        </p>

        {termsVisible && (
          <a href="https://forms.gle/bMLvWgG2KGfYXzBz8" target="_blank" rel="noopener noreferrer" className="block">
            <button
              type="button"
              className="w-full h-[52px] rounded-xl text-base font-medium shadow-lg hover:brightness-105 transition"
              style={{ background: GOLD_GRADIENT, color: "#4a3410" }}
            >
              Membership Terms &amp; Conditions
            </button>
          </a>
        )}
      </form>
    </AuthShell>
  );
}
