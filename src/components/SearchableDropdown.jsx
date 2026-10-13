import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

/**
 * Searchable dropdown for selecting from a list of string options.
 * Renders like a normal Input (same height/border) but opens a filterable
 * list — works well on mobile where native <datalist> is unreliable.
 */
export default function SearchableDropdown({ value, onChange, options = [], placeholder = "Search…", id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    return list.slice(0, 100);
  })();

  function select(opt) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all flex items-center justify-between text-left bg-white"
      >
        <span className={value ? "text-gray-900 truncate" : "text-gray-400 truncate"}>
          {value || placeholder}
        </span>
        {value ? (
          <X
            className="w-4 h-4 text-gray-400 shrink-0 ml-2 hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          />
        ) : (
          <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full h-11 pl-10 pr-3 text-sm outline-none border-b border-gray-100"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No matches</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 truncate ${
                    query.trim() && opt.toLowerCase() === query.trim().toLowerCase()
                      ? "text-red-600 font-bold"
                      : opt === value ? "bg-amber-50 text-amber-700 font-medium" : "text-gray-700"}`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
