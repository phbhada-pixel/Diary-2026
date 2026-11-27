import type {
  ApplicationSettings,
  DiaryChangeHistoryRecord,
  DiaryEntryType,
  DiaryWarning,
  EmployeeMaster,
  GovernmentHolidayMaster,
  HolidayAdjustmentDirection,
  LeaveRecord,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
  WeekdayKey,
  WeeklyScheduleMaster,
  WeekOccurrence,
} from '../shared/types.ts';
import {
  ENTRY_TYPE_LABELS,
  formatDateDDMMYYYY,
  getWeekdayLabel,
  getWeekOccurrenceLabel,
  MARATHI_DAYS_BY_INDEX,
} from '../shared/marathi.ts';
import { computeDiarySummary } from '../shared/diaryEngine.ts';
export const APP_SPREADSHEET_TITLE = 'PHC_Bhada_Monthly_Tour_Diary_DB';

export const DEFAULT_EMPLOYEE_DATA: Omit<EmployeeMaster, 'updatedAt'> = {
  id: 'emp_primary',
  fullName: 'श्री. हिप्परगेकर जी. एस.',
  designation: 'आरोग्य सहाय्यक',
  officeName: 'प्राथमिक आरोग्य केंद्र भादा',
  headquarters: 'भादा',
  email: 'phbhada@gmail.com',
  mobile: '',
  implementationDate: '2026-04-01',
};

export const DEFAULT_SETTINGS_DATA: Omit<ApplicationSettings, 'updatedAt'> = {
  id: 'settings_primary',
  holidayAdjustmentDirection: 'next',
  defaultFromPlace: 'भादा',
  implementationDate: '2026-04-01',
  financialYearStartMonth: 4,
  hqPlace: 'प्राथमिक आरोग्य केंद्र भादा मुख्यालय',
  officePlace: 'प्राथमिक आरोग्य केंद्र भादा',
  talukaMeetingPlace: 'तालुका आरोग्य अधिकारी कार्यालय, औसा',
  subcenterMeeting1Place: 'उपकेंद्र आलमला',
  subcenterMeeting2Place: 'उपकेंद्र लखनगाव',
};

export const SHEET_NAMES = {
  Employee_Master: 'Employee_Master',
  Subcenter_Master: 'Subcenter_Master',
  Village_Master: 'Village_Master',
  Weekly_Schedule_Master: 'Weekly_Schedule_Master',
  Government_Holiday_Master: 'Government_Holiday_Master',
  Leave_Management: 'Leave_Management',
  Special_Event_Master: 'Special_Event_Master',
  Monthly_Diary: 'Monthly_Diary',
  Diary_Change_History: 'Diary_Change_History',
  Application_Settings: 'Application_Settings',
} as const;

export type MasterSheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export const ALL_MASTER_SHEETS: MasterSheetName[] = [
  SHEET_NAMES.Employee_Master,
  SHEET_NAMES.Subcenter_Master,
  SHEET_NAMES.Village_Master,
  SHEET_NAMES.Weekly_Schedule_Master,
  SHEET_NAMES.Government_Holiday_Master,
  SHEET_NAMES.Leave_Management,
  SHEET_NAMES.Special_Event_Master,
  SHEET_NAMES.Monthly_Diary,
  SHEET_NAMES.Diary_Change_History,
  SHEET_NAMES.Application_Settings,
];

/**
 * Exact hardcoded column headers for all 10 Master Sheets.
 * Column A is ALWAYS Unique_ID for deterministic deduplication, lookup, update, and deletion.
 */
