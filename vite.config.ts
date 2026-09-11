import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// base: "./" — リポジトリ名に依存せず GitHub Pages のサブパスで動くようにする
// viteSingleFile — dist/index.html 1 枚に全部インライン化し、保存してオフラインでも開ける形にする
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
