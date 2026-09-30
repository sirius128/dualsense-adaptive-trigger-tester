/**
 * 起動と配線。
 * ui と hid は互いを import せず、bus のイベントだけでつながっている。
 */
import "./styles/app.css";
import { initGamepad } from "./gamepad";
import { initHaptics } from "./haptics";
import { initHID } from "./hid";
import { initialLang, setLang } from "./i18n";
import { initUI } from "./ui";

initUI();
initHID();
initHaptics();
initGamepad();

// 最初の描画は "lang" イベントでまとめて行う
setLang(initialLang());
