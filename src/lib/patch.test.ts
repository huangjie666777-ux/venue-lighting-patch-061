import { describe, expect, it } from 'vitest';
import { DMX_SLOT_COUNT, renderPatch, samplePatch, validatePatch, type PatchConfig } from './patch';

const valid: PatchConfig = {
  types: [
    { id: 't8', name: '8bit', slotCount: 2, width: 8, coarseOffset: 0, constants: { 1: 42 } },
    { id: 't16', name: '16bit', slotCount: 4, width: 16, coarseOffset: 1, fineOffset: 2, constants: { 0: 7, 3: 9 } },
  ],
  fixtures: [
    { id: 'a', name: 'A', typeId: 't8', universe: 1, startAddress: 1, logicalChannels: [1, 2], maxLevel: 80 },
    { id: 'b', name: 'B', typeId: 't16', universe: 2, startAddress: 509, logicalChannels: [3], maxLevel: 100 },
  ],
};

describe('validatePatch', () => {
  it('接受两种位宽和合法边界', () => {
    expect(validatePatch(valid)).toEqual([]);
    expect(validatePatch(samplePatch())).toEqual([]);
  });

  it('定位未知引用、重复 ID/源灯和非法数值', () => {
    const bad: PatchConfig = {
      types: [
        { id: 'x', name: 'X', slotCount: 1.5, width: 8, coarseOffset: -1, constants: { 0: 256 } },
        { id: 'x', name: 'dup', slotCount: 2, width: 16, coarseOffset: 0, fineOffset: 0, constants: {} },
      ],
      fixtures: [
        { id: 'd', name: 'D', typeId: 'missing', universe: 5, startAddress: 0, logicalChannels: [1, 1], maxLevel: 101 },
        { id: 'd', name: 'D2', typeId: 'x', universe: 1, startAddress: 1, logicalChannels: [], maxLevel: 0 },
      ],
    };
    const fields = validatePatch(bad).map((e) => e.field);
    expect(fields).toContain('slotCount');
    expect(fields).toContain('coarseOffset');
    expect(fields).toContain('constants.0');
    expect(fields).toContain('id');
    expect(fields).toContain('fineOffset');
    expect(fields).toContain('typeId');
    expect(fields).toContain('universe');
    expect(fields).toContain('startAddress');
    expect(fields).toContain('logicalChannels');
    expect(fields).toContain('maxLevel');
  });

  it('定位越过 512 和同宇宙相交的双方', () => {
    const bad: PatchConfig = structuredClone(valid);
    bad.fixtures[1] = { ...bad.fixtures[1], typeId: 't8', universe: 1, startAddress: 2, logicalChannels: [3] };
    const overlap = validatePatch(bad).filter((e) => e.field === 'addressRange');
    expect(overlap.map((e) => e.fixtureId)).toEqual(['a', 'b']);
    expect(overlap[0]?.otherFixtureId).toBe('b');
    expect(overlap[1]?.otherFixtureId).toBe('a');

    const over: PatchConfig = structuredClone(valid);
    over.fixtures[0] = { ...over.fixtures[0], startAddress: 512 };
    expect(validatePatch(over).map((e) => e.field)).toContain('startAddress');
  });
});

describe('renderPatch', () => {
  it('生成 4 个 512 字节帧，取所选逻辑灯最大值并遵守上限', () => {
    const result = renderPatch(valid, [100, 40, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.frames).toHaveLength(4);
    for (const frame of result.frames) expect(frame).toHaveLength(DMX_SLOT_COUNT);
    expect(result.frames[0][0]).toBe(Math.round((80 / 100) * 255));
    expect(result.frames[0][1]).toBe(42);
    expect(result.fixtureLevels[0]).toMatchObject({ fixtureId: 'a', level: 80 });
  });

  it('16 位四舍五入后拆分高字节和低字节，常量和余槽保留', () => {
    const result = renderPatch(valid, [0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const value = Math.round(0.1 * 65535);
    expect(result.frames[1][509]).toBe(value >> 8);
    expect(result.frames[1][510]).toBe(value & 255);
    expect(result.frames[1][508]).toBe(7);
    expect(result.frames[1][511]).toBe(9);
    expect(result.frames[2].every((v) => v === 0)).toBe(true);
    expect(result.sources[1][509]?.role).toBe('coarse');
    expect(result.sources[1][510]?.role).toBe('fine');
    expect(result.sources[1][508]?.role).toBe('constant');
  });

  it('黑场或停止的全零逻辑输出只关闭调光，不清除常量', () => {
    const result = renderPatch(valid, new Array(12).fill(0));
    expect(result.frames[0][0]).toBe(0);
    expect(result.frames[0][1]).toBe(42);
    expect(result.frames[1][509]).toBe(0);
    expect(result.frames[1][510]).toBe(0);
    expect(result.frames[1][508]).toBe(7);
    expect(result.frames[1][511]).toBe(9);
  });
});
