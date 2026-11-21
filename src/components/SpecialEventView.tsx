import React, { useState } from 'react';
import { Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { SpecialEventMaster } from '../shared/types.ts';
import { formatDateDDMMYYYY, MARATHI_DAYS_BY_INDEX, SPECIAL_EVENT_TYPES } from '../shared/marathi.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface SpecialEventViewProps {
  events: SpecialEventMaster[];
  onCreate: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const SpecialEventView: React.FC<SpecialEventViewProps> = ({
  events,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: '2026-04-20',
    eventType: SPECIAL_EVENT_TYPES[0],
    location: '',
    workDescription: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SpecialEventMaster | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      date: '2026-04-20',
      eventType: SPECIAL_EVENT_TYPES[0],
      location: '',
      workDescription: '',
      notes: '',
    });
  };

  const handleEdit = (ev: SpecialEventMaster) => {
    setEditingId(ev.id);
    setForm({
      date: ev.date,
      eventType: ev.eventType,
      location: ev.location,
      workDescription: ev.workDescription,
      notes: ev.notes,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.location.trim() || !form.workDescription.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      resetForm();
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
          आरोग्य अभियान, विशेष लसीकरण सत्र, वरिष्ठ अधिकाऱ्यांची भेट, जिल्हा/तालुका बैठक किंवा प्रशिक्षण कार्यक्रम येथे नोंदवा. या दिवशी नियमित कार्यक्रमापेक्षा विशेष कार्यक्रमाला प्राधान्य दिले जाते (मूळ मास्टर वेळापत्रक अबाधित राहते).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
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

          <div>
            <label className="block text-sm font-medium text-slate-700">
              दिनांक <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              निवडलेला दिनांक: {formatDateDDMMYYYY(form.date)} ({getDayLabel(form.date)})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              कार्यक्रमाचा प्रकार <span className="text-red-600">*</span>
            </label>
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              {SPECIAL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              कोठे (ठिकाण / कार्यालय) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="उदा. जिल्हा आरोग्य अधिकारी कार्यालय, लातूर"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              कामाचे स्वरूप <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.workDescription}
              onChange={(e) => setForm({ ...form, workDescription: e.target.value })}
              placeholder="उदा. पल्स पोलिओ विशेष लसीकरण मोहीम प्रशिक्षण"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">टिप्पणी</label>
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
              नोंदवलेले विशेष कार्यक्रम (<span className="font-mono-num">{events.length}</span>)
            </h2>
          </div>

          {events.length === 0 ? (
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
                    <th className="px-4 py-3">कोठे</th>
                    <th className="px-4 py-3">कामाचे स्वरूप व प्रकार</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((ev, idx) => (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono-num font-medium text-slate-900">
                          {formatDateDDMMYYYY(ev.date)}
                        </span>
                        <span className="ml-1.5 text-xs text-slate-500">({getDayLabel(ev.date)})</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{ev.location}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{ev.workDescription}</div>
                        <div className="text-xs text-slate-500">
                          {ev.eventType}
                          {ev.notes ? ` · ${ev.notes}` : ''}
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
                  ))}
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
