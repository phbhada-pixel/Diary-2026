import type {
  ApplicationSettings,
  DiaryChangeHistoryRecord,
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MonthlyDiaryDocument,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
  WeekdayKey,
  WeeklyScheduleMaster,
  WeekOccurrence,
} from '../shared/types.ts';
import { SHEET_NAMES, type MasterSheetName } from './sheetsConfig.ts';

// ============================================================================
// Structured Error Classes (100% Marathi User-Friendly Errors)
// ============================================================================

export class DatabaseError extends Error {
  status: number;
  missingVars?: string[];
  constructor(message: string, status = 500, missingVars?: string[]) {
    super(message);
    this.status = status;
    this.missingVars = missingVars;
  }
}

export class AppsScriptNotConfiguredError extends DatabaseError {
  constructor(missingVars: string[]) {
    const hasUrlMissing = missingVars.includes('GOOGLE_APPS_SCRIPT_URL');
    const message = hasUrlMissing
      ? `Google Apps Script URL उपलब्ध नाही. कृपया सर्व्हरच्या Environment Variables मध्ये खालील माहिती सेट करा: ${missingVars.join(', ')}`
      : `Google Apps Script Secret Token कॉन्फिगर केलेला नाही. कृपया सर्व्हरच्या Environment Variables मध्ये खालील माहिती सेट करा: ${missingVars.join(', ')}`;
    super(message, 428, missingVars);
  }
}

// ============================================================================
// Environment Configuration (Backend Only — Never Exposed or Hardcoded in UI)
// ============================================================================

