/**
 * Gamepad API で L2 / R2 の引き具合を読む。出力（WebHID）とは独立した入力側。
 * Reads how far L2 / R2 are pulled. Input side only — unrelated to the WebHID output.
 */
import { emit } from "./bus";
import { $ } from "./dom";
import { t } from "./i18n";
import { store } from "./state";

function firstConnectedPad(): Gamepad | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p?.connected) return p;
  return null;
}

export function initGamepad(): void {
  const padChip = $("padChip");
  const l2fill = $("l2fill");
  const r2fill = $("r2fill");
  const l2val = $("l2val");
  const r2val = $("r2val");

  const loop = (): void => {
    const pad = firstConnectedPad();
    if (pad) {
      padChip.className = "chip ok";
      padChip.textContent = (pad.id || "gamepad").slice(0, 28);

      const l2 = pad.buttons[6]?.value ?? 0;
      const r2 = pad.buttons[7]?.value ?? 0;
      l2fill.style.width = `${l2 * 100}%`;
      l2val.textContent = l2.toFixed(2);
      r2fill.style.width = `${r2 * 100}%`;
      r2val.textContent = r2.toFixed(2);

      // 送信先が「両方」のときは、引いている方を追う
      const watched = store.side === "L" ? l2 : store.side === "B" ? Math.max(l2, r2) : r2;
      if (store.lastTrigger === null || Math.abs(watched - store.lastTrigger) > 0.005) {
        store.lastTrigger = watched;
        emit("trigger", watched);
      }
    } else {
      padChip.className = "chip";
      padChip.textContent = t("pad.none");
    }
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}
