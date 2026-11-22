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
  WeeklyScheduleMaster,
} from '../shared/types.ts';

export interface BootstrapData {
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
}

export interface AppsScriptConnectionStatus {
  configured: boolean;
  missingVars: string[];
  backendMode: string;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
