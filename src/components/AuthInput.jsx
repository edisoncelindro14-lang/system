import React from "react";

const ICON_COLOR = "#d9b98a";

/** Glass input with a leading icon and optional trailing slot. */
export default function AuthInput({ label, required, icon: Icon, trailing, className = "", ...props }) {
  return (
    <div className="space-y-2">
      <label className="block text-[17px] text-white">
        {label} {required && <span className="text-orange-400">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: ICON_COLOR }} />
        <input
          {...props}
          required={required}
          className={`w-full h-[52px] pl-14 pr-12 rounded-xl text-white text-base placeholder-white/70 border border-white/30 focus:border-orange-400 focus:outline-none transition-colors ${className}`}
          style={{ background: "rgba(255,255,255,0.18)" }}
        />
        {trailing && <div className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: ICON_COLOR }}>{trailing}</div>}
      </div>
    </div>
  );
}
