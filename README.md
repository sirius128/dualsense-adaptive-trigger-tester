# DualSense アダプティブトリガー テスター / Adaptive Trigger Tester

DualSense を USB でつないで、ゲームが使う 15 種類のアダプティブトリガーエフェクトを
ブラウザからそのまま実機に送って試せるツールです。
効き方のグラフと、コントローラーに書き込まれる 11 バイトを並べて確認できます。
日本語 / English 切り替え対応。

Connect a DualSense over USB and fire all 15 adaptive trigger effects straight from the
browser. See how each one feels across the trigger stroke, next to the 11 bytes written
to the controller. Japanese / English UI.

👉 **https://sirius128.github.io/dualsense-adaptive-trigger-tester/**

## 使い方 / Getting started

1. **Chrome か Edge** で開く（実機への書き込みに WebHID を使うため、Safari / Firefox は非対応）
2. DualSense を **USB ケーブル**でつなぐ（データ通信できるケーブル）
3. 画面上部の **「DualSense を接続」** を押し、ダイアログで Wireless Controller を選ぶ
4. 左の一覧からエフェクトを選び、スライダーを動かす（自動反映がオンなら即座にトリガーへ反映）

Open in **Chrome or Edge**, connect the DualSense with a **USB data cable**, press
**Connect DualSense** in the bar at the top, pick *Wireless Controller* in the browser
dialog, then choose an effect on the left. With **Auto-apply** on, changes reach the
trigger immediately.

うまく反映されないときは、まず **「動作確認」** を押してください。
ライトバーが青く光って振動すれば出力は届いています。
それでもトリガーが変わらない場合は、Steam Input・DS4Windows・DualSenseX などが
同じコントローラーにエフェクトを書き続けて上書きしている可能性が高いです。

Bluetooth 接続でも動作します（レポート形式は自動判別）が、USB のほうが安定します。

## できること / Features

- 公式 6 種 + 非公式 3 種 + 簡易/制限版 5 種 + 解除の、計 15 エフェクト
- パラメータごとのスライダーと、10 ゾーン個別指定
- トリガーストロークに対する効き方のグラフ（実際に引いている位置も重ねて表示）
- 出力レポートに載る 11 バイトの内訳表示、C 配列 / 16 進でのコピー
- L2 / R2 / 両方への送り分け（初期値は両方）、一括解除、ライトバー＋振動での疎通確認
- 振動のテスト（DualShock 4 互換の振動信号。左 / 右 / 両方、強さ・長さ指定、止めるまで連続も可）
- ハプティックのテスト（USB 音声の ch3 / ch4 に波形を流す。左 / 右 / 両方、波形・パターン・周波数・振幅・長さ指定。USB 接続のみ）
- 日本語 / English の切り替え、ライト / ダークテーマ（どちらも localStorage に保存）

## 開発 / Development

Vite + TypeScript。ビルド成果物は `dist/index.html` 1 枚（CSS も JS もインライン化される）なので、
GitHub Pages にそのまま置けますし、保存してオフラインで開くこともできます。

```sh
bun install        # npm install / pnpm install でも可
bun run dev        # 開発サーバ
bun run check      # エフェクト表のバイト列が変わっていないかを検査
bun run build      # tsc --noEmit のあと dist/index.html を生成
bun run preview    # ビルド結果を確認
```

`bun run check` は Bun で TypeScript を直接実行します。npm だけの環境では
`bun run build`（型検査を含む）が主な検証手段になります。

### 構成 / Layout

```
index.html            ページのマークアップのみ。文言は data-i18n 属性で差し込む
src/
  main.ts             起動と配線
  bus.ts              購読機構。ui と hid はこれ越しにだけつながる
  state.ts            画面と実機で共有する状態
  types.ts            型と defineEffect ヘルパー
  i18n.ts             t() / T() / L() / 言語切り替え
  locales/ja.ts       日本語の UI 文言（キーの集合はこちらが正）
  locales/en.ts       英語。過不足や引数違いは型エラーになる
  payload.ts          11 バイトを組み立てる部品
  effects.ts          ★ 15 エフェクトの定義。バイト仕様を読むならここ
  notes.ts            型ごとの注記（ファームウェアの癖）
  chart.ts            効き方の SVG グラフ
  ui.ts               一覧・パラメータ・再描画・コピー
  hid.ts              WebHID での送信、ログ、ドックの状態
  haptics.ts          USB 音声（ch3 / ch4）でのハプティック再生
  gamepad.ts          Gamepad API でのトリガー読み取り
  styles/app.css
scripts/check-effects.ts   バイト列の回帰チェック
```

## 出典 / Credits

- エフェクトのバイト配置: [Nielk1 / TriggerEffectGenerator](https://gist.github.com/Nielk1/6d54cc2c00d2201ccb8c2720ad7538db)
  （`ExtendInput.DataTools.DualSense.TriggerEffectGenerator.cs` / MIT License, © 2021-2022 John Klein）
  Sony の公式資料ではなく、USB レポートの観察と試行錯誤によって割り出されたものです。
- 出力レポートの構造: Linux カーネル `drivers/hid/hid-playstation.c`

## ライセンス / License

MIT（[LICENSE](LICENSE)）。

エフェクトのバイト配置は Nielk1 の TriggerEffectGenerator（MIT, © 2021-2022 John Klein）に
基づいています。表示すべき著作権表示は [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) にまとめました。

DualSense は株式会社ソニー・インタラクティブエンタテインメントの商標です。
本ツールは非公式の実験用ツールであり、同社とは関係ありません。
DualSense is a trademark of Sony Interactive Entertainment Inc. This is an unofficial
experimental tool and is not affiliated with them.
