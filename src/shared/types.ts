export type WeekdayKey = 'monday' | 'tuesday' | 'thursday' | 'friday' | 'saturday';

export type WeekOccurrence = 1 | 2 | 3 | 4 | 5;

export type HolidayAdjustmentDirection = 'next' | 'previous';

export type DiaryEntryType =
  | 'sunday'
  | 'holiday'
  | 'leave'
  | 'wednesday_weekly'
  | 'wednesday_asha'
  | 'taluka_meeting'
  | 'subcenter_meeting'
  | 'special_event'
  | 'weekly_schedule'
  | 'adjusted_schedule'
  | 'office_work'
  | 'manual';

export interface EmployeeMaster {
  id: string;
  fullName: string;
  designation: string;
  officeName: string;
  headquarters: string;
  email: string;
  mobile: string;
  implementationDate: string; // YYYY-MM-DD
  updatedAt: string;
}

export interface SubcenterMaster {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VillageMaster {
  id: string;
  name: string;
  subcenterId: string;
  subcenterName: string;
  population: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyScheduleMaster {
  id: string;
  weekday: WeekdayKey;
  weekNumber: WeekOccurrence;
  villageId: string;
  villageName: string;
  subcenterName: string;
  sessionType: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GovernmentHolidayMaster {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  holidayType: string;
  year: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRecord {
  id: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialEventMaster {
  id: string;
  date: string; // YYYY-MM-DD
  eventType: string;
  location: string;
  workDescription: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyDiaryEntry {
  serialNo: number;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun..6=Sat
  dayNameMarathi: string;
  fromPlace: string; // Always 'भादा'
  toPlace: string;
  workDescription: string;
  entryType: DiaryEntryType;
  originalDate: string | null; // YYYY-MM-DD when shifted due to holiday
  adjustedDate: string | null; // YYYY-MM-DD when shifted due to holiday
  sourceId: string | null;
  isManualEdit: boolean;
  notes: string;
}

export interface DiaryWarning {
  date: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface MonthlyDiarySummary {
  totalDays: number;
  workingDays: number;
  sundays: number;
  holidays: number;
  leaves: number;
  specialEvents: number;
  villageTours: number;
  meetings: number;
  officeDays: number;
  adjustedDays: number;
}

export interface MonthlyDiaryDocument {
  id: string; // e.g. '2026-04'
  year: number;
  month: number; // 1..12
  monthLabelMarathi: string; // e.g. 'एप्रिल 2026'
  sheetName: string; // e.g. 'April_2026'
  employeeName: string;
  designation: string;
  officeName: string;
  entries: MonthlyDiaryEntry[];
  warnings: DiaryWarning[];
  summary: MonthlyDiarySummary;
  hasManualEdits: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryChangeHistoryRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'GENERATE' | 'RECALCULATE' | 'MANUAL_EDIT';
  changeDate: string;
  summary: string;
  oldData: string | null;
  newData: string | null;
}

export interface ApplicationSettings {
  id: string;
  holidayAdjustmentDirection: HolidayAdjustmentDirection;
  defaultFromPlace: string;
  implementationDate: string;
  financialYearStartMonth: number;
  hqPlace: string;
  officePlace: string;
  talukaMeetingPlace: string;
  subcenterMeeting1Place: string;
  subcenterMeeting2Place: string;
  updatedAt: string;
}

export type NavSection =
  | 'dashboard'
  | 'employee'
  | 'villages'
  | 'subcenters'
  | 'weekly-schedule'
  | 'holidays'
  | 'leaves'
  | 'special-events'
  | 'monthly-diary'
  | 'reports'
  | 'settings';
