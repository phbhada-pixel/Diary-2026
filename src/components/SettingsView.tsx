import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type {
  ApplicationSettings,
  HolidayAdjustmentDirection,
  MeetingLevel,
  MeetingRule,
  MeetingScheduleMode,
  MeetingWeekdayKey,
  SpecialEventMaster,
  WeekOccurrence,
} from '../shared/types.ts';
import {
  ALL_WORKING_WEEKDAYS,
  formatDateDDMMYYYY,
  formatDateTimeMarathi,
  MARATHI_DAYS_BY_INDEX,
  WEEK_OCCURRENCES,
} from '../shared/marathi.ts';
import {
  describeMeetingScheduleMarathi,
  isSettingsMeetingRecord,
  MEETING_LEVEL_DEFAULTS,
  MEETING_LEVELS,
  parseMeetingRuleFromSpecialEvent,
  serializeMeetingRuleToSpecialEventPayload,
} from '../shared/meetingRules.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface SettingsViewProps {
  settings: ApplicationSettings;
  specialEvents: SpecialEventMaster[];
  onSave: (payload: Partial<ApplicationSettings>) => Promise<void>;
  onAddMeeting: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onUpdateMeeting: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onDeleteMeeting: (id: string) => Promise<void>;
}

interface MeetingFormState {
  level: MeetingLevel;
  scheduleMode: MeetingScheduleMode;
  location: string;
  workDescription: string;
  preferredStartDay: number;
  preferredEndDay: number;
  weekday: MeetingWeekdayKey;
  weekNumber: WeekOccurrence;
  dayOfMonth: number;
  specificDate: string;
  active: boolean;
  notes: string;
}

