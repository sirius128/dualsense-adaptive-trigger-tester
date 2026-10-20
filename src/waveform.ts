/**
 * ハプティック用の波形を PCM で作る。
 * haptics.ts（Web Audio）と同じパターンを、任意のサンプルレートで組み立てる純粋関数。
 * Renders the same haptic patterns as haptics.ts into plain PCM at any sample rate.
 */

export type Wave = "sine" | "square" | "triangle" | "sawtooth";
export type Pattern = "tone" | "pulse" | "sweep" | "click";

export interface WaveSpec {
  wave: Wave;
  pattern: Pattern;
  /** Hz。sweep では使わない / unused by sweep */
  freq: number;
  /** 0..1 */
  amp: number;
  /** ms。click では使わない / unused by click */
  durMs: number;
}

const RAMP = 0.004; // 端のプチッを抑える / soften the edges
const PULSE_ON = 0.06; // 60 ms 鳴らして 60 ms 休む / 60 ms on, 60 ms off
const PULSE_PERIOD = 0.12;
const CLICK = 0.02;
const SWEEP_FROM = 20;
const SWEEP_TO = 400;

/** 位相 0..1 での値。どの波形も 0 から立ち上がる / every wave starts at 0 and rises */
function shape(wave: Wave, p: number): number {
  switch (wave) {
    case "sine":
      return Math.sin(2 * Math.PI * p);
    case "square":
      return p < 0.5 ? 1 : -1;
    case "triangle":
      return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    case "sawtooth":
      return p < 0.5 ? 2 * p : 2 * p - 2;
  }
}

/** [start, end] の区間で、両端を RAMP だけなだらかにした 0..1 */
function edge(t: number, start: number, end: number): number {
  if (t < start || t > end) return 0;
  return Math.min(1, (t - start) / RAMP, (end - t) / RAMP);
}

/** 1 チャンネル分の波形（-1..1） / one channel, -1..1 */
export function renderWave(spec: WaveSpec, rate: number): Float32Array {
  const dur = spec.pattern === "click" ? CLICK : spec.durMs / 1000;
  const n = Math.max(1, Math.round(dur * rate));
  const out = new Float32Array(n);
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let gain = edge(t, 0, dur);
    if (spec.pattern === "pulse") gain = Math.min(gain, edge(t % PULSE_PERIOD, 0, PULSE_ON));
    out[i] = shape(spec.wave, phase) * spec.amp * gain;

    // 周波数を積分して位相を進める。sweep でも波形が途切れない
    const f = spec.pattern === "sweep" ? SWEEP_FROM * (SWEEP_TO / SWEEP_FROM) ** (t / dur) : spec.freq;
    phase = (phase + f / rate) % 1;
  }
  return out;
}
