import type {
  MeetingLevel,
  MeetingRule,
  MeetingScheduleMode,
  MeetingWeekdayKey,
  SpecialEventMaster,
  WeekOccurrence,
} from './types.ts';
import {
  ALL_WORKING_WEEKDAYS,
  formatDateDDMMYYYY,
  getWeekdayLabel,
  getWeekOccurrenceLabel,
} from './marathi.ts';

export const MEETING_RULE_DATE_PREFIX = 'MEETING_RULE_';
export const WORK_LOG_DATE_PREFIX = 'WORK_LOG_';
const CONFIG_TAG_REGEX = /\s*\[CFG:(\{.*?\})\]\s*$/;

export const MEETING_LEVELS: MeetingLevel[] = ['जिल्हास्तरीय बैठक', 'तालुकास्तरीय बैठक'];

export const MEETING_LEVEL_DEFAULTS: Record<
  MeetingLevel,
  { location: string; workDescription: string; preferredStartDay: number; preferredEndDay: number }
> = {
  'जिल्हास्तरीय बैठक': {
    location: 'जिल्हा आरोग्य अधिकारी कार्यालय, लातूर',
    workDescription: 'जिल्हास्तरीय मासिक आढावा बैठक',
    preferredStartDay: 10,
    preferredEndDay: 25,
  },
  'तालुकास्तरीय बैठक': {
    location: 'तालुका आरोग्य अधिकारी कार्यालय, औसा',
    workDescription: 'तालुकास्तरीय आढावा बैठक',
    preferredStartDay: 15,
    preferredEndDay: 26,
  },
};

export function isWorkLogRecord(ev: Pick<SpecialEventMaster, 'date'>): boolean {
  return typeof ev.date === 'string' && ev.date.startsWith(WORK_LOG_DATE_PREFIX);
}

export function isMeetingRuleRecord(ev: Pick<SpecialEventMaster, 'date'>): boolean {
  return (
    typeof ev.date === 'string' &&
    (ev.date.startsWith(MEETING_RULE_DATE_PREFIX) || ev.date.startsWith(WORK_LOG_DATE_PREFIX))
  );
}

export function isSettingsMeetingRecord(ev: SpecialEventMaster): boolean {
  if (isWorkLogRecord(ev)) return false;
  if (typeof ev.date === 'string' && ev.date.startsWith(MEETING_RULE_DATE_PREFIX)) return true;
  return ev.eventType === 'जिल्हास्तरीय बैठक' || ev.eventType === 'तालुकास्तरीय बैठक';
}

