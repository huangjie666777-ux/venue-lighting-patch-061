import {
  CHANNEL_COUNT,
  DMX_SLOT_COUNT,
  UNIVERSE_COUNT,
  type DmxRendering,
  type Fixture,
  type FixtureOutput,
  type FixtureType,
  type PatchConfig,
  type PatchError,
  type PublishedPatch,
} from './types';

const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function clonePatch<T extends PatchConfig>(patch: T): T {
  return JSON.parse(JSON.stringify(patch)) as T;
}

export function validatePatch(patch: PatchConfig): PatchError[] {
  const errors: PatchError[] = [];
  const typeIds = new Set<string>();
  const fixtureIds = new Set<string>();
  const sourceOwners = new Map<number, Fixture>();
  const occupied: { fixture: Fixture; type: FixtureType; start: number; end: number }[] = [];

  for (const type of patch.types) {
    if (typeIds.has(type.id)) {
      errors.push({ kind: 'type', id: type.id, field: 'id', message: '灯型 ID 重复' });
    }
    typeIds.add(type.id);

    if (!int(type.slots) || type.slots <= 0) {
      errors.push({ kind: 'type', id: type.id, field: 'slots', message: '占用槽数须为正整数' });
    }
    if (type.resolution !== 8 && type.resolution !== 16) {
      errors.push({ kind: 'type', id: type.id, field: 'resolution', message: '调光位宽须为 8 或 16' });
    }
    if (!int(type.coarseOffset) || type.coarseOffset < 0 || type.coarseOffset >= type.slots) {
      errors.push({ kind: 'type', id: type.id, field: 'coarseOffset', message: '粗槽偏移须为 0 起且在占用范围内的整数' });
    }
    if (type.resolution === 16) {
      if (!int(type.fineOffset) || (type.fineOffset ?? -1) < 0 || (type.fineOffset ?? -1) >= type.slots) {
        errors.push({ kind: 'type', id: type.id, field: 'fineOffset', message: '16 位灯型须有占用范围内的整数细槽' });
      } else if (type.fineOffset === type.coarseOffset) {
        errors.push({ kind: 'type', id: type.id, field: 'fineOffset', message: '细槽不得与粗槽相同' });
      }
    } else if (type.fineOffset !== undefined) {
      errors.push({ kind: 'type', id: type.id, field: 'fineOffset', message: '8 位灯型不得设置细槽' });
    }

    const constantOffsets = new Set<number>();
    for (const [key, rawValue] of Object.entries(type.constants ?? {})) {
      const offset = Number(key);
      if (!int(offset) || offset < 0 || offset >= type.slots) {
        errors.push({ kind: 'type', id: type.id, field: `constants.${key}.offset`, message: '常量槽偏移须为占用范围内的整数' });
        continue;
      }
      if (!int(rawValue) || rawValue < 0 || rawValue > 255) {
        errors.push({ kind: 'type', id: type.id, field: `constants.${key}`, message: '常量值须为 0 至 255 的整数' });
      }
      if (constantOffsets.has(offset)) {
        errors.push({ kind: 'type', id: type.id, field: `constants.${key}`, message: '常量槽偏移重复' });
      }
      constantOffsets.add(offset);
      if (offset === type.coarseOffset) {
        errors.push({ kind: 'type', id: type.id, field: `constants.${key}`, message: '常量槽不得与粗槽相同' });
      }
      if (type.resolution === 16 && offset === type.fineOffset) {
        errors.push({ kind: 'type', id: type.id, field: `constants.${key}`, message: '常量槽不得与细槽相同' });
      }
    }
  }

  const typesById = new Map(patch.types.map((type) => [type.id, type]));

  for (const fixture of patch.fixtures) {
    if (fixtureIds.has(fixture.id)) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'id', message: '灯具 ID 重复' });
    }
    fixtureIds.add(fixture.id);

    const type = typesById.get(fixture.typeId);
    if (!type) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'typeId', message: `未知灯型：${fixture.typeId}` });
    }
    if (!int(fixture.universe) || fixture.universe < 1 || fixture.universe > UNIVERSE_COUNT) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'universe', message: '宇宙须为 1 至 4 的整数' });
    }
    if (!int(fixture.address) || fixture.address < 1 || fixture.address > DMX_SLOT_COUNT) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'address', message: '起始地址须为 1 至 512 的整数' });
    }
    if (typeof fixture.maxLevel !== 'number' || !Number.isFinite(fixture.maxLevel) || fixture.maxLevel < 0 || fixture.maxLevel > 100) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'maxLevel', message: '亮度上限须为 0 至 100 的数字' });
    }
    if (!Array.isArray(fixture.logicalChannels) || fixture.logicalChannels.length === 0) {
      errors.push({ kind: 'fixture', id: fixture.id, field: 'logicalChannels', message: '逻辑灯编号列表不能为空' });
    } else {
      const seen = new Set<number>();
      for (const ch of fixture.logicalChannels) {
        if (!int(ch) || ch < 1 || ch > CHANNEL_COUNT) {
          errors.push({ kind: 'fixture', id: fixture.id, field: 'logicalChannels', message: `逻辑灯编号须为 1 至 ${CHANNEL_COUNT} 的整数` });
        } else {
          if (seen.has(ch)) {
            errors.push({ kind: 'fixture', id: fixture.id, field: 'logicalChannels', message: `本灯具重复使用逻辑灯 #${ch}` });
          }
          seen.add(ch);
          const owner = sourceOwners.get(ch);
          if (owner && owner.id !== fixture.id) {
            errors.push({ kind: 'fixture', id: fixture.id, field: 'logicalChannels', message: `逻辑灯 #${ch} 已由灯具 ${owner.name || owner.id} 使用`, otherId: owner.id });
            errors.push({ kind: 'fixture', id: owner.id, field: 'logicalChannels', message: `逻辑灯 #${ch} 同时被灯具 ${fixture.name || fixture.id} 使用`, otherId: fixture.id });
          } else {
            sourceOwners.set(ch, fixture);
          }
        }
      }
    }

    if (type && int(type.slots) && type.slots > 0 && int(fixture.universe) && int(fixture.address)) {
      const end = fixture.address + type.slots - 1;
      if (end > DMX_SLOT_COUNT) {
        errors.push({ kind: 'fixture', id: fixture.id, field: 'address', message: `整段占用越过 512（结束于 ${end}）` });
      } else {
        occupied.push({ fixture, type, start: fixture.address, end });
      }
    }
  }

  for (let i = 0; i < occupied.length; i++) {
    for (let j = i + 1; j < occupied.length; j++) {
      const a = occupied[i];
      const b = occupied[j];
      if (a.fixture.universe === b.fixture.universe && a.start <= b.end && b.start <= a.end) {
        errors.push({
          kind: 'conflict',
          id: a.fixture.id,
          field: 'address',
          message: `与灯具 ${b.fixture.name || b.fixture.id} 地址冲突（${a.start}-${a.end} / ${b.start}-${b.end}）`,
          otherId: b.fixture.id,
        });
        errors.push({
          kind: 'conflict',
          id: b.fixture.id,
          field: 'address',
          message: `与灯具 ${a.fixture.name || a.fixture.id} 地址冲突（${b.start}-${b.end} / ${a.start}-${a.end}）`,
          otherId: a.fixture.id,
        });
      }
    }
  }

  return errors;
}

