import type { SpecialEventMaster } from './types.ts';
import { WORK_LOG_DATE_PREFIX } from './meetingRules.ts';
import { formatDateDDMMYYYY, MARATHI_DAYS_BY_INDEX } from './marathi.ts';

export interface DailyWorkLogEntryItem {
  id: string;
  /** Raw date key stored in Special_Event_Master (e.g. WORK_LOG_2026-11-26__1732622000_ab12) */
  rawDateKey: string;
  /** Actual calendar date in YYYY-MM-DD */
  workDate: string;
  dayNameMarathi: string;
  /** Selected villages (multi-select) */
  villages: string[];
  /** Selected employees / staff (multi-select) */
  staff: string[];
  /** Detailed work description / narrative */
  detail: string;
  createdAt: string;
  updatedAt: string;
}

interface EncodedWorkLogV2 {
  v: 2;
  villages: string[];
  staff: string[];
  detail: string;
}

interface EncodedWorkLogAny {
  v?: number;
  villages?: string[];
  staff?: string[];
  detail?: string;
  pts?: { category?: string; detail?: string; beneficiariesOrCount?: string }[];
  sum?: string;
  stf?: string;
}

export const SYSTEM_DEFAULT_STAFF_ROLES = [
  'वैद्यकीय अधिकारी',
  'आरोग्य सहाय्यक',
  'आरोग्य सेवक',
  'आरोग्य सेविका (ANM)',
  'समुदाय आरोग्य अधिकारी (CHO)',
  'आशा स्वयंसेविका (ASHA)',
  'अंगणवाडी सेविका',
  'प्रयोगशाळा तंत्रज्ञ',
  'औषध निर्माण अधिकारी',
] as const;

/**
 * Generates a unique date key per work log entry so multiple entries on the same calendar date
 * never collide with Special_Event_Master's duplicate date check in Google Apps Script.
 */
export function makeWorkLogDateKey(isoDate: string, existingRawDateKey?: string): string {
  const cleanIso = isoDate.trim().slice(0, 10);
  if (
    existingRawDateKey &&
    existingRawDateKey.startsWith(`${WORK_LOG_DATE_PREFIX}${cleanIso}`)
  ) {
    return existingRawDateKey;
  }
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return `${WORK_LOG_DATE_PREFIX}${cleanIso}__${uniqueSuffix}`;
}

export function extractWorkDateFromKey(rawDateKey: string): string {
  const stripped = (rawDateKey || '').replace(new RegExp(`^${WORK_LOG_DATE_PREFIX}`), '').trim();
  return stripped.split('__')[0].slice(0, 10);
}

export function getDayNameForIsoDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : MARATHI_DAYS_BY_INDEX[d.getDay()] || '';
}

function splitCommaList(raw: string): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseDailyWorkLogFromRecord(ev: SpecialEventMaster): DailyWorkLogEntryItem | null {
  if (!ev || typeof ev.date !== 'string' || !ev.date.startsWith(WORK_LOG_DATE_PREFIX)) {
    return null;
  }
  const workDate = extractWorkDateFromKey(ev.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return null;
  }

  let villages: string[] = splitCommaList(ev.location || '');
  let staff: string[] = [];
  let detail = (ev.workDescription || '').trim();

  const rawNotes = (ev.notes || '').trim();
  if (rawNotes.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawNotes) as EncodedWorkLogAny;
      if (parsed.v === 2) {
        if (Array.isArray(parsed.villages) && parsed.villages.length > 0) {
          villages = parsed.villages.map((v: string) => String(v || '').trim()).filter(Boolean);
        }
        if (Array.isArray(parsed.staff)) {
          staff = parsed.staff.map((s: string) => String(s || '').trim()).filter(Boolean);
        }
        if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
          detail = parsed.detail.trim();
        }
      } else {
        // Legacy v1 format compatibility
        if (typeof parsed.stf === 'string' && parsed.stf.trim()) {
          staff = splitCommaList(parsed.stf);
        }
        const ptsLines: string[] = [];
        if (Array.isArray(parsed.pts)) {
          for (const pt of parsed.pts) {
            const d = String(pt?.detail || '').trim();
            const cnt = String(pt?.beneficiariesOrCount || '').trim();
            if (d) {
              ptsLines.push(cnt ? `${d} (${cnt})` : d);
            }
          }
        }
        const sumText = String(parsed.sum || '').trim();
        if (ptsLines.length > 0) {
          detail = sumText ? `${ptsLines.join('\n')}\n${sumText}` : ptsLines.join('\n');
        } else if (sumText) {
          detail = sumText;
        }
      }
    } catch {
      // fallback to ev.workDescription
    }
  } else if (rawNotes && !detail) {
    detail = rawNotes;
  }

  if (villages.length === 0 && ev.location?.trim()) {
    villages = [ev.location.trim()];
  }

  return {
    id: ev.id,
    rawDateKey: ev.date,
    workDate,
    dayNameMarathi: getDayNameForIsoDate(workDate),
    villages,
    staff,
    detail: detail || `दि. ${formatDateDDMMYYYY(workDate)} रोजीचा सविस्तर कामाचा तपशील`,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
  };
}

export function encodeDailyWorkLogToSpecialEventPayload(input: {
  workDate: string;
  existingRawDateKey?: string;
  villages: string[];
  staff: string[];
  detail: string;
}): Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'> {
  const cleanVillages = Array.from(
    new Set(input.villages.map((v) => v.trim()).filter(Boolean))
  );
  const cleanStaff = Array.from(
    new Set(input.staff.map((s) => s.trim()).filter(Boolean))
  );
  const cleanDetail = input.detail.trim();

  const encodedNotes: EncodedWorkLogV2 = {
    v: 2,
    villages: cleanVillages,
    staff: cleanStaff,
    detail: cleanDetail,
  };

  return {
    date: makeWorkLogDateKey(input.workDate, input.existingRawDateKey),
    eventType: cleanStaff.join(', ') || 'सविस्तर कामाचा वृत्तांत',
    location: cleanVillages.join(', '),
    workDescription: cleanDetail,
    notes: JSON.stringify(encodedNotes),
  };
}
