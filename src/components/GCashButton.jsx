import React, { useState, useRef, useEffect } from "react";
import { Smartphone, Copy, Upload, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { useTable } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { supabase } from "../lib/supabase";

const LOGO_URL = "https://media.base44.com/images/public/6ad0559cb2cdb34b8de882bb/05c8060f1_Firefly3.png";

export function GCashButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pos, setPos] = useState(null);
  const memberId = getSessionMemberId();
  const { data: gcashInfo = [] } = useTable("gcash_info");
  const active = gcashInfo.find(g => g.is_active) || gcashInfo[0];

  const btnRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef(null);
  const posStart = useRef(null);
  const moved = useRef(false);

  // Default position: bottom-right corner
  useEffect(() => {
    if (pos === null) {
      const isMobile = window.innerWidth < 1024;
      setPos({ x: window.innerWidth - (isMobile ? 150 : 180), y: window.innerHeight - (isMobile ? 80 : 100) });
    }
  }, [pos]);

  // Window-level drag listeners (must be before any early return to respect Rules of Hooks)
  useEffect(() => {
    function handleMove(e) {
      if (!dragging.current || !posStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      const btn = btnRef.current;
      const bw = btn?.offsetWidth || 140;
      const bh = btn?.offsetHeight || 48;
      const nx = Math.max(8, Math.min(window.innerWidth - bw - 8, posStart.current.x + dx));
      const ny = Math.max(8, Math.min(window.innerHeight - bh - 8, posStart.current.y + dy));
      setPos({ x: nx, y: ny });
    }
    function handleUp() {
      if (!dragging.current) return;
      dragging.current = false;
      if (!moved.current) setOpen(o => !o);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  if (!memberId || !active) return null;

  function copyNumber() {
    if (active.gcash_number) {
      navigator.clipboard.writeText(active.gcash_number);
      setCopied(true);
      toast.success("GCash number copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function uploadReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // Convert image to compressed base64 data URL (no storage bucket needed)
      const dataUrl = await compressImage(file, 1200, 0.8);
      await supabase.from("gcash_receipts").insert({
        member_id: memberId,
        member_name: "",
        receipt_url: dataUrl,
        status: "pending",
      });
      toast.success("Receipt uploaded successfully!");
    } catch {
      toast.error("Failed to upload receipt");
    }
    setUploading(false);
    e.target.value = "";
  }

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const onPointerDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    moved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
  };

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
        className="fixed z-50 h-12 lg:h-14 pl-4 pr-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg lg:shadow-xl flex items-center gap-2 touch-none select-none cursor-grab active:cursor-grabbing"
        title="GCash Payment — drag to move"
      >
        <Smartphone className="w-5 h-5 lg:w-6 lg:h-6" />
        <span className="font-bold text-sm tracking-wide">GCASH<span className="hidden lg:inline"> PAYMENT</span></span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden text-white"
            style={{ background: "#2563eb" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Payment via GCash</h3>
                  <p className="text-xs text-white/80">Send payment here, then upload receipt.</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main content */}
            <div className="px-5 pb-5 flex flex-col items-center text-center">
              <img src={LOGO_URL} alt="Zistem" className="w-24 h-24 rounded-2xl object-cover border-2 border-white/40 mb-4" />
              <p className="text-xs text-white/80 mb-1">GCash Number</p>
              <p className="text-2xl font-extrabold tracking-wide">{active.gcash_number}</p>
              <p className="text-sm text-white/90 mt-1">GCash Name: {active.gcash_name}</p>

              <button onClick={copyNumber} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-900 font-semibold text-sm shadow hover:bg-blue-50 transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Click Here to Copy Number"}
              </button>

              <p className="text-xs text-white/80 mt-4">And open your GCash App to paste the GCash Number there</p>

              <label className="block w-full mt-2">
                <input type="file" accept="image/*" onChange={uploadReceipt} className="hidden" />
                <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white shadow-lg cursor-pointer transition-all" style={{ background: "#1e3a8a" }}>
                  <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Receipt"}
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
