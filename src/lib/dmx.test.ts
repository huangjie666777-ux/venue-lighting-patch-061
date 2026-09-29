import { describe, expect, it } from 'vitest';
import { renderDmx, samplePatch, validatePatch } from './dmx';
import type { PatchConfig } from './types';

describe('validatePatch', () => {
  it('示例包含 8 位与 16 位灯型且合法', () => {
    expect(validatePatch(samplePatch())).toEqual([]);
  });

  it('定位未知引用、重复 ID/源灯、非法整数与越界常量', () => {
    const bad: PatchConfig = {
      types: [
        { id: 'same', name: 'A', slots: 1, resolution: 8, coarseOffset: 1, constants: { '0': 256 } },
        { id: 'same', name: 'B', slots: 2, resolution: 16, coarseOffset: 0, fineOffset: 0, constants: { '1': 1 } },
      ],
      fixtures: [
        { id: 'f1', name: 'F1', typeId: 'missing', universe: 5, address: 0, logicalChannels: [], maxLevel: 101 },
        { id: 'f1', name: 'F2', typeId: 'same', universe: 1, address: 1, logicalChannels: [1], maxLevel: 100 },
        { id: 'f2', name: 'F3', typeId: 'same', universe: 1, address: 1, logicalChannels: [1], maxLevel: 100 },
        { id: 'f3', name: 'F4', typeId: 'same', universe: 1, address: 512, logicalChannels: [2], maxLevel: 100 },
      ],
    };
    const errors = validatePatch(bad);
    expect(errors.some((e) => e.message.includes('未知灯型'))).toBe(true);
    expect(errors.some((e) => e.field === 'id')).toBe(true);
    expect(errors.filter((e) => e.otherId).length).toBeGreaterThanOrEqual(4);
    expect(errors.some((e) => e.field === 'universe')).toBe(true);
    expect(errors.some((e) => e.field === 'address' && e.message.includes('越过'))).toBe(true);
    expect(errors.some((e) => e.field === 'logicalChannels')).toBe(true);
    expect(errors.some((e) => e.field?.startsWith('constants.'))).toBe(true);
  });

  it('同宇宙重叠冲突定位双方，不同宇宙可使用相同地址', () => {
    const patch: PatchConfig = {
      types: [{ id: 't', name: 'T', slots: 4, resolution: 8, coarseOffset: 0, constants: {} }],
      fixtures: [
        { id: 'a', name: 'A', typeId: 't', universe: 2, address: 10, logicalChannels: [1], maxLevel: 100 },
        { id: 'b', name: 'B', typeId: 't', universe: 2, address: 13, logicalChannels: [2], maxLevel: 100 },
        { id: 'c', name: 'C', typeId: 't', universe: 3, address: 10, logicalChannels: [3], maxLevel: 100 },
      ],
    };
    const conflicts = validatePatch(patch).filter((e) => e.kind === 'conflict');
    expect(conflicts.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(conflicts[0].otherId).toBeTruthy();
  });
});

describe('renderDmx', () => {
  it('取多个逻辑灯最大值、按上限截取，8 位四舍五入并保留常量/余槽', () => {
    const { frames, fixtureOutputs } = renderDmx([40, 80, 0], samplePatch(), false);
    expect(frames[0]).toHaveLength(512);
    expect(frames[0][0]).toBe(204);
    expect(frames[0][1]).toBe(0);
    expect(frames[0][2]).toBe(255);
    expect(frames[1]).toEqual(new Uint8Array(512));
    expect(fixtureOutputs[0].level).toBe(80);
    expect(fixtureOutputs[0].slots.map((slot) => slot.value)).toEqual([204, 0, 255]);
  });

  it('16 位完整值先舍入再拆高低字节，黑场/停止调光归零但常量保留', () => {
    const active = renderDmx([0, 0, 0, 0, 100], samplePatch(), false);
    expect(active.frames[0][9]).toBe(230);
    expect(active.frames[0][10]).toBe(102);
    expect(active.frames[0][12]).toBe(128);
    const dimmed = renderDmx([0, 0, 0, 0, 100], samplePatch(), true);
    expect(dimmed.frames[0][9]).toBe(0);
    expect(dimmed.frames[0][10]).toBe(0);
    expect(dimmed.frames[0][12]).toBe(128);
  });

  it('亮度上限在取最大值后截取', () => {
    const patch: PatchConfig = {
      types: [{ id: 't', name: 'T', slots: 1, resolution: 8, coarseOffset: 0, constants: {} }],
      fixtures: [{ id: 'f', name: 'F', typeId: 't', universe: 4, address: 512, logicalChannels: [1, 2], maxLevel: 50 }],
    };
    const rendered = renderDmx([100, 10], patch, false);
    expect(rendered.frames[3][511]).toBe(128);
    expect(rendered.fixtureOutputs[0].level).toBe(50);
  });
});
