import type { DiaryEntryType, WeekdayKey, WeekOccurrence } from './types.ts';

export const MARATHI_MONTHS: Record<number, string> = {
  1: 'जानेवारी',
  2: 'फेब्रुवारी',
  3: 'मार्च',
  4: 'एप्रिल',
  5: 'मे',
  6: 'जून',
  7: 'जुलै',
  8: 'ऑगस्ट',
  9: 'सप्टेंबर',
  10: 'ऑक्टोबर',
  11: 'नोव्हेंबर',
  12: 'डिसेंबर',
};

export const ENGLISH_MONTHS_FOR_SHEET: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

export const MARATHI_DAYS_BY_INDEX: Record<number, string> = {
  0: 'रविवार',
  1: 'सोमवार',
  2: 'मंगळवार',
  3: 'बुधवार',
  4: 'गुरुवार',
  5: 'शुक्रवार',
  6: 'शनिवार',
};

export const SCHEDULE_WEEKDAYS: { key: WeekdayKey; label: string; dayIndex: number }[] = [
  { key: 'monday', label: 'सोमवार', dayIndex: 1 },
  { key: 'tuesday', label: 'मंगळवार', dayIndex: 2 },
  { key: 'thursday', label: 'गुरुवार', dayIndex: 4 },
  { key: 'friday', label: 'शुक्रवार', dayIndex: 5 },
  { key: 'saturday', label: 'शनिवार', dayIndex: 6 },
];

export const WEEK_OCCURRENCES: { value: WeekOccurrence; label: string }[] = [
  { value: 1, label: 'पहिला' },
  { value: 2, label: 'दुसरा' },
  { value: 3, label: 'तिसरा' },
  { value: 4, label: 'चौथा' },
  { value: 5, label: 'पाचवा' },
];

export const HOLIDAY_TYPES = [
  'सार्वजनिक सुट्टी',
  'राष्ट्रीय सुट्टी',
  'स्थानिक सुट्टी',
  'ऐच्छिक सुट्टी',
];

export const LEAVE_TYPES = [
  'किरकोळ रजा (CL)',
  'अर्जित रजा (EL)',
  'वैद्यकीय रजा (ML)',
  'अर्धपगारी रजा (HPL)',
  'विशेष रजा',
  'इतर रजा',
];

export const SPECIAL_EVENT_TYPES = [
  'आरोग्य अभियान',
  'विशेष लसीकरण सत्र',
  'वरिष्ठ अधिकाऱ्यांची भेट',
  'जिल्हास्तरीय बैठक',
  'तालुकास्तरीय बैठक',
  'प्रशिक्षण कार्यक्रम',
  'इतर विशेष शासकीय कार्यक्रम',
];

export const SESSION_TYPE_SUGGESTIONS = [
  'नियमित लसीकरण व आरोग्य सेवा सत्र',
  'गृहभेट, सर्वेक्षण व आरोग्य तपासणी',
  'माता व बाल आरोग्य सेवा सत्र',
  'साथरोग नियंत्रण व पाणी नमुना तपासणी',
  'आरोग्य शिक्षण व क्षेत्रीय तपासणी',
  'विशेष आरोग्य तपासणी शिबिर',
];

export const ENTRY_TYPE_LABELS: Record<DiaryEntryType, string> = {
  sunday: 'रविवार',
  holiday: 'शासकीय सुट्टी',
  leave: 'रजा',
  wednesday_weekly: 'आठवडी बैठक',
  wednesday_asha: 'आशा व मासिक आढावा बैठक',
  taluka_meeting: 'तालुकास्तरीय बैठक',
  subcenter_meeting: 'उपकेंद्रस्तरीय बैठक',
  special_event: 'विशेष कार्यक्रम',
  weekly_schedule: 'वारनिहाय गाव सत्र',
  adjusted_schedule: 'सुट्टी समायोजित सत्र',
  office_work: 'कार्यालयीन कामकाज',
  manual: 'मॅन्युअल नोंद',
};

export function dayIndexToWeekdayKey(dayIndex: number): WeekdayKey | null {
  switch (dayIndex) {
    case 1:
      return 'monday';
    case 2:
      return 'tuesday';
    case 4:
      return 'thursday';
    case 5:
      return 'friday';
    case 6:
      return 'saturday';
    default:
      return null;
  }
}

export function getWeekdayLabel(key: WeekdayKey): string {
  return SCHEDULE_WEEKDAYS.find((d) => d.key === key)?.label ?? key;
}

export function getWeekOccurrenceLabel(num: WeekOccurrence): string {
  return WEEK_OCCURRENCES.find((w) => w.value === num)?.label ?? String(num);
}

/** Format YYYY-MM-DD -> DD-MM-YYYY */
export function formatDateDDMMYYYY(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Format ISO timestamp -> DD-MM-YYYY HH:mm */
export function formatDateTimeMarathi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

export function makeMonthId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function makeMonthLabelMarathi(year: number, month: number): string {
  return `${MARATHI_MONTHS[month] ?? month} ${year}`;
}

export function makeMonthSheetName(year: number, month: number): string {
  return `${ENGLISH_MONTHS_FOR_SHEET[month] ?? `Month${month}`}_${year}`;
}

/** Calculate inclusive calendar days between two YYYY-MM-DD dates */
export function calculateInclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

/** Return 12 months of a financial year starting April (e.g., fyStartYear=2026 -> Apr 2026..Mar 2027) */
export function getFinancialYearMonths(fyStartYear: number): { year: number; month: number; id: string; label: string }[] {
  const list: { year: number; month: number; id: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1; // 4..12, 1..3
    const y = m >= 4 ? fyStartYear : fyStartYear + 1;
    list.push({
      year: y,
      month: m,
      id: makeMonthId(y, m),
      label: makeMonthLabelMarathi(y, m),
    });
  }
  return list;
}

export function getFinancialYearLabel(fyStartYear: number): string {
  return `आर्थिक वर्ष ${fyStartYear}-${String(fyStartYear + 1).slice(-2)} (एप्रिल ${fyStartYear} ते मार्च ${fyStartYear + 1})`;
}

export function getFinancialYearForDate(year: number, month: number): number {
  return month >= 4 ? year : year - 1;
}
