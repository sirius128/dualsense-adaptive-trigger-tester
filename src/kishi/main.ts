/**
 * Kishi ハプティック試作ページ（kishi.html）。
 * WebHID で Kishi が揺れるかを確かめるためだけの最小構成で、本体のタブに組み込むまでは開発サーバ専用。
 * Prototype page; dev-server only until it moves into a tab of the main page.
 */
import "../styles/app.css";
import { $ } from "../dom";
import type { Bytes } from "../types";
import { renderWave } from "../waveform";
import type { Pattern, Wave } from "../waveform";
import { ACTUATORS, FRAME_BYTES, KISHI_PIDS, LEVELS, NO_PCM_PIDS, RAZER, SAMPLE_RATE, command, packFrames } from "./report";
import { KishiStream } from "./stream";
import type { StreamStats } from "./stream";

type Side = "L" | "R" | "B";
type Level = keyof typeof LEVELS;

let devices: HIDDevice[] = [];
let target: HIDDevice | null = null;
let enabled = false;
let playing: Side | null = null;

const hex2 = (v: number): string => v.toString(16).toUpperCase().padStart(2, "0");
const hex = (b: Bytes): string => Array.from(b, hex2).join(" ");

/* ---- ログ / log ---- */
function log(line: string): void {
  const el = $("kLog");
  const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  el.textContent = `${ts}  ${line}\n${el.textContent ?? ""}`.slice(0, 20000);
}

function setStatus(text: string, state: "on" | "err" | "" = ""): void {
  $("kStatus").textContent = text;
  $("kDot").className = `dot${state ? ` ${state}` : ""}`;
}

/* ---- 記述子 / descriptors ---- */
function reportBytes(r: HIDReportInfo): number {
  let bits = 0;
  for (const it of r.items ?? []) bits += (it.reportSize ?? 0) * (it.reportCount ?? 0);
  return Math.ceil(bits / 8);
}

function describeReports(kind: string, list: HIDReportInfo[] | undefined): string {
  if (!list?.length) return "";
  return `${kind}[${list.map((r) => `#${r.reportId ?? 0}:${reportBytes(r)}B`).join(" ")}]`;
}

function describe(dev: HIDDevice): string {
  return (dev.collections ?? [])
    .map((c) =>
      [
        `usage 0x${(c.usagePage ?? 0).toString(16)}/0x${(c.usage ?? 0).toString(16)}`,
        describeReports("in", c.inputReports),
        describeReports("out", c.outputReports),
        describeReports("feat", c.featureReports),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" | ");
}

/** レポート ID なしで 64 バイトの出力レポートを持つ = ハプティック用のインターフェース */
function isHapticInterface(dev: HIDDevice): boolean {
  return (dev.collections ?? []).some((c) =>
    (c.outputReports ?? []).some((r) => (r.reportId ?? 0) === 0 && reportBytes(r) === FRAME_BYTES),
  );
}

/**
 * Feature レポートを記述子どおりの長さに 0 で埋める。Windows は長さが合わないと失敗するので、
 * PeaSyo の 3 バイト（先頭の 00 も中身）を 90 バイトにして送る。長さが分からなければそのまま。
 *
 * Pad to the descriptor's feature length; Windows rejects a short buffer.
 */
function featureData(dev: HIDDevice, data: Bytes): Bytes {
  const len = Math.max(
    0,
    ...(dev.collections ?? []).flatMap((c) =>
      (c.featureReports ?? []).filter((r) => (r.reportId ?? 0) === 0).map(reportBytes),
    ),
  );
  if (len <= data.length) return data;
  const out = new Uint8Array(len);
  out.set(data);
  return out;
}

/* ---- 画面の状態 / UI state ---- */
function paint(): void {
  const ready = !!target?.opened;
  for (const id of ["kOn", "kOff", "kRawSend", "kPlayL", "kPlayR", "kPlayB", "kStop"]) {
    $<HTMLButtonElement>(id).disabled = !ready;
  }
  $("kLevel").querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = !ready));
  for (const s of ["L", "R", "B"] as const) $(`kPlay${s}`).setAttribute("aria-pressed", String(playing === s));
  $("kPid").textContent = target ? `${hex2(target.vendorId >> 8)}${hex2(target.vendorId & 0xff)}:${hex2(target.productId >> 8)}${hex2(target.productId & 0xff)}` : "—";
}

