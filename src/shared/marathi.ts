import type {
  DiaryEntryType,
  GovernmentHolidayMaster,
  MeetingWeekdayKey,
  MonthlyDiaryEntry,
  WeekdayKey,
  WeekOccurrence,
} from './types.ts';

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

export const ALL_WORKING_WEEKDAYS: { key: MeetingWeekdayKey; label: string; dayIndex: number }[] = [
  { key: 'monday', label: 'सोमवार', dayIndex: 1 },
  { key: 'tuesday', label: 'मंगळवार', dayIndex: 2 },
  { key: 'wednesday', label: 'बुधवार', dayIndex: 3 },
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
];

export const SPECIAL_WORK_DESCRIPTIONS = [
  'पल्स पोलिओ विशेष लसीकरण मोहीम',
  'विशेष लसीकरण सत्र',
  'आरोग्य तपासणी शिबिर व उपचार',
  'गृहभेट व आरोग्य सर्वेक्षण मोहीम',
  'माता व बाल आरोग्य सेवा सत्र',
  'साथरोग नियंत्रण व पाणी नमुना तपासणी',
  'आरोग्य शिक्षण व जनजागृती मोहीम',
  'वरिष्ठ अधिकाऱ्यांसह क्षेत्रीय पाहणी व आढावा',
  'प्रशिक्षण व कार्यशाळा सहभाग',
  'रक्त व पाणी नमुने संकलन मोहीम',
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
  district_meeting: 'जिल्हास्तरीय बैठक',
  taluka_meeting: 'तालुकास्तरीय बैठक',
  subcenter_meeting: 'उपकेंद्रस्तरीय बैठक',
  special_event: 'विशेष कार्यक्रम',
  weekly_schedule: 'वारनिहाय गाव सत्र',
  adjusted_schedule: 'वारनिहाय गाव सत्र',
  lab_sample_visit: 'नमुने जमा करणे (लातूर)',
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

export function getWeekdayLabel(key: WeekdayKey | MeetingWeekdayKey): string {
  return ALL_WORKING_WEEKDAYS.find((d) => d.key === key)?.label ?? key;
}

export function getWeekOccurrenceLabel(num: WeekOccurrence): string {
  return WEEK_OCCURRENCES.find((w) => w.value === num)?.label ?? String(num);
}

/**
 * Official Maharashtra Government Gazetted Public Holidays for 2026
 * (used when a Google Sheet row has only a generic label like "महाराष्ट्र शासन सार्वजनिक सुट्टी").
 */
export const MAHARASHTRA_GOVT_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-26': 'प्रजासत्ताक दिन',
  '2026-02-15': 'महाशिवरात्री',
  '2026-02-19': 'छत्रपती शिवाजी महाराज जयंती',
  '2026-03-03': 'होळी (दुसरा दिवस / धुलिवंदन)',
  '2026-03-19': 'गुढीपाडवा',
  '2026-03-21': 'रमजान ईद (ईद-उल-फित्र)',
  '2026-03-26': 'राम नवमी',
  '2026-03-31': 'महावीर जयंती',
  '2026-04-03': 'गुड फ्रायडे',
  '2026-04-14': 'डॉ. बाबासाहेब आंबेडकर जयंती',
  '2026-05-01': 'महाराष्ट्र दिन व बुद्ध पौर्णिमा',
  '2026-05-28': 'बकरी ईद (ईद-उल-झुआ)',
  '2026-06-26': 'मोहरम',
  '2026-08-15': 'स्वातंत्र्य दिन व पारशी नववर्ष दिन',
  '2026-08-26': 'ईद-ए-मिलाद',
  '2026-09-14': 'गणेश चतुर्थी',
  '2026-10-02': 'महात्मा गांधी जयंती',
  '2026-10-20': 'दसरा (विजयादशमी)',
  '2026-11-08': 'दिवाळी (लक्ष्मीपूजन)',
  '2026-11-10': 'दिवाळी (बलिप्रतिपदा)',
  '2026-11-24': 'गुरुनानक जयंती',
  '2026-12-25': 'ख्रिसमस (नाताळ)',
};

