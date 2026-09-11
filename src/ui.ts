/**
 * 画面の組み立て。エフェクト一覧・パラメータ・グラフ・バイト列・注記。
 * 実機への送信は直接呼ばず、"effect" イベントを出すだけにしてある。
 */
import { emit, on } from "./bus";
import { drawChart } from "./chart";
import { $ } from "./dom";
import { EFFECTS } from "./effects";
import { L, T, getLang, setLang, t } from "./i18n";
import { notesFor } from "./notes";
import { P } from "./payload";
import { initParams, store } from "./state";
import type { EffectDef, Lang, ZoneParamDef } from "./types";

/* ---- テーマ / theme ---- */
type ThemeMode = "auto" | "light" | "dark";
const THEMES: ThemeMode[] = ["auto", "light", "dark"];
let themeMode: ThemeMode = "auto";

function paintTheme(): void {
  if (themeMode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", themeMode);
  $("themeBtn").textContent = t(`theme.${themeMode}`);
}

function initTheme(): void {
  try {
    const saved = localStorage.getItem("dsTheme");
    if (saved === "auto" || saved === "light" || saved === "dark") themeMode = saved;
  } catch {
    /* 読めなければ自動のまま / fall back to auto */
  }
  $("themeBtn").addEventListener("click", () => {
    themeMode = THEMES[(THEMES.indexOf(themeMode) + 1) % THEMES.length]!;
    try {
      localStorage.setItem("dsTheme", themeMode);
    } catch {
      /* 保存できなくても動作には影響しない / persisting is best-effort */
    }
    paintTheme();
  });
}

/* ---- 言語トグル / language toggle ---- */
function paintLangSeg(): void {
  $("langSeg").querySelectorAll<HTMLElement>("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === getLang()));
  });
}

function initLangToggle(): void {
  $("langSeg").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (b?.dataset.lang) setLang(b.dataset.lang as Lang);
  });
}

/* ---- エフェクト一覧 / effect list ---- */
function buildList(): void {
  const nav = $("effectList");
  nav.textContent = "";
  let lastGroup: string | null = null;

  for (const eff of EFFECTS) {
    const group = T(eff.group);
    if (group !== lastGroup) {
      lastGroup = group;
      const h = document.createElement("div");
      h.className = "group-label";
      h.textContent = group;
      nav.appendChild(h);
    }

    const b = document.createElement("button");
    b.type = "button";
    b.className = "eff";
    b.setAttribute("aria-current", String(eff === store.effect));
    b.innerHTML = `<span class="nm"></span><span class="ty"></span><span class="tag"></span>`;
    b.querySelector(".nm")!.textContent = eff.name;
    b.querySelector(".ty")!.textContent = `0x${eff.type.toString(16).toUpperCase().padStart(2, "0")}`;
    b.querySelector(".tag")!.textContent = T(eff.tag);
    b.addEventListener("click", () => selectEffect(eff, b));
    nav.appendChild(b);
  }
}

function selectEffect(eff: EffectDef, btn: HTMLElement): void {
  store.effect = eff;
  store.params = initParams(eff);
  $("effectList").querySelectorAll(".eff").forEach((x) => {
    x.setAttribute("aria-current", String(x === btn));
  });
  renderParams();
  update();
}

/* ---- パラメータ / parameters ---- */
function renderParams(): void {
  const eff = store.effect;
  const host = $("params");
  host.textContent = "";
  $("effName").textContent = eff.name;
  $("effType").textContent = `type 0x${eff.type.toString(16).toUpperCase().padStart(2, "0")}`;
  $("effDesc").textContent = T(eff.desc);

  for (const d of eff.params) {
    const row = document.createElement("div");
    row.className = "param";
    row.innerHTML = `<label></label><input type="range"><output></output><span class="hint"></span>`;
    const input = row.querySelector("input")!;
    const out = row.querySelector("output")!;
    const lab = row.querySelector("label")!;

    lab.textContent = T(d.label);
    lab.htmlFor = `p-${d.k}`;
    input.id = `p-${d.k}`;
    input.min = String(d.min);
    input.max = String(d.max);
    input.step = "1";
    input.value = String(store.params[d.k]);
    row.querySelector(".hint")!.textContent = d.hint ? T(d.hint) : "";
    out.textContent = String(store.params[d.k]);

    input.addEventListener("input", () => {
      store.params[d.k] = Number(input.value);
      eff.fix?.(store.params);
      // fix() が他のスライダーを動かすことがあるので、表示を合わせ直す
      for (const o of eff.params) {
        const other = document.getElementById(`p-${o.k}`);
        if (other instanceof HTMLInputElement && Number(other.value) !== store.params[o.k]) {
          other.value = String(store.params[o.k]);
          other.parentElement!.querySelector("output")!.textContent = String(store.params[o.k]);
        }
      }
      out.textContent = String(store.params[d.k]);
      update();
    });
    host.appendChild(row);
  }

  if (eff.zoneParam) renderZoneParam(eff.zoneParam, host);
}

