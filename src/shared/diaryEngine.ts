import type {
  ApplicationSettings,
  DiaryEntryType,
  DiaryWarning,
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MeetingRule,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  MonthlyDiarySummary,
  SpecialEventMaster,
  VillageMaster,
  WeeklyScheduleMaster,
} from './types.ts';
import {
  dayIndexToWeekdayKey,
  formatDateDDMMYYYY,
  makeMonthId,
  makeMonthLabelMarathi,
  makeMonthSheetName,
  MARATHI_DAYS_BY_INDEX,
  resolveHolidayDisplayMeta,
} from './marathi.ts';
import {
  findNthWeekdayDayInMonth,
  isMeetingRuleRecord,
  parseMeetingRuleFromSpecialEvent,
} from './meetingRules.ts';
import { extractHeadquarterCities } from './travelMeta.ts';

interface GenerateDiaryInput {
  year: number;
  month: number; // 1..12
  employee: EmployeeMaster;
  villages?: VillageMaster[];
  weeklySchedules: WeeklyScheduleMaster[];
  holidays: GovernmentHolidayMaster[];
  leaves: LeaveRecord[];
  specialEvents: SpecialEventMaster[];
  settings: ApplicationSettings;
  existingEntries?: MonthlyDiaryEntry[];
  previousMonthDiary?: MonthlyDiaryDocument | null;
  preserveManualEdits?: boolean;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysBetweenIso(isoA: string, isoB: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoA);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoB);
  if (!a || !b) return 999;
  const utcA = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const utcB = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((utcB - utcA) / 86_400_000);
}

function stripSubcenterSuffix(place: string): string {
  return (place || '').replace(/\s*\(\s*उपकेंद्र[^)]*\)\s*$/u, '').trim();
}

export function computeDiarySummary(entries: MonthlyDiaryEntry[]): MonthlyDiarySummary {
  const summary: MonthlyDiarySummary = {
    totalDays: entries.length,
    workingDays: 0,
    sundays: 0,
    holidays: 0,
    leaves: 0,
    specialEvents: 0,
    villageTours: 0,
    meetings: 0,
    officeDays: 0,
    adjustedDays: 0,
  };

  for (const e of entries) {
    if (e.entryType === 'sunday') {
      summary.sundays++;
    } else if (e.entryType === 'holiday') {
      summary.holidays++;
    } else if (e.entryType === 'leave') {
      summary.leaves++;
    } else {
      summary.workingDays++;
      if (e.entryType === 'special_event') summary.specialEvents++;
      else if (e.entryType === 'weekly_schedule') summary.villageTours++;
      else if (e.entryType === 'adjusted_schedule') {
        summary.villageTours++;
        summary.adjustedDays++;
      } else if (
        e.entryType === 'wednesday_weekly' ||
        e.entryType === 'wednesday_asha' ||
        e.entryType === 'district_meeting' ||
        e.entryType === 'taluka_meeting' ||
        e.entryType === 'subcenter_meeting'
      ) {
        summary.meetings++;
      } else if (e.entryType === 'office_work') {
        summary.officeDays++;
      }
    }
  }
  return summary;
}

/**
 * Generates an automatic Monthly Tour Diary strictly honoring all rules:
 * 1. Sundays clearly separated
 * 2. Year-specific Government Holidays (never carried over from other years) + Holiday Adjustment
 * 3. Employee Leaves override all regular programs (shows 'रजा')
 * 4. Special Events take priority over regular schedule without destroying master records
 * 5. Rule 1: Every Wednesday -> PHC Bhada HQ Weekly Meeting; Wednesday after 25th -> Asha & Monthly Review Meeting
 * 6. Rule 5: Recurring Weekly Schedule (Mon/Tue/Thu/Fri/Sat by week occurrence 1..5)
 * 7. Holiday Adjustment: Displaced weekly schedules move to next or previous free working day (configurable), storing originalDate & adjustedDate; warns if impossible
 * 8. Rule 2: Taluka Review Meeting (1 free working day/month)
 * 9. Rule 3: Two Subcenter Meetings (उपकेंद्र आलमला & उपकेंद्र लखनगाव on 2 separate free working days/month)
 * 10. Rule 4: Remaining working days -> PHC Bhada Office Work
 * 11. Manual edits preserved when preserveManualEdits === true
 */
