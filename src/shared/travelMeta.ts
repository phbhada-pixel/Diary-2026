import type { MonthlyDiaryEntry, VillageMaster } from './types.ts';

export type VillageHqRole = 'village' | 'taluka_hq' | 'district_hq';

export const DEFAULT_TRAVEL_MODE = 'बस';

export const TRAVEL_MODE_OPTIONS = [
  'बस',
  'दुचाकी',
  'शासकीय वाहन',
  'खाजगी वाहन',
  'पायी',
  '—',
] as const;

export const DEFAULT_TALUKA_HQ_CITY = 'औसा';
export const DEFAULT_DISTRICT_HQ_CITY = 'लातूर';

const DIST_TAG_RE = /\s*\[DIST_KM:([0-9]+(?:\.[0-9]+)?)\]\s*/gi;
const HQ_ROLE_TAG_RE = /\s*\[HQ_ROLE:(taluka_hq|district_hq)\]\s*/gi;
const ENTRY_MODE_TAG_RE = /\s*\[MODE:([^\]]+)\]\s*/gi;
const ENTRY_KM_TAG_RE = /\s*\[KM:([0-9]+(?:\.[0-9]+)?)\]\s*/gi;

export interface ParsedVillageTravelMeta {
  distanceKm: number | null;
  hqRole: VillageHqRole;
  cleanNotes: string;
}

/**
 * Extracts structured distance (one-way km from PHC) and HQ role (taluka_hq / district_hq)
 * stored reversibly inside VillageMaster.notes without requiring spreadsheet schema changes.
 */