export function generateMeetingRuleDateKey(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${MEETING_RULE_DATE_PREFIX}${Date.now()}_${rand}`;
}

interface EncodedMeetingConfig {
  m: Exclude<MeetingScheduleMode, 'specific_date'>;
  s?: number;
  e?: number;
  wd?: MeetingWeekdayKey;
  wk?: WeekOccurrence;
  d?: number;
  a?: boolean;
}

export function parseMeetingRuleFromSpecialEvent(ev: SpecialEventMaster): MeetingRule | null {
  if (isWorkLogRecord(ev)) {
    return null;
  }
  const level: MeetingLevel =
    ev.eventType === 'जिल्हास्तरीय बैठक'
      ? 'जिल्हास्तरीय बैठक'
      : ev.eventType === 'तालुकास्तरीय बैठक'
      ? 'तालुकास्तरीय बैठक'
      : 'जिल्हास्तरीय बैठक';

  if (!(typeof ev.date === 'string' && ev.date.startsWith(MEETING_RULE_DATE_PREFIX))) {
    if (ev.eventType !== 'जिल्हास्तरीय बैठक' && ev.eventType !== 'तालुकास्तरीय बैठक') {
      return null;
    }
    return {
      id: ev.id,
      rawDateKey: ev.date,
      isRecurring: false,
      level,
      location: ev.location,
      workDescription: ev.workDescription,
      scheduleMode: 'specific_date',
      specificDate: ev.date,
      active: true,
      notes: ev.notes || '',
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
    };
  }

  let parsedCfg: EncodedMeetingConfig = {
    m: 'free_working_day',
    s: MEETING_LEVEL_DEFAULTS[level].preferredStartDay,
    e: MEETING_LEVEL_DEFAULTS[level].preferredEndDay,
    a: true,
  };
  let cleanNotes = ev.notes || '';

  const match = CONFIG_TAG_REGEX.exec(ev.notes || '');
  if (match) {
    cleanNotes = (ev.notes || '').replace(CONFIG_TAG_REGEX, '').trim();
    try {
      const obj = JSON.parse(match[1]) as Partial<EncodedMeetingConfig>;
      if (obj.m === 'free_working_day' || obj.m === 'weekday_occurrence' || obj.m === 'fixed_day') {
        parsedCfg = {
          m: obj.m,
          s: typeof obj.s === 'number' ? obj.s : undefined,
          e: typeof obj.e === 'number' ? obj.e : undefined,
          wd: obj.wd,
          wk: obj.wk,
          d: typeof obj.d === 'number' ? obj.d : undefined,
          a: obj.a !== false,
        };
      }
    } catch {
      // Fallback to default free_working_day config
    }
  }

  // Strip auto-generated prefix separated by " | " if present
  const pipeIdx = cleanNotes.indexOf(' | ');
  const userNotes =
    pipeIdx !== -1 &&
    (cleanNotes.startsWith('दरमहा') || cleanNotes.startsWith('प्रत्येक महिन्यात'))
      ? cleanNotes.slice(pipeIdx + 3).trim()
      : cleanNotes.startsWith('दरमहा') && !cleanNotes.includes('|')
      ? ''
      : cleanNotes;

  return {
    id: ev.id,
    rawDateKey: ev.date,
    isRecurring: true,
    level,
    location: ev.location,
    workDescription: ev.workDescription,
    scheduleMode: parsedCfg.m,
    preferredStartDay: parsedCfg.s ?? MEETING_LEVEL_DEFAULTS[level].preferredStartDay,
    preferredEndDay: parsedCfg.e ?? MEETING_LEVEL_DEFAULTS[level].preferredEndDay,
    weekday: parsedCfg.wd ?? 'thursday',
    weekNumber: parsedCfg.wk ?? 2,
    dayOfMonth: parsedCfg.d ?? 15,
    active: parsedCfg.a !== false,
    notes: userNotes,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
  };
}

export function describeMeetingScheduleMarathi(
  rule: Pick<
    MeetingRule,
    'scheduleMode' | 'preferredStartDay' | 'preferredEndDay' | 'weekday' | 'weekNumber' | 'dayOfMonth' | 'specificDate'
  >
): string {
  if (rule.scheduleMode === 'specific_date') {
    return rule.specificDate ? `ठराविक दिनांक: ${formatDateDDMMYYYY(rule.specificDate)}` : 'ठराविक दिनांक';
  }
  if (rule.scheduleMode === 'weekday_occurrence') {
    const wk = rule.weekNumber ? getWeekOccurrenceLabel(rule.weekNumber) : 'दुसरा';
    const wd = rule.weekday ? getWeekdayLabel(rule.weekday) : 'गुरुवार';
    return `दरमहा ${wk} ${wd}`;
  }
  if (rule.scheduleMode === 'fixed_day') {
    const day = Math.max(1, Math.min(31, Number(rule.dayOfMonth) || 15));
    return `दरमहा ${day} तारीख`;
  }
  const s = Math.max(1, Math.min(28, Number(rule.preferredStartDay) || 10));
  const e = Math.max(s, Math.min(31, Number(rule.preferredEndDay) || 25));
  return `दरमहा उपलब्ध कामकाजाचा दिवस (दि. ${s} ते ${e})`;
}

export interface MeetingRuleFormInput {
  level: MeetingLevel;
  location: string;
  workDescription: string;
  scheduleMode: MeetingScheduleMode;
  preferredStartDay?: number;
  preferredEndDay?: number;
  weekday?: MeetingWeekdayKey;
  weekNumber?: WeekOccurrence;
  dayOfMonth?: number;
  specificDate?: string;
  active?: boolean;
  notes?: string;
  existingRawDateKey?: string;
}

export function serializeMeetingRuleToSpecialEventPayload(
  input: MeetingRuleFormInput
): Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'> {
  const cleanLocation = input.location.trim();
  const cleanWork = input.workDescription.trim();
  const cleanUserNotes = (input.notes || '').trim();

  if (input.scheduleMode === 'specific_date') {
    return {
      date: (input.specificDate || '').trim(),
      eventType: input.level,
      location: cleanLocation,
      workDescription: cleanWork,
      notes: cleanUserNotes,
    };
  }

  const dateKey =
    input.existingRawDateKey && input.existingRawDateKey.startsWith(MEETING_RULE_DATE_PREFIX)
      ? input.existingRawDateKey
      : generateMeetingRuleDateKey();

  const cfg: EncodedMeetingConfig = {
    m: input.scheduleMode,
    a: input.active !== false,
  };

  if (input.scheduleMode === 'free_working_day') {
    const s = Math.max(1, Math.min(28, Number(input.preferredStartDay) || 10));
    const e = Math.max(s, Math.min(31, Number(input.preferredEndDay) || 25));
    cfg.s = s;
    cfg.e = e;
  } else if (input.scheduleMode === 'weekday_occurrence') {
    cfg.wd = input.weekday || 'thursday';
    cfg.wk = (input.weekNumber || 2) as WeekOccurrence;
  } else if (input.scheduleMode === 'fixed_day') {
    cfg.d = Math.max(1, Math.min(31, Number(input.dayOfMonth) || 15));
  }

  const scheduleSummary = describeMeetingScheduleMarathi({
    scheduleMode: input.scheduleMode,
    preferredStartDay: cfg.s,
    preferredEndDay: cfg.e,
    weekday: cfg.wd,
    weekNumber: cfg.wk,
    dayOfMonth: cfg.d,
  });

  const combinedNotes = cleanUserNotes
    ? `${scheduleSummary} | ${cleanUserNotes} [CFG:${JSON.stringify(cfg)}]`
    : `${scheduleSummary} [CFG:${JSON.stringify(cfg)}]`;

  return {
    date: dateKey,
    eventType: input.level,
    location: cleanLocation,
    workDescription: cleanWork,
    notes: combinedNotes,
  };
}

/**
 * Finds the 1-based day-of-month for the Nth occurrence of a weekday (Mon..Sat) in (year, month).
 * Returns null if that occurrence doesn't exist in that month (e.g. 5th Friday in a short month).
 */
export function findNthWeekdayDayInMonth(
  year: number,
  month: number,
  weekday: MeetingWeekdayKey,
  weekNumber: WeekOccurrence
): number | null {
  const targetDow = ALL_WORKING_WEEKDAYS.find((d) => d.key === weekday)?.dayIndex;
  if (targetDow === undefined) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === targetDow) {
      count++;
      if (count === weekNumber) return day;
    }
  }
  return null;
}
