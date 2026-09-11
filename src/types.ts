/**
 * 共通の型定義と、エフェクト定義のためのヘルパー。
 * Shared types, plus the helper that gives each effect definition its own parameter type.
 */

export type Lang = "ja" | "en";

/** WebHID の sendReport にそのまま渡せるバイト列 / bytes accepted by HIDDevice.sendReport */
export type Bytes = Uint8Array<ArrayBuffer>;

/** 日本語と英語の対で持つ文字列。片方を書き忘れると型エラーになる。 */
export type Localized = string | { ja: string; en: string };

export type ProfileKind = "resist" | "vibe";

/** トリガーストローク上の効き方。t は 0（指を離した状態）〜1（全押し）。 */
export interface Profile {
  kind: ProfileKind;
  at(t: number): number;
}

export interface ParamDef<K extends string = string> {
  k: K;
  label: Localized;
  min: number;
  max: number;
  def: number;
  hint?: Localized;
}

export interface ZoneParamDef<K extends string = string> {
  k: K;
  label: Localized;
  max: number;
  def: number[];
}

/** 実行時に配列へ格納される、型を消したエフェクト定義。 */
export interface EffectDef {
  group: Localized;
  id: string;
  name: string;
  type: number;
  tag: Localized;
  desc: Localized;
  params: readonly ParamDef[];
  zoneParam?: ZoneParamDef;
  /** payload[0..9] の意味ラベル / label for each payload byte */
  bl: readonly Localized[];
  fix?(p: ParamValues): void;
  build(p: ParamValues): Bytes;
  native(p: ParamValues): Profile;
}

export type ParamValues = Record<string, number | number[]>;

type NumParams<T extends readonly ParamDef[]> = { [K in T[number]["k"]]: number };
type ZoneParams<Z> = Z extends ZoneParamDef<infer K> ? { [P in K]: number[] } : object;

/**
 * エフェクトを 1 件定義する。
 * params に書いたキーだけが fix / build / native の引数として見えるので、
 * `p.end` を `p.endPos` と書き間違えるとコンパイルが通らない。
 */
export function defineEffect<
  const T extends readonly ParamDef[],
  const Z extends ZoneParamDef | undefined = undefined,
>(def: {
  group: Localized;
  id: string;
  name: string;
  type: number;
  tag: Localized;
  desc: Localized;
  params: T;
  zoneParam?: Z;
  bl: readonly Localized[];
  fix?: (p: NumParams<T> & ZoneParams<Z>) => void;
  build: (p: NumParams<T> & ZoneParams<Z>) => Bytes;
  native: (p: NumParams<T> & ZoneParams<Z>) => Profile;
}): EffectDef {
  return def as unknown as EffectDef;
}
