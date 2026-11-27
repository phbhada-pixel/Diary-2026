import type {
  ApplicationSettings,
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MonthlyDiaryDocument,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
  WeeklyScheduleMaster,
} from '../shared/types.ts';
import { ApiError, type AppsScriptConnectionStatus, type BootstrapData } from './apiTypes.ts';
import { staticAppsScriptApi } from './staticAppsScriptApi.ts';

export { ApiError, type AppsScriptConnectionStatus, type BootstrapData };

async function fetchOnce(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      'सर्व्हरशी संपर्क तुटला आहे किंवा नेटवर्क उपलब्ध नाही. कृपया काही क्षणांनी पुन्हा प्रयत्न करा.',
      503
    );
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  const isProxyHtml =
    parsed === null &&
    (contentType.includes('text/html') || text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html'));
  return { res, text, parsed, isProxyHtml };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  // Always allow up to 3 attempts when a reverse proxy returns HTML boot page (which never reached Express)
  const maxAttempts = 3;

  let lastResult: { res: Response; text: string; parsed: unknown; isProxyHtml: boolean } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await fetchOnce(url, options);

    const looksLikeNonJson = lastResult.parsed === null || typeof lastResult.parsed !== 'object';
    const safeToRetry =
      lastResult.isProxyHtml || (method === 'GET' && looksLikeNonJson);
    if (safeToRetry && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    break;
  }

  const { res, parsed } = lastResult!;

  if (!res.ok) {
    const errMessage =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `सर्व्हरशी संपर्क साधताना त्रुटी आली (HTTP ${res.status}).`;
    throw new ApiError(
      errMessage,
      res.status,
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new ApiError(
      'सर्व्हर अद्याप सुरू होत आहे किंवा बॅकएंड API उपलब्ध नाही. कृपया काही सेकंदांनी "पुन्हा प्रयत्न करा" वर क्लिक करा.',
      502
    );
  }

  return parsed as T;
}

const serverApi = {
  getConnectionStatus: () => request<AppsScriptConnectionStatus>('/api/status'),
  bootstrap: () => request<BootstrapData>('/api/bootstrap'),

  // Employee
  updateEmployee: (payload: Partial<EmployeeMaster>) =>
    request<EmployeeMaster>('/api/employee', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Subcenters
  createSubcenter: (payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>) =>
    request<SubcenterMaster>('/api/subcenters', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSubcenter: (id: string, payload: Pick<SubcenterMaster, 'name' | 'location' | 'notes'>) =>
    request<SubcenterMaster>(`/api/subcenters/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSubcenter: (id: string) =>
    request<{ deleted: boolean }>(`/api/subcenters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Villages
  createVillage: (payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>) =>
    request<VillageMaster>('/api/villages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateVillage: (
    id: string,
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) =>
    request<VillageMaster>(`/api/villages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteVillage: (id: string) =>
    request<{ deleted: boolean }>(`/api/villages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Weekly Schedule
  createWeeklySchedule: (
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) =>
    request<WeeklyScheduleMaster>('/api/weekly-schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWeeklySchedule: (
    id: string,
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) =>
    request<WeeklyScheduleMaster>(`/api/weekly-schedule/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteWeeklySchedule: (id: string) =>
    request<{ deleted: boolean }>(`/api/weekly-schedule/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Holidays
  createHoliday: (payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'year' | 'notes'>) =>
    request<GovernmentHolidayMaster>('/api/holidays', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateHoliday: (id: string, payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'notes'>) =>
    request<GovernmentHolidayMaster>(`/api/holidays/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteHoliday: (id: string) =>
    request<{ deleted: boolean }>(`/api/holidays/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Leaves
  createLeave: (payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>) =>
    request<{ record: LeaveRecord; updatedMonths: string[] }>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLeave: (id: string, payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>) =>
    request<{ record: LeaveRecord; updatedMonths: string[] }>(`/api/leaves/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLeave: (id: string) =>
    request<{ deleted: boolean; updatedMonths: string[] }>(`/api/leaves/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Special Events
  createSpecialEvent: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) =>
    request<SpecialEventMaster>('/api/special-events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSpecialEvent: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) =>
    request<SpecialEventMaster>(`/api/special-events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSpecialEvent: (id: string) =>
    request<{ deleted: boolean }>(`/api/special-events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Monthly Diaries
  generateDiary: (payload: {
    year: number;
    month: number;
    preserveManualEdits?: boolean;
    confirmedOverwrite?: boolean;
  }) =>
    request<MonthlyDiaryDocument>('/api/diaries/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateDiaryEntry: (
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
  ) =>
    request<MonthlyDiaryDocument>(
      `/api/diaries/${encodeURIComponent(diaryId)}/entry/${encodeURIComponent(date)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),
  deleteDiary: (diaryId: string) =>
    request<{ deleted: boolean }>(`/api/diaries/${encodeURIComponent(diaryId)}`, {
      method: 'DELETE',
    }),

  // Settings
  updateSettings: (payload: Partial<ApplicationSettings>) =>
    request<ApplicationSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Backup / Restore
  getBackup: () => request<Record<string, unknown>>('/api/backup'),
  restoreBackup: (backupPayload: Record<string, unknown>) =>
    request<{ restored: boolean }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(backupPayload),
    }),
};

const isGitHubPagesHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('.github.io') ||
    window.location.hostname === 'github.io');

const isStaticHostingMode =
  import.meta.env.VITE_STATIC_APPS_SCRIPT_MODE === 'true' || isGitHubPagesHost;

export const api = isStaticHostingMode ? staticAppsScriptApi : serverApi;
