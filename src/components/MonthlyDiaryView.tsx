import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Eye,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  EmployeeMaster,
  GovernmentHolidayMaster,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  VillageMaster,
} from '../shared/types.ts';
import {
  ENTRY_TYPE_LABELS,
  formatDateDDMMYYYY,
  formatDateTimeMarathi,
  getFinancialYearLabel,
  getFinancialYearMonths,
  makeMonthId,
  makeMonthLabelMarathi,
  resolveDiaryEntryDisplay,
} from '../shared/marathi.ts';
import {
  DEFAULT_TRAVEL_MODE,
  encodeEntryTravelOverrideInNotes,
  resolveDiaryEntryTravel,
  TRAVEL_MODE_OPTIONS,
} from '../shared/travelMeta.ts';
import {
  exportMonthlyDiaryToExcel,
  exportMonthlyDiaryToPdf,
  printMonthlyDiaryWithTitle,
} from '../utils/exportUtils.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { PrintableDiarySheet } from './PrintableDiarySheet.tsx';

interface MonthlyDiaryViewProps {
  employee: EmployeeMaster;
  holidays: GovernmentHolidayMaster[];
  villages: VillageMaster[];
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
  holidays,
  villages,
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
    travelMode: DEFAULT_TRAVEL_MODE,
    distanceKm: '',
    workDescription: '',
    notes: '',
  });
  const [savingEntry, setSavingEntry] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'working' | 'non_working' | 'manual'>('all');
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');
  const [selectedEndDate, setSelectedEndDate] = useState<string>('');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportingRowDate, setExportingRowDate] = useState<string | null>(null);
  const [pdfOverrideEntries, setPdfOverrideEntries] = useState<MonthlyDiaryEntry[] | null>(null);
  const [pdfOverrideLabel, setPdfOverrideLabel] = useState<string | null>(null);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const criticalWarnings = useMemo(
    () => (currentDiary ? currentDiary.warnings.filter((w) => w.severity === 'warning') : []),
    [currentDiary]
  );

  // Entries filtered by specific date or date range (if selected)
  const dateFilteredEntries = useMemo(() => {
    if (!currentDiary) return [];
    const start = selectedStartDate.trim();
    const end = selectedEndDate.trim();
    if (!start && !end) return currentDiary.entries;
    if (start && !end) {
      return currentDiary.entries.filter((e) => e.date === start);
    }
    if (!start && end) {
      return currentDiary.entries.filter((e) => e.date === end);
    }
    const minDate = start <= end ? start : end;
    const maxDate = start <= end ? end : start;
    return currentDiary.entries.filter((e) => e.date >= minDate && e.date <= maxDate);
  }, [currentDiary, selectedStartDate, selectedEndDate]);

  const dateFilterLabel = useMemo(() => {
    const start = selectedStartDate.trim();
    const end = selectedEndDate.trim();
    if (!start && !end) return null;
    if (start && (!end || start === end)) {
      return `दिनांक: ${formatDateDDMMYYYY(start)}`;
    }
    if (!start && end) {
      return `दिनांक: ${formatDateDDMMYYYY(end)}`;
    }
    const minDate = start <= end ? start : end;
    const maxDate = start <= end ? end : start;
    return `दिनांक: ${formatDateDDMMYYYY(minDate)} ते ${formatDateDDMMYYYY(maxDate)}`;
  }, [selectedStartDate, selectedEndDate]);

  const dateFilterFileSuffix = useMemo(() => {
    const start = selectedStartDate.trim();
    const end = selectedEndDate.trim();
    if (!start && !end) return undefined;
    if (start && (!end || start === end)) {
      return formatDateDDMMYYYY(start);
    }
    if (!start && end) {
      return formatDateDDMMYYYY(end);
    }
    const minDate = start <= end ? start : end;
    const maxDate = start <= end ? end : start;
    return `${formatDateDDMMYYYY(minDate)}_ते_${formatDateDDMMYYYY(maxDate)}`;
  }, [selectedStartDate, selectedEndDate]);

  const totalMonthDistanceKm = useMemo(() => {
    if (!currentDiary) return 0;
    let sum = 0;
    for (const row of currentDiary.entries) {
      const display = resolveDiaryEntryDisplay(row, holidays);
      const travel = resolveDiaryEntryTravel(row, display.toPlace, villages);
      sum += travel.distanceKm;
    }
    return Math.round(sum * 10) / 10;
  }, [currentDiary, holidays, villages]);

  const filteredEntries = useMemo(() => {
    if (!currentDiary) return [];
    const base = dateFilteredEntries;
    if (filterType === 'all') return base;
    if (filterType === 'working') {
      return base.filter(
        (e) => e.entryType !== 'sunday' && e.entryType !== 'holiday' && e.entryType !== 'leave'
      );
    }
    if (filterType === 'non_working') {
      return base.filter(
        (e) => e.entryType === 'sunday' || e.entryType === 'holiday' || e.entryType === 'leave'
      );
    }
    return base.filter((e) => e.isManualEdit);
  }, [currentDiary, dateFilteredEntries, filterType]);

  const startEditRow = (entry: MonthlyDiaryEntry) => {
    const display = resolveDiaryEntryDisplay(entry, holidays);
    const travel = resolveDiaryEntryTravel(entry, display.toPlace, villages);
    setEditingEntry(entry);
    setEditForm({
      fromPlace: entry.fromPlace || 'भादा',
      toPlace: display.toPlace,
      travelMode: travel.travelMode || DEFAULT_TRAVEL_MODE,
      distanceKm: travel.distanceKm > 0 ? String(travel.distanceKm) : '',
      workDescription: display.workDescription,
      notes: display.notes || '',
    });
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDiary || !editingEntry) return;
    setSavingEntry(true);
    try {
      const parsedKm =
        editForm.distanceKm.trim() === '' ? null : Number(editForm.distanceKm.trim());
      const validKm =
        parsedKm !== null && Number.isFinite(parsedKm) && parsedKm >= 0 ? parsedKm : null;
      const encodedNotes = encodeEntryTravelOverrideInNotes(
        editForm.notes.trim(),
        editForm.travelMode,
        validKm
      );
      await onUpdateEntry(currentDiary.id, editingEntry.date, {
        fromPlace: editForm.fromPlace,
        toPlace: editForm.toPlace,
        workDescription: editForm.workDescription,
        notes: encodedNotes,
      });
      setEditingEntry(null);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSavingEntry(false);
    }
  };

  const handlePrintPDF = () => {
    if (!currentDiary) return;
    printMonthlyDiaryWithTitle(currentDiary, dateFilterFileSuffix);
  };

  const handleDownloadPDF = async () => {
    if (!currentDiary || !printSheetRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfExportError(null);
    try {
      await exportMonthlyDiaryToPdf(printSheetRef.current, currentDiary, dateFilterFileSuffix);
    } catch {
      setPdfExportError(
        'थेट PDF तयार करताना अडचण आली. कृपया "A4 प्रिंट करा" पर्यायातून Save as PDF निवडा.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadSingleRowPdf = async (row: MonthlyDiaryEntry) => {
    if (!currentDiary || isExportingPdf || exportingRowDate) return;
    setExportingRowDate(row.date);
    setPdfExportError(null);
    setPdfOverrideEntries([row]);
    setPdfOverrideLabel(`दिनांक: ${formatDateDDMMYYYY(row.date)} (${row.dayNameMarathi})`);

    try {
      // Allow React a frame to render the single-date override in PrintableDiarySheet
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (printSheetRef.current) {
        await exportMonthlyDiaryToPdf(
          printSheetRef.current,
          currentDiary,
          formatDateDDMMYYYY(row.date)
        );
      }
    } catch {
      setPdfExportError(
        'थेट PDF तयार करताना अडचण आली. कृपया "A4 प्रिव्ह्यू / प्रिंट" पर्याय वापरा.'
      );
    } finally {
      setPdfOverrideEntries(null);
      setPdfOverrideLabel(null);
      setExportingRowDate(null);
    }
  };

  const activePrintEntries =
    pdfOverrideEntries ||
    (dateFilterLabel && dateFilteredEntries.length > 0 ? dateFilteredEntries : undefined);
  const activePrintLabel = pdfOverrideLabel || dateFilterLabel;

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Screen Header & Controls (Hidden during A4 Print) */}
      <div className="no-print space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">मासिक दौरा दैनंदिनी</h1>
            <p className="mt-1 text-sm text-slate-600">
              {getFinancialYearLabel(fyStartYear)} · वारनिहाय कार्यक्रम, शासकीय सुट्ट्या, कर्मचारी रजा आणि बैठकींच्या नियमांनुसार स्वयंचलित मासिक दौरा दैनंदिनी.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Financial Year selector */}
            <select
              aria-label="आर्थिक वर्ष निवडा"
              value={fyStartYear}
              onChange={(e) => {
                const newFy = Number(e.target.value);
                setSelectedStartDate('');
                setSelectedEndDate('');
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
                setSelectedStartDate('');
                setSelectedEndDate('');
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
                  onClick={() => exportMonthlyDiaryToExcel(currentDiary, holidays, villages)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPdfExportError(null);
                    setPrintPreviewOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Eye className="h-4 w-4 text-teal-700" />
                  A4 प्रिव्ह्यू / प्रिंट
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf || (Boolean(dateFilterLabel) && dateFilteredEntries.length === 0)}
                  onClick={() => void handleDownloadPDF()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {isExportingPdf
                    ? 'PDF तयार होत आहे...'
                    : dateFilterLabel
                    ? 'निवडलेल्या तारखेची PDF डाउनलोड'
                    : 'संपूर्ण महिना PDF डाउनलोड'}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
                <p className="text-xs text-slate-500">बैठका</p>
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
                <p className="text-xs text-slate-500">रजा / विशेष</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-red-700">
                  {currentDiary.summary.leaves} / {currentDiary.summary.specialEvents}
                </p>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-3.5 py-3">
                <p className="text-xs font-medium text-teal-800">एकूण प्रवास अंतर</p>
                <p className="mt-0.5 font-mono-num text-lg font-bold text-teal-900">
                  {totalMonthDistanceKm} किमी
                </p>
              </div>
            </div>

            {/* Direct PDF Export Error Banner (if any) */}
            {pdfExportError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <span>{pdfExportError}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    A4 प्रिंट करा
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfExportError(null)}
                    className="rounded p-1 text-red-700 hover:bg-red-100"
                    aria-label="सूचना बंद करा"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Critical Warnings Only */}
            {criticalWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                <p className="text-xs font-bold text-amber-900">
                  महत्त्वाच्या सूचना ({criticalWarnings.length})
                </p>
                <ul className="space-y-1.5 text-sm text-amber-950">
                  {criticalWarnings.map((w, i) => (
                    <li key={`${w.date}-${i}`} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specific Date / Date Range Filter & Quick PDF Export Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-700">
                  विशिष्ट तारखेची दैनंदिनी / PDF:
                </span>
                <select
                  aria-label="सुरुवातीचा दिनांक निवडा"
                  value={selectedStartDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStartDate(val);
                    if (!val) setSelectedEndDate('');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-num text-slate-800 focus:border-teal-600 focus:outline-none"
                >
                  <option value="">सर्व तारखा (संपूर्ण महिना)</option>
                  {currentDiary.entries.map((entry) => (
                    <option key={entry.date} value={entry.date}>
                      {formatDateDDMMYYYY(entry.date)} ({entry.dayNameMarathi})
                    </option>
                  ))}
                </select>

                {selectedStartDate && (
                  <>
                    <span className="text-xs text-slate-500">ते (ऐच्छिक कालावधी):</span>
                    <select
                      aria-label="शेवटचा दिनांक निवडा"
                      value={selectedEndDate}
                      onChange={(e) => setSelectedEndDate(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono-num text-slate-800 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="">फक्त {formatDateDDMMYYYY(selectedStartDate)} (एकच दिवस)</option>
                      {currentDiary.entries
                        .filter((entry) => entry.date >= selectedStartDate)
                        .map((entry) => (
                          <option key={entry.date} value={entry.date}>
                            {formatDateDDMMYYYY(entry.date)} ({entry.dayNameMarathi})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStartDate('');
                        setSelectedEndDate('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      संपूर्ण महिना दाखवा
                    </button>
                  </>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      ['all', 'सर्व दिवस'],
                      ['working', 'कामकाजाचे दिवस'],
                      ['non_working', 'सुट्ट्या व रजा'],
                      ['manual', 'मॅन्युअल संपादन'],
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
              <h2 className="text-lg font-bold text-slate-900">
                {dateFilterLabel && dateFilteredEntries.length === 1
                  ? 'दैनिक दौरा दैनंदिनी अहवाल'
                  : 'मासिक दौरा दैनंदिनी'}
              </h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {currentDiary.designation} {currentDiary.employeeName}
              </p>
              <p className="text-sm text-slate-700">{currentDiary.officeName}</p>
              <p className="mt-1 text-sm font-semibold text-teal-800">
                महिना: {currentDiary.monthLabelMarathi}
                {dateFilterLabel ? ` · (${dateFilterLabel})` : ''}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-14">अनुक्रमांक</th>
                    <th className="px-4 py-3 w-44">दिनांक</th>
                    <th className="px-4 py-3 w-24">कोठून</th>
                    <th className="px-4 py-3">कोठे</th>
                    <th className="px-3 py-3 w-28 text-center">प्रवासाचा प्रकार</th>
                    <th className="px-3 py-3 w-24 text-center">अंतर (किमी)</th>
                    <th className="px-4 py-3">कामाचे स्वरूप</th>
                    <th className="px-4 py-3 text-right w-28">कृती / PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((row) => {
                    const display = resolveDiaryEntryDisplay(row, holidays);
                    const travel = resolveDiaryEntryTravel(row, display.toPlace, villages);
                    const isRowExporting = exportingRowDate === row.date;
                    const rowClass =
                      row.entryType === 'sunday'
                        ? 'bg-slate-50 text-slate-500'
                        : row.entryType === 'holiday'
                        ? 'bg-orange-50/50 text-slate-700'
                        : row.entryType === 'leave'
                        ? 'bg-red-50/60 text-red-900'
                        : row.entryType === 'district_meeting'
                        ? 'bg-indigo-50/40'
                        : row.entryType === 'lab_sample_visit'
                        ? 'bg-sky-50/50'
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
                          <div>{display.toPlace}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-700">
                          {travel.travelMode}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono-num text-slate-800">
                          {travel.distanceKm > 0 ? `${travel.distanceKm} किमी` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800">
                          <div className="font-medium">{display.workDescription}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {ENTRY_TYPE_LABELS[row.entryType]}
                            {row.isManualEdit ? ' · मॅन्युअल बदल' : ''}
                            {display.notes ? ` · ${display.notes}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditRow(row)}
                              title="या तारखेची दैनंदिनी नोंद संपादित करा"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isRowExporting || isExportingPdf}
                              onClick={() => void handleDownloadSingleRowPdf(row)}
                              title={`दि. ${formatDateDDMMYYYY(row.date)} ची स्वतंत्र PDF डाउनलोड करा`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50"
                            >
                              {isRowExporting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
                              ) : (
                                <FileDown className="h-3.5 w-3.5 text-teal-700" />
                              )}
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official A4 Print-Only Sheet (Rendered cleanly when printing / exporting direct PDF) */}
          <PrintableDiarySheet
            diary={currentDiary}
            employee={employee}
            holidays={holidays}
            villages={villages}
            entriesOverride={activePrintEntries}
            dateFilterLabel={activePrintLabel}
            sheetRef={printSheetRef}
          />
        </>
      )}

      {/* A4 Printable PDF Preview Modal (hidden during native browser print so table never duplicates) */}
      {printPreviewOpen && currentDiary && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="मासिक दौरा दैनंदिनी A4 PDF प्रिव्ह्यू"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xl max-h-full">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  A4 प्रिंट / PDF प्रिव्ह्यू — {currentDiary.monthLabelMarathi}
                  {dateFilterLabel ? ` (${dateFilterLabel})` : ''}
                </h2>
                <p className="text-xs text-slate-500">
                  शासकीय नमुन्यानुसार तयार केलेले A4 मुद्रणयोग्य स्वरूप
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => void handleDownloadPDF()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {isExportingPdf ? 'PDF तयार होत आहे...' : 'PDF डाउनलोड (.pdf)'}
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Printer className="h-4 w-4 text-slate-700" />
                  A4 प्रिंट करा
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPreviewOpen(false)}
                  aria-label="प्रिव्ह्यू बंद करा"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[794px] rounded-sm bg-white p-6 sm:p-9 shadow-md ring-1 ring-slate-200">
                <PrintableDiarySheet
                  diary={currentDiary}
                  employee={employee}
                  holidays={holidays}
                  villages={villages}
                  entriesOverride={activePrintEntries}
                  dateFilterLabel={activePrintLabel}
                  previewMode
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row Edit Modal */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 no-print overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEntry}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  दैनंदिनी नोंद संपादित करा (मॅन्युअल बदल)
                </h3>
                <p className="text-xs text-slate-500">
                  दिनांक {formatDateDDMMYYYY(editingEntry.date)} ({editingEntry.dayNameMarathi})
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  प्रवासाचा प्रकार
                </label>
                <select
                  value={editForm.travelMode}
                  onChange={(e) => setEditForm({ ...editForm, travelMode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  {TRAVEL_MODE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  अंतर (जाणे-येणे किमी)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={editForm.distanceKm}
                  onChange={(e) => setEditForm({ ...editForm, distanceKm: e.target.value })}
                  placeholder="आपोआप मोजले जाईल"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                कामाचे स्वरूप <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={editForm.workDescription}
                onChange={(e) => setEditForm({ ...editForm, workDescription: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">टिप्पणी (ऐच्छिक)</label>
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