const FIXED_ANNUAL_HOLIDAYS_BY_MMDD: Record<string, string> = {
  '01-26': 'प्रजासत्ताक दिन',
  '02-19': 'छत्रपती शिवाजी महाराज जयंती',
  '04-14': 'डॉ. बाबासाहेब आंबेडकर जयंती',
  '05-01': 'महाराष्ट्र दिन',
  '08-15': 'स्वातंत्र्य दिन',
  '10-02': 'महात्मा गांधी जयंती',
  '12-25': 'ख्रिसमस (नाताळ)',
};

const GENERIC_HOLIDAY_NAMES = new Set([
  'शासकीय सुट्टी',
  'सार्वजनिक सुट्टी',
  'महाराष्ट्र शासन सार्वजनिक सुट्टी',
  'महाराष्ट्र शासन शासकीय सुट्टी',
  'राष्ट्रीय सुट्टी',
  'स्थानिक सुट्टी',
  'ऐच्छिक सुट्टी',
  'सुट्टी',
]);

export function isGenericHolidayName(raw: string | null | undefined): boolean {
  const clean = (raw || '').trim();
  if (!clean) return true;
  if (GENERIC_HOLIDAY_NAMES.has(clean)) return true;
  // Also catch combinations like "महाराष्ट्र शासन सार्वजनिक सुट्टी — शासकीय सुट्टी"
  const parts = clean
    .split(/[—–-]/u)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => GENERIC_HOLIDAY_NAMES.has(p));
}

export function resolveKnownHolidayNameByDate(isoDate: string): string | null {
  if (!isoDate || isoDate.length < 10) return null;
  const key = isoDate.slice(0, 10);
  if (MAHARASHTRA_GOVT_HOLIDAYS_2026[key]) {
    return MAHARASHTRA_GOVT_HOLIDAYS_2026[key];
  }
  const mmdd = key.slice(5, 10);
  return FIXED_ANNUAL_HOLIDAYS_BY_MMDD[mmdd] || null;
}

/**
 * Resolves the specific Marathi holiday name & type for a date/record.
 * Never returns generic "महाराष्ट्र शासन सार्वजनिक सुट्टी" when the real holiday name is known.
 */
export function resolveHolidayDisplayMeta(
  isoDate: string,
  rawName?: string | null,
  rawType?: string | null,
  sameDateHolidays: GovernmentHolidayMaster[] = []
): { name: string; holidayType: string; workDescription: string } {
  // Collect any non-generic names from matching holiday records on this date
  const specificNames: string[] = [];
  const pushIfSpecific = (candidate?: string | null) => {
    const clean = (candidate || '').trim();
    if (clean && !isGenericHolidayName(clean) && !specificNames.includes(clean)) {
      specificNames.push(clean);
    }
  };

  for (const h of sameDateHolidays) {
    pushIfSpecific(h.name);
  }
  pushIfSpecific(rawName);

  const knownName = resolveKnownHolidayNameByDate(isoDate);
  const resolvedName =
    specificNames.length > 0
      ? specificNames.join(' व ')
      : knownName || (rawName || '').trim() || 'शासकीय सुट्टी';

  const typeFromList = sameDateHolidays.find((h) => h.holidayType?.trim())?.holidayType?.trim();
  const resolvedType = (rawType || '').trim() || typeFromList || 'सार्वजनिक सुट्टी';

  const workDescription = isGenericHolidayName(resolvedName)
    ? resolvedName
    : `${resolvedName} — ${resolvedType}`;

  return {
    name: resolvedName,
    holidayType: resolvedType,
    workDescription,
  };
}

