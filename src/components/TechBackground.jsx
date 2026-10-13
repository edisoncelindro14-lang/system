import React from "react";

// Deterministic pseudo-random so the network is stable across renders
function rand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const W = 1600;
const H = 1000;

const NODES = Array.from({ length: 70 }, (_, i) => ({
  x: rand(i + 1) * W,
  y: rand(i + 101) * H,
  r: 1.2 + rand(i + 201) * 2.2,
}));

// Connect each node to its 3 nearest neighbours
const LINKS = (() => {
  const set = new Set();
  const out = [];
  NODES.forEach((a, i) => {
    NODES.map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!set.has(key)) {
          set.add(key);
          out.push([i, j]);
        }
      });
  });
  return out;
})();

// Right side of the canvas glows peach, left side teal (as in the design)
const colorFor = (x) => (x > W * 0.62 ? "255,190,140" : "90,200,220");

export default function TechBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, #16465a 0%, #0b2a3c 35%, #071a28 70%, #040f18 100%)",
        }}
      />
      {/* Soft bokeh glows */}
      <div className="absolute top-[30%] left-[35%] w-[520px] h-[520px] rounded-full blur-3xl" style={{ background: "rgba(60,160,190,0.18)" }} />
      <div className="absolute top-[10%] right-[5%] w-[380px] h-[380px] rounded-full blur-3xl" style={{ background: "rgba(255,170,110,0.12)" }} />
      <div className="absolute bottom-[5%] left-[5%] w-[360px] h-[360px] rounded-full blur-3xl" style={{ background: "rgba(40,140,180,0.15)" }} />

      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {LINKS.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke={`rgba(${colorFor(NODES[a].x)},0.35)`}
            strokeWidth="0.8"
          />
        ))}
        {NODES.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r * 4} fill={`rgba(${colorFor(n.x)},0.08)`} />
            <circle cx={n.x} cy={n.y} r={n.r} fill={`rgba(${colorFor(n.x)},0.9)`} />
          </g>
        ))}
      </svg>
    </div>
  );
}
