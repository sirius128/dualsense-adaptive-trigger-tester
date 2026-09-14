/**
 * DualSense のトリガーエフェクト 15 種。
 * The 15 trigger effects the DualSense firmware understands.
 *
 * このファイルだけ読めば、どの type がどのバイトを取るかが分かるようにしてある。
 * 各エフェクトの params に書いたキーだけが build / native / fix から見えるので、
 * キー名を書き間違えるとコンパイルが通らない。
 */
import { defineEffect } from "./types";
import type { EffectDef, Localized } from "./types";
import { L } from "./i18n";
import {
  OFF, P, Z, blk, fromArray, fromPosition, slopeArray, span, twoZoneMask, zoneIndex, zp,
} from "./payload";

/* ---- payload バイトの意味ラベル / label for each payload byte ---- */
const NONE = L("—", "—");
const lb = (...a: Localized[]): Localized[] => {
  const o = a.slice(0, 10);
  while (o.length < 10) o.push(NONE);
  return o;
};
const BL = {
  maskLo: L("マスク下位", "mask lo"),
  maskHi: L("マスク上位", "mask hi"),
  strength: L("強さ", "strength"),
  start: L("開始位置", "start"),
  end: L("終了位置", "end"),
  freq: L("周波数", "freq"),
  amp: L("振幅", "amp"),
  period: L("周期", "period"),
  feet: L("足の位置", "feet"),
  strSnap: L("強さ+弾け", "str+snap"),
  ampAB: L("振幅 A+B", "amp A+B"),
};
const ZONE_LB = [
  BL.maskLo, BL.maskHi,
  L("ゾーン値 1", "zone val 1"), L("ゾーン値 2", "zone val 2"),
  L("ゾーン値 3", "zone val 3"), L("ゾーン値 4", "zone val 4"),
];

/* ---- 一覧の見出し / list headings ---- */
const G_OFFICIAL = L("公式エフェクト", "Official effects");
const G_UNDOC = L("非公式だが固有の効果", "Undocumented effects");
const G_SIMPLE = L("簡易版（生バイト）", "Simple (raw bytes)");
const G_LIMITED = L("制限版（強さは 0–10）", "Limited (strength 0–10)");
const G_OFF = L("解除", "Off");