function fillSelect(): void {
  const sel = $<HTMLSelectElement>("kIface");
  sel.innerHTML = "";
  devices.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `${isHapticInterface(d) ? "★ " : ""}#${i} ${describe(d) || "(no collections)"}`;
    sel.append(o);
  });
  sel.disabled = devices.length < 2;
  if (target) sel.value = String(devices.indexOf(target));
}

/* ---- 接続 / connecting ---- */
async function useDevice(dev: HIDDevice): Promise<void> {
  stream.stop();
  if (target && target !== dev && target.opened) await target.close().catch(() => undefined);
  target = dev;
  enabled = false;
  try {
    if (!dev.opened) await dev.open();
    const model = KISHI_PIDS[dev.productId] ?? "未知の機種 / unknown model";
    setStatus(`${dev.productName || "Razer"}（${model}）`, "on");
    log(`開いた: #${devices.indexOf(dev)} ${describe(dev)}`);
    if (!isHapticInterface(dev)) {
      const why = NO_PCM_PIDS.has(dev.productId)
        ? "この PID（Mac 向けの構成）には PCM を受けるインターフェースがありません"
        : "64 バイトの出力レポート（レポート ID なし）を持つインターフェースが見つかりません";
      setStatus(`${dev.productName || "Razer"}: ${why}`, "err");
      log(`注意: ${why}`);
    }
  } catch (err) {
    setStatus(`開けません: ${err instanceof Error ? err.message : String(err)}`, "err");
    log(`open 失敗: ${String(err)}`);
  }
  fillSelect();
  paint();
}

async function adopt(list: HIDDevice[]): Promise<void> {
  devices = list.filter((d) => d.vendorId === RAZER);
  if (!devices.length) return;
  log(`見つかったインターフェース: ${devices.length} 個`);
  devices.forEach((d, i) => log(`  #${i} PID 0x${d.productId.toString(16)} ${describe(d)}`));
  await useDevice(devices.find(isHapticInterface) ?? devices[0]!);
}

async function connect(): Promise<void> {
  if (!("hid" in navigator)) {
    setStatus("このブラウザは WebHID に対応していません（Chrome / Edge で開いてください）", "err");
    return;
  }
  try {
    await adopt(await navigator.hid.requestDevice({ filters: [{ vendorId: RAZER }] }));
  } catch (err) {
    setStatus(String(err), "err");
  }
}

/* ---- 送信 / sending ---- */
async function sendFrame(f: Bytes): Promise<void> {
  if (!target?.opened) throw new Error("not connected");
  await target.sendReport(0, f);
}

