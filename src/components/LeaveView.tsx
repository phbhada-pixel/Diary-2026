import React, { useMemo, useState } from 'react';
import { CalendarOff, CheckCircle2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { LeaveRecord } from '../shared/types.ts';
import { calculateInclusiveDays, formatDateDDMMYYYY, LEAVE_TYPES } from '../shared/marathi.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface LeaveViewProps {
  leaves: LeaveRecord[];
  onCreate: (
    payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>
  ) => Promise<string[]>;
  onUpdate: (
    id: string,
    payload: Pick<LeaveRecord, 'leaveType' | 'startDate' | 'endDate' | 'reason' | 'notes'>
  ) => Promise<string[]>;
  onDelete: (id: string) => Promise<string[]>;
}

export const LeaveView: React.FC<LeaveViewProps> = ({ leaves, onCreate, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    leaveType: LEAVE_TYPES[0],
    startDate: '2026-04-10',
    endDate: '2026-04-10',
    reason: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [autoUpdatedNotice, setAutoUpdatedNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRecord | null>(null);

  const computedDays = useMemo(
    () => calculateInclusiveDays(form.startDate, form.endDate),
    [form.startDate, form.endDate]
  );

  const totalLeaveDaysAll = useMemo(
    () => leaves.reduce((sum, l) => sum + (l.totalDays || 0), 0),
    [leaves]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({
      leaveType: LEAVE_TYPES[0],
      startDate: '2026-04-10',
      endDate: '2026-04-10',
      reason: '',
      notes: '',
    });
  };

  const handleEdit = (item: LeaveRecord) => {
    setEditingId(item.id);
    setForm({
      leaveType: item.leaveType,
      startDate: item.startDate,
      endDate: item.endDate,
      reason: item.reason,
      notes: item.notes,
    });
  };

  const handleStartDateChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      startDate: val,
      endDate: prev.endDate < val ? val : prev.endDate,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate || computedDays <= 0) return;
    setSubmitting(true);
    setAutoUpdatedNotice(null);
    try {
      const updatedMonths = editingId
        ? await onUpdate(editingId, form)
        : await onCreate(form);

      if (updatedMonths.length > 0) {
        setAutoUpdatedNotice(
          `संबंधित महिन्याची दौरा दैनंदिनी (${updatedMonths.join(', ')}) आपोआप 'रजा' म्हणून अद्ययावत झाली आहे.`
        );
      } else {
        setAutoUpdatedNotice('रजा कायमस्वरूपी जतन केली आहे. या महिन्याची दैनंदिनी तयार करताना ही रजा आपोआप लागू होईल.');
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">कर्मचारी रजा व्यवस्थापन</h1>
          <p className="mt-1 text-sm text-slate-600">
            एक दिवसाची किंवा अनेक दिवसांची रजा नोंदवा. रजा भरल्यानंतर संबंधित महिन्याची सेव्ह केलेली दौरा दैनंदिनी आपोआप अपडेट होते.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          एकूण नोंदवलेले रजा दिवस:{' '}
          <span className="font-mono-num font-bold text-red-700">{totalLeaveDaysAll}</span>
        </div>
      </div>

      {autoUpdatedNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-900">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <span>{autoUpdatedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoUpdatedNotice(null)}
            className="rounded p-0.5 text-teal-700 hover:bg-teal-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'रजेची नोंद बदला' : 'नवीन रजा नोंदवा'}
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
              रजेचा प्रकार <span className="text-red-600">*</span>
            </label>
            <select
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                सुरुवातीचा दिनांक <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                समाप्तीचा दिनांक <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                min={form.startDate}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 flex items-center justify-between">
            <span>
              कालावधी: <span className="font-mono-num font-medium">{formatDateDDMMYYYY(form.startDate)}</span> ते{' '}
              <span className="font-mono-num font-medium">{formatDateDDMMYYYY(form.endDate)}</span>
            </span>
            <span className="font-mono-num font-bold text-slate-900">
              एकूण {computedDays} दिवस
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">रजेचे कारण</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="उदा. कौटुंबिक कामकाज / वैद्यकीय कारण"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
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
              disabled={submitting || computedDays <= 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'जतन होत आहे...' : editingId ? 'रजा अपडेट करा' : 'रजा जतन करा'}
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
              रजा नोंदवही (<span className="font-mono-num">{leaves.length}</span>)
            </h2>
          </div>

          {leaves.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CalendarOff className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">अद्याप कोणतीही रजा नोंदवलेली नाही</p>
              <p className="mt-1 text-xs text-slate-500">
                डाव्या बाजूच्या फॉर्ममधून एक दिवसाची किंवा अनेक दिवसांची रजा नोंदवता येईल.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-12">अ.क्र.</th>
                    <th className="px-4 py-3">कालावधी</th>
                    <th className="px-4 py-3 w-20 text-right">दिवस</th>
                    <th className="px-4 py-3">रजेचा प्रकार</th>
                    <th className="px-4 py-3">कारण / टिप्पणी</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((lv, idx) => (
                    <tr key={lv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono-num text-xs font-medium text-slate-900">
                        {lv.startDate === lv.endDate
                          ? formatDateDDMMYYYY(lv.startDate)
                          : `${formatDateDDMMYYYY(lv.startDate)} ते ${formatDateDDMMYYYY(lv.endDate)}`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num font-semibold text-red-700">
                        {lv.totalDays}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{lv.leaveType}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{lv.reason || '—'}</div>
                        {lv.notes && <div className="text-xs text-slate-400">{lv.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(lv)}
                            title="संपादित करा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(lv)}
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
        title="रजेची नोंद हटवायची का?"
        description={
          deleteTarget
            ? `${formatDateDDMMYYYY(deleteTarget.startDate)} ते ${formatDateDDMMYYYY(deleteTarget.endDate)} ही रजा हटवली जाईल आणि संबंधित महिन्याची दैनंदिनी पुन्हा अद्ययावत केली जाईल.`
            : ''
        }
        confirmLabel="होय, हटवा"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            const updatedMonths = await onDelete(deleteTarget.id);
            if (updatedMonths.length > 0) {
              setAutoUpdatedNotice(
                `रजा रद्द केल्यानंतर संबंधित महिन्याची दैनंदिनी (${updatedMonths.join(', ')}) अद्ययावत झाली आहे.`
              );
            }
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
