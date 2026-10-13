import React, { useState, useRef, useEffect } from "react";
import { Smartphone, Copy, Upload, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useTable } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function GCashButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pos, setPos] = useState(null);
  const [popupAbove, setPopupAbove] = useState(false);
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

  // Keep popup on the correct side of the button
  useEffect(() => {
    if (!open || !pos) return;
    setPopupAbove(pos.y > window.innerHeight * 0.5);
  }, [open, pos]);

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
      {open && pos && (
        <div
          className="fixed z-50 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{
            left: Math.max(8, Math.min(window.innerWidth - 336, pos.x)),
            ...(popupAbove
              ? { bottom: window.innerHeight - pos.y + 8, top: "auto" }
              : { top: pos.y + 56, bottom: "auto" }),
          }}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="font-bold">GCash Payment</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Send payment to:</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-bold text-gray-900 text-lg">{active.gcash_number}</p>
                <button onClick={copyNumber} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{active.gcash_name}</p>
            </div>
            <label className="block">
              <input type="file" accept="image/*" onChange={uploadReceipt} className="hidden" />
              <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer transition-all">
                <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Receipt"}
              </div>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
