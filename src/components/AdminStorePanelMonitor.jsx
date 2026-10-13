import React, { useState } from "react";
import { Eye } from "lucide-react";
import StorePanelView from "./StorePanelView";
import SearchableDropdown from "./SearchableDropdown";

const storeLabel = s => `@${s.username} — ${s.full_name}`;

// Full Store Panel (same features as the store account) for any store picked via search dropdown.
export default function AdminStorePanelMonitor({ storeMembers }) {
  const [storeId, setStoreId] = useState("");
  const store = storeMembers.find(s => s.id === storeId);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden border-t-4 border-t-blue-500">
      <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-blue-500" /> Store Panel Monitor</h2>
        <div className="w-full sm:w-80">
          <SearchableDropdown
            value={store ? storeLabel(store) : ""}
            onChange={label => setStoreId(storeMembers.find(s => storeLabel(s) === label)?.id || "")}
            options={storeMembers.map(storeLabel)}
            placeholder="Select store to monitor..."
          />
        </div>
      </div>
      {!store ? (
        <p className="text-center py-10 text-gray-400">Select a store to open its Store Panel.</p>
      ) : (
        <div className="p-5"><StorePanelView key={store.id} store={store} /></div>
      )}
    </div>
  );
}
