import React, { useState } from 'react';
import { History, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
  DiaryChangeHistoryRecord,
  SubcenterMaster,
  VillageMaster,
  WeekdayKey,
  WeeklyScheduleMaster,
  WeekOccurrence,
} from '../shared/types.ts';
import {
  formatDateTimeMarathi,
  getWeekdayLabel,
  getWeekOccurrenceLabel,
  SCHEDULE_WEEKDAYS,
  SESSION_TYPE_SUGGESTIONS,
  WEEK_OCCURRENCES,
} from '../shared/marathi.ts';
import { extractHeadquarterCities } from '../shared/travelMeta.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface WeeklyScheduleViewProps {
  schedules: WeeklyScheduleMaster[];
  villages: VillageMaster[];
  subcenters: SubcenterMaster[];
  history: DiaryChangeHistoryRecord[];
  onCreate: (
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Pick<
      WeeklyScheduleMaster,
      'weekday' | 'weekNumber' | 'villageId' | 'villageName' | 'subcenterName' | 'sessionType' | 'notes'
    >
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  schedules,
  villages,
  subcenters,
  history,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState<{
    weekday: WeekdayKey;
    weekNumber: WeekOccurrence;
    villageId: string;
    villageName: string;
    subcenterName: string;
    sessionType: string;
    notes: string;
  }>({
    weekday: 'monday',
    weekNumber: 1,
    villageId: '',
    villageName: '',
    subcenterName: '',
    sessionType: SESSION_TYPE_SUGGESTIONS[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyScheduleMaster | null>(null);
  const regularVillages = extractHeadquarterCities(villages).regularVillages;

  const scheduleHistory = history.filter((h) => h.entityType === 'Weekly_Schedule_Master');

  const scheduleLookup = new Map<string, WeeklyScheduleMaster>();
  for (const s of schedules) {
    scheduleLookup.set(`${s.weekday}_${s.weekNumber}`, s);
  }

  const resetForm = () => {
    setEditingId(null);
    setForm({
      weekday: 'monday',
      weekNumber: 1,
      villageId: '',
      villageName: '',
      subcenterName: '',
      sessionType: SESSION_TYPE_SUGGESTIONS[0],
      notes: '',
    });
  };

  const startEdit = (item: WeeklyScheduleMaster) => {
    setEditingId(item.id);
    setForm({
      weekday: item.weekday,
      weekNumber: item.weekNumber,
      villageId: item.villageId,
      villageName: item.villageName,
      subcenterName: item.subcenterName,
      sessionType: item.sessionType,
      notes: item.notes,
    });
  };

  const startQuickFill = (weekday: WeekdayKey, weekNumber: WeekOccurrence) => {
    const existing = scheduleLookup.get(`${weekday}_${weekNumber}`);
    if (existing) {
      startEdit(existing);
    } else {
      setEditingId(null);
      setForm({
        weekday,
        weekNumber,
        villageId: '',
        villageName: '',
        subcenterName: '',
        sessionType: SESSION_TYPE_SUGGESTIONS[0],
        notes: '',
      });
    }
  };

  const handleVillageSelect = (villageId: string) => {
    const v = villages.find((item) => item.id === villageId);
    if (v) {
      setForm({
        ...form,
        villageId: v.id,
        villageName: v.name,
        subcenterName: v.subcenterName || form.subcenterName,
      });
    } else {
      setForm({ ...form, villageId: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.villageName.trim() || !form.sessionType.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      resetForm();
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            मासिक वारनिहाय आरोग्य सेवा सत्र कार्यक्रम
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            एकदा भरलेला वारनिहाय कार्यक्रम कायमस्वरूपी सेव्ह राहील. भविष्यात लसीकरणाचे वार बदलल्यास ते फक्त नव्याने तयार होणाऱ्या पुढील महिन्यांच्या दैनंदिनीवर लागू होतील; आधीच तयार केलेल्या मासिक दैनंदिन्या त्यांच्या मूळ स्वरूपात सुरक्षित राहतील. (बुधवार मुख्यालयाच्या बैठकीसाठी राखीव आहे.)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <History className="h-4 w-4 text-slate-500" />
          बदल इतिहास ({scheduleHistory.length})
        </button>
      </div>

      {/* Interactive 5-Week x 5-Weekday Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            वारनिहाय मास्टर वेळापत्रक तक्ता (कोणत्याही चौकोनावर क्लिक करून भरा किंवा बदला)
          </h2>
          <span className="text-xs text-slate-500">
            नोंदवलेली सत्रे: <span className="font-mono-num font-semibold text-slate-800">{schedules.length} / 25</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3.5 py-2.5 font-semibold w-24">आठवडा</th>
                {SCHEDULE_WEEKDAYS.map((wd) => (
                  <th key={wd.key} className="px-3.5 py-2.5 font-semibold min-w-[165px]">
                    {wd.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {WEEK_OCCURRENCES.map((wk) => (
                <tr key={wk.value}>
                  <td className="px-3.5 py-3 font-semibold text-slate-700 bg-slate-50/50 whitespace-nowrap">
                    {wk.label}
                  </td>
                  {SCHEDULE_WEEKDAYS.map((wd) => {
                    const entry = scheduleLookup.get(`${wd.key}_${wk.value}`);
                    const isSelected =
                      form.weekday === wd.key && form.weekNumber === wk.value;
                    return (
                      <td
                        key={wd.key}
                        className={`p-2 align-top border-l border-slate-100 ${
                          isSelected ? 'bg-teal-50/60' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => startQuickFill(wd.key, wk.value)}
                          className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                            entry
                              ? 'border-slate-200 bg-white hover:border-teal-400'
                              : 'border-dashed border-slate-200 bg-slate-50/40 text-slate-400 hover:border-teal-400 hover:text-teal-700'
                          }`}
                        >
                          {entry ? (
                            <div>
                              <p className="font-semibold text-slate-900 truncate">{entry.villageName}</p>
                              {entry.subcenterName && (
                                <p className="text-[11px] text-slate-500 truncate">{entry.subcenterName}</p>
                              )}
                              <p className="mt-1 text-[11px] text-teal-800 line-clamp-1">
                                {entry.sessionType}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Plus className="h-3 w-3" /> जोडा
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Form + Full List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'वारनिहाय कार्यक्रम बदला' : 'वारनिहाय कार्यक्रम जोडा'}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                वार <span className="text-red-600">*</span>
              </label>
              <select
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: e.target.value as WeekdayKey })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {SCHEDULE_WEEKDAYS.map((wd) => (
                  <option key={wd.key} value={wd.key}>
                    {wd.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                आठवडा क्रमांक <span className="text-red-600">*</span>
              </label>
              <select
                value={form.weekNumber}
                onChange={(e) => setForm({ ...form, weekNumber: Number(e.target.value) as WeekOccurrence })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                {WEEK_OCCURRENCES.map((wk) => (
                  <option key={wk.value} value={wk.value}>
                    {wk.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {regularVillages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                नोंदवलेल्या गावांमधून निवडा
              </label>
              <select
                value={form.villageId}
                onChange={(e) => handleVillageSelect(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="">— गाव निवडा (किंवा खाली थेट लिहा) —</option>
                {regularVillages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.subcenterName ? `(${v.subcenterName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              गावाचे नाव <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.villageName}
              onChange={(e) => setForm({ ...form, villageName: e.target.value })}
              placeholder="गावाचे नाव लिहा"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">उपकेंद्राचे नाव</label>
            <input
              type="text"
              list="subcenter-options-list"
              value={form.subcenterName}
              onChange={(e) => setForm({ ...form, subcenterName: e.target.value })}
              placeholder="उपकेंद्राचे नाव निवडा किंवा लिहा"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            <datalist id="subcenter-options-list">
              {subcenters.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              आरोग्य सेवा सत्राचे स्वरूप <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              list="session-type-suggestions"
              value={form.sessionType}
              onChange={(e) => setForm({ ...form, sessionType: e.target.value })}
              placeholder="उदा. नियमित लसीकरण व आरोग्य सेवा सत्र"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            <datalist id="session-type-suggestions">
              {SESSION_TYPE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">अतिरिक्त टिप्पणी</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              नोंदवलेला वारनिहाय कार्यक्रम (<span className="font-mono-num">{schedules.length}</span>)
            </h2>
          </div>

          {schedules.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              अद्याप वारनिहाय कार्यक्रम भरलेला नाही. वरील तक्त्यातील कोणत्याही चौकोनावर क्लिक करा किंवा डाव्या फॉर्ममधून नोंद करा.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3">वार व आठवडा</th>
                    <th className="px-4 py-3">गावाचे नाव</th>
                    <th className="px-4 py-3">उपकेंद्र</th>
                    <th className="px-4 py-3">सत्राचे स्वरूप</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {getWeekOccurrenceLabel(item.weekNumber)} {getWeekdayLabel(item.weekday)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.villageName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.subcenterName || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{item.sessionType}</div>
                        {item.notes && <div className="text-xs text-slate-400">{item.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            title="संपादित करा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
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
      </div>

      {/* History Log Panel */}
      {showHistory && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h3 className="text-sm font-bold text-slate-900">
              वारनिहाय कार्यक्रमातील बदलांचा इतिहास (History Log)
            </h3>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {scheduleHistory.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              अद्याप कोणतेही बदल नोंदवलेले नाहीत.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {scheduleHistory.map((h) => (
                <div key={h.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{h.summary}</span>
                    <span className="font-mono-num text-xs text-slate-500">
                      {formatDateTimeMarathi(h.changeDate)} · {h.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        danger
        title="वारनिहाय कार्यक्रम हटवायचा का?"
        description={
          deleteTarget
            ? `${getWeekOccurrenceLabel(deleteTarget.weekNumber)} ${getWeekdayLabel(deleteTarget.weekday)} (${deleteTarget.villageName}) हा कार्यक्रम हटवला जाईल व त्याची नोंद इतिहास लॉगमध्ये राहील.`
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
