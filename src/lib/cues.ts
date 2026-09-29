import { CHANNEL_COUNT, type ChannelRecord, type Cue, type FieldError, type ResolvedCue } from './types';

let idCounter = 1;
export function createId(): string {
  return `cue-${Date.now().toString(36)}-${idCounter++}`;
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** 校验整个节目单；运行前及每次编辑后调用，非法输入会被逐一定位 */
export function validateCues(cues: Cue[]): FieldError[] {
  const errors: FieldError[] = [];
  const names = new Map<string, number>();

  cues.forEach((cue) => {
    const name = cue.name?.trim() ?? '';
    if (!name) {
      errors.push({ cueId: cue.id, field: 'name', message: '名称不能为空' });
    } else {
      names.set(name, (names.get(name) ?? 0) + 1);
    }

    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      const rec = cue.channels[String(ch)];
      if (!rec) continue;
      if (typeof rec.level !== 'number' || !Number.isFinite(rec.level) || rec.level < 0 || rec.level > 100) {
        errors.push({ cueId: cue.id, field: `ch.${ch}.level`, message: `灯 ${ch} 亮度须为 0 至 100 的数字` });
      }
      if (!isFiniteNonNegative(rec.up)) {
        errors.push({ cueId: cue.id, field: `ch.${ch}.up`, message: `灯 ${ch} 升光秒数须为非负数字` });
      }
      if (!isFiniteNonNegative(rec.down)) {
        errors.push({ cueId: cue.id, field: `ch.${ch}.down`, message: `灯 ${ch} 降光秒数须为非负数字` });
      }
    }

    if (cue.follow !== undefined && !isFiniteNonNegative(cue.follow)) {
      errors.push({ cueId: cue.id, field: 'follow', message: '跟随等待须为非负数字（或留空）' });
    }
  });

  for (const [name, count] of names) {
    if (count > 1) {
      cues.filter((c) => c.name.trim() === name).forEach((c) =>
        errors.push({ cueId: c.id, field: 'name', message: '名称在节目内必须唯一' }),
      );
    }
  }
  return errors;
}

/** 按节目顺序解析所有 Cue 的完整 12 灯状态（与执行路径无关） */
export function resolveCues(cues: Cue[]): ResolvedCue[] {
  const zero = (): ResolvedCue =>
    Array.from({ length: CHANNEL_COUNT }, () => ({ level: 0, up: 0, down: 0 }));

  let base = zero();
  return cues.map((cue) => {
    const next: ResolvedCue = base.map((ch) => ({ ...ch }));
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      const rec: ChannelRecord | undefined = cue.channels[String(ch)];
      if (rec) next[ch - 1] = { level: rec.level, up: rec.up, down: rec.down };
    }
    base = next;
    return next;
  });
}

export function emptyCue(name: string): Cue {
  return { id: createId(), name, channels: {}, follow: undefined };
}

/** 内置示例节目：演示继承、显式零、跟随与不同升降时长 */
export function sampleCues(): Cue[] {
  return [
    {
      id: createId(),
      name: '开场暖场',
      channels: {
        '1': { level: 60, up: 3, down: 2 },
        '2': { level: 60, up: 3, down: 2 },
        '11': { level: 40, up: 4, down: 2 },
        '12': { level: 40, up: 4, down: 2 },
      },
      follow: 2,
    },
    {
      id: createId(),
      name: '主角定点',
      channels: {
        '5': { level: 100, up: 2, down: 1 },
        '6': { level: 100, up: 2, down: 1 },
        // 显式熄灭灯 1（0 与未记录不同：这里覆盖继承的 60）
        '1': { level: 0, up: 1, down: 4 },
        '2': { level: 0, up: 1, down: 4 },
      },
      follow: 3,
    },
    {
      id: createId(),
      name: '群舞全亮',
      channels: {
        '3': { level: 90, up: 1.5, down: 3 },
        '4': { level: 90, up: 1.5, down: 3 },
        '7': { level: 90, up: 1.5, down: 3 },
        '8': { level: 90, up: 1.5, down: 3 },
        '9': { level: 70, up: 2, down: 3 },
        '10': { level: 70, up: 2, down: 3 },
      },
    },
    {
      id: createId(),
      name: '落幕',
      channels: {
        '1': { level: 0, up: 0, down: 5 },
        '2': { level: 0, up: 0, down: 5 },
        '5': { level: 0, up: 0, down: 5 },
        '6': { level: 0, up: 0, down: 5 },
        '11': { level: 0, up: 0, down: 6 },
        '12': { level: 0, up: 0, down: 6 },
      },
    },
  ];
}
