// Minimal local stand-in for Supabase Storage (public bucket uploads + range reads).
// Handles: POST/PUT /storage/v1/object/<bucket>/<path> (multipart or raw), GET /storage/v1/object/public/<bucket>/<path>
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/data"; fs.mkdirSync(ROOT, { recursive: true });
const safe = p => path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ""));

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  const up = url.match(/^\/storage\/v1\/object\/(?!public\/)(.+)$/);
  const get = url.match(/^\/storage\/v1\/object\/public\/(.+)$/);

  if (up && (req.method === "POST" || req.method === "PUT")) {
    const file = safe(up[1]); fs.mkdirSync(path.dirname(file), { recursive: true });
    const ct = req.headers["content-type"] || "application/octet-stream";
    const m = ct.match(/^multipart\/form-data;.*boundary=(.+)$/i);
    const tmp = file + ".part";
    const out = fs.createWriteStream(tmp);
    req.pipe(out);
    out.on("finish", () => {
      const meta = { start: 0, end: fs.statSync(tmp).size, type: ct };
      if (m) {
        const fd = fs.openSync(tmp, "r"), head = Buffer.alloc(4096);
        fs.readSync(fd, head, 0, 4096, 0); fs.closeSync(fd);
        const text = head.toString("latin1");
        const idx = text.indexOf("\r\n\r\n");
        meta.start = idx + 4;
        meta.end -= Buffer.byteLength("\r\n--" + m[1] + "--\r\n");
        const t = text.match(/Content-Type:\s*([^\r\n]+)/i); meta.type = t ? t[1] : "application/octet-stream";
      }
      fs.renameSync(tmp, file); fs.writeFileSync(file + ".meta", JSON.stringify(meta));
      send(200, { Key: up[1] });
    });
    out.on("error", e => send(500, { message: e.message }));
    return;
  }
  if (get && (req.method === "GET" || req.method === "HEAD")) {
    const file = safe(get[1]);
    if (!fs.existsSync(file) || !fs.existsSync(file + ".meta")) return send(404, { message: "Not found" });
    const meta = JSON.parse(fs.readFileSync(file + ".meta")); const size = meta.end - meta.start;
    let s = 0, e = size - 1, code = 200;
    const r = (req.headers.range || "").match(/bytes=(\d*)-(\d*)/);
    if (r) { code = 206; if (r[1]) s = +r[1]; if (r[2]) e = Math.min(+r[2], size - 1); if (!r[1] && r[2]) { s = size - +r[2]; e = size - 1; } }
    const h = { "Content-Type": meta.type, "Accept-Ranges": "bytes", "Content-Length": e - s + 1 };
    if (code === 206) h["Content-Range"] = `bytes ${s}-${e}/${size}`;
    res.writeHead(code, h);
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(file, { start: meta.start + s, end: meta.start + e }).pipe(res);
  }
  send(404, { message: "Unsupported" });
}).listen(3001);
