// Deletes an ad asset from Cloudinary. Runs as a Vercel function in production
// and via a Vite dev middleware locally (see vite.config.js).
// Needs CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and a cloud name env var.
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { public_id, resource_type } = req.body || {};
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return res.status(500).json({ error: "Cloudinary is not configured on the server" });
  // Only ad assets (uploaded into the "ads" folder) can be deleted through this endpoint.
  if (typeof public_id !== "string" || !public_id.startsWith("ads/") || public_id.includes("..")) {
    return res.status(400).json({ error: "Invalid public_id" });
  }
  const type = resource_type === "video" ? "video" : "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `invalidate=true&public_id=${public_id}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + secret).digest("hex");
  const body = new URLSearchParams({ public_id, timestamp: String(timestamp), api_key: key, signature, invalidate: "true" });
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${type}/destroy`, { method: "POST", body });
  const json = await r.json();
  if (!r.ok || (json.result !== "ok" && json.result !== "not found")) {
    return res.status(502).json({ error: json?.error?.message || `Cloudinary: ${json.result}` });
  }
  res.status(200).json({ result: json.result });
}
