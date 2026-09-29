import { describe, expect, it } from 'vitest';
import { ConsoleStore } from './console.svelte';
import { samplePatch } from './patch';

describe('场地配接草稿与发布', () => {
  it('失败不发布，成功发布独立快照，切换立即重渲染并释放旧地址', () => {
    const store = new ConsoleStore();
    store.engine.go(0);
    store.engine.tick(3);
    (store as unknown as { sync: () => void }).sync();
    const before = store.activePatch.version;
    const oldStart = store.draftPatch.fixtures[0]?.startAddress ?? 1;

    store.draftPatch.fixtures[0]!.startAddress = 999;
    expect(store.draftDirty).toBe(true);
    store.applyPatch();
    expect(store.activePatch.version).toBe(before);
    expect(store.activePatch.config.fixtures[0]?.startAddress).toBe(oldStart);
    expect(store.patchRender.frames[0][oldStart - 1]).toBe(Math.round(0.6 * 255));

    const valid = samplePatch();
    valid.fixtures[0]!.startAddress = 11;
    store.draftPatch = valid;
    store.applyPatch();
    expect(store.activePatch.version).toBe(before + 1);
    expect(store.activePatch.config.fixtures[0]?.startAddress).toBe(11);
    expect(store.patchRender.frames[0][0]).toBe(0);
    expect(store.patchRender.frames[0][10]).toBe(Math.round(0.6 * 255));
    expect(store.patchRender.frames[0][11]).toBe(128);

    store.draftPatch.fixtures[0]!.startAddress = 21;
    expect(store.activePatch.config.fixtures[0]?.startAddress).toBe(11);
  });
});
