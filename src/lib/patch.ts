export const UNIVERSE_COUNT = 4;
export const DMX_SLOT_COUNT = 512;
export const MAX_LOGICAL_CHANNEL = 12;

export type DimmerWidth = 8 | 16;

export interface FixtureType {
  id: string;
  name: string;
  slotCount: number;
  width: DimmerWidth;
  coarseOffset: number;
  fineOffset?: number;
  constants: Record<number, number>;
}

export interface Fixture {
  id: string;
  name: string;
  typeId: string;
  universe: number;
  startAddress: number;
  logicalChannels: number[];
  maxLevel: number;
}

export interface PatchConfig {
  types: FixtureType[];
  fixtures: Fixture[];
}

export interface ActivePatch {
  version: number;
  publishedAt: string;
  config: PatchConfig;
}

export interface PatchError {
  typeId?: string;
  fixtureId?: string;
  field: string;
  message: string;
  otherFixtureId?: string;
}

export type SlotRole = 'coarse' | 'fine' | 'constant';

export interface SlotSource {
  fixtureId: string;
  fixtureName: string;
  typeId: string;
  role: SlotRole;
  logicalChannels: number[];
  level: number;
  value: number;
}

export interface PatchRenderResult {
  frames: Uint8Array[];
  sources: (SlotSource | null)[][];
  fixtureLevels: Array<{ fixtureId: string; level: number; value: number }>;
}

const integer = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const nonEmptyId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function clonePatch(config: PatchConfig): PatchConfig {
  return structuredClone(plainPatch(config));
}

export function plainPatch(config: PatchConfig): PatchConfig {
  return {
    types: config.types.map((type) => ({
      id: type.id,
      name: type.name,
      slotCount: type.slotCount,
      width: type.width,
      coarseOffset: type.coarseOffset,
      fineOffset: type.fineOffset,
      constants: { ...type.constants },
    })),
    fixtures: config.fixtures.map((fixture) => ({
      id: fixture.id,
      name: fixture.name,
      typeId: fixture.typeId,
      universe: fixture.universe,
      startAddress: fixture.startAddress,
      logicalChannels: [...fixture.logicalChannels],
      maxLevel: fixture.maxLevel,
    })),
  };
}

