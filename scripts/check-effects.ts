/**
 * エフェクト表の回帰チェック。
 * 15 エフェクトが既定値で組み立てるバイト列を、固定値と突き合わせる。
 * 型検査では拾えない「値の変化」を、ここで止める。
 *
 *   bun scripts/check-effects.ts
 */
import { EFFECTS } from "../src/effects";

/** 既定パラメータでの出力。バイト配置を意図的に変えたときだけ、ここを更新する。 */
const EXPECTED: Record<string, string> = {
  feedback:        "21 f0 03 00 d0 b6 2d 00 00 00 00",
  weapon:          "25 28 00 06 00 00 00 00 00 00 00",
  vibration:       "26 fc 03 40 db b6 2d 00 00 28 00",
  multiFeedback:   "21 fc 01 80 e8 77 01 00 00 00 00",
  slope:           "21 fe 03 40 34 d6 3f 00 00 00 00",
  multiVibration:  "26 cf 03 ef 02 64 3d 00 00 23 00",
  bow:             "22 42 00 3a 00 00 00 00 00 00 00",
  galloping:       "23 01 02 0d 0c 00 00 00 00 00 00",
  machine:         "27 02 02 17 1e 03 00 00 00 00 00",
  simpleFeedback:  "01 60 b4 00 00 00 00 00 00 00 00",
  simpleWeapon:    "02 46 96 dc 00 00 00 00 00 00 00",
  simpleVibration: "06 28 c8 3c 00 00 00 00 00 00 00",
  limitedFeedback: "11 60 0a 00 00 00 00 00 00 00 00",
  limitedWeapon:   "12 46 96 0a 00 00 00 00 00 00 00",
  off:             "05 00 00 00 00 00 00 00 00 00 00",
};

const hex = (b: Uint8Array): string =>
  Array.from(b).map((v) => v.toString(16).padStart(2, "0")).join(" ");

let failed = 0;

for (const eff of EFFECTS) {
  const p: Record<string, number | number[]> = {};
  for (const d of eff.params) p[d.k] = d.def;
  if (eff.zoneParam) p[eff.zoneParam.k] = eff.zoneParam.def.slice();
  eff.fix?.(p);

  const got = hex(eff.build(p));
  const want = EXPECTED[eff.id];

  if (want === undefined) {
    console.error(`✗ ${eff.id}: 期待値が未登録 / no expected value recorded`);
    failed++;
  } else if (got !== want) {
    console.error(`✗ ${eff.id}\n    期待 / want: ${want}\n    実際 / got : ${got}`);
    failed++;
  }

  // プロファイルが 0..1 に収まり、NaN を出さないこと
  const prof = eff.native(p);
  for (let i = 0; i <= 40; i++) {
    const v = prof.at(i / 40);
    if (Number.isNaN(v) || v < 0 || v > 1) {
      console.error(`✗ ${eff.id}: プロファイルが範囲外 / profile out of range at t=${i / 40}: ${v}`);
      failed++;
      break;
    }
  }

  // payload ラベルは 10 個ちょうど
  if (eff.bl.length !== 10) {
    console.error(`✗ ${eff.id}: バイトラベルが ${eff.bl.length} 個 / expected 10 byte labels`);
    failed++;
  }
}

const known = new Set(EFFECTS.map((e) => e.id));
for (const id of Object.keys(EXPECTED)) {
  if (!known.has(id)) {
    console.error(`✗ ${id}: 期待値だけあってエフェクトが無い / expected value without an effect`);
    failed++;
  }
}

// 失敗したら throw で終わる（bun / node とも終了コードが 1 になる）
if (failed) throw new Error(`${failed} 件の不一致 / ${failed} mismatch(es)`);
console.log(`✓ ${EFFECTS.length} エフェクトすべて一致 / all ${EFFECTS.length} effects match`);
