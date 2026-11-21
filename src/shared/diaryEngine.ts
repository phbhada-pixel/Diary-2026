import type {
  ApplicationSettings,
  DiaryWarning,
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  MonthlyDiarySummary,
  SpecialEventMaster,
  WeeklyScheduleMaster,
} from './types.ts';
import {
  dayIndexToWeekdayKey,
  formatDateDDMMYYYY,
  makeMonthId,
  makeMonthLabelMarathi,
  makeMonthSheetName,
  MARATHI_DAYS_BY_INDEX,
} from './marathi.ts';

interface GenerateDiaryInput {
  year: number;
  month: number; // 1..12
  employee: EmployeeMaster;
  weeklySchedules: WeeklyScheduleMaster[];
  holidays: GovernmentHolidayMaster[];
  leaves: LeaveRecord[];
  specialEvents: SpecialEventMaster[];
  settings: ApplicationSettings;
  existingEntries?: MonthlyDiaryEntry[];
  preserveManualEdits?: boolean;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
    weeklySchedules,
    holidays,
    leaves,
    specialEvents,
    settings,
    existingEntries = [],
    preserveManualEdits = true,
  } = input;

  const daysInMonth = new Date(year, month, 0).getDate();
  const warnings: DiaryWarning[] = [];
  const fromPlace = settings.defaultFromPlace || 'भादा';

  // Index manual edits from existing diary if preserving manual changes
  const manualMap = new Map<string, MonthlyDiaryEntry>();
  if (preserveManualEdits) {
    for (const row of existingEntries) {
      if (row.isManualEdit) {
        manualMap.set(row.date, { ...row });
      }
    }
  }

  // Filter holidays strictly for THIS year only (never apply another year's holidays)
  const holidayByDate = new Map<string, GovernmentHolidayMaster>();
  for (const h of holidays) {
    const hYear = Number(h.year) || Number(h.date.slice(0, 4));
    if (hYear === year) {
      holidayByDate.set(h.date, h);
    }
  }

  // Index special events by date for this month
  const specialEventByDate = new Map<string, SpecialEventMaster>();
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const ev of specialEvents) {
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

  // Displaced schedules caused by Government Holidays (need adjustment)
  interface DisplacedSchedule {
    originalDayIndex: number; // 0-based index in entries
    originalDate: string;
    holidayName: string;
    schedule: WeeklyScheduleMaster;
  }
  const displacedSchedules: DisplacedSchedule[] = [];

  // Pass 1: Assign fixed-priority days: Manual Edits, Sundays, Holidays, Leaves, Special Events, Wednesdays, and Weekly Schedules
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
      continue;
    }

    // 1) Sunday
    if (dow === 0) {
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: 'साप्ताहिक सुट्टी (रविवार)',
        workDescription: 'रविवार (साप्ताहिक सुट्टी)',
        entryType: 'sunday',
        originalDate: null,
        adjustedDate: null,
        sourceId: null,
        isManualEdit: false,
        notes: '',
      };
      continue;
    }

    // 2) Government Holiday (specific to this year)
    const holiday = holidayByDate.get(isoDate);
    if (holiday) {
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: 'शासकीय सुट्टी',
        workDescription: `शासकीय सुट्टी — ${holiday.name}${holiday.holidayType ? ` (${holiday.holidayType})` : ''}`,
        entryType: 'holiday',
        originalDate: null,
        adjustedDate: null,
        sourceId: holiday.id,
        isManualEdit: false,
        notes: holiday.notes || '',
      };

      // Queue displaced regular weekly schedule for Holiday Adjustment
      if (matchedSchedule) {
        displacedSchedules.push({
          originalDayIndex: idx,
          originalDate: isoDate,
          holidayName: holiday.name,
          schedule: matchedSchedule,
        });
      } else if (dow === 3) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} (बुधवार) रोजी '${holiday.name}' शासकीय सुट्टी असल्यामुळे त्या दिवसाची बुधवार बैठक रद्द/स्थगित नोंदवली आहे.`,
        });
      }
      continue;
    }

    // 3) Employee Leave — highest priority on working days; NEVER show regular program
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
      if (matchedSchedule) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} रोजी कर्मचाऱ्याची रजा असल्यामुळे '${matchedSchedule.villageName}' येथील नियमित सत्र रद्द करून 'रजा' नोंदवली आहे.`,
        });
      }
      continue;
    }

    // 4) Special Event — takes priority over regular schedule without destroying master schedule
    const specialEvent = specialEventByDate.get(isoDate);
    if (specialEvent) {
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace: specialEvent.location,
        workDescription: `${specialEvent.workDescription}${specialEvent.eventType && !specialEvent.workDescription.includes(specialEvent.eventType) ? ` (${specialEvent.eventType})` : ''}`,
        entryType: 'special_event',
        originalDate: null,
        adjustedDate: null,
        sourceId: specialEvent.id,
        isManualEdit: false,
        notes: specialEvent.notes || '',
      };
      if (matchedSchedule) {
        warnings.push({
          date: isoDate,
          severity: 'info',
          message: `दिनांक ${formatDateDDMMYYYY(isoDate)} रोजी विशेष कार्यक्रम असल्यामुळे '${matchedSchedule.villageName}' या नियमित कार्यक्रमाऐवजी विशेष कार्यक्रमाला प्राधान्य दिले आहे.`,
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
      const subLabel = matchedSchedule.subcenterName
        ? matchedSchedule.subcenterName.startsWith('उपकेंद्र')
          ? matchedSchedule.subcenterName
          : `उपकेंद्र ${matchedSchedule.subcenterName}`
        : '';
      const toPlace = subLabel
        ? `${matchedSchedule.villageName} (${subLabel})`
        : matchedSchedule.villageName;
      entries[idx] = {
        serialNo: day,
        date: isoDate,
        dayOfWeek: dow,
        dayNameMarathi,
        fromPlace,
        toPlace,
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

  // Pass 2: Holiday Adjustment — shift displaced weekly schedules to next or previous free working day
  const direction = settings.holidayAdjustmentDirection || 'next';
  for (const item of displacedSchedules) {
    let targetIdx = -1;

    if (direction === 'next') {
      for (let i = item.originalDayIndex + 1; i < daysInMonth; i++) {
        if (entries[i] === null) {
          targetIdx = i;
          break;
        }
      }
    } else {
      for (let i = item.originalDayIndex - 1; i >= 0; i--) {
        if (entries[i] === null) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx !== -1) {
      const targetDay = targetIdx + 1;
      const adjustedIso = toIsoDate(year, month, targetDay);
      const targetDow = new Date(year, month - 1, targetDay).getDay();
      const subLabel = item.schedule.subcenterName
        ? item.schedule.subcenterName.startsWith('उपकेंद्र')
          ? item.schedule.subcenterName
          : `उपकेंद्र ${item.schedule.subcenterName}`
        : '';
      const toPlace = subLabel
        ? `${item.schedule.villageName} (${subLabel})`
        : item.schedule.villageName;

      entries[targetIdx] = {
        serialNo: targetDay,
        date: adjustedIso,
        dayOfWeek: targetDow,
        dayNameMarathi: MARATHI_DAYS_BY_INDEX[targetDow],
        fromPlace,
        toPlace,
        workDescription: `${item.schedule.sessionType} (दि. ${formatDateDDMMYYYY(item.originalDate)} च्या सुट्टीमुळे समायोजित)`,
        entryType: 'adjusted_schedule',
        originalDate: item.originalDate,
        adjustedDate: adjustedIso,
        sourceId: item.schedule.id,
        isManualEdit: false,
        notes: `मूळ नियोजित तारीख: ${formatDateDDMMYYYY(item.originalDate)} (${item.holidayName} सुट्टी)`,
      };

      warnings.push({
        date: adjustedIso,
        severity: 'info',
        message: `दिनांक ${formatDateDDMMYYYY(item.originalDate)} रोजी '${item.holidayName}' सुट्टी असल्यामुळे '${item.schedule.villageName}' येथील सत्र दिनांक ${formatDateDDMMYYYY(adjustedIso)} रोजी समायोजित केले आहे.`,
      });
    } else {
      warnings.push({
        date: item.originalDate,
        severity: 'warning',
        message: `चेतावणी: दिनांक ${formatDateDDMMYYYY(item.originalDate)} रोजी '${item.holidayName}' सुट्टीमुळे बाधित झालेले '${item.schedule.villageName}' येथील सत्र ${direction === 'next' ? 'पुढील' : 'मागील'} दिशेने कोणत्याही रिक्त कामकाजाच्या दिवशी समायोजित होऊ शकले नाही. कृपया सेटिंग्जमधील दिशा बदला किंवा मॅन्युअल समायोजन करा.`,
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

  // Check if Taluka or Subcenter meetings were already preserved via manual edits
  const hasTalukaMeeting = entries.some((e) => e?.entryType === 'taluka_meeting');
  const subcenter1Place = settings.subcenterMeeting1Place || 'उपकेंद्र आलमला';
  const subcenter2Place = settings.subcenterMeeting2Place || 'उपकेंद्र लखनगाव';
  const hasSubcenter1 = entries.some(
    (e) => e?.entryType === 'subcenter_meeting' && e.toPlace.includes(subcenter1Place)
  );
  const hasSubcenter2 = entries.some(
    (e) => e?.entryType === 'subcenter_meeting' && e.toPlace.includes(subcenter2Place)
  );

  // Pass 3: Rule 2 — Taluka Review Meeting (1 free working day per month, prefer mid/late month 15th..26th)
  if (!hasTalukaMeeting) {
    const free = getFreeDayIndices();
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
        toPlace: settings.talukaMeetingPlace || 'तालुका आरोग्य अधिकारी कार्यालय, औसा',
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