export const EFFECTS: EffectDef[] = [
  defineEffect({
    group: G_OFFICIAL, id: "feedback", name: "Feedback", type: 0x21,
    tag: L("一定の重さ", "Constant weight"),
    desc: L(
      "指定ゾーン以降を一定の力で押し返す、いちばん基本の効果。車のブレーキや、重い扉を押す手応えに使われます。",
      "Pushes back with a constant force from the given zone onward — the most basic effect. Used for car brakes and the weight of a heavy door.",
    ),
    params: [
      { k: "position", label: L("開始ゾーン", "Start zone"), min: 0, max: 9, def: 4, hint: "zone 0–9" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 8, def: 6, hint: "0–8" },
    ],
    bl: lb(...ZONE_LB),
    build: (p) => (p.strength === 0 ? OFF() : blk(0x21, ...fromPosition(p.position, p.strength))),
    native: (p) => P("resist", (t) => (t >= zp(p.position) - 1e-6 ? p.strength / 8 : 0)),
  }),

  defineEffect({
    group: G_OFFICIAL, id: "weapon", name: "Weapon", type: 0x25,
    tag: L("銃のトリガー", "Gun trigger"),
    desc: L(
      "開始ゾーンから終了ゾーンまで抵抗し、抜けた瞬間に解放される。引き金の「カチッ」という手応えそのもの。",
      "Resists from the start zone to the end zone, then releases the moment you break through — the click of a gun trigger.",
    ),
    params: [
      { k: "start", label: L("開始ゾーン", "Start zone"), min: 2, max: 7, def: 3, hint: "zone 2–7" },
      { k: "end", label: L("終了ゾーン", "End zone"), min: 3, max: 8, def: 5, hint: "zone start+1–8" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 8, def: 7, hint: "0–8" },
    ],
    bl: lb(BL.maskLo, BL.maskHi, BL.strength),
    fix: (p) => { if (p.end <= p.start) p.end = Math.min(8, p.start + 1); },
    build: (p) => (p.strength === 0 ? OFF() : blk(0x25, ...twoZoneMask(p.start, p.end), p.strength - 1)),
    native: (p) => P("resist", (t) => (span(t, zp(p.start), zp(p.end)) ? p.strength / 8 : 0)),
  }),

  defineEffect({
    group: G_OFFICIAL, id: "vibration", name: "Vibration", type: 0x26,
    tag: L("連続振動", "Continuous vibration"),
    desc: L(
      "指定ゾーン以降でトリガー自身が振動する。エンジンや電動工具の手応え。",
      "The trigger itself vibrates from the given zone onward — engines and power tools.",
    ),
    params: [
      { k: "position", label: L("開始ゾーン", "Start zone"), min: 0, max: 9, def: 2, hint: "zone 0–9" },
      { k: "amplitude", label: L("振幅", "Amplitude"), min: 0, max: 8, def: 6, hint: "0–8" },
      { k: "frequency", label: L("周波数", "Frequency"), min: 0, max: 255, def: 40, hint: "Hz 0–255" },
    ],
    bl: lb(...ZONE_LB, NONE, NONE, BL.freq),
    build: (p) =>
      p.amplitude === 0 || p.frequency === 0
        ? OFF()
        : blk(0x26, ...fromPosition(p.position, p.amplitude), 0, 0, p.frequency),
    native: (p) => P("vibe", (t) => (t >= zp(p.position) - 1e-6 ? p.amplitude / 8 : 0)),
  }),

  defineEffect({
    group: G_OFFICIAL, id: "multiFeedback", name: "MultiplePositionFeedback", type: 0x21,
    tag: L("ゾーンごとの重さ", "Per-zone weight"),
    desc: L(
      "10 ゾーンそれぞれに違う抵抗を置く。中身は Feedback と同じ type 0x21 で、ゾーンの埋め方が違うだけ。",
      "Gives each of the 10 zones its own resistance. Same type 0x21 as Feedback — only how the zones are filled differs.",
    ),
    params: [],
    zoneParam: { k: "strengths", label: L("ゾーン別の強さ", "Per-zone strength"), max: 8, def: [0, 0, 3, 5, 7, 8, 6, 4, 2, 0] },
    bl: lb(...ZONE_LB),
    build: (p) => (p.strengths.some((v) => v > 0) ? blk(0x21, ...fromArray(p.strengths)) : OFF()),
    native: (p) => P("resist", (t) => (p.strengths[zoneIndex(t)] ?? 0) / 8),
  }),

  defineEffect({
    group: G_OFFICIAL, id: "slope", name: "SlopeFeedback", type: 0x21,
    tag: L("だんだん重く", "Ramping weight"),
    desc: L(
      "開始から終了に向けて抵抗が直線的に変化する。中身は MultiplePositionFeedback を傾斜状に埋めたもの。",
      "Resistance changes linearly from the start zone to the end zone. Under the hood it is MultiplePositionFeedback filled as a ramp.",
    ),
    params: [
      { k: "start", label: L("開始ゾーン", "Start zone"), min: 0, max: 8, def: 1, hint: "zone 0–8" },
      { k: "end", label: L("終了ゾーン", "End zone"), min: 1, max: 9, def: 8, hint: "zone start+1–9" },
      { k: "startStrength", label: L("開始の強さ", "Start strength"), min: 1, max: 8, def: 1, hint: "1–8" },
      { k: "endStrength", label: L("終了の強さ", "End strength"), min: 1, max: 8, def: 8, hint: "1–8" },
    ],
    bl: lb(...ZONE_LB),
    fix: (p) => { if (p.end <= p.start) p.end = Math.min(9, p.start + 1); },
    build: (p) => blk(0x21, ...fromArray(slopeArray(p.start, p.end, p.startStrength, p.endStrength))),
    native: (p) => {
      const a = slopeArray(p.start, p.end, p.startStrength, p.endStrength);
      return P("resist", (t) => (a[zoneIndex(t)] ?? 0) / 8);
    },
  }),

  defineEffect({
    group: G_OFFICIAL, id: "multiVibration", name: "MultiplePositionVibration", type: 0x26,
    tag: L("ゾーンごとの振動", "Per-zone vibration"),
    desc: L(
      "10 ゾーンそれぞれに振幅を置き、全体で 1 つの周波数を共有する。",
      "Gives each of the 10 zones its own amplitude, with a single frequency shared across all of them.",
    ),
    params: [{ k: "frequency", label: L("周波数", "Frequency"), min: 0, max: 255, def: 35, hint: "Hz 0–255" }],
    zoneParam: { k: "amps", label: L("ゾーン別の振幅", "Per-zone amplitude"), max: 8, def: [8, 6, 4, 2, 0, 0, 2, 4, 6, 8] },
    bl: lb(...ZONE_LB, NONE, NONE, BL.freq),
    build: (p) =>
      p.frequency === 0 || !p.amps.some((v) => v > 0)
        ? OFF()
        : blk(0x26, ...fromArray(p.amps), 0, 0, p.frequency),
    native: (p) => P("vibe", (t) => (p.amps[zoneIndex(t)] ?? 0) / 8),
  }),

  defineEffect({
    group: G_UNDOC, id: "bow", name: "Bow", type: 0x22,
    tag: L("弓", "Bow"),
    desc: L(
      "引くほど重くなり、終端で弾ける。弓を引き絞って離す感触。公式 SDK には無い、ファームウェア内蔵の隠しエフェクト。",
      "Grows heavier as you pull and snaps at the end — drawing and loosing a bow. Built into the firmware but absent from the official SDK.",
    ),
    params: [
      { k: "start", label: L("開始ゾーン", "Start zone"), min: 0, max: 8, def: 1, hint: "zone 0–8" },
      { k: "end", label: L("終了ゾーン", "End zone"), min: 1, max: 9, def: 6, hint: "zone start+1–9" },
      { k: "strength", label: L("引きの強さ", "Draw strength"), min: 0, max: 8, def: 3, hint: "0–8" },
      { k: "snapForce", label: L("弾ける力", "Snap force"), min: 0, max: 8, def: 8, hint: "0–8" },
    ],
    bl: lb(BL.maskLo, BL.maskHi, BL.strSnap),
    fix: (p) => { if (p.end <= p.start) p.end = Math.min(9, p.start + 1); },
    build: (p) =>
      p.strength === 0 || p.snapForce === 0
        ? OFF()
        : blk(0x22, ...twoZoneMask(p.start, p.end), ((p.strength - 1) & 7) | (((p.snapForce - 1) & 7) << 3), 0),
    native: (p) =>
      P("resist", (t) =>
        span(t, zp(p.start), zp(p.end))
          ? (p.strength + ((p.snapForce - p.strength) * (t - zp(p.start))) / (zp(p.end) - zp(p.start))) / 8
          : 0,
      ),
  }),

  defineEffect({
    group: G_UNDOC, id: "galloping", name: "Galloping", type: 0x23,
    tag: L("駆け足", "Galloping"),
    desc: L(
      "2 拍のリズムでトリガーを叩く。馬の足音のような効果で、1 歩目と 2 歩目の間隔を指定できる。",
      "Knocks against the trigger in a two-beat rhythm, like hooves. You set where each of the two footfalls lands.",
    ),
    params: [
      { k: "start", label: L("開始ゾーン", "Start zone"), min: 0, max: 8, def: 0, hint: "zone 0–8" },
      { k: "end", label: L("終了ゾーン", "End zone"), min: 1, max: 9, def: 9, hint: "zone start+1–9" },
      { k: "firstFoot", label: L("1 歩目の位置", "First foot"), min: 0, max: 6, def: 1, hint: "0–6" },
      { k: "secondFoot", label: L("2 歩目の位置", "Second foot"), min: 1, max: 7, def: 5, hint: "firstFoot+1–7" },
      { k: "frequency", label: L("周波数", "Frequency"), min: 1, max: 255, def: 12, hint: "Hz 1–255" },
    ],
    bl: lb(BL.maskLo, BL.maskHi, BL.feet, BL.freq),
    fix: (p) => {
      if (p.end <= p.start) p.end = Math.min(9, p.start + 1);
      if (p.secondFoot <= p.firstFoot) p.secondFoot = Math.min(7, p.firstFoot + 1);
    },
    build: (p) =>
      blk(0x23, ...twoZoneMask(p.start, p.end), (p.secondFoot & 7) | ((p.firstFoot & 7) << 3), p.frequency),
    native: (p) => P("vibe", (t) => (span(t, zp(p.start), zp(p.end)) ? 1 : 0)),
  }),

  defineEffect({
    group: G_UNDOC, id: "machine", name: "Machine", type: 0x27,
    tag: L("機械", "Machine"),
    desc: L(
      "2 つの振幅を交互に鳴らす。チェーンソーやミシンのような、不均一な振動。",
      "Alternates between two amplitudes — the uneven shake of a chainsaw or a sewing machine.",
    ),
    params: [
      { k: "start", label: L("開始ゾーン", "Start zone"), min: 0, max: 8, def: 1, hint: "zone 0–8" },
      { k: "end", label: L("終了ゾーン", "End zone"), min: 1, max: 9, def: 9, hint: "zone start+1–9" },
      { k: "amplitudeA", label: L("振幅 A", "Amplitude A"), min: 0, max: 7, def: 7, hint: "0–7" },
      { k: "amplitudeB", label: L("振幅 B", "Amplitude B"), min: 0, max: 7, def: 2, hint: "0–7" },
      { k: "frequency", label: L("周波数", "Frequency"), min: 1, max: 255, def: 30, hint: "Hz 1–255" },
      { k: "period", label: L("交替の周期", "Alternation period"), min: 0, max: 255, def: 3, hint: "0–255" },
    ],
    bl: lb(BL.maskLo, BL.maskHi, BL.ampAB, BL.freq, BL.period),
    fix: (p) => { if (p.end <= p.start) p.end = Math.min(9, p.start + 1); },
    build: (p) =>
      blk(0x27, ...twoZoneMask(p.start, p.end),
        (p.amplitudeA & 7) | ((p.amplitudeB & 7) << 3), p.frequency, p.period),
    native: (p) =>
      P("vibe", (t) => (span(t, zp(p.start), zp(p.end)) ? Math.max(p.amplitudeA, p.amplitudeB) / 7 : 0)),
  }),

  defineEffect({
    group: G_SIMPLE, id: "simpleFeedback", name: "Simple_Feedback", type: 0x01,
    tag: L("一定の重さ / 簡易", "Constant weight, simple"),
    desc: L(
      "ゾーンを介さず、位置と強さを 0–255 のまま渡す旧形式。ファームウェア側でゾーンに丸められます。",
      "An older form that passes position and strength as raw 0–255 values instead of zones. The firmware rounds them to zones anyway.",
    ),
    params: [
      { k: "position", label: L("開始位置", "Start position"), min: 0, max: 255, def: 96, hint: "byte 0–255" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 255, def: 180, hint: "byte 0–255" },
    ],
    bl: lb(BL.start, BL.strength),
    build: (p) => blk(0x01, p.position, p.strength),
    native: (p) => P("resist", (t) => (t >= p.position / 255 - 1e-6 ? p.strength / 255 : 0)),
  }),

  defineEffect({
    group: G_SIMPLE, id: "simpleWeapon", name: "Simple_Weapon", type: 0x02,
    tag: L("銃のトリガー / 簡易", "Gun trigger, simple"),
    desc: L("開始・終了・強さをすべて生バイトで渡す。", "Start, end and strength all passed as raw bytes."),
    params: [
      { k: "start", label: L("開始位置", "Start position"), min: 0, max: 254, def: 70, hint: "byte 0–254" },
      { k: "end", label: L("終了位置", "End position"), min: 1, max: 255, def: 150, hint: "byte start+1–255" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 255, def: 220, hint: "byte 0–255" },
    ],
    bl: lb(BL.start, BL.end, BL.strength),
    fix: (p) => { if (p.end <= p.start) p.end = Math.min(255, p.start + 1); },
    build: (p) => blk(0x02, p.start, p.end, p.strength),
    native: (p) => P("resist", (t) => (span(t, p.start / 255, p.end / 255) ? p.strength / 255 : 0)),
  }),

  defineEffect({
    group: G_SIMPLE, id: "simpleVibration", name: "Simple_Vibration", type: 0x06,
    tag: L("連続振動 / 簡易", "Vibration, simple"),
    desc: L(
      "周波数・振幅・位置の順にバイトが並ぶ。他のエフェクトと並び順が違う点に注意。",
      "Bytes run frequency, amplitude, position — note that this order differs from every other effect.",
    ),
    params: [
      { k: "position", label: L("開始位置", "Start position"), min: 0, max: 255, def: 60, hint: "byte 0–255" },
      { k: "amplitude", label: L("振幅", "Amplitude"), min: 0, max: 255, def: 200, hint: "byte 0–255" },
      { k: "frequency", label: L("周波数", "Frequency"), min: 0, max: 255, def: 40, hint: "Hz 0–255" },
    ],
    bl: lb(BL.freq, BL.amp, BL.start),
    build: (p) =>
      p.amplitude === 0 || p.frequency === 0 ? OFF() : blk(0x06, p.frequency, p.amplitude, p.position),
    native: (p) => P("vibe", (t) => (t >= p.position / 255 - 1e-6 ? p.amplitude / 255 : 0)),
  }),

  defineEffect({
    group: G_LIMITED, id: "limitedFeedback", name: "Limited_Feedback", type: 0x11,
    tag: L("一定の重さ / 制限", "Constant weight, limited"),
    desc: L(
      "Simple_Feedback と同じ並びだが、強さの有効範囲がファームウェア側で 0–10 に制限される。",
      "Same byte layout as Simple_Feedback, but the firmware only accepts strengths of 0–10.",
    ),
    params: [
      { k: "position", label: L("開始位置", "Start position"), min: 0, max: 255, def: 96, hint: "byte 0–255" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 10, def: 10, hint: L("0–10 のみ", "0–10 only") },
    ],
    bl: lb(BL.start, BL.strength),
    build: (p) => (p.strength === 0 ? OFF() : blk(0x11, p.position, p.strength)),
    native: (p) => P("resist", (t) => (t >= p.position / 255 - 1e-6 ? p.strength / 10 : 0)),
  }),

  defineEffect({
    group: G_LIMITED, id: "limitedWeapon", name: "Limited_Weapon", type: 0x12,
    tag: L("銃のトリガー / 制限", "Gun trigger, limited"),
    desc: L(
      "開始は 16 以上、終了は開始+100 以内、強さは 0–10 に制限される。範囲を外れるとファームウェアが無視します。",
      "Start must be 16 or more, end within start+100, strength 0–10. Outside those bounds the firmware ignores the effect.",
    ),
    params: [
      { k: "start", label: L("開始位置", "Start position"), min: 16, max: 255, def: 70, hint: "byte 16–255" },
      { k: "end", label: L("終了位置", "End position"), min: 17, max: 255, def: 150, hint: "byte start–start+100" },
      { k: "strength", label: L("抵抗の強さ", "Resistance"), min: 0, max: 10, def: 10, hint: L("0–10 のみ", "0–10 only") },
    ],
    bl: lb(BL.start, BL.end, BL.strength),
    fix: (p) => {
      if (p.end <= p.start) p.end = Math.min(255, p.start + 1);
      if (p.end > p.start + 100) p.end = Math.min(255, p.start + 100);
    },
    build: (p) => (p.strength === 0 ? OFF() : blk(0x12, p.start, p.end, p.strength)),
    native: (p) => P("resist", (t) => (span(t, p.start / 255, p.end / 255) ? p.strength / 10 : 0)),
  }),

  defineEffect({
    group: G_OFF, id: "off", name: "Off", type: 0x05,
    tag: L("解除", "Release"),
    desc: L("トリガーを自由に戻す。type 0x00 も同じ扱いです。", "Frees the trigger again. Type 0x00 behaves identically."),
    params: [],
    bl: lb(),
    build: () => OFF(),
    native: () => P("resist", () => 0),
  }),
];

/** ゾーン数を他のモジュールからも参照できるように / re-export for convenience */
export { Z };