function stripWrappingQuotes(val: string): string {
  let current = val.trim();
  while (
    (current.startsWith('"') && current.endsWith('"')) ||
    (current.startsWith("'") && current.endsWith("'"))
  ) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

function isPlaceholder(val: string): boolean {
  const lower = val.trim().toLowerCase();
  return (
    !lower ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.startsWith('your_') ||
    lower.includes('your-apps-script') ||
    lower.includes('your_secret')
  );
}

export const APPS_SCRIPT_CONFIG = {
  get url(): string {
    const raw = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.VITE_GOOGLE_APPS_SCRIPT_URL || '';
    const cleaned = stripWrappingQuotes(raw);
    return isPlaceholder(cleaned) ? '' : cleaned;
  },
  get secretToken(): string {
    const raw = process.env.GOOGLE_APPS_SCRIPT_SECRET || '';
    const cleaned = stripWrappingQuotes(raw);
    return isPlaceholder(cleaned) ? '' : cleaned;
  },
  getMissingEnvVars(): string[] {
    const missing: string[] = [];
    const u = this.url;
    if (!u || !/^https?:\/\/.+/i.test(u)) {
      missing.push('GOOGLE_APPS_SCRIPT_URL');
    }
    if (!this.secretToken) {
      missing.push('GOOGLE_APPS_SCRIPT_SECRET');
    }
    return missing;
  },
  isConfigured(): boolean {
    return this.getMissingEnvVars().length === 0;
  },
} as const;

export function getAppsScriptStatusSummary() {
  const missingVars = APPS_SCRIPT_CONFIG.getMissingEnvVars();
  return {
    configured: missingVars.length === 0,
    missingVars,
    backendMode: 'google_apps_script_web_app' as const,
  };
}

// ============================================================================
// Low-Level Transport to Google Apps Script Web App
// Uses text/plain;charset=utf-8 POST + follows Apps Script 302 redirects cleanly
// ============================================================================

interface AppsScriptResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

async function callAppsScript<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const missing = APPS_SCRIPT_CONFIG.getMissingEnvVars();
  if (missing.length > 0) {
    throw new AppsScriptNotConfiguredError(missing);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(APPS_SCRIPT_CONFIG.url, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // text/plain avoids unnecessary CORS preflight and works universally with Apps Script doPost(e)
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        token: APPS_SCRIPT_CONFIG.secretToken,
        action,
        payload,
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    throw new DatabaseError(
      isTimeout
        ? 'Google Apps Script Server प्रतिसाद देत नाही (वेळ मर्यादा संपली). कृपया पुन्हा प्रयत्न करा.'
        : 'Google Apps Script Server प्रतिसाद देत नाही. कृपया Deployed Web App URL व इंटरनेट जोडणी तपासा.',
      502
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let parsed: AppsScriptResponse<T> | null = null;
  try {
    parsed = JSON.parse(text) as AppsScriptResponse<T>;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    const looksLikeGoogleLogin =
      text.includes('accounts.google.com') || text.includes('ServiceLogin') || text.includes('<!DOCTYPE html');
    throw new DatabaseError(
      looksLikeGoogleLogin
        ? 'Google Apps Script Web App कडून JSON ऐवजी HTML प्राप्त झाले. कृपया Apps Script Deployment मध्ये "Execute as: Me" आणि "Who has access: Anyone" सेट असल्याची खात्री करा.'
        : `Google Apps Script Server प्रतिसाद देत नाही (HTTP ${res.status}).`,
      502
    );
  }

  if (!parsed.ok) {
    const status = Number(parsed.status) || (res.ok ? 400 : res.status) || 500;
    const msg = parsed.error || 'डेटा सेव्ह होत नाही. कृपया पुन्हा प्रयत्न करा.';
    throw new DatabaseError(msg, status);
  }

  return parsed.data as T;
}

// ============================================================================
// High-Level Repository API (100% Backed by Google Apps Script + Google Sheets)
// ============================================================================

export interface AppsScriptVerificationReport {
  connected: true;
  authMode: 'google_apps_script_web_app';
  readWriteVerified: true;
  verifiedAt: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  masterSheetsCount: number;
  masterSheetsVerified: MasterSheetName[];
  employee: {
    id: string;
    fullName: string;
    designation: string;
    officeName: string;
    headquarters: string;
  };
  settings: {
    id: string;
    defaultFromPlace: string;
    holidayAdjustmentDirection: string;
    officePlace: string;
  };
}

export async function verifyAppsScriptConnection(): Promise<AppsScriptVerificationReport> {
  const report = await callAppsScript<AppsScriptVerificationReport>('checkDatabaseConnection');
  if (!report || report.connected !== true || report.readWriteVerified !== true) {
    throw new DatabaseError('Google Sheets मधील Read/Write चाचणी यशस्वी झाली नाही.', 502);
  }
  return report;
}

export async function getBootstrapBundle(): Promise<{
  employee: EmployeeMaster;
  settings: ApplicationSettings;
  subcenters: SubcenterMaster[];
  villages: VillageMaster[];
  weeklySchedules: WeeklyScheduleMaster[];
  holidays: GovernmentHolidayMaster[];
  leaves: LeaveRecord[];
  specialEvents: SpecialEventMaster[];
  monthlyDiaries: MonthlyDiaryDocument[];
  changeHistory: DiaryChangeHistoryRecord[];
}> {
  const bundle = await callAppsScript<{
    employee: EmployeeMaster;
    settings: ApplicationSettings;
    subcenters: SubcenterMaster[];
    villages: VillageMaster[];
    weeklySchedules: WeeklyScheduleMaster[];
    holidays: GovernmentHolidayMaster[];
    leaves: LeaveRecord[];
    specialEvents: SpecialEventMaster[];
    monthlyDiaries: MonthlyDiaryDocument[];
    changeHistory: DiaryChangeHistoryRecord[];
  }>('bootstrap');

  if (!bundle?.employee?.officeName?.trim() || !bundle?.employee?.fullName?.trim()) {
    throw new DatabaseError(
      'Employee_Master शीटमधील आवश्यक कर्मचारी माहिती आढळली नाही.',
      500
    );
  }
  if (!bundle?.settings?.defaultFromPlace?.trim()) {
    throw new DatabaseError(
      'Application_Settings शीटमधील आवश्यक प्रणाली सेटिंग्ज आढळल्या नाहीत.',
      500
    );
  }
  return bundle;
}

// --- 1. Employee_Master ---
export async function getEmployee(): Promise<EmployeeMaster> {
  const rows = await callAppsScript<EmployeeMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Employee_Master,
  });
  if (!rows || rows.length === 0) {
    throw new DatabaseError('Employee_Master शीटमध्ये कर्मचारी माहिती आढळली नाही.', 404);
  }
  return rows[0];
}

export async function updateEmployee(payload: Partial<EmployeeMaster>): Promise<EmployeeMaster> {
  return callAppsScript<EmployeeMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Employee_Master,
    uniqueId: payload.id || 'emp_primary',
    updates: payload,
    historySummary: payload.fullName ? `कर्मचारी माहिती अद्ययावत: ${payload.fullName.trim()}` : undefined,
  });
}

// --- 2. Subcenter_Master ---
export async function listSubcenters(): Promise<SubcenterMaster[]> {
  return callAppsScript<SubcenterMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Subcenter_Master,
  });
}

