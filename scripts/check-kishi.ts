/**
 * Kishi のフレーム組み立ての回帰チェック。
 * 期待値は仕様（ヘッダー、L/R 交互の S16LE、2..57 バイト目の XOR）から別途計算したもの。
 *
 *   bun scripts/check-kishi.ts
 */
import { FRAME_SAMPLES, command, frame, packFrames, silence } from "../src/kishi/report";
import { renderWave } from "../src/waveform";

const hex = (b: Uint8Array): string =>
  Array.from(b).map((v) => v.toString(16).padStart(2, "0")).join(" ");

let failed = 0;
function expect(name: string, got: string, want: string): void {
  if (got === want) return;
  failed++;
  console.error(`✗ ${name}\n    got  ${got}\n    want ${want}`);
}

// 符号が交互に変わるサンプルで、リトルエンディアンと負数の詰め方を見る
const samples = Int16Array.from({ length: FRAME_SAMPLES * 2 }, (_, k) => (k % 2 ? -1 : 1) * (k + 1) * 0x0123);
expect(
  "frame",
  hex(frame(samples)),
  "55 aa 00 00 00 00 00 30 fe 79 23 01 ba fd 69 03 74 fb af 05 2e f9 f5 07 e8 f6 3b 0a a2 f4 81 0c " +
    "5c f2 c7 0e 16 f0 0d 11 d0 ed 53 13 8a eb 99 15 44 e9 df 17 fe e6 25 1a b8 e4 5f 00 00 00 00 00",
);

// 無音はヘッダーだけが XOR に効く（0x30 ^ 0xfe ^ 0x79 = 0xb7）
expect("silence", hex(silence()), `55 aa 00 00 00 00 00 30 fe 79 ${"00 ".repeat(48)}b7 00 00 00 00 00`);

expect("command", hex(command(2, 0x64)), "00 02 64");

// 13 サンプルなら 2 フレームになり、足りない分は 0 で埋まる
const frames = packFrames(new Float32Array(13).fill(1), new Float32Array(13));
expect("pack count", String(frames.length), "2");
expect("pack tail", hex(frames[1]!.subarray(10, 16)), "ff 7f 00 00 00 00");

// 波形は 0 から始まり、終わりはランプで 0 近くまで下がる
const tone = renderWave({ wave: "sine", pattern: "tone", freq: 160, amp: 1, durMs: 100 }, 4000);
expect("tone length", String(tone.length), "400");
expect("tone start", String(tone[0]), "0");
expect("tone end", String(Math.abs(tone[tone.length - 1]!) < 0.07), "true");

// 失敗したら throw で終わる（bun / node とも終了コードが 1 になる）
if (failed) throw new Error(`${failed} 件の不一致 / ${failed} mismatch(es)`);
console.log("✓ Kishi のフレームはすべて期待どおり / all Kishi frames match");