async function sendCommand(value: number, label: string): Promise<boolean> {
  if (!target?.opened) return false;
  let ok = true;
  for (const a of ACTUATORS) {
    const data = command(a, value);
    try {
      await target.sendFeatureReport(0, featureData(target, data));
      log(`${label} → ${a === 1 ? "左" : "右"}: ${hex(data)}`);
    } catch (err) {
      ok = false;
      log(`${label} 失敗（${a === 1 ? "左" : "右"}、${hex(data)}）: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return ok;
}

async function setEnabled(on: boolean): Promise<void> {
  if (await sendCommand(on ? 1 : 0, on ? "ON" : "OFF")) enabled = on;
}

async function setLevel(level: Level): Promise<void> {
  await sendCommand(LEVELS[level], `強さ ${level.toUpperCase()}`);
  $("kLevel").querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.level === level));
  });
}

/* ---- 再生 / playback ---- */
const num = (id: string): number => Number($<HTMLInputElement>(id).value);

async function play(side: Side): Promise<void> {
  if (!target?.opened) return;
  if (!enabled) {
    await setEnabled(true);
    await setLevel("high");
  }
  const wave = renderWave(
    {
      wave: $<HTMLSelectElement>("kWave").value as Wave,
      pattern: $<HTMLSelectElement>("kPattern").value as Pattern,
      freq: num("kFreq"),
      amp: num("kAmp") / 100,
      durMs: num("kDur"),
    },
    SAMPLE_RATE,
  );
  const mute = new Float32Array(wave.length);
  const frames = packFrames(side === "R" ? mute : wave, side === "L" ? mute : wave);
  playing = side;
  paint();
  log(`再生: ${side} / ${wave.length} サンプル / ${frames.length} フレーム`);
  stream.play(frames);
}

function paintStats(s: StreamStats): void {
  $("kRun").textContent = s.running ? "送信中" : "停止中";
  $("kRun").className = `chip mono${s.running ? " ok" : ""}`;
  $("kStats").textContent = [
    `送信 ${s.sent} / 失敗 ${s.failed} / 遅れて破棄 ${s.dropped}`,
    `送信速度 ${s.fps.toFixed(1)} フレーム/秒（目標 ${(SAMPLE_RATE / 12).toFixed(1)}）`,
    `最大の遅れ ${s.maxLateMs.toFixed(1)} ms`,
    s.lastError ? `最後のエラー: ${s.lastError}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (s.lastFrame) {
    const f = s.lastFrame;
    $("kFrame").textContent = [
      `header   ${hex(f.subarray(0, 10))}`,
      `pcm      ${hex(f.subarray(10, 34))}`,
      `         ${hex(f.subarray(34, 58))}`,
      `checksum ${hex(f.subarray(58, 59))}   padding ${hex(f.subarray(59))}`,
    ].join("\n");
  }
  if (!s.running && playing) {
    playing = null;
    paint();
    log(`終了: 送信 ${s.sent} / 失敗 ${s.failed} / 破棄 ${s.dropped}${s.lastError ? ` / ${s.lastError}` : ""}`);
  }
}

const stream = new KishiStream(sendFrame, paintStats);

/* ---- 起動 / boot ---- */
function init(): void {
  $("kConnect").addEventListener("click", () => void connect());
  $("kIface").addEventListener("change", () => {
    const dev = devices[Number($<HTMLSelectElement>("kIface").value)];
    if (dev) void useDevice(dev);
  });
  $("kOn").addEventListener("click", () => void setEnabled(true));
  $("kOff").addEventListener("click", () => {
    stream.stop();
    void setEnabled(false);
  });
  $("kLevel").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b?.dataset.level) void setLevel(b.dataset.level as Level);
  });

  const raw = $<HTMLInputElement>("kRaw");
  const paintRaw = (): void => {
    $("kRawHex").textContent = `0x${hex2(Math.max(0, Math.min(255, Number(raw.value) || 0)))}`;
  };
  raw.addEventListener("input", paintRaw);
  paintRaw();
  $("kRawSend").addEventListener("click", () => {
    const v = Math.max(0, Math.min(255, Number(raw.value) || 0));
    void sendCommand(v, `値 0x${hex2(v)}`);
  });

  for (const s of ["L", "R", "B"] as const) $(`kPlay${s}`).addEventListener("click", () => void play(s));
  $("kStop").addEventListener("click", () => stream.stop());

  for (const id of ["kFreq", "kAmp", "kDur"]) {
    const input = $<HTMLInputElement>(id);
    input.addEventListener("input", () => ($(`${id}Out`).textContent = input.value));
  }
  const paintParams = (): void => {
    const pattern = $<HTMLSelectElement>("kPattern").value;
    $<HTMLInputElement>("kFreq").disabled = pattern === "sweep";
    $<HTMLInputElement>("kDur").disabled = pattern === "click";
  };
  $("kPattern").addEventListener("change", paintParams);
  paintParams();

  if ("hid" in navigator) {
    // 以前に許可したものがあれば、ダイアログなしで開く
    void navigator.hid.getDevices().then(adopt);
    navigator.hid.addEventListener("disconnect", (e) => {
      if (e.device !== target) return;
      stream.stop();
      target = null;
      enabled = false;
      setStatus("切断されました", "err");
      log("切断");
      paint();
    });
  } else {
    setStatus("このブラウザは WebHID に対応していません（Chrome / Edge で開いてください）", "err");
    $<HTMLButtonElement>("kConnect").disabled = true;
  }

  // ページを閉じるときは振動子を OFF に戻す
  window.addEventListener("pagehide", () => {
    stream.stop();
    if (target?.opened && enabled) for (const a of ACTUATORS) void target.sendFeatureReport(0, featureData(target, command(a, 0)));
  });

  paint();
}

init();
