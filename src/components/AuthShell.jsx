import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import RiceFieldBackground from "./RiceFieldBackground";

const LOGO_URL = "https://media.base44.com/images/public/6ac1daab80dea63a77ad8fa1/66582b089_Firefly.png";

export const ORANGE_GRADIENT = "linear-gradient(90deg, #f7931e 0%, #f37021 55%, #e8501a 100%)";
export const GOLD_GRADIENT =
  "linear-gradient(180deg, #f3dc8a 0%, #e2c060 35%, #cfa63f 65%, #e6c86e 100%)";

/** Shared layout for the login / registration screens. */
export default function AuthShell({ title, backTo, children }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      <RiceFieldBackground dark />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[480px] rounded-[28px] border border-white/25 p-5 pt-4 shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        {backTo ? (
          <Link to={backTo} className="inline-flex items-center gap-2 text-white/90 hover:text-white text-base mb-4 ml-1">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        ) : (
          <div className="h-1" />
        )}

        <div
          className="rounded-3xl border border-white/20 overflow-hidden shadow-xl"
          style={{
            background: "rgba(40,70,90,0.35)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div className="relative px-6 pt-8 pb-10 text-center overflow-hidden" style={{ background: ORANGE_GRADIENT }}>
            {/* glossy wave highlight */}
            <div
              className="absolute -top-10 -left-10 w-[140%] h-24 rounded-[50%] opacity-40"
              style={{ background: "linear-gradient(90deg, rgba(255,220,120,0.9), rgba(255,255,255,0))" }}
            />
            <img
              src={LOGO_URL}
              alt="ProductPrime"
              className="relative w-20 h-20 rounded-2xl mx-auto mb-5 object-cover shadow-lg border-2"
              style={{ borderColor: "#e8c46a" }}
            />
            <h1 className="relative text-2xl font-bold text-white drop-shadow-sm">{title}</h1>
          </div>

          <div className="px-8 pt-8 pb-8">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
