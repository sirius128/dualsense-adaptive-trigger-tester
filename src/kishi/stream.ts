/**
 * Kishi へのフレーム送信を、4 kHz の再生速度に合わせて刻む。
 * 1 フレームは 3 ms 分。setTimeout は入れ子にすると 4 ms 未満に縮まないので、
 * 予定時刻を基準に「遅れた分はまとめて送る」形にしている。
 *
 * Paces 3 ms frames against the clock. Nested timers cannot go below 4 ms,
 * so late frames are sent back-to-back until the stream catches up.
 */
import type { Bytes } from "../types";
import { FRAME_SAMPLES, SAMPLE_RATE, silence } from "./report";

const PERIOD_MS = (FRAME_SAMPLES / SAMPLE_RATE) * 1000;
/** 予定より少し早めに送っておく分。実機の受け側の余裕は未確認 / unverified device-side headroom */
const LEAD_MS = 6;
/** これ以上遅れたフレームは捨てて追いつく / frames later than this are dropped */
const MAX_LATE_MS = 50;
/** 終わりに無音を足して、振動子を確実に止める / trailing silence so the actuators settle */
const TAIL_FRAMES = 2;

export interface StreamStats {
  sent: number;
  failed: number;
  dropped: number;
  /** 送信できた中で一番遅れた量 / worst lateness among sent frames */
  maxLateMs: number;
  /** 実際の送信速度 / achieved frames per second */
  fps: number;
  running: boolean;
  lastFrame: Bytes | null;
  lastError: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class KishiStream {
  private token = 0;
  stats: StreamStats = KishiStream.emptyStats();

  constructor(
    private readonly send: (frame: Bytes) => Promise<void>,
    private readonly onStats: (s: StreamStats) => void,
  ) {}

  private static emptyStats(): StreamStats {
    return { sent: 0, failed: 0, dropped: 0, maxLateMs: 0, fps: 0, running: false, lastFrame: null, lastError: null };
  }

  /** 前の再生を止めてから流す / stops any current stream first */
  play(frames: Bytes[]): void {
    const token = ++this.token;
    this.stats = { ...KishiStream.emptyStats(), running: true };
    const all = [...frames, ...Array.from({ length: TAIL_FRAMES }, silence)];
    void this.run(all, token);
  }

  stop(): void {
    if (!this.stats.running) return;
    this.token++;
    this.stats.running = false;
    this.onStats(this.stats);
    // 鳴っている途中なら無音を送って止める / cut in with silence
    void (async () => {
      for (let i = 0; i < TAIL_FRAMES; i++) await this.send(silence()).catch(() => undefined);
    })();
  }

  private async run(frames: Bytes[], token: number): Promise<void> {
    const s = this.stats;
    const start = performance.now() + LEAD_MS;
    let lastPaint = 0;

    for (let i = 0; i < frames.length; i++) {
      if (token !== this.token) return;
      const due = start + i * PERIOD_MS;
      const wait = due - LEAD_MS - performance.now();
      if (wait > 1) await sleep(wait);
      if (token !== this.token) return;

      const late = performance.now() - due;
      if (late > MAX_LATE_MS) {
        s.dropped++;
        continue;
      }
      try {
        await this.send(frames[i]!);
        s.sent++;
        s.lastFrame = frames[i]!;
        s.maxLateMs = Math.max(s.maxLateMs, late);
      } catch (err) {
        s.failed++;
        s.lastError = err instanceof Error ? err.message : String(err);
      }

      const now = performance.now();
      s.fps = s.sent / Math.max(0.001, (now - start + LEAD_MS) / 1000);
      if (now - lastPaint > 200) {
        lastPaint = now;
        this.onStats(s);
      }
    }

    if (token !== this.token) return;
    s.running = false;
    this.onStats(s);
  }
}
