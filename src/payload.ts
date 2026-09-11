/**
 * トリガーエフェクトの 11 バイト（type 1 + payload 10）を組み立てる部品。
 * Building blocks for the 11-byte trigger effect block (1 type byte + 10 payload bytes).
 *
 * バイト配置は Nielk1 の TriggerEffectGenerator に準拠。
 */
import type { Bytes, Profile, ProfileKind } from "./types";

/** トリガーのゾーン数 / number of trigger zones */
export const Z = 10;

/** ゾーン番号 → ストローク位置 0..1 */
export const zp = (z: number): number => Math.min(1, Math.max(0, z / (Z - 1)));

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** ストローク位置 → もっとも近いゾーン番号 */
export const zoneIndex = (t: number): number =>
  Math.min(Z - 1, Math.max(0, Math.round(t * (Z - 1))));

/** t が [a, b] の内側か（端は含む） */
export const span = (t: number, a: number, b: number): boolean =>
  t >= a - 1e-6 && t <= b + 1e-6;

/** 効き方のプロファイルを作る / build a profile */
export const P = (kind: ProfileKind, fn: (t: number) => number): Profile => ({
  kind,
  at: (t: number) => clamp01(fn(t)),
});

/** type バイトと payload を 11 バイトにまとめる */
export function blk(type: number, ...rest: number[]): Bytes {
  const b = new Uint8Array(11);
  b[0] = type;
  rest.forEach((v, i) => {
    b[i + 1] = v & 0xff;
  });
  return b;
}

/** ゾーンマスク 2 バイト + 3bit × 10 ゾーンを詰めた 4 バイト */
function zoneWords(active: number, values: number): number[] {
  return [
    active & 0xff,
    (active >> 8) & 0xff,
    values & 0xff,
    (values >>> 8) & 0xff,
    (values >>> 16) & 0xff,
    (values >>> 24) & 0xff,
  ];
}

/** ゾーン pos 以降を同じ強さで埋める / fill zone pos onward with one strength */
export function fromPosition(pos: number, strength: number): number[] {
  let active = 0;
  let values = 0;
  for (let i = pos; i < Z; i++) {
    active |= 1 << i;
    values |= ((strength - 1) & 7) << (3 * i);
  }
  return zoneWords(active, values >>> 0);
}

/** ゾーンごとの強さ配列をそのまま詰める。強さ 0 のゾーンはマスクごと落ちる。 */
export function fromArray(arr: number[]): number[] {
  let active = 0;
  let values = 0;
  for (let i = 0; i < Z; i++) {
    const v = arr[i] ?? 0;
    if (v > 0) {
      active |= 1 << i;
      values |= ((v - 1) & 7) << (3 * i);
    }
  }
  return zoneWords(active, values >>> 0);
}

/** s から e へ直線的に変化する強さ配列 */
export function slopeArray(s: number, e: number, ss: number, es: number): number[] {
  const arr = new Array<number>(Z).fill(0);
  const slope = (es - ss) / (e - s);
  for (let i = s; i < Z; i++) arr[i] = i <= e ? Math.round(ss + slope * (i - s)) : es;
  return arr;
}

/** 解除 / release the trigger */
export const OFF = (): Bytes => blk(0x05);

/** 2 ゾーンだけを立てたマスク（Weapon / Bow / Galloping / Machine が使う） */
export const twoZoneMask = (start: number, end: number): [number, number] => {
  const m = (1 << start) | (1 << end);
  return [m & 0xff, m >> 8];
};