/**
 * Formats diary rows cleanly for screen, Dashboard preview, A4 print/PDF, and Excel export:
 * 1. Holiday rows ALWAYS clearly show WHICH holiday it is (never generic "शासकीय सुट्टी" / "महाराष्ट्र शासन सार्वजनिक सुट्टी").
 * 2. Holidays & Sundays always show "भादा मुख्यालय" in "कोठे".
 * 3. Village session rows show ONLY the village name in "कोठे" (never append "(उपकेंद्र ...)").
 * 4. No adjustment notes or internal [MODE:...] / [KM:...] tags appear inside displayed notes.
 */
export function resolveDiaryEntryDisplay(
  entry: MonthlyDiaryEntry,
  holidays: GovernmentHolidayMaster[] = []
): { toPlace: string; workDescription: string; notes: string; holidayName: string | null } {
  const cleanNotes = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw
      .replace(/\s*\[MODE:[^\]]+\]\s*/gi, ' ')
      .replace(/\s*\[KM:[0-9]+(?:\.[0-9]+)?\]\s*/gi, ' ')
      .replace(/\s*\[DIST_KM:[0-9]+(?:\.[0-9]+)?\]\s*/gi, ' ')
      .replace(/\s*\(दि\.\s*[^)]*समायोजित\)\s*/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (/^मूळ नियोजित तारीख:/u.test(trimmed)) return '';
    return trimmed;
  };

  if (entry.isManualEdit) {
    return {
      toPlace: entry.toPlace,
      workDescription: entry.workDescription,
      notes: cleanNotes(entry.notes || ''),
      holidayName: null,
    };
  }

  if (entry.entryType === 'sunday') {
    return {
      toPlace: 'भादा मुख्यालय',
      workDescription: entry.workDescription || 'रविवार (साप्ताहिक सुट्टी)',
      notes: cleanNotes(entry.notes || ''),
      holidayName: null,
    };
  }

  if (entry.entryType === 'holiday') {
    const matchedHolidays = holidays.filter(
      (h) => (entry.sourceId && h.id === entry.sourceId) || h.date === entry.date
    );

    // Extract candidate name from existing workDescription if not generic
    let descNameCandidate = '';
    if (entry.workDescription) {
      const stripped = entry.workDescription
        .replace(/^शासकीय सुट्टी\s*[—–-]\s*/u, '')
        .replace(/\s*[—–-]\s*(सार्वजनिक सुट्टी|शासकीय सुट्टी|राष्ट्रीय सुट्टी|स्थानिक सुट्टी|ऐच्छिक सुट्टी)\s*$/u, '')
        .replace(/\s*\([^)]*\)\s*$/u, '')
        .trim();
      if (!isGenericHolidayName(stripped)) {
        descNameCandidate = stripped;
      }
    }

    const meta = resolveHolidayDisplayMeta(
      entry.date,
      descNameCandidate,
      matchedHolidays[0]?.holidayType,
      matchedHolidays
    );

    return {
      toPlace: 'भादा मुख्यालय',
      workDescription: meta.workDescription,
      notes: cleanNotes(entry.notes || ''),
      holidayName: isGenericHolidayName(meta.name) ? null : meta.name,
    };
  }

  if (entry.entryType === 'weekly_schedule' || entry.entryType === 'adjusted_schedule') {
    const cleanedPlace = (entry.toPlace || '')
      .replace(/\s*\(\s*उपकेंद्र[^)]*\)\s*$/u, '')
      .trim();
    const cleanedDesc = (entry.workDescription || '')
      .replace(/\s*\(दि\.\s*[^)]*समायोजित\)\s*$/u, '')
      .trim();
    return {
      toPlace: cleanedPlace || entry.toPlace,
      workDescription: cleanedDesc || entry.workDescription,
      notes: cleanNotes(entry.notes || ''),
      holidayName: null,
    };
  }

  return {
    toPlace: entry.toPlace,
    workDescription: entry.workDescription,
    notes: cleanNotes(entry.notes || ''),
    holidayName: null,
  };
}

export const resolveHolidayEntryDisplay = resolveDiaryEntryDisplay;

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
