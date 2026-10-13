import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ArrowRight } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { Button } from "./ui";
import MonitoringView from "./MonitoringView";

export default function Monitoring() {
  const { data: members = [], isLoading } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");
  const { currentMember, loading } = useCurrentMember(members);

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Monitoring</h1>
          <p className="text-gray-600 mb-6">Please login to access your downline monitoring.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  if (currentMember.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md bg-white rounded-3xl p-8 shadow-xl border border-amber-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Pending Approval</h1>
          <p className="text-gray-600">Your registration is being reviewed by the admin.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Downline Monitoring</h1>
        <p className="text-gray-500 mt-2">Track each 1st-level downline's maintenance-code redemptions, cycle by cycle.</p>
      </motion.div>

      <MonitoringView member={currentMember} members={members} codes={codes} />
    </div>
  );
}
