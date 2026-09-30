/**
 * ハプティック（USB 音声）。
 * USB 接続の DualSense は 4ch の音声機器にもなり、ch1/ch2 がイヤホン端子とスピーカー、ch3/ch4 が左右の振動子。
 * 波形は Web Audio で作り、コントローラー側の準備（振動エミュレーションの解除）は hid が "haptics" を受けて行う。
 */
import { emit, on } from "./bus";
import { $ } from "./dom";
import { t } from "./i18n";
import { store } from "./state";

type Motor = "L" | "R" | "B";
type Pattern = "tone" | "pulse" | "sweep" | "click";

/** 0 始まりのチャンネル番号 / zero-based channel indices */
const CHANNELS: Record<Motor, number[]> = { L: [2], R: [3], B: [2, 3] };
const MOTORS = ["L", "R", "B"] as const;

/** 出力先の切り替え。型定義に無い環境もあるので自前で足しておく */
type SinkContext = AudioContext & { setSinkId?(id: string): Promise<void> };

let ctx: AudioContext | null = null;
let merger: ChannelMergerNode | null = null;
let voice: OscillatorNode | null = null;
let voiceMotor: Motor | null = null;

/* ---- ステータス / status ---- */
let statusRender: () => string = () => t("hap.idle");
let statusErr = false;

function paintStatus(): void {
  const s = $("hapStatus");
  s.textContent = statusRender();
  s.className = `status${statusErr ? " err" : ""}`;
}

function setStatus(fn: () => string, isErr = false): void {
  statusRender = fn;
  statusErr = isErr;
  paintStatus();
}

function paintButtons(): void {
  const ready = !!ctx && !!store.device;
  for (const m of MOTORS) {
    const b = $<HTMLButtonElement>(`hap${m}`);
    b.disabled = !ready;
    b.setAttribute("aria-pressed", String(voiceMotor === m));
  }
  $<HTMLButtonElement>("hapStop").disabled = !ready;
}

/** パターンによって使わないスライダーを止めておく */
function paintParams(): void {
  const pattern = $<HTMLSelectElement>("hapPattern").value as Pattern;
  $<HTMLInputElement>("hapFreq").disabled = pattern === "sweep";
  $<HTMLInputElement>("hapDur").disabled = pattern === "click";
}

/* ---- 出力先 / output device ---- */
async function findSink(): Promise<MediaDeviceInfo | undefined> {
  // Chrome は許可を取るまで機器名を返さない。マイクの音は使わないので、すぐ止める
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((tr) => tr.stop());
  } catch {
    /* 許可がなくても一覧は取れる（名前が空になる） / names stay empty without permission */
  }
  const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
  return outs.find((d) => d.deviceId !== "default" && /dualsense|wireless controller/i.test(d.label));
}

async function prepare(): Promise<void> {
  stop();
  await ctx?.close();
  ctx = null;
  merger = null;

  try {
    if (!navigator.mediaDevices) throw new Error(t("hap.needSecure"));
    const sink = await findSink();
    if (!sink) throw new Error(t("hap.notFound"));

    const c: SinkContext = new AudioContext({ latencyHint: "interactive" });
    if (typeof c.setSinkId !== "function") {
      await c.close();
      throw new Error(t("hap.noSinkId"));
    }
    await c.setSinkId(sink.deviceId);
    await c.resume();

    const dest = c.destination;
    const max = dest.maxChannelCount;
    if (max < 4) {
      await c.close();
      throw new Error(t("hap.stereoOnly", max));
    }
    dest.channelCount = 4;
    dest.channelCountMode = "explicit";
    dest.channelInterpretation = "discrete";
    merger = c.createChannelMerger(4);
    merger.connect(dest);
    ctx = c;

    const label = sink.label;
    setStatus(() => (store.device ? t("hap.ready", label) : t("hap.needHid")));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(() => msg, true);
  }
  paintButtons();
}

/* ---- 再生 / playback ---- */
function stop(): void {
  try {
    voice?.stop();
  } catch {
    /* 止まっている / already stopped */
  }
  voice = null;
  voiceMotor = null;
}

function play(m: Motor): void {
  if (!ctx || !merger) return;
  stop();
  // 振動（互換モード）が音声ハプティックを切っていることがあるので、毎回戻してから鳴らす
  emit("haptics", undefined);

  const wave = $<HTMLSelectElement>("hapWave").value as OscillatorType;
  const pattern = $<HTMLSelectElement>("hapPattern").value as Pattern;
  const freq = Number($<HTMLInputElement>("hapFreq").value);
  const amp = Number($<HTMLInputElement>("hapAmp").value) / 100;
  const dur = pattern === "click" ? 0.02 : Number($<HTMLInputElement>("hapDur").value) / 1000;

  const t0 = ctx.currentTime + 0.01;
  const end = t0 + dur;
  const ramp = 0.004; // 端のプチッを抑える / soften the edges

  const osc = ctx.createOscillator();
  osc.type = wave;
  if (pattern === "sweep") {
    osc.frequency.setValueAtTime(20, t0);
    osc.frequency.exponentialRampToValueAtTime(400, end);
  } else {
    osc.frequency.setValueAtTime(freq, t0);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  if (pattern === "pulse") {
    // 60 ms 鳴らして 60 ms 休む / 60 ms on, 60 ms off
    for (let s = t0; s + 2 * ramp < end; s += 0.12) {
      const e = Math.min(end, s + 0.06);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(amp, s + ramp);
      g.gain.setValueAtTime(amp, e - ramp);
      g.gain.linearRampToValueAtTime(0, e);
    }
  } else {
    g.gain.linearRampToValueAtTime(amp, t0 + ramp);
    g.gain.setValueAtTime(amp, end - ramp);
    g.gain.linearRampToValueAtTime(0, end);
  }

  osc.connect(g);
  for (const ch of CHANNELS[m]) g.connect(merger, 0, ch);
  osc.onended = () => {
    if (voice !== osc) return;
    voice = null;
    voiceMotor = null;
    paintButtons();
  };
  osc.start(t0);
  osc.stop(end + 0.01);

  voice = osc;
  voiceMotor = m;
  paintButtons();
}

/* ---- 起動 / boot ---- */
export function initHaptics(): void {
  $("hapPrep").addEventListener("click", () => void prepare());
  for (const m of MOTORS) $(`hap${m}`).addEventListener("click", () => play(m));
  $("hapStop").addEventListener("click", () => {
    stop();
    paintButtons();
  });

  for (const id of ["hapFreq", "hapAmp", "hapDur"]) {
    const input = $<HTMLInputElement>(id);
    input.addEventListener("input", () => ($(`${id}Out`).textContent = input.value));
  }
  $("hapPattern").addEventListener("change", paintParams);

  if (!navigator.mediaDevices || !("setSinkId" in AudioContext.prototype)) {
    $<HTMLButtonElement>("hapPrep").disabled = true;
    setStatus(() => t(navigator.mediaDevices ? "hap.noSinkId" : "hap.needSecure"), true);
  }

  on("device", () => {
    paintStatus();
    paintButtons();
  });
  on("lang", paintStatus);

  paintParams();
  paintButtons();
}
