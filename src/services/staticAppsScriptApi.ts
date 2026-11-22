import { computeDiarySummary, generateMonthlyDiary } from '../shared/diaryEngine.ts';
import {
  calculateInclusiveDays,
  formatDateDDMMYYYY,
  getWeekdayLabel,
  getWeekOccurrenceLabel,
  makeMonthId,
} from '../shared/marathi.ts';
import type {
  ApplicationSettings,
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
  WeeklyScheduleMaster,
} from '../shared/types.ts';
import { ApiError, type AppsScriptConnectionStatus, type BootstrapData } from './apiTypes.ts';

function cleanEnvValue(raw: unknown): string {
  let val = String(raw || '').trim();
  while (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  const lower = val.toLowerCase();
  if (
    !val ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.startsWith('your_') ||
    lower.includes('your-apps-script') ||
    lower.includes('your_secret')
  ) {
    return '';
  }
  return val;
}

function getStaticConfig() {
  const url = cleanEnvValue(import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL);
  const token = cleanEnvValue(import.meta.env.VITE_GOOGLE_APPS_SCRIPT_SECRET);
  const missingVars: string[] = [];
  if (!url || !/^https?:\/\/.+/i.test(url)) {
    missingVars.push('GOOGLE_APPS_SCRIPT_URL');
  }
  if (!token) {
    missingVars.push('GOOGLE_APPS_SCRIPT_SECRET');
  }
  return { url, token, missingVars };
}

interface AppsScriptEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

async function callAppsScriptDirect<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const { url, token, missingVars } = getStaticConfig();
  if (missingVars.length > 0) {
    throw new ApiError(
      `Google Apps Script कॉन्फिगरेशन उपलब्ध नाही: ${missingVars.join(', ')}`,
      428,
      { notConfigured: true, missingVars }
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        // text/plain avoids CORS preflight and works directly with Google Apps Script doPost(e)
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ token, action, payload }),
    });
  } catch {
    throw new ApiError(
      'Google Apps Script Server प्रतिसाद देत नाही. कृपया इंटरनेट जोडणी आणि Deployed Web App URL तपासा.',
      502
    );
  }

  const text = await res.text();
  let parsed: AppsScriptEnvelope<T> | null = null;
  try {
    parsed = JSON.parse(text) as AppsScriptEnvelope<T>;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ApiError(
      'Google Apps Script Web App कडून वैध JSON प्रतिसाद मिळाला नाही. कृपया Deployment मध्ये "Execute as: Me" आणि "Who has access: Anyone" सेट असल्याची खात्री करा.',
      502
    );
  }

  if (!parsed.ok) {
    throw new ApiError(
      parsed.error || 'डेटा सेव्ह होत नाही. कृपया पुन्हा प्रयत्न करा.',
      Number(parsed.status) || 400
    );
  }

  return parsed.data as T;
}

