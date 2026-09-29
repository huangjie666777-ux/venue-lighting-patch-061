import { describe, expect, it } from 'vitest';
import { ConsoleEngine } from './engine';
import type { Cue } from './types';

function mkCue(partial: Partial<Cue> & { id: string; name: string }): Cue {
  return { channels: {}, ...partial };
}

function engine(cues: Cue[]) {
  const e = new ConsoleEngine();
  e.setCues(cues);
  return e;
}

describe('GO 与逐灯线性渐变', () => {
  it('升光采用 up、降光采用 down，零秒立即到位', () => {
    const e = engine([
      mkCue({
        id: 'a',
        name: 'A',
        channels: {
          '1': { level: 100, up: 4, down: 2 },
          '2': { level: 50, up: 0, down: 0 },
        },
      }),
    ]);
    e.go(0);
    let s = e.snapshot();
    expect(s.baseLevels[0]).toBe(0);
    expect(s.baseLevels[1]).toBe(50); // 零秒
    e.tick(2);
    s = e.snapshot();
    expect(s.baseLevels[0]).toBeCloseTo(50, 6); // 4 秒升到 100
    e.tick(2);
    expect(e.snapshot().baseLevels[0]).toBe(100);

    // 降光 2 秒
    e.setCues([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 4, down: 2 } } }),
      mkCue({ id: 'b', name: 'B', channels: { '1': { level: 0, up: 0, down: 2 } } }),
    ]);
    e.go(1);
    e.tick(1);
    expect(e.snapshot().baseLevels[0]).toBeCloseTo(50, 6);
    e.tick(1);
    expect(e.snapshot().baseLevels[0]).toBe(0);
  });

  it('渐变中再次 GO 从当时基础亮度接续，不跳旧目标', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 10, down: 10 } } }),
      mkCue({ id: 'b', name: 'B', channels: { '1': { level: 0, up: 0, down: 10 } } }),
    ]);
    e.go(0);
    e.tick(5);
    expect(e.snapshot().baseLevels[0]).toBeCloseTo(50, 6);
    e.go(1); // 从 50 起，10 秒降到 0
    e.tick(5);
    expect(e.snapshot().baseLevels[0]).toBeCloseTo(25, 6);
  });

  it('跳场目标按节目顺序解析（继承），与执行路径无关', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 80, up: 0, down: 0 } } }),
      mkCue({ id: 'b', name: 'B', channels: { '2': { level: 30, up: 0, down: 0 } } }),
      mkCue({ id: 'c', name: 'C', channels: { '3': { level: 60, up: 0, down: 0 } } }),
    ]);
    e.go(2); // 直接跳到 C：灯 1 应为继承的 80
    expect(e.snapshot().baseLevels[0]).toBe(80);
    expect(e.snapshot().baseLevels[1]).toBe(30);
    expect(e.snapshot().baseLevels[2]).toBe(60);
  });
});

describe('暂停 / 继续', () => {
  it('冻结渐变与跟随倒计时，继续只推进剩余时间', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 4, down: 4 } }, follow: 10 }),
      mkCue({ id: 'b', name: 'B', channels: { '1': { level: 0, up: 0, down: 0 } } }),
    ]);
    e.go(0);
    e.tick(1);
    e.pause();
    e.tick(5);
    expect(e.snapshot().baseLevels[0]).toBeCloseTo(25, 6);
    e.resume();
    e.tick(3); // 渐变完成，跟随消耗剩余 0 秒
    expect(e.snapshot().baseLevels[0]).toBe(100);
    expect(e.snapshot().followRemaining).toBeCloseTo(10, 6);
    e.pause();
    e.tick(100);
    expect(e.snapshot().followRemaining).toBeCloseTo(10, 6);
    e.resume();
    e.tick(10);
    expect(e.snapshot().currentIndex).toBe(1);
    expect(e.snapshot().baseLevels[0]).toBe(0);
  });
});

