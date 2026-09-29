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