export function validatePatch(config: PatchConfig): PatchError[] {
  const errors: PatchError[] = [];
  const typeIds = new Set<string>();
  const fixtureIds = new Set<string>();
  const validTypes = new Map<string, FixtureType>();

  for (const type of config.types ?? []) {
    const tid = nonEmptyId(type?.id) ? type.id : '';
    if (!tid) {
      errors.push({ field: 'types[].id', message: '灯型 ID 不能为空' });
      continue;
    }
    const duplicateType = typeIds.has(tid);
    if (duplicateType) {
      errors.push({ typeId: tid, field: 'id', message: '灯型 ID 必须唯一' });
    }
    typeIds.add(tid);

    let valid = true;
    if (!integer(type.slotCount) || type.slotCount <= 0) {
      errors.push({ typeId: tid, field: 'slotCount', message: '占用槽数必须为正整数' });
      valid = false;
    }
    if (type.width !== 8 && type.width !== 16) {
      errors.push({ typeId: tid, field: 'width', message: '调光位宽必须为 8 或 16' });
      valid = false;
    }
    if (!integer(type.coarseOffset) || type.coarseOffset < 0 || (valid && type.coarseOffset >= type.slotCount)) {
      errors.push({ typeId: tid, field: 'coarseOffset', message: '粗槽偏移须为占用范围内的非负整数' });
      valid = false;
    }

    const used = new Set<number>();
    if (integer(type.coarseOffset) && type.coarseOffset >= 0) used.add(type.coarseOffset);
    if (type.width === 16) {
      if (!integer(type.fineOffset) || (type.fineOffset as number) < 0 || (valid && (type.fineOffset as number) >= type.slotCount)) {
        errors.push({ typeId: tid, field: 'fineOffset', message: '16 位灯型须指定占用范围内的细槽非负整数' });
        valid = false;
      } else if (used.has(type.fineOffset as number)) {
        errors.push({ typeId: tid, field: 'fineOffset', message: '细槽不得与粗槽相同' });
        valid = false;
      } else if (integer(type.fineOffset)) {
        used.add(type.fineOffset);
      }
    } else if (type.fineOffset !== undefined) {
      errors.push({ typeId: tid, field: 'fineOffset', message: '8 位灯型不能设置细槽' });
    }

    const constants = type.constants ?? {};
    for (const [rawOffset, rawValue] of Object.entries(constants)) {
      const offset = Number(rawOffset);
      if (!Number.isInteger(offset) || offset < 0 || (valid && offset >= type.slotCount)) {
        errors.push({ typeId: tid, field: `constants.${rawOffset}`, message: '常量槽偏移须为占用范围内的非负整数' });
        continue;
      }
      if (!integer(rawValue) || rawValue < 0 || rawValue > 255) {
        errors.push({ typeId: tid, field: `constants.${rawOffset}`, message: '常量值必须为 0 至 255 的整数' });
        continue;
      }
      if (used.has(offset)) {
        errors.push({ typeId: tid, field: `constants.${rawOffset}`, message: '常量槽不得与粗槽或细槽相同' });
        continue;
      }
      used.add(offset);
    }

    if (valid && !duplicateType) validTypes.set(tid, type);
  }

  const placements: Array<{ fixture: Fixture; end: number }> = [];
  for (const fixture of config.fixtures ?? []) {
    const fid = nonEmptyId(fixture?.id) ? fixture.id : '';
    if (!fid) {
      errors.push({ field: 'fixtures[].id', message: '灯具 ID 不能为空' });
      continue;
    }
    const duplicateFixture = fixtureIds.has(fid);
    if (duplicateFixture) {
      errors.push({ fixtureId: fid, field: 'id', message: '灯具 ID 必须唯一' });
    }
    fixtureIds.add(fid);

    let placementValid = true;
    const type = validTypes.get(fixture.typeId);
    if (!nonEmptyId(fixture.typeId) || !type) {
      errors.push({ fixtureId: fid, field: 'typeId', message: '未知灯型引用' });
      placementValid = false;
    }
    if (!integer(fixture.universe) || fixture.universe < 1 || fixture.universe > UNIVERSE_COUNT) {
      errors.push({ fixtureId: fid, field: 'universe', message: '宇宙必须为 1 至 4 的整数' });
      placementValid = false;
    }
    if (!integer(fixture.startAddress) || fixture.startAddress < 1 || fixture.startAddress > DMX_SLOT_COUNT) {
      errors.push({ fixtureId: fid, field: 'startAddress', message: '起始地址必须为 1 至 512 的整数' });
      placementValid = false;
    }
    if (!Array.isArray(fixture.logicalChannels) || fixture.logicalChannels.length === 0) {
      errors.push({ fixtureId: fid, field: 'logicalChannels', message: '逻辑灯编号列表不能为空' });
      placementValid = false;
    } else {
      const seen = new Set<number>();
      for (const logical of fixture.logicalChannels) {
        if (!integer(logical) || logical < 1 || logical > MAX_LOGICAL_CHANNEL) {
          errors.push({ fixtureId: fid, field: 'logicalChannels', message: `逻辑灯编号须为 1 至 ${MAX_LOGICAL_CHANNEL} 的整数` });
          placementValid = false;
          break;
        }
        if (seen.has(logical)) {
          errors.push({ fixtureId: fid, field: 'logicalChannels', message: `灯具内源灯 ${logical} 重复` });
          placementValid = false;
          break;
        }
        seen.add(logical);
      }
    }
    if (!integer(fixture.maxLevel) || fixture.maxLevel < 0 || fixture.maxLevel > 100) {
      errors.push({ fixtureId: fid, field: 'maxLevel', message: '亮度上限必须为 0 至 100 的整数' });
    }

    if (type && placementValid && !duplicateFixture) {
      const end = fixture.startAddress + type.slotCount - 1;
      if (end > DMX_SLOT_COUNT) {
        errors.push({ fixtureId: fid, field: 'startAddress', message: `配接越过 512（末槽为 ${end}）` });
      } else {
        placements.push({ fixture, end });
      }
    }
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (a.fixture.universe !== b.fixture.universe) continue;
      const aStart = a.fixture.startAddress;
      const bStart = b.fixture.startAddress;
      if (aStart <= b.end && bStart <= a.end) {
        errors.push({ fixtureId: a.fixture.id, otherFixtureId: b.fixture.id, field: 'addressRange', message: `与灯具 ${b.fixture.id} 的地址区间相交` });
        errors.push({ fixtureId: b.fixture.id, otherFixtureId: a.fixture.id, field: 'addressRange', message: `与灯具 ${a.fixture.id} 的地址区间相交` });
      }
    }
  }

  return errors;
}

