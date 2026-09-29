export const CHANNEL_COUNT = 12;

/** 一盏灯的一次显式记录：亮度 0..100、升光秒数、降光秒数 */
export interface ChannelRecord {
  level: number;
  up: number;
  down: number;
}

/** 一个 Cue：只记录部分灯，未记录的灯继承节目顺序上的前序 Cue */
export interface Cue {
  id: string;
  name: string;
  /** key 为灯编号 "1".."12"；存在即显式记录（含 0 = 显式熄灭） */
  channels: Record<string, ChannelRecord>;
  /** 跟随等待秒数（可选，>= 0）；末项不再跟随 */
  follow?: number;
}

/** 解析后的单灯完整状态 */
export interface ResolvedChannel {
  level: number;
  up: number;
  down: number;
}

/** 某一 Cue 在节目顺序中解析出的 12 灯完整状态 */
export type ResolvedCue = ResolvedChannel[];

export interface FieldError {
  cueId: string;
  /** 形如 name / ch.3.level / ch.3.up / follow */
  field: string;
  message: string;
}

export const UNIVERSE_COUNT = 4;
export const DMX_SLOT_COUNT = 512;

export interface ConstantSlot {
  offset: number;
  value: number;
}

export interface FixtureType {
  id: string;
  name: string;
  slots: number;
  resolution: 8 | 16;
  /** 相对起始地址的 0 基偏移 */
  coarseOffset: number;
  fineOffset?: number;
  /** key 为 0 基偏移，value 为 0..255 常量 */
  constants: Record<string, number>;
}

export interface Fixture {
  id: string;
  name: string;
  typeId: string;
  universe: number; // 1..4
  address: number; // 1..512
  logicalChannels: number[]; // 1..12，跨灯具不得重复
  maxLevel: number; // 0..100
}

export interface PatchConfig {
  types: FixtureType[];
  fixtures: Fixture[];
}

export interface PublishedPatch extends PatchConfig {
  version: number;
  publishedAt: number;
}

export interface PatchError {
  kind: 'type' | 'fixture' | 'conflict';
  id: string;
  field?: string;
  message: string;
  otherId?: string;
}

export interface FixtureOutput {
  fixture: Fixture;
  type: FixtureType;
  level: number;
  start: number;
  end: number;
  slots: { offset: number; absolute: number; value: number; source: string }[];
}

export interface DmxRendering {
  frames: Uint8Array[];
  fixtureOutputs: FixtureOutput[];
}
