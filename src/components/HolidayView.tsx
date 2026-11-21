import React, { useMemo, useState } from 'react';
import { CalendarRange, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ApplicationSettings, GovernmentHolidayMaster } from '../shared/types.ts';
import { formatDateDDMMYYYY, HOLIDAY_TYPES, MARATHI_DAYS_BY_INDEX } from '../shared/marathi.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface HolidayViewProps {
  holidays: GovernmentHolidayMaster[];
  settings: ApplicationSettings;
  onCreate: (
    payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'year' | 'notes'>
  ) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Pick<GovernmentHolidayMaster, 'date' | 'name' | 'holidayType' | 'notes'>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const HolidayView: React.FC<HolidayViewProps> = ({
  holidays,
  settings,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [customYears, setCustomYears] = useState<number[]>([2026, 2027, 2028]);
  const [newYearInput, setNewYearInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: '2026-04-14',
    name: '',
    holidayType: HOLIDAY_TYPES[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GovernmentHolidayMaster | null>(null);

  const allYears = useMemo(() => {
    const set = new Set<number>(customYears);
    for (const h of holidays) set.add(h.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [customYears, holidays]);

  const yearHolidays = useMemo(
    () => holidays.filter((h) => h.year === selectedYear).sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, selectedYear]
  );

  const handleYearChange = (yr: number) => {
    setSelectedYear(yr);
    setEditingId(null);
    setForm((prev) => ({
      ...prev,
      date: `${yr}-01-26`,
      name: '',
      notes: '',
    }));
  };

  const handleAddYearMaster = () => {
    const yr = Number(newYearInput);
    if (yr >= 2025 && yr <= 2050) {
      if (!customYears.includes(yr)) {
        setCustomYears([...customYears, yr].sort((a, b) => a - b));
      }
      handleYearChange(yr);
      setNewYearInput('');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      date: `${selectedYear}-05-01`,
      name: '',
      holidayType: HOLIDAY_TYPES[0],
      notes: '',
    });
  };

  const handleEdit = (h: GovernmentHolidayMaster) => {
    setSelectedYear(h.year);
    setEditingId(h.id);
    setForm({
      date: h.date,
      name: h.name,
      holidayType: h.holidayType,
      notes: h.notes,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate({
          ...form,
          year: selectedYear,
        });
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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">शासकीय सुट्टी व्यवस्थापन</h1>
          <p className="mt-1 text-sm text-slate-600">
            प्रत्येक वर्षासाठी स्वतंत्र शासकीय सुट्ट्यांची यादी जतन करा. एका वर्षातील सुट्ट्या पुढील वर्षी आपोआप लागू होत नाहीत.
          </p>
        </div>

        <div className="text-xs text-slate-600">
          सध्याची सुट्टी समायोजन दिशा:{' '}
          <span className="font-semibold text-teal-800">
            {settings.holidayAdjustmentDirection === 'next' ? 'पुढील उपलब्ध कामकाजाचा दिवस' : 'मागील उपलब्ध कामकाजाचा दिवस'}
          </span>
        </div>
      </div>

      {/* Year Master Tabs + Add New Year */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1">
          {allYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => handleYearChange(yr)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors font-mono-num whitespace-nowrap ${
                selectedYear === yr
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              वर्ष {yr} ({holidays.filter((h) => h.year === yr).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={2025}
            max={2050}
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            placeholder="नवीन वर्ष (उदा. 2029)"
            className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddYearMaster}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            + वर्ष यादी तयार करा
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? `सुट्टी संपादित करा (${selectedYear})` : `वर्ष ${selectedYear} साठी सुट्टी जोडा`}
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
              सुट्टीची तारीख ({selectedYear}) <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              min={`${selectedYear}-01-01`}
              max={`${selectedYear}-12-31`}
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
              सुट्टीचे नाव <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="उदा. डॉ. बाबासाहेब आंबेडकर जयंती"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">सुट्टीचा प्रकार</label>
            <select
              value={form.holidayType}
              onChange={(e) => setForm({ ...form, holidayType: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              {HOLIDAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
              {submitting ? 'जतन होत आहे...' : editingId ? 'सुट्टी अपडेट करा' : 'सुट्टी जतन करा'}
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

        {/* Holiday List */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              वर्ष {selectedYear} मधील शासकीय सुट्ट्या (<span className="font-mono-num">{yearHolidays.length}</span>)
            </h2>
          </div>

          {yearHolidays.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CalendarRange className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                वर्ष {selectedYear} साठी अद्याप कोणतीही शासकीय सुट्टी नोंदवलेली नाही
              </p>
              <p className="mt-1 text-xs text-slate-500">
                डाव्या फॉर्ममधून महाराष्ट्र शासनाच्या अधिकृत सुट्ट्या नोंदवा.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-12">अ.क्र.</th>
                    <th className="px-4 py-3 w-40">दिनांक व वार</th>
                    <th className="px-4 py-3">सुट्टीचे नाव</th>
                    <th className="px-4 py-3">प्रकार</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearHolidays.map((h, idx) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono-num font-medium text-slate-900">
                          {formatDateDDMMYYYY(h.date)}
                        </span>
                        <span className="ml-1.5 text-xs text-slate-500">({getDayLabel(h.date)})</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{h.name}</div>
                        {h.notes && <div className="text-xs text-slate-400">{h.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{h.holidayType}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(h)}
                            title="संपादित करा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(h)}
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
        title="शासकीय सुट्टी हटवायची का?"
        description={
          deleteTarget
            ? `दिनांक ${formatDateDDMMYYYY(deleteTarget.date)} (${deleteTarget.name}) ही सुट्टी हटवली जाईल.`
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