export function parseVillageTravelMeta(
  village: Pick<VillageMaster, 'notes' | 'subcenterId' | 'subcenterName'>
): ParsedVillageTravelMeta {
  const raw = village.notes || '';
  let distanceKm: number | null = null;
  let hqRole: VillageHqRole = 'village';

  const distMatch = /\[DIST_KM:([0-9]+(?:\.[0-9]+)?)\]/i.exec(raw);
  if (distMatch) {
    const parsed = Number(distMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      distanceKm = parsed;
    }
  }

  const roleMatch = /\[HQ_ROLE:(taluka_hq|district_hq)\]/i.exec(raw);
  if (roleMatch) {
    hqRole = roleMatch[1].toLowerCase() as VillageHqRole;
  } else if (village.subcenterId === '__TALUKA_HQ__' || village.subcenterName === 'तालुका मुख्यालय') {
    hqRole = 'taluka_hq';
  } else if (village.subcenterId === '__DISTRICT_HQ__' || village.subcenterName === 'जिल्हा मुख्यालय') {
    hqRole = 'district_hq';
  }

  const cleanNotes = raw
    .replace(DIST_TAG_RE, ' ')
    .replace(HQ_ROLE_TAG_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { distanceKm, hqRole, cleanNotes };
}

export function encodeVillageNotesWithTravelMeta(
  cleanNotes: string,
  distanceKm: number | null | undefined,
  hqRole: VillageHqRole = 'village'
): string {
  const base = (cleanNotes || '')
    .replace(DIST_TAG_RE, ' ')
    .replace(HQ_ROLE_TAG_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const tags: string[] = [];
  if (hqRole === 'taluka_hq' || hqRole === 'district_hq') {
    tags.push(`[HQ_ROLE:${hqRole}]`);
  }
  if (distanceKm !== null && distanceKm !== undefined && Number.isFinite(distanceKm) && distanceKm >= 0) {
    const normalized = Math.round(distanceKm * 10) / 10;
    tags.push(`[DIST_KM:${normalized}]`);
  }

  if (tags.length === 0) return base;
  return base ? `${base} ${tags.join(' ')}` : tags.join(' ');
}

export interface HeadquarterCityConfig {
  id: string | null;
  name: string;
  distanceKm: number | null;
  record: VillageMaster | null;
}

export interface ExtractedLocations {
  talukaHq: HeadquarterCityConfig;
  districtHq: HeadquarterCityConfig;
  regularVillages: VillageMaster[];
}

export function extractHeadquarterCities(villages: VillageMaster[] = []): ExtractedLocations {
  let talukaRec: VillageMaster | null = null;
  let talukaDist: number | null = null;
  let districtRec: VillageMaster | null = null;
  let districtDist: number | null = null;
  const regularVillages: VillageMaster[] = [];

  for (const v of villages) {
    const meta = parseVillageTravelMeta(v);
    if (meta.hqRole === 'taluka_hq' && !talukaRec) {
      talukaRec = v;
      talukaDist = meta.distanceKm;
    } else if (meta.hqRole === 'district_hq' && !districtRec) {
      districtRec = v;
      districtDist = meta.distanceKm;
    } else {
      regularVillages.push(v);
    }
  }

  return {
    talukaHq: {
      id: talukaRec?.id ?? null,
      name: talukaRec?.name?.trim() || DEFAULT_TALUKA_HQ_CITY,
      distanceKm: talukaDist,
      record: talukaRec,
    },
    districtHq: {
      id: districtRec?.id ?? null,
      name: districtRec?.name?.trim() || DEFAULT_DISTRICT_HQ_CITY,
      distanceKm: districtDist,
      record: districtRec,
    },
    regularVillages,
  };
}

/**
 * Normalizes Marathi spelling variations (e.g. लखनगाव vs लखणगाव, बु vs बू, खु vs खू)
 * so distances match reliably across Village Master, Subcenter Master, and Diary entries.
 */
function normalizeMarathiPlaceKey(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/उपकेंद्र/gu, '')
    .replace(/[.,()\-—–/]/gu, ' ')
    .replace(/ण/gu, 'न')
    .replace(/ू/gu, 'ु')
    .replace(/ी/gu, 'ि')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function stripEntryTravelTags(rawNotes: string): string {
  return (rawNotes || '')
    .replace(ENTRY_MODE_TAG_RE, ' ')
    .replace(ENTRY_KM_TAG_RE, ' ')
    .replace(DIST_TAG_RE, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Splits clean entry notes into an array of individual detailed work notes for a date.
 * Supports newline-separated or " || " separated multiple work notes.
 */
export function parseDetailedWorkNotes(cleanNotes: string): string[] {
  if (!cleanNotes || !cleanNotes.trim()) return [];
  const rawItems = cleanNotes
    .split(/\r?\n|\s*\|\|\s*/u)
    .map((line) => line.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/u, '').trim())
    .filter(Boolean);
  return rawItems;
}

/**
 * Encodes an array of multiple detailed work notes back into a clean newline-separated string.
 */
export function encodeDetailedWorkNotes(notesList: string[]): string {
  return notesList
    .map((n) => n.trim())
    .filter(Boolean)
    .join('\n');
}

export interface ParsedSpecialEventTravelMeta {
  oneWayDistanceKm: number | null;
  cleanNotes: string;
}

/**
 * Extracts optional one-way distance in km ([DIST_KM:x]) stored inside SpecialEventMaster.notes
 * when a new/custom village or location is entered during Special Event registration.
 */
export function parseSpecialEventTravelMeta(rawNotes: string): ParsedSpecialEventTravelMeta {
  const raw = rawNotes || '';
  let oneWayDistanceKm: number | null = null;

  const distMatch = /\[DIST_KM:([0-9]+(?:\.[0-9]+)?)\]/i.exec(raw);
  if (distMatch) {
    const parsed = Number(distMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      oneWayDistanceKm = parsed;
    }
  } else {
    const kmMatch = /\[KM:([0-9]+(?:\.[0-9]+)?)\]/i.exec(raw);
    if (kmMatch) {
      const parsed = Number(kmMatch[1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        oneWayDistanceKm = Math.round((parsed / 2) * 10) / 10;
      }
    }
  }

  const cleanNotes = raw
    .replace(DIST_TAG_RE, ' ')
    .replace(ENTRY_KM_TAG_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { oneWayDistanceKm, cleanNotes };
}

export function encodeSpecialEventNotesWithTravelMeta(
  cleanNotes: string,
  oneWayDistanceKm: number | null | undefined
): string {
  const base = (cleanNotes || '')
    .replace(DIST_TAG_RE, ' ')
    .replace(ENTRY_KM_TAG_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (
    oneWayDistanceKm !== null &&
    oneWayDistanceKm !== undefined &&
    Number.isFinite(oneWayDistanceKm) &&
    oneWayDistanceKm > 0
  ) {
    const normalized = Math.round(oneWayDistanceKm * 10) / 10;
    const tag = `[DIST_KM:${normalized}]`;
    return base ? `${base} ${tag}` : tag;
  }
  return base;
}

export function encodeEntryTravelOverrideInNotes(
  cleanNotes: string,
  travelMode: string,
  distanceKm: number | null
): string {
  const base = stripEntryTravelTags(cleanNotes);
  const tags: string[] = [];
  const modeClean = (travelMode || '').trim();
  if (modeClean) {
    tags.push(`[MODE:${modeClean}]`);
  }
  if (distanceKm !== null && Number.isFinite(distanceKm) && distanceKm >= 0) {
    const normalized = Math.round(distanceKm * 10) / 10;
    tags.push(`[KM:${normalized}]`);
  }
  if (tags.length === 0) return base;
  return base ? `${base} ${tags.join(' ')}` : tags.join(' ');
}

export interface ResolvedEntryTravel {
  travelMode: string;
  /** Round-trip distance in km (जाणे-येणे = 2 × one-way km from PHC) */
  distanceKm: number;
  /** One-way distance in km from PHC (if matched) */
  oneWayKm: number | null;
  /** True when the day involves outstation travel away from PHC HQ */
  isOutstation: boolean;
}

function isHeadquartersOrNonTravelPlace(place: string): boolean {
  const norm = normalizeMarathiPlaceKey(place);
  if (!norm) return true;
  if (norm === 'रजा') return true;
  if (norm === 'भादा' || norm === 'भादा मुख्यालय') return true;
  if (norm.includes('प्राथमिक आरोग्य केंद्र भादा') || norm.includes('भादा मुख्यालय')) return true;
  return false;
}

/**
 * Resolves the travel mode (default "बस" for outstation visits) and round-trip kilometers
 * for any Monthly Diary row using Village distances + Taluka HQ + District HQ distances
 * + any one-way distance ([DIST_KM:x]) recorded on a Special Event for a newly added village.
 */
export function resolveDiaryEntryTravel(
  entry: MonthlyDiaryEntry,
  displayToPlace: string,
  villages: VillageMaster[] = []
): ResolvedEntryTravel {
  const rawNotes = entry.notes || '';
  const modeMatch = /\[MODE:([^\]]+)\]/i.exec(rawNotes);
  const kmMatch = /\[KM:([0-9]+(?:\.[0-9]+)?)\]/i.exec(rawNotes);
  const distOneWayMatch = /\[DIST_KM:([0-9]+(?:\.[0-9]+)?)\]/i.exec(rawNotes);
  const manualMode = modeMatch ? modeMatch[1].trim() : null;
  const manualKm = kmMatch && Number.isFinite(Number(kmMatch[1])) ? Number(kmMatch[1]) : null;
  const customOneWayKm =
    distOneWayMatch && Number.isFinite(Number(distOneWayMatch[1]))
      ? Number(distOneWayMatch[1])
      : null;

  const isNonTravelType =
    entry.entryType === 'sunday' ||
    entry.entryType === 'holiday' ||
    entry.entryType === 'leave' ||
    entry.entryType === 'wednesday_weekly' ||
    entry.entryType === 'wednesday_asha' ||
    entry.entryType === 'office_work';

  const isHqPlace = isHeadquartersOrNonTravelPlace(displayToPlace);
  const isOutstation = !isNonTravelType && !isHqPlace;

  // Non-travel days (unless explicitly overridden by manual edit tags)
  if (!isOutstation && manualMode === null && manualKm === null && customOneWayKm === null) {
    return {
      travelMode: '—',
      distanceKm: 0,
      oneWayKm: 0,
      isOutstation: false,
    };
  }

  const { talukaHq, districtHq, regularVillages } = extractHeadquarterCities(villages);

  // Match one-way distance from PHC
  let matchedOneWayKm: number | null = null;

  if (entry.entryType === 'district_meeting' || entry.entryType === 'lab_sample_visit') {
    matchedOneWayKm = districtHq.distanceKm;
  } else if (entry.entryType === 'taluka_meeting') {
    matchedOneWayKm = talukaHq.distanceKm;
  }

  if (matchedOneWayKm === null) {
    const placeNorm = normalizeMarathiPlaceKey(displayToPlace);
    const districtNorm = normalizeMarathiPlaceKey(districtHq.name);
    const talukaNorm = normalizeMarathiPlaceKey(talukaHq.name);

    if (districtNorm && placeNorm.includes(districtNorm) && districtHq.distanceKm !== null) {
      matchedOneWayKm = districtHq.distanceKm;
    } else if (talukaNorm && placeNorm.includes(talukaNorm) && talukaHq.distanceKm !== null) {
      matchedOneWayKm = talukaHq.distanceKm;
    } else {
      // Match against all registered villages (supports single village, subcenter, or multi-village special event)
      const parts = displayToPlace
        .split(',')
        .map((p) => normalizeMarathiPlaceKey(p))
        .filter(Boolean);

      let maxFoundKm: number | null = null;
      for (const v of regularVillages) {
        const meta = parseVillageTravelMeta(v);
        if (meta.distanceKm === null) continue;
        const vNorm = normalizeMarathiPlaceKey(v.name);
        if (!vNorm) continue;

        const matched =
          parts.some((p) => p === vNorm || p.includes(vNorm) || vNorm.includes(p)) ||
          placeNorm === vNorm ||
          placeNorm.includes(vNorm);

        if (matched) {
          if (maxFoundKm === null || meta.distanceKm > maxFoundKm) {
            maxFoundKm = meta.distanceKm;
          }
        }
      }
      if (customOneWayKm !== null && customOneWayKm >= 0) {
        if (maxFoundKm === null || customOneWayKm > maxFoundKm) {
          maxFoundKm = customOneWayKm;
        }
      }
      matchedOneWayKm = maxFoundKm;
    }
  }

  if (customOneWayKm !== null && customOneWayKm >= 0) {
    if (matchedOneWayKm === null || customOneWayKm > matchedOneWayKm) {
      matchedOneWayKm = customOneWayKm;
    }
  }

  const autoRoundTripKm =
    matchedOneWayKm !== null && matchedOneWayKm > 0
      ? Math.round(matchedOneWayKm * 2 * 10) / 10
      : 0;

  const finalKm = manualKm !== null ? manualKm : autoRoundTripKm;
  const finalMode = manualMode !== null ? manualMode : isOutstation ? DEFAULT_TRAVEL_MODE : '—';

  return {
    travelMode: finalMode,
    distanceKm: finalKm,
    oneWayKm: matchedOneWayKm,
    isOutstation: isOutstation || finalKm > 0 || (finalMode !== '—' && finalMode !== ''),
  };
}