const createDefaultMeetingForm = (
  level: MeetingLevel,
  talukaDefaultPlace?: string
): MeetingFormState => {
  const def = MEETING_LEVEL_DEFAULTS[level];
  return {
    level,
    scheduleMode: 'free_working_day',
    location:
      level === 'तालुकास्तरीय बैठक' && talukaDefaultPlace?.trim()
        ? talukaDefaultPlace.trim()
        : def.location,
    workDescription: def.workDescription,
    preferredStartDay: def.preferredStartDay,
    preferredEndDay: def.preferredEndDay,
    weekday: 'thursday',
    weekNumber: 2,
    dayOfMonth: 15,
    specificDate: '2026-04-20',
    active: true,
    notes: '',
  };
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  specialEvents,
  onSave,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
}) => {
  const [form, setForm] = useState({
    holidayAdjustmentDirection: settings.holidayAdjustmentDirection,
    defaultFromPlace: settings.defaultFromPlace,
    implementationDate: settings.implementationDate,
    hqPlace: settings.hqPlace,
    officePlace: settings.officePlace,
    talukaMeetingPlace: settings.talukaMeetingPlace,
    subcenterMeeting1Place: settings.subcenterMeeting1Place,
    subcenterMeeting2Place: settings.subcenterMeeting2Place,
  });
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // District & Taluka Meetings state
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingRule, setEditingRule] = useState<MeetingRule | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingFormState>(() =>
    createDefaultMeetingForm('जिल्हास्तरीय बैठक', settings.talukaMeetingPlace)
  );
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingRule | null>(null);

  useEffect(() => {
    setForm({
      holidayAdjustmentDirection: settings.holidayAdjustmentDirection,
      defaultFromPlace: settings.defaultFromPlace,
      implementationDate: settings.implementationDate,
      hqPlace: settings.hqPlace,
      officePlace: settings.officePlace,
      talukaMeetingPlace: settings.talukaMeetingPlace,
      subcenterMeeting1Place: settings.subcenterMeeting1Place,
      subcenterMeeting2Place: settings.subcenterMeeting2Place,
    });
  }, [settings]);

  const configuredMeetings = useMemo(() => {
    const list: MeetingRule[] = [];
    for (const ev of specialEvents) {
      if (!isSettingsMeetingRecord(ev)) continue;
      const parsed = parseMeetingRuleFromSpecialEvent(ev);
      if (parsed) list.push(parsed);
    }
    return list.sort((a, b) => {
      if (a.isRecurring !== b.isRecurring) return a.isRecurring ? -1 : 1;
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return (a.specificDate || a.createdAt).localeCompare(b.specificDate || b.createdAt);
    });
  }, [specialEvents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSave(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSaving(false);
    }
  };

  const openAddMeeting = (initialLevel: MeetingLevel = 'जिल्हास्तरीय बैठक') => {
    setEditingRule(null);
    setMeetingForm(createDefaultMeetingForm(initialLevel, settings.talukaMeetingPlace));
    setShowMeetingForm(true);
  };

  const openEditMeeting = (rule: MeetingRule) => {
    setEditingRule(rule);
    setMeetingForm({
      level: rule.level,
      scheduleMode: rule.scheduleMode,
      location: rule.location,
      workDescription: rule.workDescription,
      preferredStartDay: rule.preferredStartDay ?? MEETING_LEVEL_DEFAULTS[rule.level].preferredStartDay,
      preferredEndDay: rule.preferredEndDay ?? MEETING_LEVEL_DEFAULTS[rule.level].preferredEndDay,
      weekday: rule.weekday && rule.weekday !== 'saturday' ? rule.weekday : 'thursday',
      weekNumber: rule.weekNumber ?? 2,
      dayOfMonth: rule.dayOfMonth ?? 15,
      specificDate: rule.specificDate ?? '2026-04-20',
      active: rule.active,
      notes: rule.notes,
    });
    setShowMeetingForm(true);
  };

  const closeMeetingForm = () => {
    setShowMeetingForm(false);
    setEditingRule(null);
  };

  const handleMeetingLevelSwitch = (nextLevel: MeetingLevel) => {
    setMeetingForm((prev) => {
      const prevDef = MEETING_LEVEL_DEFAULTS[prev.level];
      const nextDef = MEETING_LEVEL_DEFAULTS[nextLevel];
      const prevTalukaLoc = settings.talukaMeetingPlace || MEETING_LEVEL_DEFAULTS['तालुकास्तरीय बैठक'].location;
      const shouldReplaceLocation =
        !prev.location.trim() ||
        prev.location.trim() === prevDef.location ||
        prev.location.trim() === prevTalukaLoc;
      const shouldReplaceWork =
        !prev.workDescription.trim() || prev.workDescription.trim() === prevDef.workDescription;

      return {
        ...prev,
        level: nextLevel,
        location: shouldReplaceLocation
          ? nextLevel === 'तालुकास्तरीय बैठक'
            ? prevTalukaLoc
            : nextDef.location
          : prev.location,
        workDescription: shouldReplaceWork ? nextDef.workDescription : prev.workDescription,
        preferredStartDay: nextDef.preferredStartDay,
        preferredEndDay: nextDef.preferredEndDay,
      };
    });
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.location.trim() || !meetingForm.workDescription.trim()) return;
    if (meetingForm.scheduleMode === 'specific_date' && !meetingForm.specificDate) return;

    setSavingMeeting(true);
    try {
      const payload = serializeMeetingRuleToSpecialEventPayload({
        ...meetingForm,
        existingRawDateKey: editingRule?.rawDateKey,
      });
      if (editingRule) {
        await onUpdateMeeting(editingRule.id, payload);
      } else {
        await onAddMeeting(payload);
      }
      closeMeetingForm();
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleToggleRuleActive = async (rule: MeetingRule) => {
    if (!rule.isRecurring) return;
    setTogglingId(rule.id);
    try {
      const payload = serializeMeetingRuleToSpecialEventPayload({
        level: rule.level,
        location: rule.location,
        workDescription: rule.workDescription,
        scheduleMode: rule.scheduleMode,
        preferredStartDay: rule.preferredStartDay,
        preferredEndDay: rule.preferredEndDay,
        weekday: rule.weekday,
        weekNumber: rule.weekNumber,
        dayOfMonth: rule.dayOfMonth,
        active: !rule.active,
        notes: rule.notes,
        existingRawDateKey: rule.rawDateKey,
      });
      await onUpdateMeeting(rule.id, payload);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setTogglingId(null);
    }
  };

  const getSpecificDateDayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : MARATHI_DAYS_BY_INDEX[d.getDay()];
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">प्रणाली सेटिंग्ज</h1>
        <p className="mt-1 text-sm text-slate-600">
          मासिक दौरा दैनंदिनी स्वयंचलित तयार करताना वापरले जाणारे सुट्टी समायोजन नियम, जिल्हास्तरीय व तालुकास्तरीय बैठका आणि अनिवार्य कार्यालयांची ठिकाणे येथे निश्चित करा.
        </p>
      </div>

      {/* Section 1: District & Taluka Level Meetings Management (Add Meeting) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-teal-50 p-2 text-teal-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                जिल्हास्तरीय व तालुकास्तरीय बैठक व्यवस्थापन
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                जिल्हास्तरीय किंवा तालुकास्तरीय नियमित मासिक बैठक अथवा ठराविक तारखेची बैठक येथे जोडा. नवीन महिन्याची दैनंदिनी तयार करताना या बैठका आपोआप समाविष्ट होतील.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openAddMeeting('जिल्हास्तरीय बैठक')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            बैठक जोडा
          </button>
        </div>

        {/* Inline Add / Edit Meeting Form */}
        {showMeetingForm && (
          <form
            onSubmit={handleSaveMeeting}
            className="border-b border-slate-200 bg-teal-50/30 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRule ? 'बैठकीची माहिती संपादित करा' : 'नवीन जिल्हास्तरीय / तालुकास्तरीय बैठक जोडा'}
              </h3>
              <button
                type="button"
                onClick={closeMeetingForm}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Meeting Level Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                बैठकीचा स्तर <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MEETING_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleMeetingLevelSwitch(lvl)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      meetingForm.level === lvl
                        ? lvl === 'जिल्हास्तरीय बैठक'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4" />
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                बैठकीचे वेळापत्रक प्रकार <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      mode: 'free_working_day' as MeetingScheduleMode,
                      title: 'दरमहा उपलब्ध कामकाजाच्या दिवशी',
                      desc: 'प्रत्येक महिन्यात रिक्त कामकाजाच्या दिवशी आपोआप',
                    },
                    {
                      mode: 'weekday_occurrence' as MeetingScheduleMode,
                      title: 'दरमहा ठराविक वार व आठवडा',
                      desc: 'उदा. दुसरा गुरुवार किंवा तिसरा शुक्रवार',
                    },
                    {
                      mode: 'fixed_day' as MeetingScheduleMode,
                      title: 'दरमहा ठराविक तारीख',
                      desc: 'उदा. प्रत्येक महिन्याची 15 तारीख (सुट्टी असल्यास समायोजन)',
                    },
                    {
                      mode: 'specific_date' as MeetingScheduleMode,
                      title: 'ठराविक दिनांकास (एकाच तारखेसाठी)',
                      desc: 'फक्त निवडलेल्या एका विशिष्ट तारखेसाठी बैठक',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.mode}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      meetingForm.scheduleMode === item.mode
                        ? 'border-teal-700 bg-white shadow-sm'
                        : 'border-slate-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="meetingScheduleMode"
                        value={item.mode}
                        checked={meetingForm.scheduleMode === item.mode}
                        onChange={() =>
                          setMeetingForm({ ...meetingForm, scheduleMode: item.mode })
                        }
                        className="h-4 w-4 accent-teal-700"
                      />
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-slate-500">{item.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Dynamic Schedule Controls */}
            {meetingForm.scheduleMode === 'free_working_day' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    पसंतीची सुरुवात तारीख (महिन्यातील)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={meetingForm.preferredStartDay}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        preferredStartDay: Math.max(1, Math.min(28, Number(e.target.value) || 1)),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    पसंतीची शेवट तारीख (महिन्यातील)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={meetingForm.preferredEndDay}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        preferredEndDay: Math.max(1, Math.min(31, Number(e.target.value) || 25)),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {meetingForm.scheduleMode === 'weekday_occurrence' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">आठवडा निवडा</label>
                  <select
                    value={meetingForm.weekNumber}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        weekNumber: Number(e.target.value) as WeekOccurrence,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {WEEK_OCCURRENCES.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    वार निवडा (सोमवार ते शुक्रवार — ५ दिवसांचा आठवडा)
                  </label>
                  <select
                    value={meetingForm.weekday}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        weekday: e.target.value as MeetingWeekdayKey,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {ALL_WORKING_WEEKDAYS.filter((d) => d.key !== 'saturday').map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {meetingForm.scheduleMode === 'fixed_day' && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <label className="block text-xs font-medium text-slate-700">
                  प्रत्येक महिन्याची तारीख (1 ते 31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={meetingForm.dayOfMonth}
                  onChange={(e) =>
                    setMeetingForm({
                      ...meetingForm,
                      dayOfMonth: Math.max(1, Math.min(31, Number(e.target.value) || 15)),
                    })
                  }
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  सर्व शनिवार व रविवारी तालुका व जिल्हा कार्यालयांना सुट्टी (५ दिवसांचा आठवडा) असल्याने शनिवार, रविवार किंवा शासकीय सुट्टी आल्यास बैठक सोमवार ते शुक्रवारमधील जवळच्या रिक्त दिवशी समायोजित होईल.
                </p>
              </div>
            )}

            {meetingForm.scheduleMode === 'specific_date' && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <label className="block text-xs font-medium text-slate-700">
                  बैठकीचा दिनांक <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={meetingForm.specificDate}
                  onChange={(e) => setMeetingForm({ ...meetingForm, specificDate: e.target.value })}
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  निवडलेला दिनांक: {formatDateDDMMYYYY(meetingForm.specificDate)} (
                  {getSpecificDateDayLabel(meetingForm.specificDate)})
                </p>
              </div>
            )}

            {/* Location, Work Description & Notes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  कोठे (बैठकीचे ठिकाण / कार्यालय) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                  placeholder="उदा. जिल्हा आरोग्य अधिकारी कार्यालय, लातूर"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  कामाचे स्वरूप / बैठकीचे नाव <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={meetingForm.workDescription}
                  onChange={(e) =>
                    setMeetingForm({ ...meetingForm, workDescription: e.target.value })
                  }
                  placeholder="उदा. जिल्हास्तरीय मासिक आढावा बैठक"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">टिप्पणी (ऐच्छिक)</label>
                <input
                  type="text"
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  placeholder="उदा. मासिक प्रगती अहवाल सादरीकरण"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeMeetingForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                disabled={savingMeeting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {savingMeeting
                  ? 'जतन होत आहे...'
                  : editingRule
                  ? 'बैठक अपडेट करा'
                  : 'बैठक जतन करा'}
              </button>
            </div>
          </form>
        )}

        {/* Added Meetings List */}
        {configuredMeetings.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              अद्याप कोणतीही अतिरिक्त जिल्हास्तरीय किंवा तालुकास्तरीय बैठक जोडलेली नाही.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              वरील <strong>"+ बैठक जोडा"</strong> बटणावर क्लिक करून जिल्हास्तरीय बैठक किंवा तालुकास्तरीय बैठक जोडा.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3 w-40">बैठकीचा स्तर</th>
                  <th className="px-4 py-3">ठिकाण व कामाचे स्वरूप</th>
                  <th className="px-4 py-3">वेळापत्रक</th>
                  <th className="px-4 py-3 w-28">स्थिती</th>
                  <th className="px-4 py-3 text-right w-24">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configuredMeetings.map((rule) => (
                  <tr key={rule.id} className={rule.active ? 'hover:bg-slate-50' : 'bg-slate-50/70 opacity-70'}>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                          rule.level === 'जिल्हास्तरीय बैठक'
                            ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            : 'bg-teal-50 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {rule.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{rule.location}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{rule.workDescription}</div>
                      {rule.notes && <div className="text-xs text-slate-400 mt-0.5">{rule.notes}</div>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-700">
                      <div className="font-medium text-slate-800">
                        {describeMeetingScheduleMarathi(rule)}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {rule.isRecurring ? 'नियमित मासिक बैठक' : 'एकदाच (ठराविक दिनांक)'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {rule.isRecurring ? (
                        <button
                          type="button"
                          disabled={togglingId === rule.id}
                          onClick={() => handleToggleRuleActive(rule)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            rule.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {togglingId === rule.id ? '...' : rule.active ? 'सक्रिय' : 'थांबवलेली'}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-slate-600">निश्चित</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditMeeting(rule)}
                          title="संपादित करा"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rule)}
                          title="हटवा"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: General System Rules & Fixed Locations */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        {/* Holiday Adjustment Direction */}
        <div>
          <h2 className="text-base font-bold text-slate-900">शासकीय सुट्टी समायोजन दिशा</h2>
          <p className="mt-1 text-xs text-slate-500">
            वारनिहाय कार्यक्रमाच्या दिवशी शासकीय सुट्टी आल्यास त्या दिवसाचे सत्र कोणत्या उपलब्ध कामकाजाच्या दिवशी समायोजित करावे ते निवडा.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  value: 'next' as HolidayAdjustmentDirection,
                  title: 'पुढील उपलब्ध दिवस',
                  desc: 'सुट्टीनंतरच्या पहिल्या रिकाम्या कामकाजाच्या दिवशी सत्र समायोजित करा.',
                },
                {
                  value: 'previous' as HolidayAdjustmentDirection,
                  title: 'मागील उपलब्ध दिवस',
                  desc: 'सुट्टीपूर्वीच्या मागील रिकाम्या कामकाजाच्या दिवशी सत्र समायोजित करा.',
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  form.holidayAdjustmentDirection === opt.value
                    ? 'border-teal-700 bg-teal-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="holidayDirection"
                    value={opt.value}
                    checked={form.holidayAdjustmentDirection === opt.value}
                    onChange={() =>
                      setForm({ ...form, holidayAdjustmentDirection: opt.value })
                    }
                    className="h-4 w-4 accent-teal-700"
                  />
                  <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-slate-600">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Fixed Rule Locations */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">अनिवार्य नियम व कार्यालयांची नावे</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                कोठून (कायमस्वरूपी ठिकाण)
              </label>
              <input
                type="text"
                required
                value={form.defaultFromPlace}
                onChange={(e) => setForm({ ...form, defaultFromPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                अंमलबजावणी दिनांक
              </label>
              <input
                type="date"
                value={form.implementationDate}
                onChange={(e) => setForm({ ...form, implementationDate: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम १ — बुधवार मुख्यालय नाव
              </label>
              <input
                type="text"
                required
                value={form.hqPlace}
                onChange={(e) => setForm({ ...form, hqPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम २ — तालुकास्तरीय आढावा बैठक ठिकाण (डीफॉल्ट)
              </label>
              <input
                type="text"
                required
                value={form.talukaMeetingPlace}
                onChange={(e) => setForm({ ...form, talukaMeetingPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम ३ — उपकेंद्रस्तरीय बैठक (पहिला दिवस)
              </label>
              <input
                type="text"
                required
                value={form.subcenterMeeting1Place}
                onChange={(e) => setForm({ ...form, subcenterMeeting1Place: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम ३ — उपकेंद्रस्तरीय बैठक (दुसरा दिवस)
              </label>
              <input
                type="text"
                required
                value={form.subcenterMeeting2Place}
                onChange={(e) => setForm({ ...form, subcenterMeeting2Place: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                नियम ४ — उर्वरित दिवस कार्यालयीन कामकाज ठिकाण
              </label>
              <input
                type="text"
                required
                value={form.officePlace}
                onChange={(e) => setForm({ ...form, officePlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            शेवटचे अद्यतन: {formatDateTimeMarathi(settings.updatedAt)}
          </p>
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700">
                <Check className="h-4 w-4" />
                सेटिंग्ज जतन केल्या
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'जतन होत आहे...' : 'सेटिंग्ज जतन करा'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        danger
        title="बैठक हटवायची का?"
        description={
          deleteTarget
            ? `'${deleteTarget.level} — ${deleteTarget.location}' (${describeMeetingScheduleMarathi(deleteTarget)}) ही बैठक सेटिंग्जमधून हटवली जाईल. आधी तयार केलेल्या दैनंदिन्या सुरक्षित राहतील.`
            : ''
        }
        confirmLabel="होय, हटवा"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDeleteMeeting(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