function renderZoneParam(zpar: ZoneParamDef, host: HTMLElement): void {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="eyebrow" style="margin-bottom:8px"></div><div class="zones"></div>`;
  wrap.querySelector(".eyebrow")!.textContent = t("zones.label", T(zpar.label), zpar.max);
  const grid = wrap.querySelector(".zones")!;
  const values = store.params[zpar.k] as number[];

  values.forEach((v, i) => {
    const cell = document.createElement("div");
    cell.className = "zone";
    cell.innerHTML = `<input type="range" orient="vertical"><span></span>`;
    const input = cell.querySelector("input")!;
    input.min = "0";
    input.max = String(zpar.max);
    input.step = "1";
    input.value = String(v);
    input.setAttribute("aria-label", `zone ${i}`);
    const lbl = cell.querySelector("span")!;
    lbl.textContent = String(i);
    input.addEventListener("input", () => {
      values[i] = Number(input.value);
      lbl.textContent = input.value;
      update();
    });
    grid.appendChild(cell);
  });
  host.appendChild(wrap);
}

/* ---- まとめて再描画 / redraw ---- */
export function update(opts?: { silent?: boolean }): void {
  const eff = store.effect;
  eff.fix?.(store.params);
  const block = eff.build(store.params);
  store.currentBlock = block;

  const prof = block[0] === 0x05 ? P("resist", () => 0) : eff.native(store.params);
  store.curProfile = prof;
  drawChart($<SVGSVGElement>("chart"), prof, store.lastTrigger);

  paintKind(block, prof.kind);
  paintBytes(block, eff);
  paintNotes(block, eff);

  // 実機への反映は hid 側が "effect" を購読して行う
  if (!opts?.silent) emit("effect", undefined);
}

function paintKind(block: Uint8Array, kind: "resist" | "vibe"): void {
  const chip = $("kindChip");
  const swatch = $("legendSwatch");
  if (block[0] === 0x05) {
    chip.textContent = t("kind.off");
    $("legendLabel").textContent = t("legend.off");
    swatch.style.borderTopColor = "var(--accent)";
  } else if (kind === "vibe") {
    chip.textContent = t("kind.vibe");
    $("legendLabel").textContent = t("legend.vibe");
    swatch.style.borderTopColor = "var(--accent-2)";
  } else {
    chip.textContent = t("kind.resist");
    $("legendLabel").textContent = t("legend.resist");
    swatch.style.borderTopColor = "var(--accent)";
  }
}

function paintBytes(block: Uint8Array, eff: EffectDef): void {
  const host = $("bytes");
  host.textContent = "";
  block.forEach((v, i) => {
    const d = document.createElement("div");
    d.className = `byte${i === 0 ? " type" : v === 0 ? " zero" : " live"}`;
    d.innerHTML = `<b></b><i></i><u></u>`;
    d.querySelector("b")!.textContent = v.toString(16).toUpperCase().padStart(2, "0");
    d.querySelector("i")!.textContent = i === 0 ? "type" : `p[${i - 1}]`;
    d.querySelector("u")!.textContent = i === 0 ? "" : T(eff.bl[i - 1] ?? L("—", "—"));
    host.appendChild(d);
  });

  const hex = Array.from(block.slice(1))
    .map((v) => `0x${v.toString(16).toUpperCase().padStart(2, "0")}`)
    .join(", ");
  $("cCode").innerHTML =
    `uint8_t type    = <b>0x${block[0]!.toString(16).toUpperCase().padStart(2, "0")}</b>;\n` +
    `uint8_t payload[10] = { <b>${hex}</b> };`;
}

function paintNotes(block: Uint8Array, eff: EffectDef): void {
  const host = $("notes");
  host.textContent = "";
  for (const [cls, msg] of notesFor(eff, block)) {
    const p = document.createElement("p");
    p.className = `note${cls ? ` ${cls}` : ""}`;
    p.innerHTML = T(msg);
    host.appendChild(p);
  }
}

/* ---- コピー / copy ---- */
function copy(text: string, label: string): void {
  const status = $("copyStatus");
  navigator.clipboard?.writeText(text).then(
    () => {
      status.textContent = t("copy.done", label);
      setTimeout(() => (status.textContent = ""), 2200);
    },
    () => (status.textContent = t("copy.fail")),
  );
}

function initCopy(): void {
  $("copyC").addEventListener("click", () => copy($("cCode").textContent ?? "", t("copy.cName")));
  $("copyHex").addEventListener("click", () =>
    copy(
      Array.from(store.currentBlock.slice(1))
        .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
        .join(" "),
      t("copy.hexName"),
    ),
  );
}

/* ---- 起動 / boot ---- */
export function initUI(): void {
  initTheme();
  initCopy();
  initLangToggle();

  // 言語が変わったら一覧とパラメータを作り直す（選択とスライダーの値は保つ）
  on("lang", () => {
    paintLangSeg();
    paintTheme();
    buildList();
    renderParams();
    update({ silent: true });
  });

  // 実機のトリガーが動いたらグラフだけ描き直す
  on("trigger", (pos) => {
    $("liveLegend").hidden = pos == null || pos <= 0.002;
    drawChart($<SVGSVGElement>("chart"), store.curProfile, pos);
  });
}
