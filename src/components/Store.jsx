import React from "react";
import { motion } from "framer-motion";
import { Store as StoreIcon } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import StorePanelView from "./StorePanelView";

export default function Store() {
  const { data: members = [] } = useTable("members");
  const { currentMember } = useCurrentMember(members);

  if (!currentMember) return <div className="p-10 text-center text-gray-400">Loading...</div>;
  if (currentMember.role !== "store") return <div className="p-10 text-center text-gray-500">This page is only for Store accounts.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl"><StoreIcon className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Panel</h1>
          <p className="text-gray-500">Generate maintenance codes within the limit set by the admin</p>
        </div>
      </motion.div>
      <StorePanelView store={currentMember} />
    </div>
  );
}
