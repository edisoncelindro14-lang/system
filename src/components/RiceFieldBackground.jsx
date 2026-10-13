import React from "react";

const BG_URL =
  "https://media.base44.com/images/public/6ace3abc7d65c772599ec043/115a0c601_716663-computer-wallpaper-desktop-background-2560x1440-image.jpg";

/**
 * Fixed full-screen rice-field background with a readability overlay.
 * `dark` increases the overlay for screens that place light text directly on it.
 */
export default function RiceFieldBackground({ dark = false }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${BG_URL}')`, backgroundAttachment: "fixed" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? "linear-gradient(to bottom right, rgba(17,17,17,0.55), rgba(26,22,14,0.6))"
            : "linear-gradient(to bottom right, rgba(255,255,255,0.35), rgba(255,255,255,0.5))",
        }}
      />
    </div>
  );
}
