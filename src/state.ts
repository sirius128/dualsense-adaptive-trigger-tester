/**
 * 画面と実機のあいだで共有する状態。ui と hid が互いを import せずに済むよう、ここに集めてある。
 * Shared state, kept here so that ui and hid never need to import each other.
 */
import { EFFECTS } from "./effects";
import { P } from "./payload";
import type { Bytes, EffectDef, ParamValues, Profile } from "./types";

export type Side = "L" | "R" | "B";
export type Link = "usb" | "bt";

export interface Store {
  /** 選択中のエフェクト */
  effect: EffectDef;
  /** そのエフェクトのパラメータ値 */
  params: ParamValues;
  /** 送信先のトリガー */
  side: Side;
  /** 接続形式（記述子から自動判別） */
  link: Link;
  device: HIDDevice | null;
  reportIds: Set<number> | null;
  /** いま組み立てられている 11 バイト */
  currentBlock: Bytes;
  /** いま表示している効き方 */
  curProfile: Profile;
  /** 実機のトリガー位置。未検出なら null */
  lastTrigger: number | null;
}

/** エフェクトの初期パラメータを作る */
export function initParams(eff: EffectDef): ParamValues {
  const p: ParamValues = {};
  for (const d of eff.params) p[d.k] = d.def;
  if (eff.zoneParam) p[eff.zoneParam.k] = eff.zoneParam.def.slice();
  return p;
}

const first = EFFECTS[0]!;

export const store: Store = {
  effect: first,
  params: initParams(first),
  side: "B",
  link: "usb",
  device: null,
  reportIds: null,
  currentBlock: new Uint8Array(11),
  curProfile: P("resist", () => 0),
  lastTrigger: null,
};