export async function createSubcenter(
  payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>
): Promise<SubcenterMaster> {
  return callAppsScript<SubcenterMaster>('addRecord', {
    sheetName: SHEET_NAMES.Subcenter_Master,
    record: payload,
    historySummary: `नवीन उपकेंद्र जोडले: ${payload.name.trim()}`,
  });
}

export async function updateSubcenter(
  id: string,
  payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>
): Promise<SubcenterMaster> {
  return callAppsScript<SubcenterMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Subcenter_Master,
    uniqueId: id,
    updates: payload,
    historySummary: `उपकेंद्र माहिती बदलली: ${payload.name.trim()}`,
  });
}

export async function deleteSubcenter(id: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteRecord', {
    sheetName: SHEET_NAMES.Subcenter_Master,
    uniqueId: id,
    historySummary: `उपकेंद्र हटवले (${id})`,
  });
}

// --- 3. Village_Master ---
export async function listVillages(): Promise<VillageMaster[]> {
  return callAppsScript<VillageMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Village_Master,
  });
}

export async function createVillage(
  payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
): Promise<VillageMaster> {
  return callAppsScript<VillageMaster>('addRecord', {
    sheetName: SHEET_NAMES.Village_Master,
    record: payload,
    historySummary: `नवीन गाव जोडले: ${payload.name.trim()}`,
  });
}

export async function updateVillage(
  id: string,
  payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
): Promise<VillageMaster> {
  return callAppsScript<VillageMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Village_Master,
    uniqueId: id,
    updates: payload,
    historySummary: `गावाची माहिती बदलली: ${payload.name.trim()}`,
  });
}

export async function deleteVillage(id: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteRecord', {
    sheetName: SHEET_NAMES.Village_Master,
    uniqueId: id,
    historySummary: `गाव हटवले (${id})`,
  });
}

// --- 4. Weekly_Schedule_Master ---
export async function listWeeklySchedules(): Promise<WeeklyScheduleMaster[]> {
  return callAppsScript<WeeklyScheduleMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Weekly_Schedule_Master,
  });
}

export async function createWeeklySchedule(
  payload: Pick<
    WeeklyScheduleMaster,
    'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
  >,
  summaryText: string
): Promise<WeeklyScheduleMaster> {
  return callAppsScript<WeeklyScheduleMaster>('addRecord', {
    sheetName: SHEET_NAMES.Weekly_Schedule_Master,
    record: payload,
    historySummary: summaryText,
  });
}

export async function updateWeeklySchedule(
  id: string,
  payload: Pick<
    WeeklyScheduleMaster,
    'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
  >,
  summaryText: string
): Promise<WeeklyScheduleMaster> {
  return callAppsScript<WeeklyScheduleMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Weekly_Schedule_Master,
    uniqueId: id,
    updates: {
      ...payload,
      weekday: payload.weekday as WeekdayKey,
      weekNumber: Number(payload.weekNumber) as WeekOccurrence,
    },
    historySummary: summaryText,
  });
}

export async function deleteWeeklySchedule(id: string, summaryText: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteRecord', {
    sheetName: SHEET_NAMES.Weekly_Schedule_Master,
    uniqueId: id,
    historySummary: summaryText,
  });
}

// --- 5. Government_Holiday_Master ---
export async function listHolidays(year?: number): Promise<GovernmentHolidayMaster[]> {
  return callAppsScript<GovernmentHolidayMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Government_Holiday_Master,
    filters: year ? { year } : {},
  });
}

export async function createHoliday(
  payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'year' | 'notes'>,
  summaryText: string
): Promise<GovernmentHolidayMaster> {
  return callAppsScript<GovernmentHolidayMaster>('addRecord', {
    sheetName: SHEET_NAMES.Government_Holiday_Master,
    record: payload,
    historySummary: summaryText,
  });
}

export async function updateHoliday(
  id: string,
  payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'notes'>,
  summaryText: string
): Promise<GovernmentHolidayMaster> {
  return callAppsScript<GovernmentHolidayMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Government_Holiday_Master,
    uniqueId: id,
    updates: payload,
    historySummary: summaryText,
  });
}

export async function deleteHoliday(id: string, summaryText: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteRecord', {
    sheetName: SHEET_NAMES.Government_Holiday_Master,
    uniqueId: id,
    historySummary: summaryText,
  });
}

// --- 6. Leave_Management ---
export async function listLeaves(): Promise<LeaveRecord[]> {
  return callAppsScript<LeaveRecord[]>('getRecords', {
    sheetName: SHEET_NAMES.Leave_Management,
  });
}

