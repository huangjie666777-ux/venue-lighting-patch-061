import { ConsoleEngine, type EngineSnapshot } from './engine';
import { createId, emptyCue, sampleCues, validateCues } from './cues';
import { CHANNEL_COUNT, type Cue } from './types';

/**
 * 控台应用状态：Cue 节目单（可编辑）+ 播放引擎 + rAF 驱动的快照。
 * 使用 Svelte 5 runes，组件直接消费其字段。
 */
export class ConsoleStore {
  cues = $state<Cue[]>(sampleCues());
  selectedId = $state<string>('');
  errors = $state<{ cueId: string; field: string; message: string }[]>([]);
  snap = $state<EngineSnapshot>(new ConsoleEngine().snapshot());

  engine = new ConsoleEngine();
  private lastTime: number | null = null;
  private rafId = 0;

  constructor() {
    this.revalidate();
    this.selectedId = this.cues[0]?.id ?? '';
    this.sync();
  }

  get selected(): Cue | undefined {
    return this.cues.find((c) => c.id === this.selectedId);
  }

  get running(): boolean {
    return this.snap.running;
  }

  get canRun(): boolean {
    return this.errors.length === 0 && this.cues.length > 0;
  }

  private revalidate(): void {
    this.errors = validateCues(this.cues);
    this.engine.setCues(this.cues);
  }

  select(id: string): void {
    this.selectedId = id;
  }

  addCue(): void {
    if (this.running) return;
    const cue = emptyCue(`Cue ${this.cues.length + 1}`);
    this.cues.push(cue);
    this.selectedId = cue.id;
    this.revalidate();
  }

  duplicateCue(id: string): void {
    if (this.running) return;
    const i = this.cues.findIndex((c) => c.id === id);
    if (i < 0) return;
    const src = this.cues[i];
    const copy: Cue = {
      id: createId(),
      name: `${src.name} 副本`,
      channels: JSON.parse(JSON.stringify(src.channels)),
      follow: src.follow,
    };
    this.cues.splice(i + 1, 0, copy);
    this.selectedId = copy.id;
    this.revalidate();
  }

  deleteCue(id: string): void {
    if (this.running) return;
    const i = this.cues.findIndex((c) => c.id === id);
    if (i < 0) return;
    this.cues.splice(i, 1);
    if (this.selectedId === id) {
      this.selectedId = this.cues[Math.min(i, this.cues.length - 1)]?.id ?? '';
    }
    this.revalidate();
  }

  move(id: string, delta: number): void {
    if (this.running) return;
    const i = this.cues.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.cues.length) return;
    const [item] = this.cues.splice(i, 1);
    this.cues.splice(j, 0, item);
    this.revalidate();
  }

  rename(id: string, name: string): void {
    const cue = this.cues.find((c) => c.id === id);
    if (cue) {
      cue.name = name;
      this.revalidate();
    }
  }

  setChannel(id: string, ch: number, patch: { level?: string; up?: string; down?: string }): void {
    const cue = this.cues.find((c) => c.id === id);
    if (!cue) return;
    const key = String(ch);
    let rec = cue.channels[key];
    if (!rec) {
      rec = { level: 0, up: 1, down: 1 };
      cue.channels[key] = rec;
    }
    if (patch.level !== undefined) rec.level = Number(patch.level);
    if (patch.up !== undefined) rec.up = Number(patch.up);
    if (patch.down !== undefined) rec.down = Number(patch.down);
    this.revalidate();
  }

  clearChannel(id: string, ch: number): void {
    const cue = this.cues.find((c) => c.id === id);
    if (!cue) return;
    delete cue.channels[String(ch)];
    this.revalidate();
  }

  setFollow(id: string, raw: string): void {
    const cue = this.cues.find((c) => c.id === id);
    if (!cue) return;
    cue.follow = raw.trim() === '' ? undefined : Number(raw);
    this.revalidate();
  }

  fieldError(cueId: string, field: string): string | undefined {
    return this.errors.find((e) => e.cueId === cueId && e.field === field)?.message;
  }

  go(): void {
    if (!this.canRun) return;
    this.engine.go();
    this.ensureLoop();
    this.sync();
  }

  jump(index: number): void {
    if (!this.canRun) return;
    this.engine.go(index);
    this.ensureLoop();
    this.sync();
  }

  pause(): void {
    this.engine.pause();
    this.sync();
  }

  resume(): void {
    this.engine.resume();
    this.lastTime = null;
    this.ensureLoop();
    this.sync();
  }

  stop(): void {
    this.engine.stop();
    this.lastTime = null;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.sync();
  }

  setMaster(v: number): void {
    this.engine.setMaster(v);
    this.sync();
  }

  toggleBlackout(): void {
    this.engine.setBlackout(!this.snap.blackout);
    this.sync();
  }

  toggleTakeover(ch: number): void {
    this.engine.setTakeover(ch, !this.snap.takeover[ch - 1]);
    this.sync();
  }

  setTakeoverLevel(ch: number, v: number): void {
    this.engine.setTakeoverLevel(ch, v);
    this.sync();
  }

  private ensureLoop(): void {
    if (this.rafId) return;
    this.lastTime = null;
    const frame = (t: number) => {
      if (this.lastTime !== null) this.engine.tick((t - this.lastTime) / 1000);
      this.lastTime = t;
      this.sync();
      const s = this.engine.snapshot();
      const idle =
        !s.running || s.paused || (!s.fading && s.followRemaining === null && s.nextIndex === -1);
      if (idle) {
        this.rafId = 0;
        this.lastTime = null;
      } else {
        this.rafId = requestAnimationFrame(frame);
      }
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private sync(): void {
    this.snap = this.engine.snapshot();
  }
}

export const consoleStore = new ConsoleStore();
export { CHANNEL_COUNT };
