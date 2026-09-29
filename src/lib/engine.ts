import { resolveCues } from './cues';
import { CHANNEL_COUNT, type Cue, type ResolvedCue } from './types';

interface Fade {
  from: number;
  to: number;
  duration: number; // 秒
  elapsed: number; // 秒（暂停时冻结）
}

export interface EngineSnapshot {
  running: boolean;
  paused: boolean;
  blackout: boolean;
  master: number;
  currentIndex: number; // -1 表示尚未执行
  nextIndex: number; // -1 表示后面无 Cue
  baseLevels: number[];
  outputLevels: number[];
  takeover: boolean[];
  takeoverLevels: number[];
  /** 每灯渐变进度 0..1（未在渐变视为 1） */
  channelProgress: number[];
  /** 整组渐变进度 0..1，无渐变任务时为 1 */
  fadeProgress: number;
  fading: boolean;
  followRemaining: number | null;
  followTotal: number | null;
}

export class ConsoleEngine {
  private cues: Cue[] = [];
  private resolved: ResolvedCue[] = [];

  running = false;
  paused = false;
  blackout = false;
  master = 1;

  currentIndex = -1;
  private baseLevels = Array.from({ length: CHANNEL_COUNT }, () => 0);
  private fades: (Fade | null)[] = Array.from({ length: CHANNEL_COUNT }, () => null);
  private followRemaining: number | null = null;
  private followTotal: number | null = null;

  private takeover = Array.from({ length: CHANNEL_COUNT }, () => false);
  private takeoverLevels = Array.from({ length: CHANNEL_COUNT }, () => 0);

  setCues(cues: Cue[]): void {
    this.cues = cues;
    this.resolved = resolveCues(cues);
  }

  start(): void {
    this.running = true;
    this.paused = false;
  }

  /** 停止：输出归零、清除接管与待触发跟随，恢复可编辑状态 */
  stop(): void {
    this.running = false;
    this.paused = false;
    this.blackout = false;
    this.currentIndex = -1;
    this.baseLevels = Array.from({ length: CHANNEL_COUNT }, () => 0);
    this.fades = Array.from({ length: CHANNEL_COUNT }, () => null);
    this.followRemaining = null;
    this.followTotal = null;
    this.takeover = Array.from({ length: CHANNEL_COUNT }, () => false);
    this.takeoverLevels = Array.from({ length: CHANNEL_COUNT }, () => 0);
  }