export function renderPatch(config: PatchConfig, logicalOutputs: readonly number[]): PatchRenderResult {
  const frames = Array.from({ length: UNIVERSE_COUNT }, () => new Uint8Array(DMX_SLOT_COUNT));
  const sources = Array.from({ length: UNIVERSE_COUNT }, () => Array<SlotSource | null>(DMX_SLOT_COUNT).fill(null));
  const fixtureLevels: PatchRenderResult['fixtureLevels'] = [];
  const types = new Map(config.types.map((type) => [type.id, type]));

  for (const fixture of config.fixtures) {
    const type = types.get(fixture.typeId);
    if (!type) continue;
    const selected = fixture.logicalChannels.map((ch) => logicalOutputs[ch - 1] ?? 0);
    const level = Math.min(fixture.maxLevel, Math.max(0, selected.length ? Math.max(...selected) : 0));
    const maxValue = type.width === 16 ? 65535 : 255;
    const value = Math.round((level / 100) * maxValue);
    fixtureLevels.push({ fixtureId: fixture.id, level, value });

    const universeIndex = fixture.universe - 1;
    const base = fixture.startAddress - 1;
    const put = (offset: number, byte: number, role: SlotRole) => {
      const slot = base + offset;
      if (slot < 0 || slot >= DMX_SLOT_COUNT) return;
      frames[universeIndex][slot] = byte;
      sources[universeIndex][slot] = {
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        typeId: type.id,
        role,
        logicalChannels: [...fixture.logicalChannels],
        level,
        value: role === 'fine' ? value & 255 : role === 'coarse' && type.width === 16 ? value >> 8 : byte,
      };
    };

    if (type.width === 16) {
      put(type.coarseOffset, value >> 8, 'coarse');
      put(type.fineOffset as number, value & 255, 'fine');
    } else {
      put(type.coarseOffset, value, 'coarse');
    }
    for (const [rawOffset, constant] of Object.entries(type.constants)) {
      put(Number(rawOffset), constant, 'constant');
    }
  }

  return { frames, sources, fixtureLevels };
}

export function samplePatch(): PatchConfig {
  return {
    types: [
      {
        id: 'dim-8',
        name: '8 位调光 + 常量',
        slotCount: 2,
        width: 8,
        coarseOffset: 0,
        constants: { 1: 128 },
      },
      {
        id: 'profile-16',
        name: '16 位成像灯 + 常量',
        slotCount: 3,
        width: 16,
        coarseOffset: 0,
        fineOffset: 1,
        constants: { 2: 255 },
      },
    ],
    fixtures: [
      { id: 'f-front-l', name: '面光左（8 位）', typeId: 'dim-8', universe: 1, startAddress: 1, logicalChannels: [1, 2], maxLevel: 100 },
      { id: 'f-front-r', name: '面光右（8 位）', typeId: 'dim-8', universe: 1, startAddress: 3, logicalChannels: [3, 4], maxLevel: 80 },
      { id: 'f-spot-l', name: '主角定点左（16 位）', typeId: 'profile-16', universe: 1, startAddress: 101, logicalChannels: [5], maxLevel: 100 },
      { id: 'f-spot-r', name: '主角定点右（16 位）', typeId: 'profile-16', universe: 1, startAddress: 104, logicalChannels: [6], maxLevel: 100 },
      { id: 'f-wash', name: '群洗灯（16 位）', typeId: 'profile-16', universe: 2, startAddress: 1, logicalChannels: [7, 8, 9, 10], maxLevel: 90 },
      { id: 'f-back', name: '背光（16 位）', typeId: 'profile-16', universe: 2, startAddress: 4, logicalChannels: [11, 12], maxLevel: 100 },
    ],
  };
}
