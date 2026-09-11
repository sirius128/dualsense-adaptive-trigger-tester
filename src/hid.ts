/**
 * 実機への書き込み（WebHID）。
 * 出力レポートの構造は Linux カーネルの hid-playstation.c に準拠。
 */
import { on } from "./bus";
import { $ } from "./dom";
import { t } from "./i18n";
import { OFF } from "./payload";
import { store } from "./state";
import type { Link, Side } from "./state";
import type { Bytes } from "./types";

const SONY = 0x054c;
const USB_REPORT = 0x02;
const BT_REPORT = 0x31;

// valid_flag0 / valid_flag1 のビット / bit layout from hid-playstation.c
const F0_VIBRATION = 0x01;
const F0_HAPTICS_SELECT = 0x02;
const F0_RIGHT_TRIGGER = 0x04;
const F0_LEFT_TRIGGER = 0x08;
const F1_LIGHTBAR = 0x04;

/* ---- Bluetooth 用の CRC32 ---- */
const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function crc32(bytes: Bytes): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

let btSeq = 0;

interface Extras {
  rumble?: number;
  rgb?: [number, number, number];
}

/** 47 バイトの共通ブロック。トリガーエフェクトは右が offset 10、左が 21。 */
function commonBlock(block: Bytes | null, opts?: Extras): Bytes {
  const both = store.side === "B";
  const doL = both || store.side === "L";
  const doR = both || store.side === "R";
  const c = new Uint8Array(47);

  if (block) {
    c[0] |= (doR ? F0_RIGHT_TRIGGER : 0) | (doL ? F0_LEFT_TRIGGER : 0);
    if (doR) c.set(block, 10);
    if (doL) c.set(block, 21);
  }
  if (opts?.rumble != null) {
    c[0] |= F0_VIBRATION | F0_HAPTICS_SELECT;
    c[2] = opts.rumble;
    c[3] = opts.rumble;
  }
  if (opts?.rgb) {
    c[1] |= F1_LIGHTBAR;
    [c[44], c[45], c[46]] = opts.rgb;
  }
  return c;
}

/** USB はそのまま、Bluetooth は seq_tag と CRC32 で包む */
function wrapReport(common: Bytes, reportId: number): Bytes {
  if (reportId === USB_REPORT) return common;
  const bt = new Uint8Array(77);
  btSeq = (btSeq + 1) & 0x0f;
  if (btSeq === 0) btSeq = 1;
  bt[0] = (btSeq << 4) | 0x00;
  bt[1] = 0x10;
  bt.set(common, 2);
  const crc = crc32(Uint8Array.from([0xa2, BT_REPORT, ...bt.subarray(0, 73)]));
  bt[73] = crc & 0xff;
  bt[74] = (crc >>> 8) & 0xff;
  bt[75] = (crc >>> 16) & 0xff;
  bt[76] = (crc >>> 24) & 0xff;
  return bt;
}

/** 記述子から、実際に受け付ける出力レポート ID を拾う */
function outputReportIds(dev: HIDDevice): Set<number> {
  const ids = new Set<number>();
  for (const col of dev.collections ?? []) {
    for (const r of col.outputReports ?? []) if (r.reportId != null) ids.add(r.reportId);
  }
  return ids;
}

const hex2 = (v: number): string => `0x${v.toString(16).toUpperCase().padStart(2, "0")}`;

const hexDump = (data: Bytes, n: number): string =>
  Array.from(data.subarray(0, n))
    .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ") + (data.length > n ? " …" : "");

/* ---- 言語をまたいで再現できるステータスとログ ----
   文字列ではなく「描き方」を持っておくので、言語を切り替えても直前のメッセージが追従する。 */
let statusRender: () => string = () => t("dock.notConnected");
let statusErr = false;
let logRender: () => string[] = () => [t("log.notConnected")];

function paintStatus(): void {
  const s = $("hidStatus");
  s.textContent = statusRender();
  s.className = statusErr ? "err" : "";
  $("dot").className = `dot${statusErr ? " err" : store.device ? " on" : ""}`;
}

function setStatus(fn: (() => string) | string, isErr = false): void {
  statusRender = typeof fn === "function" ? fn : () => fn;
  statusErr = isErr;
  paintStatus();
}

function paintLog(): void {
  $("hidLog").textContent = logRender().filter(Boolean).join("\n");
}

function setLog(fn: () => string[]): void {
  logRender = fn;
  paintLog();
}

