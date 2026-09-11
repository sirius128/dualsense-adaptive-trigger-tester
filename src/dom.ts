/** id で要素を引く。存在しない id を書いたらその場で落とす。 */
export function $<T extends Element = HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`element #${id} not found`);
  return n as unknown as T;
}