describe('跟随等待', () => {
  it('渐变恰在帧点结束时零秒跟随不延后一帧', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 2, down: 2 } }, follow: 0 }),
      mkCue({ id: 'b', name: 'B', channels: { '1': { level: 0, up: 0, down: 2 } } }),
    ]);
    e.go(0);
    e.tick(2);
    expect(e.snapshot().currentIndex).toBe(1);
    expect(e.snapshot().baseLevels[0]).toBe(100);
  });

  it('各灯完成后才开始跟随，到期自动执行下一 Cue，末项不跟随', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 2, down: 2 } }, follow: 2 }),
      mkCue({ id: 'b', name: 'B', channels: { '1': { level: 0, up: 0, down: 0 } } }),
    ]);
    e.go(0);
    e.tick(1);
    expect(e.snapshot().followRemaining).toBeNull(); // 渐变未完
    e.tick(1);
    expect(e.snapshot().followRemaining).toBeCloseTo(2, 6);
    e.tick(2);
    expect(e.snapshot().currentIndex).toBe(1);
    expect(e.snapshot().followRemaining).toBeNull();
  });

  it('帧延迟不丢触发；连续零等待跟随一路执行；手动 GO 取消旧跟随', () => {
    const e = engine([
      mkCue({ id: 'a', name: 'A', channels: { '1': { level: 10, up: 0, down: 0 } }, follow: 0 }),
      mkCue({ id: 'b', name: 'B', channels: { '2': { level: 10, up: 0, down: 0 } }, follow: 0 }),
      mkCue({ id: 'c', name: 'C', channels: { '3': { level: 10, up: 0, down: 0 } }, follow: 5 }),
      mkCue({ id: 'd', name: 'D', channels: {} }),
    ]);
    e.go(0);
    e.tick(0.5); // 一次延迟帧跨过两个零等待
    expect(e.snapshot().currentIndex).toBe(2);
    expect(e.snapshot().followRemaining).toBeCloseTo(4.5, 6);
    e.go(3); // 手动跳场取消旧跟随（末项不跟随）
    expect(e.snapshot().followRemaining).toBeNull();
  });
});

describe('接管 / 总控 / 黑场 / 停止', () => {
  it('先接管或基础值再乘总控；黑场强制零；释放接管跟随当时基础', () => {
    const e = engine([mkCue({ id: 'a', name: 'A', channels: { '1': { level: 80, up: 0, down: 0 } } })]);
    e.go(0);
    expect(e.snapshot().outputLevels[0]).toBe(80);
    e.setMaster(0.5);
    expect(e.snapshot().outputLevels[0]).toBe(40);
    e.setTakeover(1, true);
    e.setTakeoverLevel(1, 100);
    expect(e.snapshot().outputLevels[0]).toBe(50);
    e.setBlackout(true);
    expect(e.snapshot().outputLevels[0]).toBe(0);
    e.setBlackout(false);
    e.setTakeover(1, false);
    expect(e.snapshot().outputLevels[0]).toBe(40); // 恢复基础 80 * 0.5
  });

 it('接管期间基础渐变继续，释放后立即跟随当时基础亮度', () => {
    const e = engine([mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 10, down: 10 } } })]);
    e.go(0);
    e.setTakeover(1, true);
    e.setTakeoverLevel(1, 10);
    e.tick(5);
    expect(e.snapshot().outputLevels[0]).toBe(10); // 接管输出
    expect(e.snapshot().baseLevels[0]).toBeCloseTo(50, 6); // 基础继续
    e.setTakeover(1, false);
    expect(e.snapshot().outputLevels[0]).toBeCloseTo(50, 6);
  });

  it('停止归零并清除接管、跟随与运行态', () => {
    const e = engine([mkCue({ id: 'a', name: 'A', channels: { '1': { level: 100, up: 0, down: 0 } }, follow: 3 })]);
    e.go(0);
    e.setTakeover(1, true);
    e.setBlackout(true);
    e.stop();
    const s = e.snapshot();
    expect(s.running).toBe(false);
    expect(s.outputLevels[0]).toBe(0);
    expect(s.takeover[0]).toBe(false);
    expect(s.followRemaining).toBeNull();
    expect(s.blackout).toBe(false);
  });
});
