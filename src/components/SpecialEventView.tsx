import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { SpecialEventMaster, VillageMaster } from '../shared/types.ts';
import {
  formatDateDDMMYYYY,
  MARATHI_DAYS_BY_INDEX,
  SPECIAL_EVENT_TYPES,
  SPECIAL_WORK_DESCRIPTIONS,
} from '../shared/marathi.ts';
import { isMeetingRuleRecord } from '../shared/meetingRules.ts';
import {
  encodeSpecialEventNotesWithTravelMeta,
  encodeVillageNotesWithTravelMeta,
  extractHeadquarterCities,
  parseSpecialEventTravelMeta,
  parseVillageTravelMeta,
} from '../shared/travelMeta.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface SpecialEventViewProps {
  events: SpecialEventMaster[];
  villages: VillageMaster[];
  onCreate: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateVillage?: (
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) => Promise<void>;
}

interface MultiOptionItem {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectWithOtherProps {
  label: string;
  required?: boolean;
  options: MultiOptionItem[];
  selected: string[];
  onChangeSelected: (next: string[]) => void;
  otherEnabled: boolean;
  onToggleOther: (enabled: boolean) => void;
  otherText: string;
  onChangeOtherText: (val: string) => void;
  otherLabel: string;
  otherPlaceholder: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyOptionsHint?: string;
}

const MultiSelectWithOther: React.FC<MultiSelectWithOtherProps> = ({
  label,
  required = false,
  options,
  selected,
  onChangeSelected,
  otherEnabled,
  onToggleOther,
  otherText,
  onChangeOtherText,
  otherLabel,
  otherPlaceholder,
  searchable = false,
  searchPlaceholder = 'शोधा...',
  emptyOptionsHint,
}) => {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ? o.sublabel.toLowerCase().includes(q) : false)
    );
  }, [options, query]);

  const toggleValue = (val: string) => {
    if (selected.includes(val)) {
      onChangeSelected(selected.filter((x) => x !== val));
    } else {
      onChangeSelected([...selected, val]);
    }
  };

  const totalSelectedCount = selected.length + (otherEnabled && otherText.trim() ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
        {totalSelectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-teal-800">
              निवडलेले: <span className="font-mono-num">{totalSelectedCount}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                onChangeSelected([]);
                onToggleOther(false);
                onChangeOtherText('');
              }}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              सर्व काढा
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        {searchable && options.length > 5 && (
          <div className="relative border-b border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
            />
          </div>
        )}

        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-500">
              {emptyOptionsHint || 'कोणताही पर्याय आढळला नाही.'}
            </p>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition-colors ${
                    isChecked ? 'bg-teal-50/70 text-teal-950' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleValue(opt.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-700"
                  />
                  <span className="flex-1 leading-snug">
                    <span className={isChecked ? 'font-semibold' : ''}>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="ml-1.5 text-xs text-slate-500">({opt.sublabel})</span>
                    )}
                  </span>
                </label>
              );
            })
          )}

          {/* Dedicated "इतर" (Other) Option */}
          <label
            className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm border-t border-slate-200 transition-colors ${
              otherEnabled ? 'bg-amber-50/70 text-amber-950 font-medium' : 'bg-slate-50/50 text-slate-700 hover:bg-slate-100/70'
            }`}
          >
            <input
              type="checkbox"
              checked={otherEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                onToggleOther(checked);
                if (!checked) onChangeOtherText('');
              }}
              className="h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-700"
            />
            <span>{otherLabel}</span>
          </label>
        </div>
      </div>

      {/* Custom text input when "इतर" is selected */}
      {otherEnabled && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => onChangeOtherText(e.target.value)}
          placeholder={otherPlaceholder}
          className="w-full rounded-lg border border-teal-400 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
        />
      )}

      {/* Selected summary preview */}
      {totalSelectedCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selected.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900"
            >
              <Check className="h-3 w-3 text-teal-700" />
              {val}
              <button
                type="button"
                onClick={() => toggleValue(val)}
                aria-label={`${val} काढा`}
                className="ml-0.5 text-teal-700 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {otherEnabled && otherText.trim() && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
              इतर: {otherText.trim()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Splits a saved comma-separated string back into matching known options + leftover "इतर" custom text.
 */
function parseSavedMultiValue(
  raw: string,
  knownValues: string[]
): { selected: string[]; otherEnabled: boolean; otherText: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { selected: [], otherEnabled: false, otherText: '' };
  }

  const knownSet = new Map<string, string>();
  for (const kv of knownValues) {
    knownSet.set(kv.trim().toLowerCase(), kv);
  }

  const parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const selected: string[] = [];
  const unknownParts: string[] = [];

  for (const part of parts) {
    const matched = knownSet.get(part.toLowerCase());
    if (matched) {
      if (!selected.includes(matched)) selected.push(matched);
    } else {
      unknownParts.push(part);
    }
  }

  const otherText = unknownParts.join(', ');
  return {
    selected,
    otherEnabled: otherText.length > 0,
    otherText,
  };
}

function combineMultiValue(selected: string[], otherEnabled: boolean, otherText: string): string {
  const items = [...selected];
  const custom = otherEnabled ? otherText.trim() : '';
  if (custom) {
    items.push(custom);
  }
  return items.join(', ');
}

export const SpecialEventView: React.FC<SpecialEventViewProps> = ({
  events,
  villages,
  onCreate,
  onUpdate,
  onDelete,
  onCreateVillage,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('2026-04-20');
  const [notes, setNotes] = useState('');

  // 1) कार्यक्रमाचा प्रकार (multi-select + इतर)
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([SPECIAL_EVENT_TYPES[0]]);
  const [otherEventTypeEnabled, setOtherEventTypeEnabled] = useState(false);
  const [otherEventTypeText, setOtherEventTypeText] = useState('');

  // 2) गावाचे नाव / कोठे (multi-select from Village_Master + इतर गाव + एका वेळचे किमी अंतर)
  const [selectedVillages, setSelectedVillages] = useState<string[]>([]);
  const [otherLocationEnabled, setOtherLocationEnabled] = useState(false);
  const [otherLocationText, setOtherLocationText] = useState('');
  const [otherLocationOneWayKm, setOtherLocationOneWayKm] = useState('');
  const [saveNewVillageToMaster, setSaveNewVillageToMaster] = useState(true);

  // 3) कामाचे स्वरूप (multi-select + इतर)
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [otherWorkEnabled, setOtherWorkEnabled] = useState(false);
  const [otherWorkText, setOtherWorkText] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SpecialEventMaster | null>(null);

  const visibleEvents = useMemo(
    () => events.filter((ev) => !isMeetingRuleRecord(ev)),
    [events]
  );

  const villageOptions: MultiOptionItem[] = useMemo(() => {
    const { talukaHq, districtHq, regularVillages } = extractHeadquarterCities(villages);
    const seen = new Set<string>();
    const list: MultiOptionItem[] = [];
    for (const v of regularVillages) {
      const name = v.name.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const vMeta = parseVillageTravelMeta(v);
      const kmInfo = vMeta.distanceKm !== null && vMeta.distanceKm > 0 ? `${vMeta.distanceKm} किमी` : '';
      const subInfo = v.subcenterName ? `उपकेंद्र ${v.subcenterName}` : '';
      const combinedSub = [subInfo, kmInfo].filter(Boolean).join(' · ');
      list.push({
        value: name,
        label: name,
        sublabel: combinedSub || undefined,
      });
    }
    list.sort((a, b) => a.label.localeCompare(b.label, 'mr'));

    for (const hq of [
      { name: talukaHq.name, roleLabel: 'तालुका मुख्यालय शहर', km: talukaHq.distanceKm },
      { name: districtHq.name, roleLabel: 'जिल्हा मुख्यालय शहर', km: districtHq.distanceKm },
    ]) {
      const clean = hq.name.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        const kmText = hq.km !== null && hq.km > 0 ? ` · ${hq.km} किमी` : '';
        list.push({
          value: clean,
          label: clean,
          sublabel: `${hq.roleLabel}${kmText}`,
        });
      }
    }
    return list;
  }, [villages]);

  const eventTypeOptions: MultiOptionItem[] = useMemo(
    () => SPECIAL_EVENT_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  const workDescriptionOptions: MultiOptionItem[] = useMemo(
    () => SPECIAL_WORK_DESCRIPTIONS.map((w) => ({ value: w, label: w })),
    []
  );

  const resetForm = () => {
    setEditingId(null);
    setDate('2026-04-20');
    setSelectedEventTypes([SPECIAL_EVENT_TYPES[0]]);
    setOtherEventTypeEnabled(false);
    setOtherEventTypeText('');
    setSelectedVillages([]);
    setOtherLocationEnabled(false);
    setOtherLocationText('');
    setOtherLocationOneWayKm('');
    setSaveNewVillageToMaster(true);
    setSelectedWorkTypes([]);
    setOtherWorkEnabled(false);
    setOtherWorkText('');
    setNotes('');
    setValidationError(null);
  };

  const handleEdit = (ev: SpecialEventMaster) => {
    setEditingId(ev.id);
    setDate(ev.date);
    const parsedMeta = parseSpecialEventTravelMeta(ev.notes || '');
    setNotes(parsedMeta.cleanNotes);
    setOtherLocationOneWayKm(
      parsedMeta.oneWayDistanceKm !== null ? String(parsedMeta.oneWayDistanceKm) : ''
    );
    setValidationError(null);

    const parsedType = parseSavedMultiValue(ev.eventType, SPECIAL_EVENT_TYPES);
    setSelectedEventTypes(parsedType.selected);
    setOtherEventTypeEnabled(parsedType.otherEnabled);
    setOtherEventTypeText(parsedType.otherText);

    const parsedLoc = parseSavedMultiValue(
      ev.location,
      villageOptions.map((o) => o.value)
    );
    setSelectedVillages(parsedLoc.selected);
    setOtherLocationEnabled(parsedLoc.otherEnabled || parsedMeta.oneWayDistanceKm !== null);
    setOtherLocationText(parsedLoc.otherText);

    const parsedWork = parseSavedMultiValue(ev.workDescription, SPECIAL_WORK_DESCRIPTIONS);
    setSelectedWorkTypes(parsedWork.selected);
    setOtherWorkEnabled(parsedWork.otherEnabled);
    setOtherWorkText(parsedWork.otherText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const finalEventType = combineMultiValue(
      selectedEventTypes,
      otherEventTypeEnabled,
      otherEventTypeText
    );
    const finalLocation = combineMultiValue(
      selectedVillages,
      otherLocationEnabled,
      otherLocationText
    );
    const finalWorkDescription = combineMultiValue(
      selectedWorkTypes,
      otherWorkEnabled,
      otherWorkText
    );

    if (!date) {
      setValidationError('कृपया दिनांक निवडा.');
      return;
    }
    if (!finalEventType) {
      setValidationError('कृपया किमान एक कार्यक्रमाचा प्रकार निवडा किंवा "इतर" मध्ये लिहा.');
      return;
    }
    if (!finalLocation) {
      setValidationError('कृपया यादीतून किमान एक गाव निवडा किंवा "इतर / नवीन गाव" मध्ये नाव लिहा.');
      return;
    }
    if (!finalWorkDescription) {
      setValidationError('कृपया किमान एक कामाचे स्वरूप निवडा किंवा "इतर" मध्ये लिहा.');
      return;
    }

    let parsedOneWayKm: number | null = null;
    const rawKmTrimmed = otherLocationOneWayKm.trim();
    if (otherLocationEnabled && rawKmTrimmed !== '') {
      const num = Number(rawKmTrimmed);
      if (!Number.isFinite(num) || num < 0) {
        setValidationError('कृपया एका वेळचे अंतर (किमी) वैध अंकात प्रविष्ट करा (उदा. 12).');
        return;
      }
      parsedOneWayKm = num;
    }

    const encodedNotes = encodeSpecialEventNotesWithTravelMeta(notes.trim(), parsedOneWayKm);

    const payload = {
      date,
      eventType: finalEventType,
      location: finalLocation,
      workDescription: finalWorkDescription,
      notes: encodedNotes,
    };

    setSubmitting(true);
    try {
      // If user entered a brand new village name in "इतर / नवीन गाव" with distance and checked "गावे मास्टरमध्ये जतन करा"
      const customVillageNames = otherLocationEnabled
        ? otherLocationText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (onCreateVillage && saveNewVillageToMaster && customVillageNames.length > 0) {
        const existingNamesLower = new Set(villages.map((v) => v.name.trim().toLowerCase()));
        for (const newName of customVillageNames) {
          if (!existingNamesLower.has(newName.toLowerCase())) {
            try {
              await onCreateVillage({
                name: newName,
                subcenterId: '',
                subcenterName: '',
                population: '',
                notes: encodeVillageNotesWithTravelMeta('', parsedOneWayKm, 'village'),
              });
              existingNamesLower.add(newName.toLowerCase());
            } catch {
              // Ignore duplicate/optional village creation error; Special Event still saves
            }
          }
        }
      }

      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSubmitting(false);
    }
  };

  const getDayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : MARATHI_DAYS_BY_INDEX[d.getDay()];
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">विशेष कार्यक्रम व्यवस्थापन</h1>
        <p className="mt-1 text-sm text-slate-600">
          आरोग्य अभियान, विशेष लसीकरण सत्र, वरिष्ठ अधिकाऱ्यांची भेट, जिल्हा/तालुका बैठक किंवा प्रशिक्षण कार्यक्रम येथे नोंदवा. नवीन गाव जोडताना त्या गावाचे प्रा. आ. केंद्रापासूनचे एका वेळचे (One-Way) किमी अंतर प्रविष्ट करता येते.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'विशेष कार्यक्रम बदला' : 'नवीन विशेष कार्यक्रम जोडा'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {validationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {validationError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              दिनांक <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              निवडलेला दिनांक: {formatDateDDMMYYYY(date)} ({getDayLabel(date)})
            </p>
          </div>

          {/* 1) कार्यक्रमाचा प्रकार — Multi-select + इतर */}
          <MultiSelectWithOther
            label="कार्यक्रमाचा प्रकार"
            required
            options={eventTypeOptions}
            selected={selectedEventTypes}
            onChangeSelected={setSelectedEventTypes}
            otherEnabled={otherEventTypeEnabled}
            onToggleOther={setOtherEventTypeEnabled}
            otherText={otherEventTypeText}
            onChangeOtherText={setOtherEventTypeText}
            otherLabel="इतर कार्यक्रमाचा प्रकार (स्वतः लिहा)"
            otherPlaceholder="उदा. विशेष कुष्ठरोग तपासणी मोहीम"
          />

          {/* 2) गावाचे नाव / कोठे — Multi-select Village Master list + इतर गाव + एका वेळचे किलोमीटर */}
          <div className="space-y-2.5">
            <MultiSelectWithOther
              label="गावाचे नाव / कोठे"
              required
              searchable
              searchPlaceholder="गाव शोधा..."
              options={villageOptions}
              selected={selectedVillages}
              onChangeSelected={setSelectedVillages}
              otherEnabled={otherLocationEnabled}
              onToggleOther={(enabled) => {
                setOtherLocationEnabled(enabled);
                if (!enabled) {
                  setOtherLocationOneWayKm('');
                }
              }}
              otherText={otherLocationText}
              onChangeOtherText={setOtherLocationText}
              otherLabel="नवीन / इतर गाव किंवा ठिकाण जोडा (स्वतः लिहा)"
              otherPlaceholder="नवीन गावाचे नाव किंवा ठिकाण लिहा (उदा. किल्लारी / निलंगा)"
              emptyOptionsHint="गावांची यादी रिकामी आहे. तुम्ही 'नवीन / इतर गाव' निवडून नाव लिहू शकता."
            />

            {otherLocationEnabled && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-800">
                    नवीन गावाचे प्रा. आ. केंद्रापासून एका वेळचे अंतर (किमी)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={otherLocationOneWayKm}
                      onChange={(e) => setOtherLocationOneWayKm(e.target.value)}
                      placeholder="उदा. 15"
                      className="w-36 rounded-lg border border-teal-400 bg-white px-3 py-1.5 text-sm font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600">
                      किमी (एका बाजूचे)
                      {otherLocationOneWayKm.trim() &&
                        Number.isFinite(Number(otherLocationOneWayKm)) &&
                        Number(otherLocationOneWayKm) > 0 && (
                          <strong className="ml-1.5 text-teal-800">
                            → दैनंदिनीत जाऊन-येऊन एकूण: {Math.round(Number(otherLocationOneWayKm) * 2 * 10) / 10} किमी
                          </strong>
                        )}
                    </span>
                  </div>
                </div>

                {onCreateVillage && otherLocationText.trim() && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={saveNewVillageToMaster}
                      onChange={(e) => setSaveNewVillageToMaster(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-teal-700"
                    />
                    <span>
                      हे नवीन गाव व त्याचे अंतर पुढील वापरासाठी <strong>गावे मास्टर</strong> मध्येही जतन करा
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* 3) कामाचे स्वरूप — Multi-select + इतर */}
          <MultiSelectWithOther
            label="कामाचे स्वरूप"
            required
            searchable
            searchPlaceholder="कामाचे स्वरूप शोधा..."
            options={workDescriptionOptions}
            selected={selectedWorkTypes}
            onChangeSelected={setSelectedWorkTypes}
            otherEnabled={otherWorkEnabled}
            onToggleOther={setOtherWorkEnabled}
            otherText={otherWorkText}
            onChangeOtherText={setOtherWorkText}
            otherLabel="इतर कामाचे स्वरूप (स्वतः लिहा)"
            otherPlaceholder="उदा. विशेष लसीकरण व जनजागृती मोहीम"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700">टिप्पणी</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ऐच्छिक टिप्पणी"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'जतन होत आहे...' : editingId ? 'कार्यक्रम अपडेट करा' : 'कार्यक्रम जतन करा'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                रद्द
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white h-fit">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              नोंदवलेले विशेष कार्यक्रम (<span className="font-mono-num">{visibleEvents.length}</span>)
            </h2>
          </div>

          {visibleEvents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Sparkles className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">अद्याप कोणताही विशेष कार्यक्रम नाही</p>
              <p className="mt-1 text-xs text-slate-500">
                विशेष मोहीम, वरिष्ठ भेट किंवा प्रशिक्षणाची नोंद डाव्या फॉर्ममधून करा.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-12">अ.क्र.</th>
                    <th className="px-4 py-3 w-40">दिनांक</th>
                    <th className="px-4 py-3">कोठे (गावे / ठिकाण)</th>
                    <th className="px-4 py-3">कामाचे स्वरूप व प्रकार</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleEvents.map((ev, idx) => {
                    const evMeta = parseSpecialEventTravelMeta(ev.notes || '');
                    return (
                      <tr key={`${ev.id}-${ev.date}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono-num font-medium text-slate-900">
                            {formatDateDDMMYYYY(ev.date)}
                          </span>
                          <span className="ml-1.5 text-xs text-slate-500">({getDayLabel(ev.date)})</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{ev.location}</div>
                          {evMeta.oneWayDistanceKm !== null && evMeta.oneWayDistanceKm > 0 && (
                            <div className="mt-0.5 text-xs font-mono-num text-teal-700">
                              एकमार्ग: {evMeta.oneWayDistanceKm} किमी (एकूण: {Math.round(evMeta.oneWayDistanceKm * 2 * 10) / 10} किमी)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{ev.workDescription}</div>
                          <div className="text-xs text-slate-500">
                            {ev.eventType}
                            {evMeta.cleanNotes ? ` · ${evMeta.cleanNotes}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(ev)}
                              title="संपादित करा"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(ev)}
                              title="हटवा"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        danger
        title="विशेष कार्यक्रम हटवायचा का?"
        description={
          deleteTarget
            ? `दिनांक ${formatDateDDMMYYYY(deleteTarget.date)} (${deleteTarget.location}) हा विशेष कार्यक्रम हटवला जाईल.`
            : ''
        }
        confirmLabel="होय, हटवा"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
