import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev-only: serve api/cloudinary-delete.js (a Vercel function in production) from Vite.
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use("/api/cloudinary-delete", async (req, res) => {
        let raw = "";
        for await (const c of req) raw += c;
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
        res.status = code => { res.statusCode = code; return res; };
        res.json = obj => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
        try {
          const { default: handler } = await server.ssrLoadModule("/api/cloudinary-delete.js");
          await handler(req, res);
        } catch (e) { res.status(500).json({ error: e.message }); }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    devApi(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-192.png", "pwa-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "ProductPrime",
        short_name: "ProductPrime",
        description: "MLM genealogy and referral management platform",
        theme_color: "#f59e0b",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    strictPort: true,
  },
});