  pause(): void {
    if (this.running) this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setMaster(v: number): void {
    this.master = Math.min(1, Math.max(0, v));
  }

  setBlackout(v: boolean): void {
    this.blackout = v;
  }

  setTakeover(channel1Based: number, on: boolean): void {
    const i = channel1Based - 1;
    if (i < 0 || i >= CHANNEL_COUNT) return;
    this.takeover[i] = on;
    if (on) this.takeoverLevels[i] = this.baseLevels[i];
  }

  setTakeoverLevel(channel1Based: number, level: number): void {
    const i = channel1Based - 1;
    if (i < 0 || i >= CHANNEL_COUNT) return;
    this.takeoverLevels[i] = Math.min(100, Math.max(0, level));
  }

  /** GO：执行下一 Cue；传 index 为选中跳场。从当时基础亮度接续。 */
  go(index?: number): number {
    if (!this.running) this.start();
    const target = index ?? this.currentIndex + 1;
    if (target < 0 || target >= this.resolved.length) return this.currentIndex;

    // 手动 GO / 跳场一律取消旧跟随
    this.followRemaining = null;
    this.followTotal = null;

    const resolvedTarget = this.resolved[target];
    this.fades = resolvedTarget.map((ch, i) => {
      const from = this.baseLevels[i];
      if (ch.level === from) return null;
      const duration = ch.level > from ? ch.up : ch.down;
      if (duration <= 0) {
        this.baseLevels[i] = ch.level; // 零秒立即到位
        return null;
      }
      return { from, to: ch.level, duration, elapsed: 0 };
    });

    this.currentIndex = target;
    this.maybeArmFollow(target);
    return target;
  }

  private maybeArmFollow(target: number): void {
    // 所有灯到位后才开始跟随；末项不再跟随
    if (target < this.cues.length - 1 && this.fades.every((f) => f === null)) {
      const follow = this.cues[target].follow;
      if (follow !== undefined && follow >= 0) {
        this.followRemaining = follow;
        this.followTotal = follow;
      }
    }
  }

  /** 按经过秒数推进；帧回调延迟不会累积漂移，零时长连续跟随不漏过 */
  tick(dt: number): void {
    if (!this.running || this.paused || dt <= 0) return;
    let remaining = dt;

    while (remaining > 0) {
      const fadeBudget = this.fadeBudget();
      if (fadeBudget > 0) {
        if (remaining < fadeBudget) {
          this.advanceFades(remaining);
          remaining = 0;
        } else {
          this.advanceFades(fadeBudget);
          remaining -= fadeBudget;
        }
        if (!this.anyFading() && this.followRemaining === null) this.maybeArmFollow(this.currentIndex);
        if (remaining === 0 && this.followRemaining === 0) {
          this.followRemaining = null;
          this.followTotal = null;
          if (this.currentIndex + 1 < this.cues.length) this.go(this.currentIndex + 1);
        }
        if (!this.anyFading() && this.followRemaining === null) break;
        continue;
      }

      if (this.followRemaining === null) break;
      const wait = this.followRemaining;
      if (wait === 0) {
        this.followRemaining = null;
        this.followTotal = null;
        if (this.currentIndex + 1 < this.cues.length) this.go(this.currentIndex + 1);
        continue;
      }
      if (remaining < wait) {
        this.followRemaining -= remaining;
        break;
      }
      // 跟随到期：超调时间（含帧延迟）继续作用于后续 Cue，零等待链路不漏
      remaining -= wait;
      this.followRemaining = null;
      this.followTotal = null;
      if (this.currentIndex + 1 < this.cues.length) this.go(this.currentIndex + 1);
    }
  }

  private anyFading(): boolean {
    return this.fades.some((f) => f !== null);
  }

  /** 当前未完成渐变中最长的剩余时间；无渐变返回 0 */
  private fadeBudget(): number {
    let max = 0;
    for (let i = 0; i < CHANNEL_COUNT; i++) {
      const fade = this.fades[i];
      if (!fade) continue;
      max = Math.max(max, fade.duration - fade.elapsed);
    }
    return max;
  }

  /** 各灯线性推进 dt 秒；再次 GO 后以当时亮度为新起点重建渐变 */
  private advanceFades(dt: number): void {
    for (let i = 0; i < CHANNEL_COUNT; i++) {
      const fade = this.fades[i];
      if (!fade) continue;
      fade.elapsed += dt;
      if (fade.elapsed >= fade.duration) {
        this.baseLevels[i] = fade.to;
        this.fades[i] = null;
      } else {
        const t = fade.elapsed / fade.duration;
        this.baseLevels[i] = fade.from + (fade.to - fade.from) * t;
      }
    }
  }

  get nextIndex(): number {
    return this.currentIndex + 1 < this.cues.length ? this.currentIndex + 1 : -1;
  }

  getOutput(): number[] {
    return this.baseLevels.map((base, i) => {
      if (this.blackout) return 0;
      const source = this.takeover[i] ? this.takeoverLevels[i] : base;
      return source * this.master;
    });
  }

  snapshot(): EngineSnapshot {
    const channelProgress = this.fades.map((f) => (f ? Math.min(1, f.elapsed / f.duration) : 1));
    const fading = this.anyFading();
    const fadeProgress = fading ? channelProgress.reduce((a, b) => a + b, 0) / CHANNEL_COUNT : 1;
    return {
      running: this.running,
      paused: this.paused,
      blackout: this.blackout,
      master: this.master,
      currentIndex: this.currentIndex,
      nextIndex: this.nextIndex,
      baseLevels: [...this.baseLevels],
      outputLevels: this.getOutput(),
      takeover: [...this.takeover],
      takeoverLevels: [...this.takeoverLevels],
      channelProgress,
      fadeProgress,
      fading,
      followRemaining: this.followRemaining,
      followTotal: this.followTotal,
    };
  }
}