export function publishPatch(draft: PatchConfig, version = 1): PublishedPatch {
  return { ...clonePatch(draft), version, publishedAt: Date.now() };
}

export function samplePatch(): PublishedPatch {
  return publishPatch(
    {
      types: [
        { id: 'dim-8', name: '8 位调光灯', slots: 3, resolution: 8, coarseOffset: 0, constants: { '2': 255 } },
        { id: 'dim-16', name: '16 位调光灯', slots: 4, resolution: 16, coarseOffset: 0, fineOffset: 1, constants: { '3': 128 } },
      ],
      fixtures: [
        { id: 'front-8', name: '面光 8 位组', typeId: 'dim-8', universe: 1, address: 1, logicalChannels: [1, 2], maxLevel: 100 },
        { id: 'spot-16', name: '主角 16 位定点', typeId: 'dim-16', universe: 1, address: 10, logicalChannels: [5], maxLevel: 90 },
      ],
    },
    1,
  );
}

export function renderDmx(levels: number[], patch: PatchConfig, forceDimmerZero = false): DmxRendering {
  const frames = Array.from({ length: UNIVERSE_COUNT }, () => new Uint8Array(DMX_SLOT_COUNT));
  const types = new Map(patch.types.map((type) => [type.id, type]));
  const fixtureOutputs: FixtureOutput[] = [];

  for (const fixture of patch.fixtures) {
    const type = types.get(fixture.typeId);
    if (!type || fixture.universe < 1 || fixture.universe > UNIVERSE_COUNT) continue;

    const sourceValues = fixture.logicalChannels
      .filter((ch) => Number.isInteger(ch) && ch >= 1 && ch <= CHANNEL_COUNT)
      .map((ch) => levels[ch - 1] ?? 0);
    const logicalLevel = sourceValues.length ? Math.max(...sourceValues) : 0;
    const level = forceDimmerZero ? 0 : Math.min(fixture.maxLevel, Math.max(0, logicalLevel));
    const maxRaw = type.resolution === 16 ? 65535 : 255;
    const raw = Math.round((level / 100) * maxRaw);
    const frame = frames[fixture.universe - 1];
    const base = fixture.address - 1;
    const sourceName = fixture.logicalChannels.map((ch) => `#${ch}`).join('/');

    if (base >= 0 && base < DMX_SLOT_COUNT) {
      frame[base + type.coarseOffset] = type.resolution === 16 ? raw >> 8 : raw;
      if (type.resolution === 16) frame[base + (type.fineOffset ?? 0)] = raw & 255;
      for (const [key, value] of Object.entries(type.constants)) {
        frame[base + Number(key)] = value;
      }
    }

    const slots = Array.from({ length: type.slots }, (_, offset) => {
      const absolute = fixture.address + offset;
      let source = '空槽' ;
      if (offset === type.coarseOffset) source = `${sourceName} 调光粗槽`;
      if (type.resolution === 16 && offset === type.fineOffset) source = `${sourceName} 调光细槽`;
      if (Object.hasOwn(type.constants, String(offset))) source = '常量';
      return { offset, absolute, value: frame[base + offset] ?? 0, source };
    });

    fixtureOutputs.push({ fixture, type, level, start: fixture.address, end: fixture.address + type.slots - 1, slots });
  }

  return { frames, fixtureOutputs };
}
