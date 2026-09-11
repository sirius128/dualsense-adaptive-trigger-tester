/**
 * 表示言語の切り替え。
 * 静的な文言は t("key")、エフェクト定義に埋め込んだ対は T(value) で引く。
 */
import { ja } from "./locales/ja";
import { en } from "./locales/en";
import { emit } from "./bus";
import type { Lang, Localized } from "./types";

export type UIKey = keyof typeof ja;

const DICTS = { ja, en };
let current: Lang = "ja";

export const getLang = (): Lang => current;

/** 静的な UI 文言。キー名を間違えるとコンパイルが通らない。 */
export function t(key: UIKey, ...args: (string | number)[]): string {
  const v = DICTS[current][key] as string | ((...a: (string | number)[]) => string);
  return typeof v === "function" ? v(...args) : v;
}

/** エフェクト定義などに埋め込んだ {ja, en} の対を、いまの言語で読む。 */
export const T = (v: Localized): string => (typeof v === "string" ? v : v[current]);

/** 対を作る。en を書き忘れると型エラーになる。 */
export const L = (ja: string, en: string): Localized => ({ ja, en });

/** data-i18n 属性の付いた要素をまとめて描き直す。 */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((n) => {
    n.textContent = t(n.dataset.i18n as UIKey);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((n) => {
    n.innerHTML = t(n.dataset.i18nHtml as UIKey);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((n) => {
    n.title = t(n.dataset.i18nTitle as UIKey);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((n) => {
    n.setAttribute("aria-label", t(n.dataset.i18nAria as UIKey));
  });
}

/** 言語を切り替え、購読側に描き直しを促す。 */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem("dsLang", lang);
  } catch {
    /* プライベートウィンドウなどでは保存できない / storage may be unavailable */
  }
  document.documentElement.lang = lang;
  document.title = t("app.title");
  const meta = document.getElementById("metaDesc");
  if (meta instanceof HTMLMetaElement) meta.content = t("meta.desc");
  applyI18n();
  emit("lang", lang);
}

/** 起動時の言語。保存された選択があればそれ、なければブラウザの言語から。 */
export function initialLang(): Lang {
  let lang: Lang = (navigator.language || "").toLowerCase().startsWith("ja") ? "ja" : "en";
  try {
    const saved = localStorage.getItem("dsLang");
    if (saved === "ja" || saved === "en") lang = saved;
  } catch {
    /* 読めなければブラウザの言語のまま / fall back to the browser language */
  }
  return lang;
}