export const SHEET_HEADERS: Record<MasterSheetName, string[]> = {
  Employee_Master: [
    'Unique_ID',
    'कर्मचाऱ्याचे नाव',
    'पदनाम',
    'कार्यालय',
    'मुख्यालय',
    'ई-मेल',
    'मोबाईल',
    'अंमलबजावणी दिनांक (ISO)',
    'अंमलबजावणी दिनांक',
    'अद्ययावत दिनांक',
  ],
  Subcenter_Master: [
    'Unique_ID',
    'उपकेंद्राचे नाव',
    'ठिकाण',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Village_Master: [
    'Unique_ID',
    'गावाचे नाव',
    'उपकेंद्र ID',
    'उपकेंद्राचे नाव',
    'लोकसंख्या',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Weekly_Schedule_Master: [
    'Unique_ID',
    'Weekday_Key',
    'वार',
    'आठवड्याचा क्रमांक',
    'आठवडा लेबल',
    'गाव ID',
    'गावाचे नाव',
    'उपकेंद्राचे नाव',
    'आरोग्य सेवा सत्राचे स्वरूप',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Government_Holiday_Master: [
    'Unique_ID',
    'वर्ष',
    'तारीख (ISO)',
    'सुट्टीची तारीख',
    'सुट्टीचे नाव',
    'सुट्टीचा प्रकार',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Leave_Management: [
    'Unique_ID',
    'रजेचा प्रकार',
    'सुरुवात (ISO)',
    'समाप्ती (ISO)',
    'सुरुवातीचा दिनांक',
    'समाप्तीचा दिनांक',
    'एकूण दिवस',
    'रजेचे कारण',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Special_Event_Master: [
    'Unique_ID',
    'तारीख (ISO)',
    'दिनांक',
    'कार्यक्रमाचा प्रकार',
    'कोठे',
    'कामाचे स्वरूप',
    'टिप्पणी',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Monthly_Diary: [
    'Unique_ID',
    'वर्ष',
    'महिना',
    'महिना व वर्ष',
    'Sheet_Name',
    'कर्मचारी नाव',
    'पदनाम',
    'कार्यालय',
    'एकूण दिवस',
    'कामकाजाचे दिवस',
    'रविवार',
    'शासकीय सुट्ट्या',
    'रजा',
    'विशेष कार्यक्रम',
    'मॅन्युअल बदल',
    'Warnings_JSON',
    'निर्मिती दिनांक',
    'अद्ययावत दिनांक',
  ],
  Diary_Change_History: [
    'Unique_ID',
    'दिनांक व वेळ',
    'विभाग',
    'नोंद ID',
    'कृती',
    'तपशील',
    'जुनी माहिती',
    'नवीन माहिती',
  ],
  Application_Settings: [
    'Unique_ID',
    'सुट्टी समायोजन दिशा',
    'कोठून (मुख्यालय)',
    'अंमलबजावणी दिनांक',
    'आर्थिक वर्ष सुरुवात महिना',
    'मुख्यालय नाव',
    'कार्यालय नाव',
    'तालुका बैठक ठिकाण',
    'उपकेंद्र बैठक १',
    'उपकेंद्र बैठक २',
    'अद्ययावत दिनांक',
  ],
};

export const MONTHLY_SHEET_TABLE_HEADERS = [
  'अनुक्रमांक',
  'दिनांक',
  'वार',
  'कोठून',
  'कोठे',
  'कामाचे स्वरूप',
  'प्रकार',
  'मूळ नियोजित तारीख',
  'समायोजित तारीख',
  'मॅन्युअल संपादन',
  'टिप्पणी',
  'Date_ISO',
  'Entry_Type_Key',
  'Original_Date_ISO',
  'Adjusted_Date_ISO',
  'Source_ID',
];

function cell(row: string[], index: number): string {
  return (row[index] ?? '').toString();
}

// ============================================================================
// Bidirectional Row Mappers (Object <-> Google Sheets Row)
// ============================================================================

export function employeeToRow(e: EmployeeMaster): string[] {
  return [
    e.id,
    e.fullName,
    e.designation,
    e.officeName,
    e.headquarters,
    e.email,
    e.mobile || '',
    e.implementationDate,
    formatDateDDMMYYYY(e.implementationDate),
    e.updatedAt,
  ];
}

export function rowToEmployee(row: string[]): EmployeeMaster {
  const id = cell(row, 0).trim() || DEFAULT_EMPLOYEE_DATA.id;
  const fullName = cell(row, 1).trim() || DEFAULT_EMPLOYEE_DATA.fullName;
  const designation = cell(row, 2).trim() || DEFAULT_EMPLOYEE_DATA.designation;
  const officeName = cell(row, 3).trim() || DEFAULT_EMPLOYEE_DATA.officeName;
  const headquarters = cell(row, 4).trim() || DEFAULT_EMPLOYEE_DATA.headquarters;
  const email = cell(row, 5).trim() || DEFAULT_EMPLOYEE_DATA.email;
  const mobile = cell(row, 6).trim();
  const implementationDate = cell(row, 7).trim() || DEFAULT_EMPLOYEE_DATA.implementationDate;
  const updatedAt = cell(row, 9).trim() || new Date().toISOString();

  return {
    id,
    fullName,
    designation,
    officeName,
    headquarters,
    email,
    mobile,
    implementationDate,
    updatedAt,
  };
}

export function needsEmployeeBackfill(row: string[]): boolean {
  return (
    !cell(row, 0).trim() ||
    !cell(row, 1).trim() ||
    !cell(row, 2).trim() ||
    !cell(row, 3).trim() ||
    !cell(row, 4).trim() ||
    !cell(row, 5).trim() ||
    !cell(row, 7).trim()
  );
}

export function subcenterToRow(s: SubcenterMaster): string[] {
  return [s.id, s.name, s.location, s.notes, s.createdAt, s.updatedAt];
}

export function rowToSubcenter(row: string[]): SubcenterMaster {
  return {
    id: cell(row, 0),
    name: cell(row, 1),
    location: cell(row, 2),
    notes: cell(row, 3),
    createdAt: cell(row, 4),
    updatedAt: cell(row, 5),
  };
}

export function villageToRow(v: VillageMaster): string[] {
  return [
    v.id,
    v.name,
    v.subcenterId,
    v.subcenterName,
    v.population,
    v.notes,
    v.createdAt,
    v.updatedAt,
  ];
}

export function rowToVillage(row: string[]): VillageMaster {
  return {
    id: cell(row, 0),
    name: cell(row, 1),
    subcenterId: cell(row, 2),
    subcenterName: cell(row, 3),
    population: cell(row, 4),
    notes: cell(row, 5),
    createdAt: cell(row, 6),
    updatedAt: cell(row, 7),
  };
}

export function weeklyScheduleToRow(w: WeeklyScheduleMaster): string[] {
  return [
    w.id,
    w.weekday,
    getWeekdayLabel(w.weekday),
    String(w.weekNumber),
    getWeekOccurrenceLabel(w.weekNumber),
    w.villageId,
    w.villageName,
    w.subcenterName,
    w.sessionType,
    w.notes,
    w.createdAt,
    w.updatedAt,
  ];
}

export function rowToWeeklySchedule(row: string[]): WeeklyScheduleMaster {
  return {
    id: cell(row, 0),
    weekday: cell(row, 1) as WeekdayKey,
    weekNumber: Number(cell(row, 3)) as WeekOccurrence,
    villageId: cell(row, 5),
    villageName: cell(row, 6),
    subcenterName: cell(row, 7),
    sessionType: cell(row, 8),
    notes: cell(row, 9),
    createdAt: cell(row, 10),
    updatedAt: cell(row, 11),
  };
}

export function holidayToRow(h: GovernmentHolidayMaster): string[] {
  return [
    h.id,
    String(h.year),
    h.date,
    formatDateDDMMYYYY(h.date),
    h.name,
    h.holidayType,
    h.notes,
    h.createdAt,
    h.updatedAt,
  ];
}

export function rowToHoliday(row: string[]): GovernmentHolidayMaster {
  const date = cell(row, 2).trim();
  const col3 = cell(row, 3).trim();
  const col4 = cell(row, 4).trim();
  const col5 = cell(row, 5).trim();
  const col3LooksLikeDate = /^\d{2}-\d{2}-\d{4}$/.test(col3) || /^\d{4}-\d{2}-\d{2}$/.test(col3);
  const shifted = !col3LooksLikeDate && col3.length > 0 && !col5;
  return {
    id: cell(row, 0),
    year: Number(cell(row, 1)) || Number(date.slice(0, 4)),
    date,
    name: shifted ? col3 : col4,
    holidayType: shifted ? col4 || 'सार्वजनिक सुट्टी' : col5 || 'सार्वजनिक सुट्टी',
    notes: cell(row, 6),
    createdAt: cell(row, 7),
    updatedAt: cell(row, 8),
  };
}

export function leaveToRow(l: LeaveRecord): string[] {
  return [
    l.id,
    l.leaveType,
    l.startDate,
    l.endDate,
    formatDateDDMMYYYY(l.startDate),
    formatDateDDMMYYYY(l.endDate),
    String(l.totalDays),
    l.reason,
    l.notes,
    l.createdAt,
    l.updatedAt,
  ];
}

export function rowToLeave(row: string[]): LeaveRecord {
  return {
    id: cell(row, 0),
    leaveType: cell(row, 1),
    startDate: cell(row, 2),
    endDate: cell(row, 3),
    totalDays: Number(cell(row, 6)) || 1,
    reason: cell(row, 7),
    notes: cell(row, 8),
    createdAt: cell(row, 9),
    updatedAt: cell(row, 10),
  };
}

export function specialEventToRow(ev: SpecialEventMaster): string[] {
  return [
    ev.id,
    ev.date,
    formatDateDDMMYYYY(ev.date),
    ev.eventType,
    ev.location,
    ev.workDescription,
    ev.notes,
    ev.createdAt,
    ev.updatedAt,
  ];
}

export function rowToSpecialEvent(row: string[]): SpecialEventMaster {
  return {
    id: cell(row, 0),
    date: cell(row, 1),
    eventType: cell(row, 3),
    location: cell(row, 4),
    workDescription: cell(row, 5),
    notes: cell(row, 6),
    createdAt: cell(row, 7),
    updatedAt: cell(row, 8),
  };
}

export function historyToRow(h: DiaryChangeHistoryRecord): string[] {
  return [
    h.id,
    h.changeDate,
    h.entityType,
    h.entityId,
    h.action,
    h.summary,
    h.oldData || '',
    h.newData || '',
  ];
}

export function rowToHistory(row: string[]): DiaryChangeHistoryRecord {
  return {
    id: cell(row, 0),
    changeDate: cell(row, 1),
    entityType: cell(row, 2),
    entityId: cell(row, 3),
    action: (cell(row, 4) || 'UPDATE') as DiaryChangeHistoryRecord['action'],
    summary: cell(row, 5),
    oldData: cell(row, 6) || null,
    newData: cell(row, 7) || null,
  };
}

export function settingsToRow(s: ApplicationSettings): string[] {
  return [
    s.id,
    s.holidayAdjustmentDirection,
    s.defaultFromPlace,
    s.implementationDate,
    String(s.financialYearStartMonth),
    s.hqPlace,
    s.officePlace,
    s.talukaMeetingPlace,
    s.subcenterMeeting1Place,
    s.subcenterMeeting2Place,
    s.updatedAt,
  ];
}

export function rowToSettings(row: string[]): ApplicationSettings {
  const rawDir = cell(row, 1).trim();
  const dir = rawDir === 'previous' ? 'previous' : 'next';
  return {
    id: cell(row, 0).trim() || DEFAULT_SETTINGS_DATA.id,
    holidayAdjustmentDirection: dir as HolidayAdjustmentDirection,
    defaultFromPlace: cell(row, 2).trim() || DEFAULT_SETTINGS_DATA.defaultFromPlace,
    implementationDate: cell(row, 3).trim() || DEFAULT_SETTINGS_DATA.implementationDate,
    financialYearStartMonth: Number(cell(row, 4).trim()) || DEFAULT_SETTINGS_DATA.financialYearStartMonth,
    hqPlace: cell(row, 5).trim() || DEFAULT_SETTINGS_DATA.hqPlace,
    officePlace: cell(row, 6).trim() || DEFAULT_SETTINGS_DATA.officePlace,
    talukaMeetingPlace: cell(row, 7).trim() || DEFAULT_SETTINGS_DATA.talukaMeetingPlace,
    subcenterMeeting1Place: cell(row, 8).trim() || DEFAULT_SETTINGS_DATA.subcenterMeeting1Place,
    subcenterMeeting2Place: cell(row, 9).trim() || DEFAULT_SETTINGS_DATA.subcenterMeeting2Place,
    updatedAt: cell(row, 10).trim() || new Date().toISOString(),
  };
}

export function needsSettingsBackfill(row: string[]): boolean {
  const rawDir = cell(row, 1).trim();
  return (
    !cell(row, 0).trim() ||
    (rawDir !== 'next' && rawDir !== 'previous') ||
    !cell(row, 2).trim() ||
    !cell(row, 3).trim() ||
    !cell(row, 4).trim() ||
    !cell(row, 5).trim() ||
    !cell(row, 6).trim() ||
    !cell(row, 7).trim() ||
    !cell(row, 8).trim() ||
    !cell(row, 9).trim()
  );
}

export interface MonthlyDiaryIndexMeta {
  id: string;
  year: number;
  month: number;
  monthLabelMarathi: string;
  sheetName: string;
  employeeName: string;
  designation: string;
  officeName: string;
  hasManualEdits: boolean;
  warnings: DiaryWarning[];
  createdAt: string;
  updatedAt: string;
}

export function monthlyDiaryIndexToRow(d: MonthlyDiaryDocument): string[] {
  return [
    d.id,
    String(d.year),
    String(d.month),
    d.monthLabelMarathi,
    d.sheetName,
    d.employeeName,
    d.designation,
    d.officeName,
    String(d.summary.totalDays),
    String(d.summary.workingDays),
    String(d.summary.sundays),
    String(d.summary.holidays),
    String(d.summary.leaves),
    String(d.summary.specialEvents),
    d.hasManualEdits ? 'होय' : 'नाही',
    JSON.stringify(d.warnings || []),
    d.createdAt,
    d.updatedAt,
  ];
}

export function rowToMonthlyDiaryIndex(row: string[]): MonthlyDiaryIndexMeta {
  let warnings: DiaryWarning[] = [];
  try {
    warnings = JSON.parse(cell(row, 15) || '[]');
  } catch {
    warnings = [];
  }
  return {
    id: cell(row, 0),
    year: Number(cell(row, 1)),
    month: Number(cell(row, 2)),
    monthLabelMarathi: cell(row, 3),
    sheetName: cell(row, 4),
    employeeName: cell(row, 5),
    designation: cell(row, 6),
    officeName: cell(row, 7),
    hasManualEdits: cell(row, 14) === 'होय',
    warnings,
    createdAt: cell(row, 16),
    updatedAt: cell(row, 17),
  };
}

/**
 * Formats an individual month sheet (e.g., April_2026, May_2026) with official title header + full daily entries.
 */
export function buildMonthlyDiarySheetValues(doc: MonthlyDiaryDocument): string[][] {
  const rows: string[][] = [
    ['मासिक दौरा दैनंदिनी'],
    [`${doc.designation} ${doc.employeeName}`],
    [doc.officeName],
    [`महिना: ${doc.monthLabelMarathi}`],
    [],
    MONTHLY_SHEET_TABLE_HEADERS,
  ];

  for (const entry of doc.entries) {
    rows.push([
      String(entry.serialNo),
      formatDateDDMMYYYY(entry.date),
      entry.dayNameMarathi,
      entry.fromPlace,
      entry.toPlace,
      entry.workDescription,
      ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType,
      entry.originalDate ? formatDateDDMMYYYY(entry.originalDate) : '',
      entry.adjustedDate ? formatDateDDMMYYYY(entry.adjustedDate) : '',
      entry.isManualEdit ? 'होय' : 'नाही',
      entry.notes || '',
      entry.date,
      entry.entryType,
      entry.originalDate || '',
      entry.adjustedDate || '',
      entry.sourceId || '',
    ]);
  }

  return rows;
}

/**
 * Reconstructs a full MonthlyDiaryDocument from its Monthly_Diary index row and its individual month tab rows (starting at row 7).
 */
export function parseMonthlyDiaryFromSheet(
  meta: MonthlyDiaryIndexMeta,
  entryRows: string[][]
): MonthlyDiaryDocument {
  const entries: MonthlyDiaryEntry[] = [];

  for (const row of entryRows) {
    const serial = Number(cell(row, 0));
    const dateIso = cell(row, 11);
    if (!serial || !dateIso) continue;

    const dateObj = new Date(`${dateIso}T00:00:00`);
    const dow = Number.isNaN(dateObj.getTime()) ? 0 : dateObj.getDay();

    entries.push({
      serialNo: serial,
      date: dateIso,
      dayOfWeek: dow,
      dayNameMarathi: cell(row, 2) || MARATHI_DAYS_BY_INDEX[dow] || '',
      fromPlace: cell(row, 3) || 'भादा',
      toPlace: cell(row, 4),
      workDescription: cell(row, 5),
      entryType: (cell(row, 12) || 'office_work') as DiaryEntryType,
      originalDate: cell(row, 13) || null,
      adjustedDate: cell(row, 14) || null,
      sourceId: cell(row, 15) || null,
      isManualEdit: cell(row, 9) === 'होय',
      notes: cell(row, 10),
    });
  }

  entries.sort((a, b) => a.serialNo - b.serialNo);
  const summary = computeDiarySummary(entries);

  return {
    id: meta.id,
    year: meta.year,
    month: meta.month,
    monthLabelMarathi: meta.monthLabelMarathi,
    sheetName: meta.sheetName,
    employeeName: meta.employeeName,
    designation: meta.designation,
    officeName: meta.officeName,
    entries,
    warnings: meta.warnings,
    summary,
    hasManualEdits: entries.some((e) => e.isManualEdit) || meta.hasManualEdits,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}