async function patchSavedDiariesForLeaveRange(
  startDate: string,
  endDate: string,
  reasonSummary: string,
  newlyAddedLeave?: LeaveRecord
): Promise<string[]> {
  const updatedMonthIds: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return updatedMonthIds;

  const visited = new Set<string>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  let cachedLeaves: LeaveRecord[] | null = newlyAddedLeave ? [newlyAddedLeave] : null;
  let bundle: BootstrapData | null = null;

  while (cursor <= lastMonth) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const monthId = makeMonthId(y, m);
    if (!visited.has(monthId)) {
      visited.add(monthId);
      const existing = await callAppsScriptDirect<MonthlyDiaryDocument | null>('getMonthlyDiary', {
        id: monthId,
      });
      if (existing) {
        if (!cachedLeaves) {
          cachedLeaves = await callAppsScriptDirect<LeaveRecord[]>('getRecords', {
            sheetName: 'Leave_Management',
          });
        }
        const findLeave = (isoDate: string) =>
          cachedLeaves!.find((lv) => isoDate >= lv.startDate && isoDate <= lv.endDate);

        let fallbackByDate: Map<string, MonthlyDiaryEntry> | null = null;
        let changed = false;
        const patchedEntries: MonthlyDiaryEntry[] = [];

        for (const entry of existing.entries) {
          if (entry.date < startDate || entry.date > endDate) {
            patchedEntries.push(entry);
            continue;
          }
          if (entry.isManualEdit || entry.entryType === 'sunday' || entry.entryType === 'holiday') {
            patchedEntries.push(entry);
            continue;
          }
          const activeLeave = findLeave(entry.date);
          if (activeLeave) {
            const nextDesc = `रजा — ${activeLeave.leaveType}${activeLeave.reason ? ` (${activeLeave.reason})` : ''}`;
            if (
              entry.entryType !== 'leave' ||
              entry.sourceId !== activeLeave.id ||
              entry.workDescription !== nextDesc
            ) {
              changed = true;
              patchedEntries.push({
                ...entry,
                toPlace: 'रजा',
                workDescription: nextDesc,
                entryType: 'leave',
                originalDate: null,
                adjustedDate: null,
                sourceId: activeLeave.id,
                notes: activeLeave.notes || '',
              });
              continue;
            }
            patchedEntries.push(entry);
            continue;
          }
          if (entry.entryType === 'leave') {
            changed = true;
            if (!fallbackByDate) {
              if (!bundle) bundle = await callAppsScriptDirect<BootstrapData>('bootstrap');
              const refDoc = generateMonthlyDiary({
                year: y,
                month: m,
                employee: bundle.employee,
                weeklySchedules: bundle.weeklySchedules,
                holidays: bundle.holidays.filter((h) => h.year === y),
                leaves: bundle.leaves,
                specialEvents: bundle.specialEvents,
                settings: bundle.settings,
                existingEntries: existing.entries,
                preserveManualEdits: true,
              });
              fallbackByDate = new Map(refDoc.entries.map((e) => [e.date, e]));
            }
            patchedEntries.push(
              fallbackByDate.get(entry.date) || {
                ...entry,
                toPlace: bundle?.settings.officePlace || 'प्राथमिक आरोग्य केंद्र भादा',
                workDescription: 'कार्यालयीन कामकाज',
                entryType: 'office_work',
                sourceId: null,
                notes: '',
              }
            );
            continue;
          }
          patchedEntries.push(entry);
        }

        if (changed) {
          const updatedDoc: MonthlyDiaryDocument = {
            ...existing,
            entries: patchedEntries,
            summary: computeDiarySummary(patchedEntries),
            hasManualEdits: patchedEntries.some((e) => e.isManualEdit),
            updatedAt: new Date().toISOString(),
          };
          await callAppsScriptDirect<MonthlyDiaryDocument>('generateMonthlyDiary', {
            diaryDocument: updatedDoc,
            historyAction: {
              action: 'RECALCULATE',
              summary: `${existing.monthLabelMarathi} दैनंदिनीतील फक्त रजा दिनांक अद्ययावत (${reasonSummary}) — मूळ वारनिहाय नोंदी सुरक्षित`,
              oldData: null,
              newData: JSON.stringify(updatedDoc.summary),
            },
          });
          updatedMonthIds.push(monthId);
        }
      }
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return updatedMonthIds;
}

export const staticAppsScriptApi = {
  getConnectionStatus: async (): Promise<AppsScriptConnectionStatus> => {
    const { missingVars } = getStaticConfig();
    return {
      configured: missingVars.length === 0,
      missingVars,
      backendMode: 'google_apps_script_web_app_static',
    };
  },

  bootstrap: () => callAppsScriptDirect<BootstrapData>('bootstrap'),

  updateEmployee: (payload: Partial<EmployeeMaster>) =>
    callAppsScriptDirect<EmployeeMaster>('updateRecord', {
      sheetName: 'Employee_Master',
      uniqueId: payload.id || 'emp_primary',
      updates: payload,
      historySummary: payload.fullName ? `कर्मचारी माहिती अद्ययावत: ${payload.fullName.trim()}` : undefined,
    }),

  createSubcenter: (payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>) =>
    callAppsScriptDirect<SubcenterMaster>('addRecord', {
      sheetName: 'Subcenter_Master',
      record: payload,
      historySummary: `नवीन उपकेंद्र जोडले: ${payload.name.trim()}`,
    }),
  updateSubcenter: (id: string, payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>) =>
    callAppsScriptDirect<SubcenterMaster>('updateRecord', {
      sheetName: 'Subcenter_Master',
      uniqueId: id,
      updates: payload,
      historySummary: `उपकेंद्र माहिती बदलली: ${payload.name.trim()}`,
    }),
  deleteSubcenter: (id: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteRecord', {
      sheetName: 'Subcenter_Master',
      uniqueId: id,
      historySummary: `उपकेंद्र हटवले (${id})`,
    }),

  createVillage: (
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) =>
    callAppsScriptDirect<VillageMaster>('addRecord', {
      sheetName: 'Village_Master',
      record: payload,
      historySummary: `नवीन गाव जोडले: ${payload.name.trim()}`,
    }),
  updateVillage: (
    id: string,
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) =>
    callAppsScriptDirect<VillageMaster>('updateRecord', {
      sheetName: 'Village_Master',
      uniqueId: id,
      updates: payload,
      historySummary: `गावाची माहिती बदलली: ${payload.name.trim()}`,
    }),
  deleteVillage: (id: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteRecord', {
      sheetName: 'Village_Master',
      uniqueId: id,
      historySummary: `गाव हटवले (${id})`,
    }),

  createWeeklySchedule: (
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) =>
    callAppsScriptDirect<WeeklyScheduleMaster>('addRecord', {
      sheetName: 'Weekly_Schedule_Master',
      record: payload,
      historySummary: `वारनिहाय कार्यक्रम जोडला: ${getWeekOccurrenceLabel(payload.weekNumber)} ${getWeekdayLabel(payload.weekday)} — ${payload.villageName.trim()}`,
    }),
  updateWeeklySchedule: (
    id: string,
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) =>
    callAppsScriptDirect<WeeklyScheduleMaster>('updateRecord', {
      sheetName: 'Weekly_Schedule_Master',
      uniqueId: id,
      updates: payload,
      historySummary: `वारनिहाय कार्यक्रम बदलला: ${getWeekOccurrenceLabel(payload.weekNumber)} ${getWeekdayLabel(payload.weekday)} — ${payload.villageName.trim()}`,
    }),
  deleteWeeklySchedule: (id: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteRecord', {
      sheetName: 'Weekly_Schedule_Master',
      uniqueId: id,
      historySummary: `वारनिहाय कार्यक्रम हटवला (${id})`,
    }),

  createHoliday: (payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'year' | 'notes'>) => {
    const parsedYear = Number(payload.date.slice(0, 4)) || payload.year;
    return callAppsScriptDirect<GovernmentHolidayMaster>('addRecord', {
      sheetName: 'Government_Holiday_Master',
      record: { ...payload, year: parsedYear },
      historySummary: `शासकीय सुट्टी जोडली (${parsedYear}): ${formatDateDDMMYYYY(payload.date)} — ${payload.name.trim()}`,
    });
  },
  updateHoliday: (
    id: string,
    payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'notes'>
  ) =>
    callAppsScriptDirect<GovernmentHolidayMaster>('updateRecord', {
      sheetName: 'Government_Holiday_Master',
      uniqueId: id,
      updates: payload,
      historySummary: `शासकीय सुट्टी बदलली: ${formatDateDDMMYYYY(payload.date)} — ${payload.name.trim()}`,
    }),
  deleteHoliday: (id: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteRecord', {
      sheetName: 'Government_Holiday_Master',
      uniqueId: id,
      historySummary: `शासकीय सुट्टी हटवली (${id})`,
    }),

  createLeave: async (payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>) => {
    const totalDays = calculateInclusiveDays(payload.startDate, payload.endDate);
    const created = await callAppsScriptDirect<LeaveRecord>('addRecord', {
      sheetName: 'Leave_Management',
      record: { ...payload, totalDays },
      historySummary: `रजा नोंदवली: ${formatDateDDMMYYYY(payload.startDate)} ते ${formatDateDDMMYYYY(payload.endDate)} (${totalDays} दिवस — ${payload.leaveType.trim()})`,
    });
    let updatedMonths: string[] = [];
    try {
      updatedMonths = await patchSavedDiariesForLeaveRange(
        payload.startDate,
        payload.endDate,
        'रजा नोंद',
        created
      );
    } catch {
      // Leave is already saved in Google Sheets
    }
    return { record: created, updatedMonths };
  },
  updateLeave: async (
    id: string,
    payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>
  ) => {
    const totalDays = calculateInclusiveDays(payload.startDate, payload.endDate);
    const { prev, updated } = await callAppsScriptDirect<{ prev: LeaveRecord; updated: LeaveRecord }>(
      'updateRecord',
      {
        sheetName: 'Leave_Management',
        uniqueId: id,
        updates: { ...payload, totalDays },
        historySummary: `रजा अद्ययावत: ${formatDateDDMMYYYY(payload.startDate)} ते ${formatDateDDMMYYYY(payload.endDate)} (${totalDays} दिवस)`,
      }
    );
    const rangeStart = prev.startDate < payload.startDate ? prev.startDate : payload.startDate;
    const rangeEnd = prev.endDate > payload.endDate ? prev.endDate : payload.endDate;
    let updatedMonths: string[] = [];
    try {
      updatedMonths = await patchSavedDiariesForLeaveRange(rangeStart, rangeEnd, 'रजा बदल');
    } catch {
      // Leave is already updated in Google Sheets
    }
    return { record: updated, updatedMonths };
  },
  deleteLeave: async (id: string) => {
    const res = await callAppsScriptDirect<{ deleted: boolean; previous: LeaveRecord }>('deleteRecord', {
      sheetName: 'Leave_Management',
      uniqueId: id,
      historySummary: `रजा हटवली (${id})`,
    });
    let updatedMonths: string[] = [];
    try {
      if (res.previous) {
        updatedMonths = await patchSavedDiariesForLeaveRange(
          res.previous.startDate,
          res.previous.endDate,
          'रजा रद्द'
        );
      }
    } catch {
      // Leave is already deleted in Google Sheets
    }
    return { deleted: true, updatedMonths };
  },

  createSpecialEvent: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) =>
    callAppsScriptDirect<SpecialEventMaster>('addRecord', {
      sheetName: 'Special_Event_Master',
      record: payload,
      historySummary: `विशेष कार्यक्रम जोडला: ${formatDateDDMMYYYY(payload.date)} — ${payload.location.trim()}`,
    }),
  updateSpecialEvent: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) =>
    callAppsScriptDirect<SpecialEventMaster>('updateRecord', {
      sheetName: 'Special_Event_Master',
      uniqueId: id,
      updates: payload,
      historySummary: `विशेष कार्यक्रम बदलला: ${formatDateDDMMYYYY(payload.date)} — ${payload.location.trim()}`,
    }),
  deleteSpecialEvent: (id: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteRecord', {
      sheetName: 'Special_Event_Master',
      uniqueId: id,
      historySummary: `विशेष कार्यक्रम हटवला (${id})`,
    }),

  generateDiary: async (payload: {
    year: number;
    month: number;
    preserveManualEdits?: boolean;
    confirmedOverwrite?: boolean;
  }) => {
    const preserveManualEdits = payload.preserveManualEdits !== false;
    const monthId = makeMonthId(payload.year, payload.month);
    const existing = await callAppsScriptDirect<MonthlyDiaryDocument | null>('getMonthlyDiary', {
      id: monthId,
    });
    if (existing && !payload.confirmedOverwrite) {
      throw new ApiError(
        `${existing.monthLabelMarathi} ची दैनंदिनी आधीच सेव्ह आहे. पुन्हा तयार (Recalculate) करण्यासाठी संमती आवश्यक आहे.`,
        409,
        { requiresConfirmation: true, hasManualEdits: existing.hasManualEdits }
      );
    }
    const bundle = await callAppsScriptDirect<BootstrapData>('bootstrap');
    const generated = generateMonthlyDiary({
      year: payload.year,
      month: payload.month,
      employee: bundle.employee,
      weeklySchedules: bundle.weeklySchedules,
      holidays: bundle.holidays.filter((h) => h.year === payload.year),
      leaves: bundle.leaves,
      specialEvents: bundle.specialEvents,
      settings: bundle.settings,
      existingEntries: existing ? existing.entries : [],
      preserveManualEdits,
    });
    if (existing) generated.createdAt = existing.createdAt;

    return callAppsScriptDirect<MonthlyDiaryDocument>('generateMonthlyDiary', {
      diaryDocument: generated,
      historyAction: {
        action: existing ? 'RECALCULATE' : 'GENERATE',
        summary: existing
          ? `${generated.monthLabelMarathi} दैनंदिनी पुन्हा अद्ययावत केली (${preserveManualEdits ? 'मॅन्युअल बदल सुरक्षित' : 'पूर्ण नव्याने तयार'})`
          : `${generated.monthLabelMarathi} ची नवीन दौरा दैनंदिनी स्वयंचलित तयार केली`,
        oldData: existing ? JSON.stringify(existing.summary) : null,
        newData: JSON.stringify(generated.summary),
      },
    });
  },

  updateDiaryEntry: async (
    diaryId: string,
    date: string,
    payload: {
      fromPlace: string;
      toPlace: string;
      workDescription: string;
      notes?: string;
      entryType?: string;
      isManualEdit?: boolean;
    }
  ) => {
    const existing = await callAppsScriptDirect<MonthlyDiaryDocument | null>('getMonthlyDiary', {
      id: diaryId,
    });
    if (!existing) throw new ApiError('दैनंदिनी आढळली नाही.', 404);
    const idx = existing.entries.findIndex((e) => e.date === date);
    if (idx === -1) throw new ApiError('संबंधित दिनांक दैनंदिनीत आढळला नाही.', 404);

    const oldEntry = existing.entries[idx];
    const updatedEntry: MonthlyDiaryEntry = {
      ...oldEntry,
      fromPlace: (payload.fromPlace || oldEntry.fromPlace || 'भादा').trim(),
      toPlace: payload.toPlace.trim(),
      workDescription: payload.workDescription.trim(),
      notes: (payload.notes ?? oldEntry.notes ?? '').trim(),
      entryType: (payload.entryType as MonthlyDiaryEntry['entryType']) || oldEntry.entryType,
      isManualEdit: payload.isManualEdit !== false,
    };
    const updatedEntries = [...existing.entries];
    updatedEntries[idx] = updatedEntry;

    const updatedDoc: MonthlyDiaryDocument = {
      ...existing,
      entries: updatedEntries,
      summary: computeDiarySummary(updatedEntries),
      hasManualEdits: updatedEntries.some((e) => e.isManualEdit),
      updatedAt: new Date().toISOString(),
    };

    return callAppsScriptDirect<MonthlyDiaryDocument>('generateMonthlyDiary', {
      diaryDocument: updatedDoc,
      historyAction: {
        action: 'MANUAL_EDIT',
        summary: `${existing.monthLabelMarathi} — दि. ${formatDateDDMMYYYY(date)} मॅन्युअल बदल: ${updatedEntry.toPlace}`,
        oldData: JSON.stringify(oldEntry),
        newData: JSON.stringify(updatedEntry),
      },
    });
  },

  deleteDiary: (diaryId: string) =>
    callAppsScriptDirect<{ deleted: boolean }>('deleteMonthlyDiary', { id: diaryId }),

  updateSettings: (payload: Partial<ApplicationSettings>) =>
    callAppsScriptDirect<ApplicationSettings>('updateRecord', {
      sheetName: 'Application_Settings',
      uniqueId: payload.id || 'settings_primary',
      updates: payload,
    }),

  getBackup: async (): Promise<Record<string, unknown>> => {
    const bundle = await callAppsScriptDirect<BootstrapData>('bootstrap');
    return {
      exportedAt: new Date().toISOString(),
      application: 'मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली — प्राथमिक आरोग्य केंद्र भादा',
      data: {
        Employee_Master: bundle.employee,
        Application_Settings: bundle.settings,
        Subcenter_Master: bundle.subcenters,
        Village_Master: bundle.villages,
        Weekly_Schedule_Master: bundle.weeklySchedules,
        Government_Holiday_Master: bundle.holidays,
        Leave_Management: bundle.leaves,
        Special_Event_Master: bundle.specialEvents,
        Monthly_Diary: bundle.monthlyDiaries,
        Diary_Change_History: bundle.changeHistory,
      },
    };
  },

  restoreBackup: (backupPayload: Record<string, unknown>) =>
    callAppsScriptDirect<{ restored: boolean }>('restoreBackup', {
      data: (backupPayload as { data?: unknown })?.data || backupPayload,
    }),
};
