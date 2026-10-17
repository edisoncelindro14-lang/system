import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, GitBranch, Users, Wallet, Layers, User, Shield, Crown, Store, LogOut, Menu, X, ChevronRight, Archive } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { clearMemberSession, getSessionMemberId } from "../lib/auth";
import { MaintenanceBanner } from "./MaintenanceBanner";
import { MaintenanceProvider } from "../lib/useMaintenance";
import { GCashButton } from "./GCashButton";
import RiceFieldBackground from "./RiceFieldBackground";
import { clearDataCache } from "../lib/useData";

const LOGO_URL = "https://media.base44.com/images/public/6ad0559cb2cdb34b8de882bb/05c8060f1_Firefly3.png";

const NAV_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, path: "Dashboard" },
  { name: "Zistem Tree", icon: GitBranch, path: "Genealogy" },
  { name: "1st Level Monitoring", icon: Users, path: "Monitoring" },
  { name: "Total Withdrawal", icon: Wallet, path: "Earnings" },
  { name: "Zistem ComPlan", icon: Layers, path: "LevelBonuses" },
  { name: "Code Cabinet", icon: Archive, path: "CodeCabinet" },
  { name: "My Profile", icon: User, path: "Profile" },
];
const ADMIN_ITEMS = [{ name: "Admin Panel", icon: Shield, path: "Admin" }];
const SUBADMIN_ITEMS = [{ name: "Sub-Admin Panel", icon: Shield, path: "SubAdmin" }];
const STORE_ITEMS = [{ name: "Store Panel", icon: Store, path: "Store" }];
const SUPADMIN_ITEMS = [{ name: "Super Admin", icon: Crown, path: "SupAdmin" }];

function navPath(path) {
  return "/" + path;
}

export default function Layout({ children, currentPageName }) {
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: members = [] } = useTable("members");
  const { data: settings = [], refetch: refetchSettings } = useTable("system_settings");
  const memberId = getSessionMemberId();
  const member = memberId ? members.find(m => m.id === memberId) : null;

  // Poll + custom event: refetch settings when system_settings changes (e.g. admin toggles tab visibility)
  useEffect(() => {
    const interval = setInterval(() => refetchSettings(), 15000);
    const onSettingsChanged = () => refetchSettings();
    window.addEventListener("system_settings_changed", onSettingsChanged);
    return () => { clearInterval(interval); window.removeEventListener("system_settings_changed", onSettingsChanged); };
  }, [refetchSettings]);

  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });
  const showMonitoring = settingsMap.tab_monitoring_visible !== "false";
  const showSubAdmin = settingsMap.tab_subadmin_visible !== "false";
  const showComPlan = settingsMap.tab_complan_visible !== "false";

  const isAdmin = member?.role === "admin";
  const isSubAdmin = member?.role === "sub_admin";
  const isSupAdmin = member?.username === "supadmin";

  let items = NAV_ITEMS.filter(item => {
    if (item.path === "Monitoring") return showMonitoring;
    if (item.path === "LevelBonuses") return showComPlan;
    return true;
  });
  if (isAdmin || isSupAdmin) items = [...items, ...ADMIN_ITEMS];
  if (isSubAdmin && showSubAdmin) items = [...items, ...SUBADMIN_ITEMS];
  if (member?.role === "store") items = [...items, ...STORE_ITEMS];
  if (isSupAdmin) items = [...items, ...SUPADMIN_ITEMS];

  function handleLogout() {
    clearMemberSession();
    clearDataCache();
    nav("/MemberLogin");
  }

  if (currentPageName === "Register" || currentPageName === "MemberLogin") {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <RiceFieldBackground />
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-xl border-b border-emerald-200 z-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Zistem" className="w-10 h-10 rounded-xl object-cover" />
          <span className="font-bold text-xl text-gray-900">Zistem</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg active:scale-95 transition-all">
          <Menu className="w-8 h-8 text-white" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-emerald-600 via-emerald-500 to-emerald-400 border-r border-emerald-300/40 flex-col z-40">
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Zistem" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/40" />
            <div>
              <p className="font-bold text-xl text-white drop-shadow">Zistem</p>
              <p className="text-xs text-white/70">Zistem</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map(item => {
            const Icon = item.icon;
            const active = currentPageName === item.path;
            return (
              <Link key={item.path} to={navPath(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? "bg-amber-900 text-white shadow-md" : "text-white/90 hover:bg-white/20"}`}>
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/20">
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-xl mb-3 shadow-sm">
            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center text-white font-bold ring-2 ring-white/40">
              {(member?.username || "U").charAt(0).toUpperCase()}
            </div>
            <p className="font-medium text-white truncate flex-1">{member?.username || "Member"}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-emerald-900 hover:text-emerald-800 hover:bg-emerald-200/60 font-medium transition-all">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-50 lg:hidden" />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-emerald-600 via-emerald-500 to-emerald-400 z-50 lg:hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={LOGO_URL} alt="Zistem" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/40" />
                  <span className="font-bold text-xl text-white drop-shadow">Zistem</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-white/20 text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {items.map(item => {
                  const Icon = item.icon;
                  const active = currentPageName === item.path;
                  return (
                    <Link key={item.path} to={navPath(item.path)} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? "bg-amber-900 text-white shadow-md" : "text-white/90 hover:bg-white/20"}`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-white/20">
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-xl mb-3 shadow-sm">
                  <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center text-white font-bold ring-2 ring-white/40">
                    {(member?.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-white truncate flex-1">{member?.username || "Member"}</p>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-emerald-900 hover:text-emerald-800 hover:bg-emerald-200/60 font-bold transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <MaintenanceProvider>
        <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
          <MaintenanceBanner />
          {children}
          <GCashButton />
        </main>
      </MaintenanceProvider>
    </div>
  );
}
