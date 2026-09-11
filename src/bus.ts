/**
 * 最小の購読機構。ui と hid が互いを直接呼ばずに済ませるためだけに使う。
 * A tiny event bus, used only so that ui and hid never have to import each other.
 */
import type { Lang } from "./types";

export interface Events {
  /** 表示言語が変わった / the display language changed */
  lang: Lang;
  /** 組み立てたエフェクトが変わった / the built effect changed */
  effect: void;
  /** 実機のトリガー位置が動いた / the physical trigger moved */
  trigger: number | null;
}

type Handler<K extends keyof Events> = (payload: Events[K]) => void;
type AnyHandler = (payload: never) => void;

const handlers = new Map<keyof Events, AnyHandler[]>();

export function on<K extends keyof Events>(key: K, fn: Handler<K>): void {
  const list = handlers.get(key) ?? [];
  list.push(fn as AnyHandler);
  handlers.set(key, list);
}

export function emit<K extends keyof Events>(key: K, payload: Events[K]): void {
  for (const fn of handlers.get(key) ?? []) (fn as Handler<K>)(payload);
}
