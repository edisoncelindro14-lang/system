import React, { createContext, useContext, useEffect, useState } from "react";
import { getSessionMemberId } from "./auth";
import { maintenanceStatus } from "./helpers";
import { useTable } from "./useData";

const MaintenanceContext = createContext(null);

// The banner and Code Cabinet share both the maintenance data and the same tick.
export function MaintenanceProvider({ children }) {
  const memberId = getSessionMemberId();
  const { data: members = [], refetch: refetchMembers } = useTable("members", { enabled: !!memberId });
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes", { enabled: !!memberId });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!memberId) return;
    const tick = setInterval(() => setTick(t => t + 1), 1000);
    const refresh = setInterval(() => { refetchMembers(); refetchCodes(); }, 5000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, [memberId, refetchMembers, refetchCodes]);

  const member = members.find(m => m.id === memberId) || null;
  const status = member ? maintenanceStatus(member, codes) : null;

  return (
    <MaintenanceContext.Provider value={{ member, members, codes, status, refetchCodes }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  return useContext(MaintenanceContext);
}
