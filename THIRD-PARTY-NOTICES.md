# サードパーティの表示 / Third-party notices

## ライセンス表示が必要なもの / Requiring attribution

### ExtendInput.DataTools.DualSense.TriggerEffectGenerator.cs

本ツールの `src/effects.ts` にある 15 エフェクトのバイト配置・パラメータの有効範囲・
「強さが 0 なら Off を送る」挙動は、下記の成果に基づいています。
コードを移植したのではなく TypeScript で書き直したものですが、
知見の出所として明記します。

The byte layouts, parameter ranges and the "send Off when strength is zero" behaviour
of the 15 effects in `src/effects.ts` are based on the work below. The code was
rewritten in TypeScript rather than ported line by line, but the knowledge originates
there and is credited accordingly.

- 出典 / Source: https://gist.github.com/Nielk1/6d54cc2c00d2201ccb8c2720ad7538db
- 作者 / Author: John Klein (Nielk1)

```
MIT License

Copyright (c) 2021-2022 John Klein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

なお、この資料は Sony の公式仕様ではありません。作者が libpad を参照できない状況で、
Metro Exodus の出力を usbpcap で観察し、試行錯誤によって割り出したものです。

## 参照した資料 / Referenced, no code taken

### Linux カーネル `drivers/hid/hid-playstation.c`

出力レポートの構造（`valid_flag0` / `valid_flag1` のビット、共通ブロック 47 バイト内での
トリガーエフェクトの位置、Bluetooth 時の seq_tag と CRC32 の付け方）を確認するために
参照しました。コードは取り込んでいないため、ライセンス表示の義務は生じません。

Referenced to confirm the output report structure. No code was taken from it.

## 実行時に読み込むもの / Loaded at runtime

- Google Fonts 経由の Chakra Petch / IBM Plex Mono / Noto Sans JP
  （`index.html` の `<link>` で読み込み。ファイルは同梱していません）

ビルドに使う依存（Vite・TypeScript など）は `dist/index.html` には含まれません。
Build-time dependencies are not part of the published `dist/index.html`.
