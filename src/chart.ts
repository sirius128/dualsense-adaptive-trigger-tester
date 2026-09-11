/**
 * トリガーストロークに対する効き方の SVG グラフ。
 * 抵抗は塗り、振動は斜線ハッチで描き分ける。
 */
import { t } from "./i18n";
import { Z, zp } from "./payload";
import type { Profile } from "./types";

const NS = "http://www.w3.org/2000/svg";
const CW = 760, CH = 288, ML = 46, MR = 18, MT = 16, MB = 48;
const PW = CW - ML - MR;
const PH = CH - MT - MB;

const sx = (pos: number): number => ML + pos * PW;
const sy = (v: number): number => MT + (1 - v) * PH;

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent?.appendChild(n);
  return n;
}

/** プロファイルを階段状のパスに変換する */
function profilePath(prof: Profile, close: boolean): string {
  const N = 240;
  let d = "";
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const pos = i / N;
    const v = prof.at(pos);
    const x = sx(pos).toFixed(1);
    if (i === 0) {
      d = `M${x},${sy(v).toFixed(1)}`;
    } else {
      if (Math.abs(v - prev) > 1e-6) d += ` L${x},${sy(prev).toFixed(1)}`;
      d += ` L${x},${sy(v).toFixed(1)}`;
    }
    prev = v;
  }
  if (close) d += ` L${sx(1).toFixed(1)},${sy(0).toFixed(1)} L${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`;
  return d;
}

export function drawChart(svg: SVGSVGElement, prof: Profile, live: number | null): void {
  svg.textContent = "";
  const vibe = prof.kind === "vibe";
  const col = vibe ? "var(--accent-2)" : "var(--accent)";
  const fill = vibe ? "url(#hatch)" : "var(--accent-soft)";

  const defs = el("defs", {}, svg);
  const pat = el("pattern", {
    id: "hatch", width: 7, height: 7,
    patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)",
  }, defs);
  el("rect", { width: 7, height: 7, fill: "transparent" }, pat);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: col, "stroke-width": 2.4, opacity: 0.34 }, pat);

  // 横の目盛り / horizontal grid
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    el("line", { x1: ML, y1: sy(v), x2: ML + PW, y2: sy(v), stroke: "var(--line)", "stroke-width": 1 }, svg);
    el("text", {
      x: ML - 9, y: sy(v) + 4, "text-anchor": "end", fill: "var(--ink-3)",
      "font-family": "IBM Plex Mono, monospace", "font-size": 10.5,
    }, svg).textContent = `${(v * 100).toFixed(0)}%`;
  }

  // ゾーンの目盛り / zone ticks
  for (let z = 0; z < Z; z++) {
    const x = sx(zp(z));
    el("line", { x1: x, y1: MT + PH, x2: x, y2: MT + PH + 5, stroke: "var(--line-strong)", "stroke-width": 1 }, svg);
    el("text", {
      x, y: MT + PH + 18, "text-anchor": "middle", fill: "var(--ink-3)",
      "font-family": "IBM Plex Mono, monospace", "font-size": 10,
    }, svg).textContent = String(z);
  }

  el("line", { x1: ML, y1: MT + PH, x2: ML + PW, y2: MT + PH, stroke: "var(--ink-3)", "stroke-width": 1.5 }, svg);
  el("text", {
    x: ML, y: CH - 10, fill: "var(--ink-3)",
    "font-family": "IBM Plex Mono, monospace", "font-size": 10.5,
  }, svg).textContent = t("chart.xStart");
  el("text", {
    x: ML + PW, y: CH - 10, "text-anchor": "end", fill: "var(--ink-3)",
    "font-family": "IBM Plex Mono, monospace", "font-size": 10.5,
  }, svg).textContent = t("chart.xEnd");

  el("path", { d: profilePath(prof, true), fill, stroke: "none" }, svg);
  el("path", {
    d: profilePath(prof, false), fill: "none", stroke: col,
    "stroke-width": 2.5, "stroke-linejoin": "round",
  }, svg);

  // 実機のトリガー位置 / where the physical trigger is right now
  if (live != null && live > 0.002) {
    const x = sx(live);
    el("line", {
      x1: x, y1: MT, x2: x, y2: MT + PH,
      stroke: "var(--ink-2)", "stroke-width": 1.5, "stroke-dasharray": "2 4",
    }, svg);
    el("circle", {
      cx: x, cy: sy(prof.at(live)), r: 4.5, fill: col,
      stroke: "var(--surface)", "stroke-width": 2,
    }, svg);
  }
}
