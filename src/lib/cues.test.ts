import { describe, expect, it } from 'vitest';
import { resolveCues, validateCues, sampleCues, emptyCue, createId } from './cues';
import type { Cue } from './types';

describe('resolveCues 继承', () => {
  it('首个 Cue 之前未记录灯为零，未记录灯继承前序', () => {
    const cues: Cue[] = [
      { id: 'a', name: 'A', channels: { '1': { level: 50, up: 2, down: 1 } } },
      { id: 'b', name: 'B', channels: { '2': { level: 80, up: 1, down: 1 } } },
    ];
    const resolved = resolveCues(cues);
    expect(resolved[0][0].level).toBe(50);
    expect(resolved[0][1].level).toBe(0);
    expect(resolved[1][0].level).toBe(50); // 继承 A
    expect(resolved[1][1].level).toBe(80);
  });

  it('显式零覆盖继承值，与未记录不同', () => {
    const cues: Cue[] = [
      { id: 'a', name: 'A', channels: { '3': { level: 40, up: 1, down: 1 } } },
      { id: 'b', name: 'B', channels: { '3': { level: 0, up: 0, down: 5 } } },
    ];
    expect(resolveCues(cues)[1][2].level).toBe(0);
  });

  it('示例节目合法', () => {
    expect(validateCues(sampleCues())).toEqual([]);
  });
});

describe('validateCues 定位', () => {
  it('定位非法亮度、负时长、空名、重名、非法跟随', () => {
    const cues: Cue[] = [
      { id: 'a', name: '', channels: { '1': { level: 101, up: -1, down: 1 } }, follow: -2 },
      { id: 'b', name: 'X', channels: {} },
      { id: 'c', name: 'X', channels: {} },
    ];
    const errors = validateCues(cues);
    const fields = errors.map((e) => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('ch.1.level');
    expect(fields).toContain('ch.1.up');
    expect(fields).toContain('follow');
    expect(errors.filter((e) => e.field === 'name')).toHaveLength(3);
  });

  it('工厂生成空 Cue 与唯一 id', () => {
    const c = emptyCue('N');
    expect(c.channels).toEqual({});
    expect(createId()).not.toBe(createId());
  });
});
