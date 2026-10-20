/**
 * Razer Kishi（V3 / V3 Pro / Ultra）のハプティック用レポート。
 * 形式は PeaSyo の公開実装（AGPL-3.0、RazerKishiController.java）から事実だけを読み取り、コードは独自に書いている。
 * V3 Pro XL（0x0727）は別プロトコルなので対象外。
 *
 * Report layout facts come from PeaSyo's public implementation; the code here is our own.
 * The V3 Pro XL (0x0727) speaks a different protocol and is not handled.
 */
import type { Bytes } from "../types";

export const RAZER = 0x1532;

export const KISHI_PIDS: Record<number, string> = {
  0x0719: "Kishi (XInput+)", // Ultra / V3 / V3 Pro で共通 / shared by Ultra, V3 and V3 Pro
  0x071a: "Kishi Ultra",
  0x0721: "Kishi V3",
  0x0724: "Kishi V3 Pro",
  // Mac につないだときの構成。iAP と "Razer HD Haptics Specifications"（レポート ID 付き 63 バイト）が出て、
  // PCM を受けるインターフェース 3 は無い / seen on macOS: no PCM interface in this mode
  0x071d: "Kishi Ultra (Apple)",
};

/** PCM を受けるインターフェースが無いと分かっている PID / PIDs known to lack the PCM interface */
export const NO_PCM_PIDS = new Set([0x071d]);

/** ステレオ 16bit の PCM を 4 kHz で流す / stereo S16LE at 4 kHz */
export const SAMPLE_RATE = 4000;
/** 1 フレームに入るステレオのサンプル数（3 ms 分） / stereo samples per frame (3 ms) */
export const FRAME_SAMPLES = 12;
export const FRAME_BYTES = 64;

// 55 AA … 30（PCM のバイト数） FE 79（ステレオのコマンド）
const HEADER = [0x55, 0xaa, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0xfe, 0x79];
const PAYLOAD_AT = 10;
const PAYLOAD_BYTES = FRAME_SAMPLES * 2 * 2;
const CHECKSUM_AT = PAYLOAD_AT + PAYLOAD_BYTES; // 58。残り 5 バイトは 0 / the last 5 bytes stay 0

/** 1 = 左、2 = 右 / 1 = left, 2 = right */
export type Actuator = 1 | 2;
export const ACTUATORS: readonly Actuator[] = [1, 2];

/**
 * インターフェース 3 の Feature レポートの長さ（レポート ID なし）。Windows の HidP_GetCaps で 91（ID の 1 バイト込み）。
 * Chrome はこの Feature を collections に出さないので、長さはここで持つ。
 * Windows は長さが合わない Feature の送信を拒否する。
 *
 * Feature length on interface 3 (91 incl. the ID byte on Windows). Chrome does not list it.
 */
export const FEATURE_BYTES = 90;

/** PeaSyo が使っている強さの段階 / the strength steps PeaSyo uses */
export const LEVELS = { low: 0x21, medium: 0x42, high: 0x64 } as const;

/** 2 バイト目から 57 バイト目までの XOR / XOR over bytes 2..57 */
export function checksum(frame: Bytes): number {
  let x = 0;
  for (let i = 2; i < CHECKSUM_AT; i++) x ^= frame[i]!;
  return x;
}

/** L, R 交互に並んだ 24 個のサンプルから 64 バイトを作る / 24 interleaved L/R samples → 64 bytes */
export function frame(samples: Int16Array): Bytes {
  if (samples.length !== FRAME_SAMPLES * 2) throw new Error(`need ${FRAME_SAMPLES * 2} samples`);
  const f = new Uint8Array(FRAME_BYTES);
  f.set(HEADER, 0);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    f[PAYLOAD_AT + i * 2] = s & 0xff;
    f[PAYLOAD_AT + i * 2 + 1] = (s >> 8) & 0xff;
  }
  f[CHECKSUM_AT] = checksum(f);
  return f;
}

/**
 * Feature レポート（レポート ID なし）の中身。
 * PeaSyo は「振動子の ON / OFF」も「強さ」もこの同じ形で送っていて、値だけが違う（ON = 1、OFF = 0、強さ = LEVELS）。
 * 実機で何が効いているかは未確認なので、ここでは形だけを持つ。
 *
 * PeaSyo sends both on/off and strength in this same shape, differing only in value.
 */
export function command(actuator: Actuator, value: number): Bytes {
  return Uint8Array.of(0x00, actuator, value & 0xff);
}

/** -1..1 の左右チャンネルを、フレーム単位に詰める。末尾は 0 で埋める */
export function packFrames(left: Float32Array, right: Float32Array): Bytes[] {
  const n = Math.max(left.length, right.length);
  const frames: Bytes[] = [];
  const buf = new Int16Array(FRAME_SAMPLES * 2);
  const toS16 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 32767);

  for (let at = 0; at < n; at += FRAME_SAMPLES) {
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      buf[i * 2] = toS16(left[at + i] ?? 0);
      buf[i * 2 + 1] = toS16(right[at + i] ?? 0);
    }
    frames.push(frame(buf));
  }
  return frames;
}

/** 無音のフレーム / a silent frame */
export const silence = (): Bytes => frame(new Int16Array(FRAME_SAMPLES * 2));