export async function createLeave(
  payload: Omit<LeaveRecord, 'id' | 'createdAt' | 'updatedAt'>,
  summaryText: string
): Promise<LeaveRecord> {
  return callAppsScript<LeaveRecord>('addRecord', {
    sheetName: SHEET_NAMES.Leave_Management,
    record: payload,
    historySummary: summaryText,
  });
}

export async function updateLeave(
  id: string,
  payload: Omit<LeaveRecord, 'id' | 'createdAt' | 'updatedAt'>,
  summaryText: string
): Promise<{ prev: LeaveRecord; updated: LeaveRecord }> {
  return callAppsScript<{ prev: LeaveRecord; updated: LeaveRecord }>('updateRecord', {
    sheetName: SHEET_NAMES.Leave_Management,
    uniqueId: id,
    updates: payload,
    historySummary: summaryText,
  });
}

export async function deleteLeave(id: string, summaryText: string): Promise<LeaveRecord> {
  const res = await callAppsScript<{ deleted: boolean; previous: LeaveRecord }>('deleteRecord', {
    sheetName: SHEET_NAMES.Leave_Management,
    uniqueId: id,
    historySummary: summaryText,
  });
  return res.previous;
}

// --- 7. Special_Event_Master ---
export async function listSpecialEvents(): Promise<SpecialEventMaster[]> {
  return callAppsScript<SpecialEventMaster[]>('getRecords', {
    sheetName: SHEET_NAMES.Special_Event_Master,
  });
}

export async function createSpecialEvent(
  payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>,
  summaryText: string
): Promise<SpecialEventMaster> {
  return callAppsScript<SpecialEventMaster>('addRecord', {
    sheetName: SHEET_NAMES.Special_Event_Master,
    record: payload,
    historySummary: summaryText,
  });
}

export async function updateSpecialEvent(
  id: string,
  payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>,
  summaryText: string
): Promise<SpecialEventMaster> {
  return callAppsScript<SpecialEventMaster>('updateRecord', {
    sheetName: SHEET_NAMES.Special_Event_Master,
    uniqueId: id,
    updates: payload,
    historySummary: summaryText,
  });
}

export async function deleteSpecialEvent(id: string, summaryText: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteRecord', {
    sheetName: SHEET_NAMES.Special_Event_Master,
    uniqueId: id,
    historySummary: summaryText,
  });
}

// --- 8. Monthly_Diary + Dynamic Monthly Tabs (April_2026, May_2026, ...) ---
export async function getMonthlyDiaryById(id: string): Promise<MonthlyDiaryDocument | null> {
  return callAppsScript<MonthlyDiaryDocument | null>('getMonthlyDiary', { id });
}

export async function listMonthlyDiaries(): Promise<MonthlyDiaryDocument[]> {
  const bundle = await getBootstrapBundle();
  return bundle.monthlyDiaries;
}

export async function saveMonthlyDiary(
  doc: MonthlyDiaryDocument,
  historyAction?: {
    action: DiaryChangeHistoryRecord['action'];
    summary: string;
    oldData: string | null;
    newData: string | null;
  }
): Promise<MonthlyDiaryDocument> {
  return callAppsScript<MonthlyDiaryDocument>('generateMonthlyDiary', {
    diaryDocument: doc,
    historyAction: historyAction || null,
  });
}

export async function deleteMonthlyDiary(id: string): Promise<void> {
  await callAppsScript<{ deleted: boolean }>('deleteMonthlyDiary', { id });
}

// --- 9. Diary_Change_History ---
export async function listChangeHistory(limit = 200): Promise<DiaryChangeHistoryRecord[]> {
  return callAppsScript<DiaryChangeHistoryRecord[]>('getRecords', {
    sheetName: SHEET_NAMES.Diary_Change_History,
    filters: { limit },
  });
}

// --- 10. Application_Settings ---
export async function getSettings(): Promise<ApplicationSettings> {
  return callAppsScript<ApplicationSettings>('getApplicationSettings');
}

export async function updateSettings(
  payload: Partial<ApplicationSettings>
): Promise<ApplicationSettings> {
  return callAppsScript<ApplicationSettings>('updateRecord', {
    sheetName: SHEET_NAMES.Application_Settings,
    uniqueId: payload.id || 'settings_primary',
    updates: payload,
  });
}

// --- Full Backup Restore ---
export async function restoreFullBackupToSheets(data: Record<string, unknown>): Promise<void> {
  await callAppsScript<{ restored: boolean }>('restoreBackup', { data });
}