export function generateMonthlyDiary(input: GenerateDiaryInput): MonthlyDiaryDocument {
  const {
    year,
    month,
    employee,
    villages = [],
    weeklySchedules,
    holidays,
    leaves,
    specialEvents,
    settings,
    existingEntries = [],
    previousMonthDiary = null,
    preserveManualEdits = true,
  } = input;

  const { talukaHq, districtHq } = extractHeadquarterCities(villages);
  const talukaCityName = talukaHq.name;
  const districtCityName = districtHq.name;

  const daysInMonth = new Date(year, month, 0).getDate();
  const warnings: DiaryWarning[] = [];
  const fromPlace = settings.defaultFromPlace || 'भादा';

  // Previous calendar month info for enforcing the minimum 28-day gap for the same session
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthId = makeMonthId(prevYear, prevMonth);
  const implMonthId = (settings.implementationDate || '2026-04-01').slice(0, 7);

  const findPreviousMonthSessionDate = (schedule: WeeklyScheduleMaster): string | null => {
    // 1) Prefer exact actual date from the saved previous month's diary
    if (previousMonthDiary && previousMonthDiary.id === prevMonthId) {
      const exactById = previousMonthDiary.entries.find(
        (e) =>
          e.sourceId === schedule.id &&
          (e.entryType === 'weekly_schedule' || e.entryType === 'adjusted_schedule' || e.entryType === 'manual')
      );
      if (exactById) return exactById.date;

      const targetVillage = schedule.villageName.trim().toLowerCase();
      const matchingVillageEntries = previousMonthDiary.entries.filter(
        (e) =>
          (e.entryType === 'weekly_schedule' || e.entryType === 'adjusted_schedule') &&
          stripSubcenterSuffix(e.toPlace).toLowerCase() === targetVillage
      );
      if (matchingVillageEntries.length === 1) {
        return matchingVillageEntries[0].date;
      }
      if (matchingVillageEntries.length > 1) {
        const expectedPrevDay =
          findNthWeekdayDayInMonth(prevYear, prevMonth, schedule.weekday, schedule.weekNumber) ?? 15;
        let best = matchingVillageEntries[0];
        let bestDiff = Math.abs(best.serialNo - expectedPrevDay);
        for (const cand of matchingVillageEntries.slice(1)) {
          const d = Math.abs(cand.serialNo - expectedPrevDay);
          if (d < bestDiff) {
            best = cand;
            bestDiff = d;
          }
        }
        return best.date;
      }
    }

    // 2) Fallback when previous month diary is not saved yet (only if previous month >= implementation month)
    if (prevMonthId < implMonthId) return null;
    const prevScheduledDay = findNthWeekdayDayInMonth(
      prevYear,
      prevMonth,
      schedule.weekday,
      schedule.weekNumber
    );
    return prevScheduledDay !== null ? toIsoDate(prevYear, prevMonth, prevScheduledDay) : null;
  };

  // Index manual edits from existing diary if preserving manual changes
  const manualMap = new Map<string, MonthlyDiaryEntry>();
  if (preserveManualEdits) {
    for (const row of existingEntries) {
      if (row.isManualEdit) {
        manualMap.set(row.date, { ...row });
      }
    }
  }

  // Filter holidays strictly for THIS year only (preserving multiple holidays on the same date, e.g. 01-05)
  const holidaysByDate = new Map<string, GovernmentHolidayMaster[]>();
  for (const h of holidays) {
    const hYear = Number(h.year) || Number(h.date.slice(0, 4));
    if (hYear === year) {
      const list = holidaysByDate.get(h.date) || [];
      list.push(h);
      holidaysByDate.set(h.date, list);
    }
  }

  // Index single-date special events AND separate Settings recurring meeting rules
  const specialEventByDate = new Map<string, SpecialEventMaster>();
  const targetedMeetingsByDay = new Map<number, MeetingRule[]>();
  const freeDayMeetingRules: MeetingRule[] = [];
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;

  for (const ev of specialEvents) {
    if (isMeetingRuleRecord(ev)) {
      const rule = parseMeetingRuleFromSpecialEvent(ev);
      if (!rule || !rule.active) continue;

      if (rule.scheduleMode === 'free_working_day') {
        freeDayMeetingRules.push(rule);
      } else if (rule.scheduleMode === 'weekday_occurrence' && rule.weekday && rule.weekNumber) {
        const targetDay = findNthWeekdayDayInMonth(year, month, rule.weekday, rule.weekNumber);
        if (targetDay !== null) {
          const list = targetedMeetingsByDay.get(targetDay) || [];
          list.push(rule);
          targetedMeetingsByDay.set(targetDay, list);
        }
      } else if (rule.scheduleMode === 'fixed_day' && rule.dayOfMonth) {
        const clampedDay = Math.max(1, Math.min(daysInMonth, rule.dayOfMonth));
        const list = targetedMeetingsByDay.get(clampedDay) || [];
        list.push(rule);
        targetedMeetingsByDay.set(clampedDay, list);
      }
      continue;
    }

    if (ev.date.startsWith(monthPrefix)) {
      specialEventByDate.set(ev.date, ev);
    }
  }

  // Helper to find leave covering a date
  const findLeaveForDate = (isoDate: string): LeaveRecord | undefined => {
    return leaves.find((lv) => isoDate >= lv.startDate && isoDate <= lv.endDate);
  };

  // Index weekly schedule by `${weekday}_${weekNumber}`
  const scheduleMap = new Map<string, WeeklyScheduleMaster>();
  for (const ws of weeklySchedules) {
    scheduleMap.set(`${ws.weekday}_${ws.weekNumber}`, ws);
  }

  // Initialize day slots (null means unassigned free working day)
  const entries: (MonthlyDiaryEntry | null)[] = new Array(daysInMonth).fill(null);

  // Displaced schedules caused by Government Holidays or scheduled District/Taluka meetings
  interface DisplacedSchedule {
    originalDayIndex: number; // 0-based index in entries
    originalDate: string;
    reasonLabel: string;
    schedule: WeeklyScheduleMaster;
  }
  const displacedSchedules: DisplacedSchedule[] = [];

  // Displaced targeted recurring meetings (when fixed day / weekday falls on Sunday/Holiday/Leave/occupied day)
  interface DisplacedMeeting {
    originalDayIndex: number;
    originalDate: string;
    reasonLabel: string;
    rule: MeetingRule;
  }
  const displacedMeetings: DisplacedMeeting[] = [];

  const getMeetingEntryType = (level: MeetingRule['level']): DiaryEntryType =>
    level === 'जिल्हास्तरीय बैठक' ? 'district_meeting' : 'taluka_meeting';

  const meetingRuleById = new Map<string, MeetingRule>();
  for (const list of targetedMeetingsByDay.values()) {
    for (const r of list) meetingRuleById.set(r.id, r);
  }
  for (const r of freeDayMeetingRules) {
    meetingRuleById.set(r.id, r);
  }

  const isMeetingEntryType = (t: DiaryEntryType): boolean =>
    t === 'wednesday_weekly' ||
    t === 'wednesday_asha' ||
    t === 'district_meeting' ||
    t === 'taluka_meeting' ||
    t === 'subcenter_meeting';

  // 5-Day Week Rule: All Taluka & District offices are closed on ALL Saturdays (6) and Sundays (0)
  const isFiveDayOfficeOpen = (dayIdx: number): boolean => {
    const dow = new Date(year, month - 1, dayIdx + 1).getDay();
    return dow >= 1 && dow <= 5;
  };

  // Pass 1: Assign fixed-priority days: Manual Edits, Leave (FINAL), Sundays, Holidays, Special Events, Targeted Meetings, Wednesdays, and Weekly Schedules
  for (let day = 1; day <= daysInMonth; day++) {
    const idx = day - 1;
    const isoDate = toIsoDate(year, month, day);
    const dateObj = new Date(year, month - 1, day);
    const dow = dateObj.getDay(); // 0=Sun..6=Sat
    const dayNameMarathi = MARATHI_DAYS_BY_INDEX[dow];

    // Check matching recurring weekly schedule for Mon/Tue/Thu/Fri/Sat
    const weekdayKey = dayIndexToWeekdayKey(dow);
    const weekNumber = Math.ceil(day / 7);
    const matchedSchedule =
      weekdayKey && weekNumber >= 1 && weekNumber <= 5
        ? scheduleMap.get(`${weekdayKey}_${weekNumber}`)
        : undefined;

    // Targeted recurring Settings meetings scheduled for this calendar day
    const dayMeetings = targetedMeetingsByDay.get(day) || [];

    // 0) Preserved Manual Edit (if user opted not to overwrite manual changes)
    const manualRow = manualMap.get(isoDate);
    if (manualRow) {
      entries[idx] = {
        ...manualRow,
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace: manualRow.fromPlace || fromPlace,
        isManualEdit: true,
      };
      for (const mRule of dayMeetings) {
        if (manualRow.sourceId !== mRule.id) {
          displacedMeetings.push({
            originalDayIndex: idx,
            originalDate: isoDate,
            reasonLabel: 'मॅन्युअल नोंद',
            rule: mRule,
          });
        }
      }
      continue;
    }

    // 1) Employee Leave — ABSOLUTELY FINAL; do NOT consider health service sessions, meetings, or anything else
    const leave = findLeaveForDate(isoDate);
    if (leave) {
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: 'रजा',
        workDescription: `रजा — ${leave.leaveType}${leave.reason ? ` (${leave.reason})` : ''}`,
        entryType: 'leave',
        originalDate: null,
        adjustedDate: null,
        sourceId: leave.id,
        isManualEdit: false,
        notes: leave.notes || '',
      };
      continue;
    }

    // 2) Special Event (including specific-date District/Taluka meetings) — recorded even on Government Holidays or Sundays
    const specialEvent = specialEventByDate.get(isoDate);
    const dayHolidays = holidaysByDate.get(isoDate);
    if (specialEvent) {
      const evEntryType: DiaryEntryType =
        specialEvent.eventType === 'जिल्हास्तरीय बैठक'
          ? 'district_meeting'
          : specialEvent.eventType === 'तालुकास्तरीय बैठक'
          ? 'taluka_meeting'
          : 'special_event';
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: specialEvent.location,
        workDescription: `${specialEvent.workDescription}${specialEvent.eventType && !specialEvent.workDescription.includes(specialEvent.eventType) ? ` (${specialEvent.eventType})` : ''}`,
        entryType: evEntryType,
        originalDate: null,
        adjustedDate: null,
        sourceId: specialEvent.id,
        isManualEdit: false,
        notes: specialEvent.notes || '',
      };

      if (dayHolidays && dayHolidays.length > 0) {
        const primaryHoliday = dayHolidays[0];
        const holidayMeta = resolveHolidayDisplayMeta(
          isoDate,
          primaryHoliday.name,
          primaryHoliday.holidayType,
          dayHolidays
        );
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} रोजी '${holidayMeta.name}' शासकीय सुट्टीच्या दिवशी '${specialEvent.eventType || 'विशेष कार्यक्रम'}' (${specialEvent.location}) ची नोंद दैनंदिनीत घेतली आहे.`,
        });
        if (matchedSchedule) {
          displacedSchedules.push({
            originalDayIndex: idx,
            originalDate: isoDate,
            reasonLabel: `${holidayMeta.name} सुट्टी व ${specialEvent.eventType || 'विशेष कार्यक्रम'}`,
            schedule: matchedSchedule,
          });
        }
      } else if (dow === 0) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} (रविवार सुट्टी) रोजी '${specialEvent.eventType || 'विशेष कार्यक्रम'}' (${specialEvent.location}) ची नोंद दैनंदिनीत घेतली आहे.`,
        });
      } else if (matchedSchedule) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} रोजी ${specialEvent.eventType || 'विशेष कार्यक्रम'} असल्यामुळे '${matchedSchedule.villageName}' या नियमित कार्यक्रमाऐवजी प्राधान्य दिले आहे.`,
        });
      }

      for (const mRule of dayMeetings) {
        displacedMeetings.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: specialEvent.eventType || 'विशेष कार्यक्रम',
          rule: mRule,
        });
      }
      continue;
    }

    // 3) Sunday (Weekly Holiday) — कोठे: भादा मुख्यालय
    if (dow === 0) {
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: 'भादा मुख्यालय',
        workDescription: 'रविवार (साप्ताहिक सुट्टी)',
        entryType: 'sunday',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
      for (const mRule of dayMeetings) {
        displacedMeetings.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: 'रविवार',
          rule: mRule,
        });
      }
      continue;
    }

    // 4) Government Holiday (specific to this year) — कोठे: भादा मुख्यालय, कामाचे स्वरूप: सुट्टीचे स्पष्ट नाव
    if (dayHolidays && dayHolidays.length > 0) {
      const primaryHoliday = dayHolidays[0];
      const holidayMeta = resolveHolidayDisplayMeta(
        isoDate,
        primaryHoliday.name,
        primaryHoliday.holidayType,
        dayHolidays
      );
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: 'भादा मुख्यालय',
        workDescription: holidayMeta.workDescription,
        entryType: 'holiday',
        originalDate: null,
        adjustedDate: null,
        sourceId: primaryHoliday.id,
        isManualEdit: false,
        notes: primaryHoliday.notes || '',
      };

      // Queue displaced regular weekly schedule for Holiday Adjustment
      if (matchedSchedule) {
        displacedSchedules.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: `${holidayMeta.name} सुट्टी`,
          schedule: matchedSchedule,
        });
      } else if (dow === 3) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} (बुधवार) रोजी '${holidayMeta.name}' शासकीय सुट्टी असल्यामुळे त्या दिवसाची बुधवार बैठक रद्द/स्थगित नोंदवली आहे.`,
        });
      }
      for (const mRule of dayMeetings) {
        displacedMeetings.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: `${holidayMeta.name} सुट्टी`,
          rule: mRule,
        });
      }
      continue;
    }

    // 4.5) Settings Recurring District/Taluka Meeting targeted to this specific day/weekday
    // 5-Day Week: All Taluka & District offices are closed on Saturday -> displace to Mon–Fri working day
    if (dayMeetings.length > 0 && dow === 6) {
      for (const mRule of dayMeetings) {
        displacedMeetings.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: 'शनिवार (५ दिवसांचा आठवडा)',
          rule: mRule,
        });
      }
    } else if (dayMeetings.length > 0) {
      const primaryRule = dayMeetings[0];
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: primaryRule.location,
        workDescription: primaryRule.workDescription,
        entryType: getMeetingEntryType(primaryRule.level),
        originalDate: null,
        adjustedDate: null,
        sourceId: primaryRule.id,
        isManualEdit: false,
        notes: primaryRule.notes || '',
      };

      // If this meeting displaced a regular weekly village session, shift the village session cleanly
      if (matchedSchedule) {
        displacedSchedules.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: primaryRule.level,
          schedule: matchedSchedule,
        });
      }
      // If multiple recurring meetings collided on the same day, shift the extra ones to a free day
      for (let m = 1; m < dayMeetings.length; m++) {
        displacedMeetings.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: primaryRule.level,
          rule: dayMeetings[m],
        });
      }
      continue;
    }

    // 5) Rule 1 — Every Wednesday
    if (dow === 3) {
      const isAfter25 = day > 25;
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: settings.hqPlace || 'प्राथमिक आरोग्य केंद्र भादा मुख्यालय',
        workDescription: isAfter25
          ? 'आशा बैठक व मासिक आढावा बैठक'
          : 'साप्ताहिक बैठक व कार्यालयीन कामकाज (आठवडी बैठक)',
        entryType: isAfter25 ? 'wednesday_asha' : 'wednesday_weekly',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
      continue;
    }

    // 6) Rule 5 — Recurring Weekly Schedule (Mon, Tue, Thu, Fri, Sat)
    if (matchedSchedule) {
      const prevSessionDate = findPreviousMonthSessionDate(matchedSchedule);
      if (prevSessionDate && daysBetweenIso(prevSessionDate, isoDate) < 28) {
        // Same session has not completed minimum 28 days since previous month's session -> shift to nearest valid free day
        displacedSchedules.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          reasonLabel: 'किमान २८ दिवसांचे अंतर',
          schedule: matchedSchedule,
        });
      } else {
        entries[idx] = {
          serialNo: day,
          date: isoDate,
          dayOfWeek: dow,
          dayNameMarathi,
          fromPlace,
          toPlace: matchedSchedule.villageName.trim(),
          workDescription: matchedSchedule.sessionType,
          entryType: 'weekly_schedule',
          originalDate: null,
          adjustedDate: null,
          sourceId: matchedSchedule.id,
          isManualEdit: false,
          notes: matchedSchedule.notes || '',
        };
      }
    }
  }

  // Pass 2: Session Adjustment — pick nearest previous or next non-session, non-holiday, non-leave day
  // (free working day preferred at same distance; meeting day is ALSO allowed!)
  // strictly satisfying >= 28 days gap from previous month's same session (zero adjustment text inside diary!)
  const direction = settings.holidayAdjustmentDirection || 'next';
  for (const item of displacedSchedules) {
    const prevSessionDate = findPreviousMonthSessionDate(item.schedule);
    let targetIdx = -1;

    for (let dist = 1; dist < daysInMonth; dist++) {
      const prevCand = item.originalDayIndex - dist;
      const nextCand = item.originalDayIndex + dist;
      const orderedCandidates =
        direction === 'previous' ? [prevCand, nextCand] : [nextCand, prevCand];

      // First prefer a completely empty day at this distance
      for (const candIdx of orderedCandidates) {
        if (candIdx < 0 || candIdx >= daysInMonth) continue;
        if (entries[candIdx] !== null) continue;

        const candIso = toIsoDate(year, month, candIdx + 1);
        if (prevSessionDate && daysBetweenIso(prevSessionDate, candIso) < 28) continue;

        targetIdx = candIdx;
        break;
      }
      if (targetIdx !== -1) break;

      // Second: a meeting day (Wednesday / District / Taluka / Subcenter meeting) is ALSO allowed!
      for (const candIdx of orderedCandidates) {
        if (candIdx < 0 || candIdx >= daysInMonth) continue;
        const existingAtCand = entries[candIdx];
        if (!existingAtCand || existingAtCand.isManualEdit) continue;
        if (!isMeetingEntryType(existingAtCand.entryType)) continue;

        const candIso = toIsoDate(year, month, candIdx + 1);
        if (prevSessionDate && daysBetweenIso(prevSessionDate, candIso) < 28) continue;

        targetIdx = candIdx;
        break;
      }
      if (targetIdx !== -1) break;
    }

    if (targetIdx !== -1) {
      const targetDay = targetIdx + 1;
      const adjustedIso = toIsoDate(year, month, targetDay);
      const targetDow = new Date(year, month - 1, targetDay).getDay();

      // If this slot held a targeted recurring District/Taluka meeting, shift that meeting to a free day in Pass 2.5
      const displacedExisting = entries[targetIdx];
      if (
        displacedExisting &&
        displacedExisting.sourceId &&
        meetingRuleById.has(displacedExisting.sourceId)
      ) {
        const rule = meetingRuleById.get(displacedExisting.sourceId)!;
        displacedMeetings.push({
          originalDayIndex: targetIdx,
          originalDate: adjustedIso,
          reasonLabel: item.schedule.villageName,
          rule,
        });
      }

      entries[targetIdx] = {
        serialNo: targetDay,
        date: adjustedIso,
        dayOfWeek: targetDow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[targetDow],
        fromPlace,
        toPlace: item.schedule.villageName.trim(),
        workDescription: item.schedule.sessionType,
        entryType: 'adjusted_schedule',
        originalDate: null,
        adjustedDate: null,
        sourceId: item.schedule.id,
        isManualEdit: false,
        notes: item.schedule.notes || '',
      };
    } else {
      warnings.push({
        date: item.originalDate,
        severity: 'warning',
        message: `चेतावणी: '${item.schedule.villageName}' येथील आरोग्य सेवा सत्रासाठी मागील महिन्यापासून किमान २८ दिवसांचे अंतर पूर्ण करणारा रिक्त कामकाजाचा दिवस या महिन्यात उपलब्ध होऊ शकला नाही. कृपया मॅन्युअल संपादन करा.`,
      });
    }
  }

  // Pass 2.5: Adjust displaced targeted recurring District/Taluka meetings to nearest Mon–Fri free working day (5-day week)
  for (const dm of displacedMeetings) {
    let targetIdx = -1;
    for (let dist = 1; dist < daysInMonth; dist++) {
      const prevCand = dm.originalDayIndex - dist;
      const nextCand = dm.originalDayIndex + dist;
      const orderedCandidates =
        direction === 'previous' ? [prevCand, nextCand] : [nextCand, prevCand];

      for (const candIdx of orderedCandidates) {
        if (candIdx < 0 || candIdx >= daysInMonth) continue;
        if (entries[candIdx] !== null) continue;
        if (!isFiveDayOfficeOpen(candIdx)) continue;
        targetIdx = candIdx;
        break;
      }
      if (targetIdx !== -1) break;
    }

    if (targetIdx !== -1) {
      const targetDay = targetIdx + 1;
      const adjustedIso = toIsoDate(year, month, targetDay);
      const targetDow = new Date(year, month - 1, targetDay).getDay();
      entries[targetIdx] = {
        serialNo: targetDay,
        date: adjustedIso,
        dayOfWeek: targetDow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[targetDow],
        fromPlace,
        toPlace: dm.rule.location,
        workDescription: dm.rule.workDescription,
        entryType: getMeetingEntryType(dm.rule.level),
        originalDate: null,
        adjustedDate: null,
        sourceId: dm.rule.id,
        isManualEdit: false,
        notes: dm.rule.notes || '',
      };
    } else {
      warnings.push({
        date: dm.originalDate,
        severity: 'warning',
        message: `चेतावणी: या महिन्यात रिक्त कामकाजाचा दिवस उपलब्ध नसल्यामुळे '${dm.rule.level}' (${dm.rule.location}) समाविष्ट करता आली नाही. कृपया मॅन्युअल समायोजन करा.`,
      });
    }
  }

  // Helper to get remaining free working day indices
  const getFreeDayIndices = (): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      if (entries[i] === null) indices.push(i);
    }
    return indices;
  };

  // Pass 3A: Schedule Settings recurring 'free_working_day' District / Taluka meetings (Mon–Fri only, 5-day week)
  for (const rule of freeDayMeetingRules) {
    const alreadyPlaced = entries.some((e) => e?.sourceId === rule.id);
    if (alreadyPlaced) continue;

    const free = getFreeDayIndices().filter(isFiveDayOfficeOpen);
    if (free.length > 0) {
      const startPref = rule.preferredStartDay || 10;
      const endPref = rule.preferredEndDay || 25;
      const preferred =
        free.find((idx) => idx + 1 >= startPref && idx + 1 <= endPref) ??
        free[Math.floor(free.length / 2)];
      const day = preferred + 1;
      const isoDate = toIsoDate(year, month, day);
      const dow = new Date(year, month - 1, day).getDay();
      entries[preferred] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
        fromPlace,
        toPlace: rule.location,
        workDescription: rule.workDescription,
        entryType: getMeetingEntryType(rule.level),
        originalDate: null,
        adjustedDate: null,
        sourceId: rule.id,
        isManualEdit: false,
        notes: rule.notes || '',
      };
    } else {
      warnings.push({
        date: toIsoDate(year, month, 1),
        severity: 'warning',
        message: `चेतावणी: या महिन्यात रिक्त कामकाजाचा दिवस उपलब्ध नसल्यामुळे '${rule.level}' (${rule.location}) आपोआप समाविष्ट करता आली नाही. कृपया मॅन्युअल समायोजन करा.`,
      });
    }
  }

  // Check if Taluka or Subcenter meetings were already placed (via Settings meeting rule, specific date, or manual edit)
  const hasTalukaMeeting = entries.some((e) => e?.entryType === 'taluka_meeting');
  const subcenter1Place = settings.subcenterMeeting1Place || 'उपकेंद्र आलमला';
  const subcenter2Place = settings.subcenterMeeting2Place || 'उपकेंद्र लखनगाव';
  const hasSubcenter1 = entries.some(
    (e) => e?.entryType === 'subcenter_meeting' && e.toPlace.includes(subcenter1Place)
  );
  const hasSubcenter2 = entries.some(
    (e) => e?.entryType === 'subcenter_meeting' && e.toPlace.includes(subcenter2Place)
  );

  // Pass 3B: Rule 2 — Default Taluka Review Meeting (1 Mon–Fri free working day/month, 5-day week)
  if (!hasTalukaMeeting) {
    const free = getFreeDayIndices().filter(isFiveDayOfficeOpen);
    if (free.length > 0) {
      const preferred = free.find((idx) => idx + 1 >= 15 && idx + 1 <= 26) ?? free[Math.floor(free.length / 2)];
      const day = preferred + 1;
      const isoDate = toIsoDate(year, month, day);
      const dow = new Date(year, month - 1, day).getDay();
      entries[preferred] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
        fromPlace,
        toPlace:
          talukaHq.record && talukaCityName
            ? `तालुका आरोग्य अधिकारी कार्यालय, ${talukaCityName}`
            : settings.talukaMeetingPlace || `तालुका आरोग्य अधिकारी कार्यालय, ${talukaCityName}`,
        workDescription: 'तालुकास्तरीय आढावा बैठक',
        entryType: 'taluka_meeting',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
    } else {
      warnings.push({
        date: toIsoDate(year, month, 1),
        severity: 'warning',
        message: 'चेतावणी: या महिन्यात रिक्त कामकाजाचा दिवस उपलब्ध नसल्यामुळे तालुकास्तरीय आढावा बैठक आपोआप समाविष्ट करता आली नाही. कृपया मॅन्युअल समायोजन करा.',
      });
    }
  }

  // Pass 4: Rule 3 — Subcenter Meetings (2 separate free working days: आलमला & लखनगाव)
  if (!hasSubcenter1) {
    const free = getFreeDayIndices();
    if (free.length > 0) {
      const chosen = free.find((idx) => idx + 1 >= 5 && idx + 1 <= 18) ?? free[0];
      const day = chosen + 1;
      const isoDate = toIsoDate(year, month, day);
      const dow = new Date(year, month - 1, day).getDay();
      entries[chosen] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
        fromPlace,
        toPlace: subcenter1Place,
        workDescription: 'उपकेंद्रस्तरीय बैठक',
        entryType: 'subcenter_meeting',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
    } else {
      warnings.push({
        date: toIsoDate(year, month, 1),
        severity: 'warning',
        message: `चेतावणी: रिक्त कामकाजाचा दिवस उपलब्ध नसल्यामुळे '${subcenter1Place}' येथील उपकेंद्रस्तरीय बैठक समाविष्ट होऊ शकली नाही.`,
      });
    }
  }

  if (!hasSubcenter2) {
    const free = getFreeDayIndices();
    if (free.length > 0) {
      const chosen = free.find((idx) => idx + 1 >= 12 && idx + 1 <= 27) ?? free[0];
      const day = chosen + 1;
      const isoDate = toIsoDate(year, month, day);
      const dow = new Date(year, month - 1, day).getDay();
      entries[chosen] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
        fromPlace,
        toPlace: subcenter2Place,
        workDescription: 'उपकेंद्रस्तरीय बैठक',
        entryType: 'subcenter_meeting',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
    } else {
      warnings.push({
        date: toIsoDate(year, month, 1),
        severity: 'warning',
        message: `चेतावणी: रिक्त कामकाजाचा दिवस उपलब्ध नसल्यामुळे '${subcenter2Place}' येथील उपकेंद्रस्तरीय बैठक समाविष्ट होऊ शकली नाही.`,
      });
    }
  }

  // Pass 4.5: Randomly add 3 to 4 visits per month to District HQ City for blood sample submission
  // (जिल्हा हिवताप अधिकारी कार्यालय) or water bacteriological sample submission
  // (जिल्हा आरोग्य प्रयोगशाळा) on remaining Mon–Fri free working days (5-day week).
  const LATUR_SAMPLE_VISITS = [
    {
      toPlace: `जिल्हा हिवताप अधिकारी कार्यालय, ${districtCityName}`,
      workDescription: 'रक्त नमुने जमा करणे',
    },
    {
      toPlace: `जिल्हा आरोग्य प्रयोगशाळा, ${districtCityName}`,
      workDescription: 'पाणी नमुने अनुजीव तपासणीसाठी जमा करणे',
    },
  ] as const;

  const existingLaturCount = entries.filter(
    (e) =>
      e !== null &&
      (e.entryType === 'lab_sample_visit' ||
        e.workDescription.includes('रक्त नमुने जमा करणे') ||
        e.workDescription.includes('पाणी नमुने अनुजीव तपासणीसाठी'))
  ).length;

  const desiredTotalLaturVisits = Math.random() < 0.5 ? 3 : 4;
  const remainingNeeded = Math.max(0, desiredTotalLaturVisits - existingLaturCount);

  if (remainingNeeded > 0) {
    // Strict 5-Day Week: All District offices (Latur) are closed on ALL Saturdays and Sundays (Mon–Fri only)
    const candidatePool = getFreeDayIndices().filter(isFiveDayOfficeOpen);
    if (candidatePool.length > 0) {
      const visitsToPlace = Math.min(remainingNeeded, candidatePool.length);

      // Spread selected days across the month by dividing candidates into buckets and picking randomly in each bucket
      const selectedIndices: number[] = [];
      for (let b = 0; b < visitsToPlace; b++) {
        const start = Math.floor((b * candidatePool.length) / visitsToPlace);
        const end = Math.floor(((b + 1) * candidatePool.length) / visitsToPlace);
        const bucket = candidatePool.slice(start, Math.max(start + 1, end));
        const pick = bucket[Math.floor(Math.random() * bucket.length)];
        if (pick !== undefined && !selectedIndices.includes(pick)) {
          selectedIndices.push(pick);
        }
      }

      // Build balanced yet randomized list of Blood / Water sample visits (ensuring both types appear when >= 2 visits)
      const chosenTasks: (typeof LATUR_SAMPLE_VISITS)[number][] = [];
      if (selectedIndices.length === 1) {
        chosenTasks.push(LATUR_SAMPLE_VISITS[Math.random() < 0.5 ? 0 : 1]);
      } else if (selectedIndices.length >= 2) {
        chosenTasks.push(LATUR_SAMPLE_VISITS[0], LATUR_SAMPLE_VISITS[1]);
        for (let k = 2; k < selectedIndices.length; k++) {
          chosenTasks.push(LATUR_SAMPLE_VISITS[Math.random() < 0.5 ? 0 : 1]);
        }
        // Fisher-Yates shuffle
        for (let k = chosenTasks.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          const tmp = chosenTasks[k];
          chosenTasks[k] = chosenTasks[j];
          chosenTasks[j] = tmp;
        }
      }

      for (let i = 0; i < selectedIndices.length; i++) {
        const chosenIdx = selectedIndices[i];
        const task = chosenTasks[i];
        const day = chosenIdx + 1;
        const isoDate = toIsoDate(year, month, day);
        const dow = new Date(year, month - 1, day).getDay();
        entries[chosenIdx] = {
          serialNo: day,
          date: isoDate,
          dayOfWeek: dow,
          dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
          fromPlace,
          toPlace: task.toPlace,
          workDescription: task.workDescription,
          entryType: 'lab_sample_visit',
          originalDate: null,
          adjustedDate: null,
          sourceId: null,
          isManualEdit: false,
          notes: '',
        };
      }
    }
  }

  // Pass 5: Rule 4 — All remaining working days -> PHC Bhada Office Work
  const finalEntries: MonthlyDiaryEntry[] = [];
  for (let i = 0; i < daysInMonth; i++) {
    const day = i + 1;
    const isoDate = toIsoDate(year, month, day);
    const dow = new Date(year, month - 1, day).getDay();
    if (entries[i] !== null) {
      finalEntries.push(entries[i]!);
    } else {
      finalEntries.push({
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[dow],
        fromPlace,
        toPlace: settings.officePlace || 'प्राथमिक आरोग्य केंद्र भादा',
        workDescription: 'कार्यालयीन कामकाज',
        entryType: 'office_work',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      });
    }
  }

  // Informational note if month has no Wednesday after 25th (e.g. June 2026, Feb 2027)
  const hasAshaWednesday = finalEntries.some((e) => e.entryType === 'wednesday_asha');
  if (!hasAshaWednesday) {
    warnings.push({
      date: toIsoDate(year, month, daysInMonth),
      severity: 'info',
      message: `नोंद: ${makeMonthLabelMarathi(year, month)} मध्ये 25 तारखेनंतर बुधवार येत नाही (किंवा त्या दिवशी सुट्टी/रजा आहे). आवश्यक असल्यास शेवटच्या बुधवारी 'आशा बैठक व मासिक आढावा बैठक' मॅन्युअली संपादित करू शकता.`,
    });
  }

  const now = new Date().toISOString();
  const summary = computeDiarySummary(finalEntries);

  return {
    id: makeMonthId(year, month),
    year,
    month,
    monthLabelMarathi: makeMonthLabelMarathi(year, month),
    sheetName: makeMonthSheetName(year, month),
    employeeName: employee.fullName,
    designation: employee.designation,
    officeName: employee.officeName,
    entries: finalEntries,
    warnings,
    summary,
    hasManualEdits: finalEntries.some((e) => e.isManualEdit),
    createdAt: now,
    updatedAt: now,
  };
}
