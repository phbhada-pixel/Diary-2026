import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  FileSpreadsheet,
  Info,
  Pencil,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  EmployeeMaster,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
} from '../shared/types.ts';
import {
  ENTRY_TYPE_LABELS,
  formatDateDDMMYYYY,
  formatDateTimeMarathi,
  getFinancialYearLabel,
  getFinancialYearMonths,
  makeMonthId,
  makeMonthLabelMarathi,
} from '../shared/marathi.ts';
import { exportMonthlyDiaryToExcel } from '../utils/exportUtils.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface MonthlyDiaryViewProps {
  employee: EmployeeMaster;
  diaries: MonthlyDiaryDocument[];
  selectedYear: number;
  selectedMonth: number;
  onSelectMonth: (year: number, month: number) => void;
  onGenerate: (year: number, month: number, opts?: { preserveManualEdits?: boolean; confirmedOverwrite?: boolean }) => Promise<void>;
  onUpdateEntry: (
    diaryId: string,
    date: string,
    payload: { fromPlace: string; toPlace: string; workDescription: string; notes: string }
  ) => Promise<void>;
  isGenerating: boolean;
}

export const MonthlyDiaryView: React.FC<MonthlyDiaryViewProps> = ({
  employee,
  diaries,
  selectedYear,
  selectedMonth,
  onSelectMonth,
  onGenerate,
  onUpdateEntry,
  isGenerating,
}) => {
  const fyStartYear = selectedMonth >= 4 ? selectedYear : selectedYear - 1;
  const fyMonths = useMemo(() => getFinancialYearMonths(fyStartYear), [fyStartYear]);
  const fyYearOptions = [2026, 2027, 2028, 2029, 2030];

  const monthId = makeMonthId(selectedYear, selectedMonth);
  const currentDiary = diaries.find((d) => d.id === monthId) || null;

  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MonthlyDiaryEntry | null>(null);
  const [editForm, setEditForm] = useState({
    fromPlace: 'भादा',
    toPlace: '',
    workDescription: '',
    notes: '',
  });
  const [savingEntry, setSavingEntry] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'working' | 'non_working' | 'adjusted'>('all');

  const filteredEntries = useMemo(() => {
    if (!currentDiary) return [];
    if (filterType === 'all') return currentDiary.entries;
    if (filterType === 'working') {
      return currentDiary.entries.filter(
        (e) => e.entryType !== 'sunday' && e.entryType !== 'holiday' && e.entryType !== 'leave'
      );
    }
    if (filterType === 'non_working') {
      return currentDiary.entries.filter(
        (e) => e.entryType === 'sunday' || e.entryType === 'holiday' || e.entryType === 'leave'
      );
    }
    return currentDiary.entries.filter(
      (e) => e.entryType === 'adjusted_schedule' || e.isManualEdit
    );
  }, [currentDiary, filterType]);

  const startEditRow = (entry: MonthlyDiaryEntry) => {
    setEditingEntry(entry);
    setEditForm({
      fromPlace: entry.fromPlace || 'भादा',
      toPlace: entry.toPlace,
      workDescription: entry.workDescription,
      notes: entry.notes || '',
    });
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDiary || !editingEntry) return;
    setSavingEntry(true);
    try {
      await onUpdateEntry(currentDiary.id, editingEntry.date, editForm);
      setEditingEntry(null);
    } finally {
      setSavingEntry(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Screen Header & Controls (Hidden during A4 Print) */}
      <div className="no-print space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">मासिक दौरा दैनंदिनी</h1>
            <p className="mt-1 text-sm text-slate-600">
              {getFinancialYearLabel(fyStartYear)} · एप्रिल 2026 पासून कोणत्याही महिन्याची दौरा दैनंदिनी स्वयंचलित तयार, संपादित व Export करा.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Financial Year selector */}
            <select
              aria-label="आर्थिक वर्ष निवडा"
              value={fyStartYear}
              onChange={(e) => {
                const newFy = Number(e.target.value);
                onSelectMonth(newFy, 4); // Start of selected Financial Year (April)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              {fyYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  आर्थिक वर्ष {fy}-{String(fy + 1).slice(-2)}
                </option>
              ))}
            </select>

            {/* Month selector */}
            <select
              aria-label="महिना निवडा"
              value={monthId}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                onSelectMonth(y, m);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              {fyMonths.map((fm) => (
                <option key={fm.id} value={fm.id}>
                  {fm.label}
                </option>
              ))}
            </select>

            {currentDiary ? (
              <>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setRecalcDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  पुन्हा अपडेट करा
                </button>
                <button
                  type="button"
                  onClick={() => exportMonthlyDiaryToExcel(currentDiary)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                >
                  <Printer className="h-4 w-4" />
                  PDF / A4 प्रिंट
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => onGenerate(selectedYear, selectedMonth, { confirmedOverwrite: false, preserveManualEdits: true })}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
              >
                <CalendarPlus className="h-4 w-4" />
                {isGenerating ? 'तयार होत आहे...' : `${makeMonthLabelMarathi(selectedYear, selectedMonth)} दैनंदिनी तयार करा`}
              </button>
            )}
          </div>
        </div>

        {/* Summary & Filter Controls when diary exists */}
        {currentDiary && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">एकूण दिवस</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-slate-900">
                  {currentDiary.summary.totalDays}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">कामकाजाचे दिवस</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-teal-800">
                  {currentDiary.summary.workingDays}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">गाव सत्रे</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-slate-900">
                  {currentDiary.summary.villageTours}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">बैठका (बुधवार/तालुका/उपकेंद्र)</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-slate-900">
                  {currentDiary.summary.meetings}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">रविवार व सुट्ट्या</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-slate-700">
                  {currentDiary.summary.sundays + currentDiary.summary.holidays}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-xs text-slate-500">रजा / विशेष कार्यक्रम</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-red-700">
                  {currentDiary.summary.leaves} / {currentDiary.summary.specialEvents}
                </p>
              </div>
            </div>

            {/* Warnings / Adjustments Banner */}
            {currentDiary.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                <p className="text-xs font-bold text-amber-900">
                  समायोजन व नियम सूचना ({currentDiary.warnings.length})
                </p>
                <ul className="space-y-1.5 text-sm text-amber-950">
                  {currentDiary.warnings.map((w, i) => (
                    <li key={`${w.date}-${i}`} className="flex items-start gap-2">
                      {w.severity === 'warning' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                      )}
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['all', 'सर्व दिवस'],
                    ['working', 'कामकाजाचे दिवस'],
                    ['non_working', 'सुट्ट्या व रजा'],
                    ['adjusted', 'समायोजित / मॅन्युअल'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterType(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      filterType === key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                शेवटचे अद्यतन: {formatDateTimeMarathi(currentDiary.updatedAt)}
                {currentDiary.hasManualEdits ? ' · मॅन्युअल संपादन संरक्षित' : ''}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Empty State if month not generated yet */}
      {!currentDiary ? (
        <div className="no-print rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <CalendarPlus className="mx-auto h-11 w-11 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            {makeMonthLabelMarathi(selectedYear, selectedMonth)} ची दौरा दैनंदिनी तयार नाही
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-sm text-slate-600">
            वारनिहाय कार्यक्रम, वर्ष {selectedYear} मधील शासकीय सुट्ट्या, कर्मचारी रजा, विशेष कार्यक्रम तसेच बुधवार, तालुका व उपकेंद्र बैठकीचे नियम आपोआप लागू करून दैनंदिनी तयार होईल.
          </p>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() =>
              onGenerate(selectedYear, selectedMonth, {
                confirmedOverwrite: false,
                preserveManualEdits: true,
              })
            }
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            <CalendarPlus className="h-4 w-4" />
            {isGenerating
              ? 'तयार होत आहे...'
              : `${makeMonthLabelMarathi(selectedYear, selectedMonth)} दैनंदिनी स्वयंचलित तयार करा`}
          </button>
        </div>
      ) : (
        <>
          {/* Interactive Screen Ledger Table (no-print) */}
          <div className="no-print rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Official Header Preview */}
            <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 text-center">
              <h2 className="text-lg font-bold text-slate-900">मासिक दौरा दैनंदिनी</h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {currentDiary.designation} {currentDiary.employeeName}
              </p>
              <p className="text-sm text-slate-700">{currentDiary.officeName}</p>
              <p className="mt-1 text-sm font-semibold text-teal-800">
                महिना: {currentDiary.monthLabelMarathi}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-14">अनुक्रमांक</th>
                    <th className="px-4 py-3 w-44">दिनांक</th>
                    <th className="px-4 py-3 w-28">कोठून</th>
                    <th className="px-4 py-3">कोठे</th>
                    <th className="px-4 py-3">कामाचे स्वरूप</th>
                    <th className="px-4 py-3 text-right w-20">संपादन</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((row) => {
                    const rowClass =
                      row.entryType === 'sunday'
                        ? 'bg-slate-50 text-slate-500'
                        : row.entryType === 'holiday'
                        ? 'bg-orange-50/50 text-slate-700'
                        : row.entryType === 'leave'
                        ? 'bg-red-50/60 text-red-900'
                        : row.entryType === 'adjusted_schedule'
                        ? 'bg-amber-50/50'
                        : row.entryType === 'special_event'
                        ? 'bg-teal-50/40'
                        : '';

                    return (
                      <tr key={row.date} className={`hover:bg-slate-50/90 ${rowClass}`}>
                        <td className="px-4 py-2.5 font-mono-num text-xs text-slate-500">
                          {row.serialNo}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-mono-num font-medium text-slate-900">
                            {formatDateDDMMYYYY(row.date)}
                          </span>
                          <span className="ml-1.5 text-xs text-slate-500">({row.dayNameMarathi})</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{row.fromPlace}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          <div>{row.toPlace}</div>
                          {row.originalDate && (
                            <div className="mt-0.5 text-xs text-amber-800">
                              मूळ दिनांक: {formatDateDDMMYYYY(row.originalDate)} → समायोजित: {formatDateDDMMYYYY(row.adjustedDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800">
                          <div>{row.workDescription}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {ENTRY_TYPE_LABELS[row.entryType]}
                            {row.isManualEdit ? ' · मॅन्युअल बदल' : ''}
                            {row.notes ? ` · ${row.notes}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => startEditRow(row)}
                            title="ही तारीख संपादित करा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official A4 Print-Only Sheet (Rendered cleanly when printing / saving PDF) */}
          <div className="print-only print-sheet">
            <div className="text-center mb-3">
              <h1 className="text-lg font-bold text-black">मासिक दौरा दैनंदिनी</h1>
              <p className="text-sm font-semibold text-black">
                {currentDiary.designation} {currentDiary.employeeName}
              </p>
              <p className="text-sm text-black">{currentDiary.officeName}</p>
              <p className="text-sm font-semibold text-black mt-0.5">
                महिना: {currentDiary.monthLabelMarathi}
              </p>
            </div>

            <table className="diary-print-table">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>अनुक्रमांक</th>
                  <th style={{ width: '20%' }}>दिनांक</th>
                  <th style={{ width: '11%' }}>कोठून</th>
                  <th style={{ width: '28%' }}>कोठे</th>
                  <th style={{ width: '33%' }}>कामाचे स्वरूप</th>
                </tr>
              </thead>
              <tbody>
                {currentDiary.entries.map((row) => (
                  <tr key={row.date}>
                    <td style={{ textAlign: 'center' }}>{row.serialNo}</td>
                    <td>
                      {formatDateDDMMYYYY(row.date)} ({row.dayNameMarathi})
                    </td>
                    <td>{row.fromPlace}</td>
                    <td>{row.toPlace}</td>
                    <td>{row.workDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 text-xs text-black flex justify-between">
              <span>
                एकूण दिवस: {currentDiary.summary.totalDays} | कामकाजाचे दिवस: {currentDiary.summary.workingDays} | रविवार व शासकीय सुट्ट्या: {currentDiary.summary.sundays + currentDiary.summary.holidays} | रजा: {currentDiary.summary.leaves}
              </span>
            </div>

            <div className="mt-10 flex justify-between text-sm font-semibold text-black px-2">
              <div className="text-center">
                <p>स्वाक्षरी</p>
                <p className="mt-6">{employee.designation}</p>
                <p>{employee.fullName}</p>
                <p>{employee.officeName}</p>
              </div>
              <div className="text-center">
                <p>प्रतिस्वाक्षरी</p>
                <p className="mt-6">वैद्यकीय अधिकारी</p>
                <p>{employee.officeName}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Row Edit Modal */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEntry}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  दैनंदिनी नोंद संपादित करा
                </h3>
                <p className="text-xs text-slate-500">
                  दिनांक {formatDateDDMMYYYY(editingEntry.date)} ({editingEntry.dayNameMarathi}) · हा बदल मॅन्युअल नोंद म्हणून संरक्षित राहील.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">कोठून</label>
              <input
                type="text"
                required
                value={editForm.fromPlace}
                onChange={(e) => setEditForm({ ...editForm, fromPlace: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                कोठे <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={editForm.toPlace}
                onChange={(e) => setEditForm({ ...editForm, toPlace: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                कामाचे स्वरूप <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={editForm.workDescription}
                onChange={(e) => setEditForm({ ...editForm, workDescription: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">टिप्पणी</label>
              <input
                type="text"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                disabled={savingEntry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {savingEntry ? 'जतन होत आहे...' : 'बदल जतन करा'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recalculate Protection Confirmation Dialog */}
      <ConfirmDialog
        open={recalcDialogOpen}
        title={`${currentDiary?.monthLabelMarathi || ''} दैनंदिनी पुन्हा अपडेट करायची का?`}
        description={
          currentDiary?.hasManualEdits
            ? 'या महिन्याची आधीच तयार केलेली दैनंदिनी सध्या मूळ स्वरूपात सुरक्षित आहे. पुन्हा अपडेट केल्यास सध्याचा नवीन वारनिहाय कार्यक्रम या महिन्यावर लागू होईल. तुम्ही मॅन्युअल बदल सुरक्षित ठेवून अपडेट करू शकता किंवा मूळ दैनंदिनी जशीच्या तशी ठेवण्यासाठी "रद्द करा" निवडा.'
            : 'या महिन्याची आधीच तयार केलेली दैनंदिनी सध्या मूळ स्वरूपात सुरक्षित आहे. पुन्हा अपडेट केल्यास सध्याचा नवीन वारनिहाय कार्यक्रम, सुट्ट्या, रजा व विशेष कार्यक्रमांनुसार ही दैनंदिनी नव्याने तयार होईल. मूळ दैनंदिनी जशीच्या तशी ठेवण्यासाठी "रद्द करा" निवडा.'
        }
        confirmLabel="मॅन्युअल बदल सुरक्षित ठेवून अपडेट करा"
        secondaryConfirmLabel={currentDiary?.hasManualEdits ? 'सर्व नोंदी नव्याने तयार करा' : undefined}
        onCancel={() => setRecalcDialogOpen(false)}
        onConfirm={async () => {
          setRecalcDialogOpen(false);
          await onGenerate(selectedYear, selectedMonth, {
            preserveManualEdits: true,
            confirmedOverwrite: true,
          });
        }}
        onSecondaryConfirm={async () => {
          setRecalcDialogOpen(false);
          await onGenerate(selectedYear, selectedMonth, {
            preserveManualEdits: false,
            confirmedOverwrite: true,
          });
        }}
      />
    </div>
  );
};
