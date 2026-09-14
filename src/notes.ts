/**
 * エフェクトの型ごとに出す注記。ファームウェア側の癖をここにまとめてある。
 * Per-type notes about firmware quirks.
 */
import { L } from "./i18n";
import type { EffectDef, Localized } from "./types";

export type NoteClass = "" | "flag" | "warn";

export function notesFor(eff: EffectDef, block: Uint8Array): [NoteClass, Localized][] {
  const out: [NoteClass, Localized][] = [];

  if (block[0] === 0x05 && eff.type !== 0x05)
    out.push(["warn", L(
      "強さか周波数が <b>0</b> のため、このエフェクトは <b>解除（type 0x05）</b>として送られます。トリガーは軽いままになります。",
      "Strength or frequency is <b>0</b>, so this is sent as a plain <b>Off (type 0x05)</b> and the trigger stays loose.",
    )]);

  if (eff.type === 0x01 || eff.type === 0x02 || eff.type === 0x06 || eff.type === 0x11 || eff.type === 0x12)
    out.push(["flag", L(
      "公式モードの古い実装がファームウェアに残っているものです。出典では <b>使うべきではない</b>とされています。同じ効果は Feedback / Weapon / Vibration で得られます。",
      "An older implementation of an official mode, still left in the firmware. The source documenting these states they <b>should not be used</b> — Feedback / Weapon / Vibration give you the same results.",
    )]);

  if (eff.type === 0x11 || eff.type === 0x12)
    out.push(["flag", L(
      "強さのバイトは 0–255 の幅を持ちますが、ファームウェアが受け付けるのは <b>0–10</b> だけです。11 以上を書いてもエフェクトは無効になります。",
      "The strength byte holds 0–255, but the firmware only accepts <b>0–10</b>. Anything above 10 disables the effect.",
    )]);

  if (eff.type === 0x12)
    out.push(["flag", L(
      "開始位置は <b>16 以上</b>、終了位置は <b>開始+100 以内</b>。この範囲を外れると、ファームウェアはエフェクトごと無視します。",
      "Start must be <b>16 or more</b> and end within <b>start+100</b>. Outside that, the firmware ignores the whole effect.",
    )]);

  if (eff.type === 0x22 || eff.type === 0x23 || eff.type === 0x27)
    out.push(["flag", L(
      "公式 SDK には無い、解析で見つかったエフェクトです。ファームウェアに残っている遺物とされており、効き方がバージョンによって変わることも、<b>将来の更新で削除されること</b>もあり得ます。",
      "Found by reverse engineering, not in the official SDK. It is described as a firmware leftover, so its behaviour may change between versions and <b>a future update may remove it entirely</b>.",
    )]);

  if (eff.type === 0x22 && (block[2]! & 0x02) !== 0)
    out.push(["", L(
      "終了ゾーン <b>9</b> は、バイト配置の出典（Nielk1）が挙げている範囲（0–8）の外側です。実機のゲームがこのマスク（<code>01 02</code> = ゾーン 0 と 9）を書いて動作しているのを確認しているため、ここでも選べるようにしてあります。",
      "End zone <b>9</b> lies outside the 0–8 range given by the byte-layout source (Nielk1). A shipping title was observed writing this very mask (<code>01 02</code> = zones 0 and 9) and the effect worked on hardware, so it is offered here.",
    )]);

  if (eff.type === 0x23)
    out.push(["", L(
      "グラフは振動する範囲だけを示しています。実際には 2 拍のリズムで叩くので、波形は上下に脈打ちます。",
      "The graph shows only the range that vibrates. In reality it knocks in a two-beat rhythm, so the real waveform pulses.",
    )]);

  if (eff.type === 0x27)
    out.push(["", L(
      "グラフは強い方の振幅を示しています。実際には振幅 A と B が「交替の周期」で入れ替わります。",
      "The graph shows the stronger of the two amplitudes. In reality A and B swap at the alternation period.",
    )]);

  if (eff.type === 0x21 && (eff.id === "multiFeedback" || eff.id === "slope"))
    out.push(["", L(
      "ゾーンの強さは <b>3 bit（1–8）</b>で 10 ゾーン分をまとめて 4 バイトに詰めています。強さ 0 のゾーンはマスクごと落ちます。",
      "Zone strengths are <b>3 bits each (1–8)</b>, ten of them packed into 4 bytes. A zone set to 0 is dropped from the mask entirely.",
    )]);

  if (eff.type === 0x01 || eff.type === 0x02 || eff.type === 0x06)
    out.push(["", L(
      "生バイトで渡しても、ファームウェア内部では結局 10 ゾーンに丸められます。グラフは丸める前の指定値です。",
      "Even passed as raw bytes, the firmware rounds these to the same 10 zones internally. The graph shows the values before rounding.",
    )]);

  return out;
}