/* ---- 送信 / sending ---- */
async function writeOut(common: Bytes, label: () => string): Promise<void> {
  const dev = store.device;
  if (!dev) return;

  const order = store.link === "usb" ? [USB_REPORT, BT_REPORT] : [BT_REPORT, USB_REPORT];
  let lastErr: unknown = null;

  for (const id of order) {
    const data = wrapReport(common, id);
    try {
      await dev.sendReport(id, data);
      // 想定と違うレポートで通ったなら、接続形式の判定を直しておく
      if (id !== (store.link === "usb" ? USB_REPORT : BT_REPORT)) {
        setLink(id === USB_REPORT ? "usb" : "bt");
      }
      const name = dev.productName || "DualSense";
      $("reportChip").textContent = `output ${hex2(id)} / ${data.length} B`;
      setLog(() => [t("log.device", name, hex2(id), data.length), t("log.sentLine", label()), hexDump(data, 34)]);
      setStatus(() => t("status.sent", label()));
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  setStatus(msg, true);
  setLog(() => [
    t("log.sendFail", msg),
    t("log.accepts", store.reportIds?.size ? [...store.reportIds].map(hex2).join(", ") : t("log.acceptsNone")),
  ]);
}

async function sendEffect(block?: Bytes): Promise<void> {
  const name = store.effect.name;
  await writeOut(commonBlock(block ?? store.currentBlock), () => name);
}

const autoSendOn = (): boolean => $<HTMLInputElement>("autoSend").checked;

/* ---- ドックの状態 / dock state ---- */
function setConnectedUI(dev: HIDDevice | null): void {
  for (const id of ["sendBtn", "offBtn", "pingBtn"]) $<HTMLButtonElement>(id).disabled = !dev;
  $("step1").className = `step${dev ? " done" : " now"}`;
  $("step2").className = `step${dev ? " done" : ""}`;
  $("step3").className = `step${dev ? " now" : ""}`;
  $("hidBtn").textContent = t(dev ? "dock.reconnect" : "dock.connect");
  $("hidBtn").className = `btn${dev ? "" : " primary"}`;
  $("linkChip").hidden = !dev;
  $("guideChip").textContent = t(dev ? "guide.connected" : "dock.notConnected");
  $("guideChip").className = `chip${dev ? " ok" : ""}`;
  $("guide").querySelector<HTMLElement>(".reqs")!.hidden = !!dev;
  $("hidNote").hidden = !!dev;
}

function paintHidNote(): void {
  const n = $("hidNote");
  if (!("hid" in navigator)) {
    n.className = "note warn";
    n.innerHTML = t("hid.unsupported");
  } else {
    n.className = "note";
    n.innerHTML = t("hid.note");
  }
}

function setSide(s: Side): void {
  store.side = s;
  $("sideSeg").querySelectorAll<HTMLElement>("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.side === s));
  });
}

function setLink(l: Link): void {
  store.link = l;
  $("linkChip").textContent = l === "usb" ? "USB" : "Bluetooth";
}

/* ---- 接続 / connecting ---- */
async function connect(): Promise<void> {
  try {
    const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: SONY }] });
    if (!devices.length) return;

    // 出力レポートを持つ collection を選ぶ（DualSense が複数見える環境がある）
    const dev = devices.find((d) => outputReportIds(d).size) ?? devices[0]!;
    if (!dev.opened) await dev.open();

    store.device = dev;
    store.reportIds = outputReportIds(dev);
    if (store.reportIds.has(USB_REPORT)) setLink("usb");
    else if (store.reportIds.has(BT_REPORT)) setLink("bt");

    const name = dev.productName || "DualSense";
    const ids = [...store.reportIds].map(hex2).join(", ");
    setConnectedUI(dev);
    setStatus(() => name);
    setLog(() => [t("log.connected", name), t("log.outputs", ids || t("log.outputsNone")), t("log.tryTest")]);
    if (autoSendOn()) void sendEffect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(msg, true);
    setLog(() => [t("log.connectFail", msg)]);
  }
}

/* ---- 起動 / boot ---- */
export function initHID(): void {
  if (!("hid" in navigator)) {
    $<HTMLButtonElement>("hidBtn").disabled = true;
    setStatus(() => t("hid.unsupportedStatus"), true);
  }

  setSide(store.side);
  $("hidBtn").addEventListener("click", () => void connect());
  $("sendBtn").addEventListener("click", () => void sendEffect());

  $("offBtn").addEventListener("click", () => {
    const save = store.side;
    store.side = "B";
    void writeOut(commonBlock(OFF()), () => t("send.off")).finally(() => {
      store.side = save;
    });
  });

  // ライトバーと振動で、出力が届いているかを確かめる
  $("pingBtn").addEventListener("click", async () => {
    await writeOut(commonBlock(null, { rumble: 120, rgb: [0, 90, 255] }), () => t("send.ping"));
    setTimeout(() => {
      void writeOut(commonBlock(store.currentBlock, { rumble: 0, rgb: [0, 0, 0] }), () => t("send.pingEnd"));
    }, 450);
  });

  $("sideSeg").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b?.dataset.side) return;
    const prev = store.side;
    setSide(b.dataset.side as Side);
    // 外した側は解除しておかないと、前のエフェクトが残ったままになる
    if (store.device && prev !== store.side) {
      const save = store.side;
      store.side = prev;
      void writeOut(commonBlock(OFF()), () => t("send.prevOff")).finally(() => {
        store.side = save;
        if (autoSendOn()) void sendEffect();
      });
    }
  });

  $("autoSend").addEventListener("change", () => {
    if (autoSendOn() && store.device) void sendEffect();
  });

  // エフェクトが変わったら、自動反映が入っているときだけ実機へ送る
  on("effect", () => {
    if (autoSendOn() && store.device) void sendEffect();
  });

  on("lang", () => {
    paintStatus();
    paintLog();
    paintHidNote();
    setConnectedUI(store.device);
  });

  // ページを閉じるときはトリガーを戻しておく
  window.addEventListener("pagehide", () => {
    const dev = store.device;
    if (!dev) return;
    const save = store.side;
    store.side = "B";
    const id = store.link === "usb" ? USB_REPORT : BT_REPORT;
    try {
      void dev.sendReport(id, wrapReport(commonBlock(OFF()), id));
    } catch {
      /* 閉じる途中なので失敗しても何もできない / nothing to do while unloading */
    }
    store.side = save;
  });

  setConnectedUI(null);
  paintHidNote();
}
