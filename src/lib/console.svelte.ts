import { ConsoleEngine, type EngineSnapshot } from './engine';
import { createId, emptyCue, sampleCues, validateCues } from './cues';
import {
  clonePatch,
  renderPatch,
  samplePatch,
  validatePatch,
  UNIVERSE_COUNT,
  type ActivePatch,
  type DimmerWidth,
  type PatchConfig,
  type PatchError,
  type PatchRenderResult,
} from './patch';
import { CHANNEL_COUNT, type Cue } from './types';

/**
 * 控台应用状态：Cue 节目单（可编辑）+ 播放引擎 + rAF 驱动的快照。
 * 使用 Svelte 5 runes，组件直接消费其字段。
 */
export class ConsoleStore {
  cues = $state<Cue[]>(sampleCues());
  activePatch = $state<ActivePatch>({ version: 1, publishedAt: new Date().toISOString(), config: clonePatch(samplePatch()) });
  draftPatch = $state<PatchConfig>(clonePatch(samplePatch()));
  patchErrors = $state<PatchError[]>([]);
  patchMessage = $state('');
  selectedUniverse = $state(1);
  patchRender = $state<PatchRenderResult>(renderPatch(this.activePatch.config, new ConsoleEngine().getOutput()));
  selectedId = $state<string>('');
  errors = $state<{ cueId: string; field: string; message: string }[]>([]);
  snap = $state<EngineSnapshot>(new ConsoleEngine().snapshot());

  engine = new ConsoleEngine();
  private lastTime: number | null = null;
  private rafId = 0;

  constructor() {
    this.revalidate();
    this.revalidatePatch();
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

  get draftDirty(): boolean {
    return JSON.stringify(this.draftPatch) !== JSON.stringify(this.activePatch.config);
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

  private revalidatePatch(): void {
    this.patchErrors = validatePatch(this.draftPatch);
  }

  private patchError(ownerId: string | undefined, field: string): PatchError | undefined {
    return this.patchErrors.find((error) => (error.typeId === ownerId || error.fixtureId === ownerId) && error.field === field);
  }

  patchTypeError(id: string, field: string): string {
    return this.patchError(id, field)?.message ?? '';
  }

  patchFixtureError(id: string, field: string): string {
    const own = this.patchError(id, field)?.message;
    if (own) return own;
    return this.patchErrors
      .filter((error) => error.fixtureId === id && error.field === 'addressRange')
      .map((error) => error.message)
      .join('；');
  }

  addFixtureType(): void {
    const id = `type-${this.draftPatch.types.length + 1}-${Date.now().toString(36)}`;
    this.draftPatch.types.push({ id, name: '新灯型', slotCount: 1, width: 8, coarseOffset: 0, constants: {} });
    this.revalidatePatch();
  }

  updateFixtureType(id: string, field: 'name' | 'slotCount' | 'coarseOffset' | 'fineOffset', raw: string): void {
    const item = this.draftPatch.types.find((type) => type.id === id);
    if (!item) return;
    if (field === 'name') item.name = raw;
    else if (field === 'fineOffset') item.fineOffset = raw.trim() === '' ? undefined : Number(raw);
    else if (field === 'slotCount') item.slotCount = Number(raw);
    else item.coarseOffset = Number(raw);
    this.revalidatePatch();
  }

  setFixtureTypeWidth(id: string, width: DimmerWidth): void {
    const item = this.draftPatch.types.find((type) => type.id === id);
    if (!item) return;
    item.width = width;
    if (width === 8) delete item.fineOffset;
    else item.fineOffset = item.coarseOffset === 1 ? 2 : 1;
    this.revalidatePatch();
  }

  setConstants(id: string, raw: string): void {
    const item = this.draftPatch.types.find((type) => type.id === id);
    if (!item) return;
    const constants: Record<number, number> = {};
    for (const part of raw.split(',')) {
      const text = part.trim();
      if (!text) continue;
      const [offset, value] = text.split('=').map((segment) => segment.trim());
      constants[Number(offset)] = Number(value);
    }
    item.constants = constants;
    this.revalidatePatch();
  }

  constantsText(type: { constants: Record<number, number> }): string {
    return Object.entries(type.constants).map(([offset, value]) => `${offset}=${value}`).join(', ');
  }

  deleteFixtureType(id: string): void {
    this.draftPatch.types = this.draftPatch.types.filter((type) => type.id !== id);
    this.revalidatePatch();
  }

  addFixture(): void {
    const id = `fixture-${this.draftPatch.fixtures.length + 1}-${Date.now().toString(36)}`;
    this.draftPatch.fixtures.push({
      id,
      name: '新灯具',
      typeId: this.draftPatch.types[0]?.id ?? '',
      universe: 1,
      startAddress: 1,
      logicalChannels: [1],
      maxLevel: 100,
    });
    this.revalidatePatch();
  }

  updateFixture(id: string, field: 'name' | 'typeId' | 'universe' | 'startAddress' | 'maxLevel', raw: string | number): void {
    const item = this.draftPatch.fixtures.find((fixture) => fixture.id === id);
    if (!item) return;
    if (field === 'name' || field === 'typeId') item[field] = String(raw);
    else item[field] = Number(raw);
    this.revalidatePatch();
  }

  setFixtureLogical(id: string, raw: string): void {
    const item = this.draftPatch.fixtures.find((fixture) => fixture.id === id);
    if (!item) return;
    item.logicalChannels = raw.split(/[\s,，、]+/).filter(Boolean).map(Number);
    this.revalidatePatch();
  }

  fixtureLogicalText(fixture: { logicalChannels: number[] }): string {
    return fixture.logicalChannels.join(', ');
  }

  deleteFixture(id: string): void {
    this.draftPatch.fixtures = this.draftPatch.fixtures.filter((fixture) => fixture.id !== id);
    this.revalidatePatch();
  }

  applyPatch(): void {
    const errors = validatePatch(this.draftPatch);
    this.patchErrors = errors;
    if (errors.length > 0) {
      this.patchMessage = `配接未应用：${errors.length} 处错误`;
      return;
    }
    const config = clonePatch(this.draftPatch);
    this.activePatch = { version: this.activePatch.version + 1, publishedAt: new Date().toISOString(), config };
    this.patchMessage = `已发布版本 ${this.activePatch.version}`;
    this.sync();
  }

  revertPatch(): void {
    this.draftPatch = clonePatch(this.activePatch.config);
    this.patchMessage = '';
    this.revalidatePatch();
  }

  selectUniverse(universe: number): void {
    this.selectedUniverse = Math.min(UNIVERSE_COUNT, Math.max(1, universe));
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
    this.patchRender = renderPatch(this.activePatch.config, this.snap.outputLevels);
  }
}

export const consoleStore = new ConsoleStore();
export { CHANNEL_COUNT };
