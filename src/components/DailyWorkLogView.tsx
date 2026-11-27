import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Calendar,
  Check,
  Eye,
  FileDown,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  EmployeeMaster,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
} from '../shared/types.ts';
import { formatDateDDMMYYYY, formatDateTimeMarathi } from '../shared/marathi.ts';
import { extractHeadquarterCities } from '../shared/travelMeta.ts';
import {
  type DailyWorkLogEntryItem,
  encodeDailyWorkLogToSpecialEventPayload,
  getDayNameForIsoDate,
  parseDailyWorkLogFromRecord,
  SYSTEM_DEFAULT_STAFF_ROLES,
} from '../shared/dailyWorkLog.ts';
import { exportElementToA4Pdf, printWithDocumentTitle } from '../utils/exportUtils.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface DailyWorkLogViewProps {
  employee: EmployeeMaster;
  villages: VillageMaster[];
  subcenters?: SubcenterMaster[];
  specialEvents: SpecialEventMaster[];
  onCreateRecord: (
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onUpdateRecord: (
    id: string,
    payload: Pick<SpecialEventMaster, 'date' | 'eventType' | 'location' | 'workDescription' | 'notes'>
  ) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
}

const MARATHI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

function toMarathiNumber(num: number): string {
  return String(num)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? MARATHI_DIGITS[Number(ch)] : ch))
    .join('');
}

function splitDetailIntoParagraphs(detail: string): string[] {
  const parts = (detail || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [(detail || '').trim()];
}

interface PrintableSingleDayWorkLogSheetProps {
  employee: EmployeeMaster;
  workDate: string;
  entries: DailyWorkLogEntryItem[];
  previewMode?: boolean;
  sheetRef?: React.Ref<HTMLDivElement>;
}

const PrintableSingleDayWorkLogSheet: React.FC<PrintableSingleDayWorkLogSheetProps> = ({
  employee,
  workDate,
  entries,
  previewMode = false,
  sheetRef,
}) => {
  const dayName = getDayNameForIsoDate(workDate);

  // Aggregate unique villages & staff across all entries of the selected day
  const allDayVillages = Array.from(
    new Set(entries.flatMap((e) => e.villages).filter(Boolean))
  );
  const allDayStaff = Array.from(
    new Set(entries.flatMap((e) => e.staff).filter(Boolean))
  );

  return (
    <div
      ref={sheetRef}
      className={`print-only print-sheet${previewMode ? ' print-preview-visible' : ''}`}
    >
      <div className="diary-print-header">
        <h1 className="diary-print-title">दैनंदिन सविस्तर कामाचा वृत्तांत अहवाल</h1>
        <p className="diary-print-subtitle">
          {employee.designation} {employee.fullName}
        </p>
        <p className="diary-print-meta">
          {employee.officeName} (मुख्यालय: {employee.headquarters || 'भादा'})
        </p>
      </div>

      <div className="book-report-meta-bar">
        <span>
          <strong>दिनांक:</strong> {formatDateDDMMYYYY(workDate)} ({dayName})
        </span>
        {allDayVillages.length > 0 && (
          <span>
            <strong>गाव:</strong> {allDayVillages.join(', ')}
          </span>
        )}
        <span>
          <strong>एकूण मुद्दे:</strong> {toMarathiNumber(entries.length)}
        </span>
      </div>

      <div className="book-report-body">
        {entries.map((item, idx) => {
          const paragraphs = splitDetailIntoParagraphs(item.detail);
          const isLastEntry = idx === entries.length - 1;

          return (
            <React.Fragment key={item.id}>
              {/* Heading + First Paragraph kept together so heading is never orphaned at bottom of a page */}
              <div
                data-pdf-block="true"
                className="book-report-entry"
                style={
                  paragraphs.length > 1
                    ? { borderBottom: 'none', marginBottom: '6px', paddingBottom: '0' }
                    : isLastEntry
                    ? { borderBottom: 'none' }
                    : undefined
                }
              >
                <p className="book-report-point-head">
                  <span>मुद्दा क्र. {toMarathiNumber(idx + 1)} : </span>
                  <span className="book-report-point-meta">
                    गाव — {item.villages.join(', ') || '—'}
                    {item.staff.length > 0 ? ` | कर्मचारी — ${item.staff.join(', ')}` : ''}
                  </span>
                </p>
                {paragraphs[0] && <p className="book-report-paragraph">{paragraphs[0]}</p>}
              </div>

              {/* Any additional paragraphs in the same entry render as distinct book paragraphs */}
              {paragraphs.slice(1).map((para, pIdx) => {
                const isLastParaOfEntry = pIdx === paragraphs.length - 2;
                return (
                  <div
                    key={`${item.id}-p-${pIdx}`}
                    data-pdf-block="true"
                    className={isLastParaOfEntry ? 'book-report-entry' : ''}
                    style={
                      isLastParaOfEntry
                        ? isLastEntry
                          ? { borderBottom: 'none' }
                          : undefined
                        : { marginBottom: '8px' }
                    }
                  >
                    <p className="book-report-paragraph">{para}</p>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {allDayStaff.length > 0 && (
        <div className="diary-print-summary" style={{ marginTop: '14px' }}>
          <span>
            <strong>दिनांक:</strong> {formatDateDDMMYYYY(workDate)} ({dayName})
          </span>
          <span>
            <strong>सहभागी कर्मचारी:</strong> {allDayStaff.join(', ')}
          </span>
        </div>
      )}

      <div className="diary-print-signatures">
        <div className="diary-print-sig-col">
          <p>स्वाक्षरी</p>
          <p className="diary-print-sig-space">{employee.designation}</p>
          <p>{employee.fullName}</p>
          <p>{employee.officeName}</p>
        </div>
        <div className="diary-print-sig-col">
          <p>प्रतिस्वाक्षरी</p>
          <p className="diary-print-sig-space">वैद्यकीय अधिकारी</p>
          <p>{employee.officeName}</p>
        </div>
      </div>
    </div>
  );
};

export const DailyWorkLogView: React.FC<DailyWorkLogViewProps> = ({
  employee,
  villages,
  subcenters = [],
  specialEvents,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
}) => {
  // Parse all standalone daily work log entries (WORK_LOG_YYYY-MM-DD)
  const allWorkLogs = useMemo(() => {
    const list: DailyWorkLogEntryItem[] = [];
    for (const ev of specialEvents) {
      const parsed = parseDailyWorkLogFromRecord(ev);
      if (parsed) {
        list.push(parsed);
      }
    }
    // Sort chronological within a date (oldest first so serial numbers 1, 2, 3 match order added during the day)
    list.sort((a, b) => {
      if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate);
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    return list;
  }, [specialEvents]);

  // Distinct dates that have saved entries (newest first) for quick past-date jump
  const recordedDates = useMemo(() => {
    const set = new Set<string>();
    for (const item of allWorkLogs) {
      set.add(item.workDate);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allWorkLogs]);

  const primaryEmployeeLabel = useMemo(() => {
    const name = (employee.fullName || 'श्री. हिप्परगेकर जी. एस.').trim();
    const desig = (employee.designation || 'आरोग्य सहाय्यक').trim();
    return desig ? `${name} (${desig})` : name;
  }, [employee]);

  // Form State — Strictly: दिनांक, गाव (multi-select), कर्मचारी (multi-select), सविस्तर तपशील
  const [workDate, setWorkDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedVillages, setSelectedVillages] = useState<string[]>([
    employee.headquarters?.trim() || 'भादा',
  ]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>(() => [primaryEmployeeLabel]);
  const [detail, setDetail] = useState<string>('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Optional quick custom village / staff addition into system options
  const [customVillageOptions, setCustomVillageOptions] = useState<string[]>([]);
  const [newVillageInput, setNewVillageInput] = useState<string>('');
  const [showAddVillageBox, setShowAddVillageBox] = useState<boolean>(false);

  const [customStaffOptions, setCustomStaffOptions] = useState<string[]>([]);
  const [newStaffInput, setNewStaffInput] = useState<string>('');
  const [showAddStaffBox, setShowAddStaffBox] = useState<boolean>(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Preview / PDF / Delete Modal State (Strictly shows ONLY the currently selected workDate)
  const [a4ModalOpen, setA4ModalOpen] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<DailyWorkLogEntryItem | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);
  const detailTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Populate Village options from System (Village_Master + Subcenter_Master + Headquarters + any saved villages)
  const systemVillageOptions = useMemo(() => {
    const { talukaHq, districtHq, regularVillages } = extractHeadquarterCities(villages);
    const set = new Set<string>();
    if (employee.headquarters?.trim()) set.add(employee.headquarters.trim());
    set.add('भादा');
    for (const v of regularVillages) {
      if (v.name?.trim()) set.add(v.name.trim());
    }
    for (const sc of subcenters) {
      if (sc.name?.trim()) set.add(sc.name.trim());
      if (sc.location?.trim()) set.add(sc.location.trim());
    }
    if (talukaHq.name?.trim()) set.add(talukaHq.name.trim());
    if (districtHq.name?.trim()) set.add(districtHq.name.trim());
    for (const rec of allWorkLogs) {
      for (const v of rec.villages) {
        if (v.trim()) set.add(v.trim());
      }
    }
    for (const cv of customVillageOptions) {
      if (cv.trim()) set.add(cv.trim());
    }
    return Array.from(set);
  }, [villages, subcenters, employee.headquarters, allWorkLogs, customVillageOptions]);

  // Populate Staff / Employee options from System (Employee_Master + System Staff Roles + any saved staff names)
  const systemStaffOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(primaryEmployeeLabel);
    for (const role of SYSTEM_DEFAULT_STAFF_ROLES) {
      set.add(role);
    }
    for (const rec of allWorkLogs) {
      for (const s of rec.staff) {
        if (s.trim()) set.add(s.trim());
      }
    }
    for (const cs of customStaffOptions) {
      if (cs.trim()) set.add(cs.trim());
    }
    return Array.from(set);
  }, [primaryEmployeeLabel, allWorkLogs, customStaffOptions]);

  // ONLY entries belonging to the active/selected date (`workDate`) are shown in the preview
  const currentDayEntries = useMemo(() => {
    return allWorkLogs.filter((item) => item.workDate === workDate);
  }, [allWorkLogs, workDate]);

  const toggleVillage = (vName: string) => {
    setSelectedVillages((prev) =>
      prev.includes(vName) ? prev.filter((x) => x !== vName) : [...prev, vName]
    );
  };

  const toggleStaff = (sName: string) => {
    setSelectedStaff((prev) =>
      prev.includes(sName) ? prev.filter((x) => x !== sName) : [...prev, sName]
    );
  };

  const handleAddCustomVillage = () => {
    const clean = newVillageInput.trim();
    if (!clean) return;
    if (!customVillageOptions.includes(clean)) {
      setCustomVillageOptions((prev) => [...prev, clean]);
    }
    if (!selectedVillages.includes(clean)) {
      setSelectedVillages((prev) => [...prev, clean]);
    }
    setNewVillageInput('');
    setShowAddVillageBox(false);
  };

  const handleAddCustomStaff = () => {
    const clean = newStaffInput.trim();
    if (!clean) return;
    if (!customStaffOptions.includes(clean)) {
      setCustomStaffOptions((prev) => [...prev, clean]);
    }
    if (!selectedStaff.includes(clean)) {
      setSelectedStaff((prev) => [...prev, clean]);
    }
    setNewStaffInput('');
    setShowAddStaffBox(false);
  };

  const startEditEntry = (entry: DailyWorkLogEntryItem) => {
    setEditingEntryId(entry.id);
    setWorkDate(entry.workDate);
    setSelectedVillages(entry.villages.length > 0 ? entry.villages : ['भादा']);
    setSelectedStaff(entry.staff.length > 0 ? entry.staff : [primaryEmployeeLabel]);
    setDetail(entry.detail);
    setFormError(null);
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setDetail('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!workDate) {
      setFormError('कृपया दिनांक निवडा.');
      return;
    }
    if (selectedVillages.length === 0) {
      setFormError('कृपया किमान एक गाव निवडा.');
      return;
    }
    if (selectedStaff.length === 0) {
      setFormError('कृपया किमान एक कर्मचारी निवडा.');
      return;
    }
    if (!detail.trim()) {
      setFormError('कृपया केलेल्या कामाचा सविस्तर तपशील लिहा.');
      return;
    }

    const editingEntry = editingEntryId
      ? allWorkLogs.find((item) => item.id === editingEntryId) || null
      : null;

    const payload = encodeDailyWorkLogToSpecialEventPayload({
      workDate,
      existingRawDateKey: editingEntry?.rawDateKey,
      villages: selectedVillages,
      staff: selectedStaff,
      detail: detail.trim(),
    });

    setSubmitting(true);
    try {
      if (editingEntryId) {
        // Update the specific entry being edited
        await onUpdateRecord(editingEntryId, payload);
        setEditingEntryId(null);
      } else {
        // Always add a NEW entry for this date so the user can add multiple times throughout the day
        await onCreateRecord(payload);
      }
      // Clear only the detail field so the user can immediately add the next work entry for the same day
      setDetail('');
      window.setTimeout(() => {
        detailTextareaRef.current?.focus();
      }, 50);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCurrentDayPdf = async () => {
    if (currentDayEntries.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (printSheetRef.current) {
        const dateLabel = formatDateDDMMYYYY(workDate);
        await exportElementToA4Pdf(
          printSheetRef.current,
          `सविस्तर_कामाचा_वृत्तांत_${dateLabel}`,
          `सविस्तर कामाचा वृत्तांत (${dateLabel})`
        );
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="no-print space-y-5">
        {/* Top Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
              <BookOpenCheck className="h-3.5 w-3.5" />
              स्वतंत्र विभाग (मूळ मासिक दौरा दैनंदिनीपासून पूर्णपणे वेगळा)
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              सविस्तर कामाचा वृत्तांत
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              दिनांक, गाव आणि कर्मचारी निवडून दिवसभरात अनेक वेळा नवीन सविस्तर माहिती ॲड करा. प्रिव्ह्यूमध्ये निवडलेल्या चालू दिवसाचीच माहिती दिसेल व त्याची PDF डाउनलोड करता येईल.
            </p>
          </div>

          {/* Quick Past-Date Switcher */}
          {recordedDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">
                नोंद असलेल्या तारखा ({recordedDates.length}):
              </label>
              <select
                aria-label="मागील नोंद असलेला दिनांक निवडा"
                value={recordedDates.includes(workDate) ? workDate : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setEditingEntryId(null);
                    setWorkDate(e.target.value);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono-num font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
              >
                {!recordedDates.includes(workDate) && (
                  <option value="">
                    चालू निवडलेला दिनांक: {formatDateDDMMYYYY(workDate)}
                  </option>
                )}
                {recordedDates.map((d) => {
                  const count = allWorkLogs.filter((x) => x.workDate === d).length;
                  return (
                    <option key={d} value={d}>
                      दि. {formatDateDDMMYYYY(d)} ({getDayNameForIsoDate(d)}) — {count} नोंदी
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* 2-Column Layout: Left = 4-Field Entry Form, Right = Live Preview of ONLY the Selected Date */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: Entry Form (Strictly 4 Fields: दिनांक, गाव, कर्मचारी, सविस्तर तपशील) */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingEntryId
                    ? `दि. ${formatDateDDMMYYYY(workDate)} मधील नोंद संपादित करा`
                    : `सविस्तर कामाची नवीन नोंद जोडा (मुद्दा क्र. ${toMarathiNumber(
                        currentDayEntries.length + 1
                      )})`}
                </h2>
                <p className="text-xs text-slate-500">
                  एकाच दिवशी एक काम भरल्यानंतर पुन्हा दुसरे, तिसरे काम केले तर तेही स्वतंत्र मुद्दा म्हणून भरता येते.
                </p>
              </div>
              {editingEntryId && (
                <button
                  type="button"
                  onClick={cancelEditEntry}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  title="संपादन रद्द करा"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!editingEntryId && currentDayEntries.length > 0 && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs font-medium text-teal-900">
                दि. <strong>{formatDateDDMMYYYY(workDate)}</strong> रोजी आधीच{' '}
                <strong>{toMarathiNumber(currentDayEntries.length)}</strong> काम/मुद्दे नोंदवलेले आहेत. आता खाली या दिवसातील पुढील काम (
                <strong>मुद्दा क्र. {toMarathiNumber(currentDayEntries.length + 1)}</strong>) भरा.
              </div>
            )}

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                {formError}
              </div>
            )}

            {/* FIELD 1: दिनांक (Date) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-slate-800">
                  १. दिनांक <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntryId(null);
                    setWorkDate(new Date().toISOString().slice(0, 10));
                  }}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  आजची तारीख निवडा
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <input
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => {
                    setEditingEntryId(null);
                    setWorkDate(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
                />
                <span className="shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900">
                  {formatDateDDMMYYYY(workDate)} ({getDayNameForIsoDate(workDate)})
                </span>
              </div>
            </div>

            {/* FIELD 2: गाव (Multi-select populated from system) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <MapPin className="h-4 w-4 text-teal-700" />
                  २. गाव निवडा (Multiple Select) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddVillageBox((v) => !v)}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-teal-700 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    इतर गाव
                  </button>
                  {selectedVillages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedVillages([])}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      निवड पुसा ({selectedVillages.length})
                    </button>
                  )}
                </div>
              </div>

              {showAddVillageBox && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVillageInput}
                    onChange={(e) => setNewVillageInput(e.target.value)}
                    placeholder="नवीन गावाचे नाव लिहा..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-teal-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomVillage}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    जोडा
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5">
                {systemVillageOptions.map((vName) => {
                  const isSelected = selectedVillages.includes(vName);
                  return (
                    <button
                      key={vName}
                      type="button"
                      onClick={() => toggleVillage(vName)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-700 text-white shadow-2xs'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-xs border ${
                          isSelected
                            ? 'border-white bg-white text-teal-800'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </span>
                      <span>{vName}</span>
                    </button>
                  );
                })}
              </div>

              {selectedVillages.length > 0 && (
                <p className="text-xs font-medium text-teal-800">
                  निवडलेली गावे: {selectedVillages.join(', ')}
                </p>
              )}
            </div>

            {/* FIELD 3: कर्मचारी (Multi-select populated from system) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <Users className="h-4 w-4 text-teal-700" />
                  ३. कर्मचारी निवडा (Multiple Select) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStaffBox((s) => !s)}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-teal-700 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    नवीन कर्मचारी नाव
                  </button>
                  {selectedStaff.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStaff([])}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      निवड पुसा ({selectedStaff.length})
                    </button>
                  )}
                </div>
              </div>

              {showAddStaffBox && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newStaffInput}
                    onChange={(e) => setNewStaffInput(e.target.value)}
                    placeholder="कर्मचाऱ्याचे नाव / पदनाम लिहा..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-teal-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomStaff}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    जोडा
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-0.5">
                {systemStaffOptions.map((sName) => {
                  const isSelected = selectedStaff.includes(sName);
                  return (
                    <button
                      key={sName}
                      type="button"
                      onClick={() => toggleStaff(sName)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors text-left ${
                        isSelected
                          ? 'border-teal-700 bg-teal-700 text-white shadow-2xs'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border ${
                          isSelected
                            ? 'border-white bg-white text-teal-800'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </span>
                      <span>{sName}</span>
                    </button>
                  );
                })}
              </div>

              {selectedStaff.length > 0 && (
                <p className="text-xs font-medium text-teal-800">
                  निवडलेले कर्मचारी: {selectedStaff.join(', ')}
                </p>
              )}
            </div>

            {/* FIELD 4: सविस्तर तपशील (Detailed Work Narrative) */}
            <div>
              <label className="block text-sm font-bold text-slate-800">
                ४. सविस्तर तपशील{' '}
                {!editingEntryId && (
                  <span className="text-xs font-semibold text-teal-800">
                    (मुद्दा क्र. {toMarathiNumber(currentDayEntries.length + 1)})
                  </span>
                )}{' '}
                <span className="text-red-600">*</span>
              </label>
              <textarea
                ref={detailTextareaRef}
                rows={4}
                required
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={`मुद्दा क्र. ${toMarathiNumber(
                  currentDayEntries.length + 1
                )}: या वेळेत / सत्रात केलेल्या कामाचा सविस्तर तपशील येथे लिहा...`}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {editingEntryId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {submitting
                  ? 'जतन होत आहे...'
                  : editingEntryId
                  ? 'नोंद अपडेट करा'
                  : currentDayEntries.length > 0
                  ? `दि. ${formatDateDDMMYYYY(workDate)} मध्ये पुढील काम (मुद्दा क्र. ${toMarathiNumber(
                      currentDayEntries.length + 1
                    )}) ॲड करा`
                  : `दि. ${formatDateDDMMYYYY(workDate)} मध्ये पहिले काम (मुद्दा क्र. १) ॲड करा`}
              </button>
              {editingEntryId && (
                <button
                  type="button"
                  onClick={cancelEditEntry}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  रद्द
                </button>
              )}
            </div>
          </form>

          {/* RIGHT: Live Preview of ONLY the Currently Selected Date (`workDate`) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              {/* Preview Action Bar for the Active Day */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-2.5 py-1 font-mono-num text-xs font-bold text-white">
                    <Calendar className="h-3.5 w-3.5" />
                    चालू दिवसाचा प्रिव्ह्यू: दि. {formatDateDDMMYYYY(workDate)} ({getDayNameForIsoDate(workDate)})
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    एकूण नोंदी: <span className="font-mono-num">{currentDayEntries.length}</span>
                  </span>
                </div>

                {currentDayEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setA4ModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5 text-teal-700" />
                      A4 प्रिव्ह्यू
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        printWithDocumentTitle(
                          `सविस्तर_कामाचा_वृत्तांत_${formatDateDDMMYYYY(workDate)}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                    >
                      <Printer className="h-3.5 w-3.5 text-slate-700" />
                      प्रिंट
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => void handleDownloadCurrentDayPdf()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {isExportingPdf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      दि. {formatDateDDMMYYYY(workDate)} PDF डाउनलोड
                    </button>
                  </div>
                )}
              </div>

              {/* Official Book-Print Paragraph Preview Body for the Active Day ONLY */}
              <div className="p-6 sm:p-8 bg-white">
                {/* Official Government Report Header */}
                <div className="border-b-2 border-slate-800 pb-3.5 text-center">
                  <h3 className="text-xl font-bold text-slate-900">
                    दैनंदिन सविस्तर कामाचा वृत्तांत अहवाल
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {employee.designation} {employee.fullName}
                  </p>
                  <p className="text-xs text-slate-600">
                    {employee.officeName} (मुख्यालय: {employee.headquarters || 'भादा'})
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800">
                  <span>
                    दिनांक: {formatDateDDMMYYYY(workDate)} ({getDayNameForIsoDate(workDate)})
                  </span>
                  <span>एकूण मुद्दे: {toMarathiNumber(currentDayEntries.length)}</span>
                </div>

                {currentDayEntries.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      दि. {formatDateDDMMYYYY(workDate)} ({getDayNameForIsoDate(workDate)}) साठी अद्याप कोणतीही नोंद नाही.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      डाव्या बाजूच्या फॉर्ममधून गाव, कर्मचारी व सविस्तर तपशील भरून या दिवसाची माहिती ॲड करा.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {currentDayEntries.map((item, idx) => {
                      const isBeingEdited = editingEntryId === item.id;
                      const paragraphs = splitDetailIntoParagraphs(item.detail);
                      return (
                        <article
                          key={item.id}
                          className={`rounded-lg border-b border-dashed border-slate-300 pb-5 last:border-b-0 last:pb-1 transition-colors ${
                            isBeingEdited ? 'bg-teal-50/60 p-3.5 ring-1 ring-teal-200' : ''
                          }`}
                        >
                          {/* Book Point Heading + Inline Village & Staff Metadata + Subtle Edit/Delete Controls */}
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold leading-snug text-slate-900">
                              <span className="text-teal-900">
                                मुद्दा क्र. {toMarathiNumber(idx + 1)} :
                              </span>{' '}
                              <span className="font-semibold text-slate-800">
                                गाव — {item.villages.join(', ') || '—'}
                              </span>
                              {item.staff.length > 0 && (
                                <span className="font-medium text-slate-700">
                                  {' '}
                                  | कर्मचारी — {item.staff.join(', ')}
                                </span>
                              )}
                            </p>

                            <div className="inline-flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditEntry(item)}
                                title="ही नोंद बदला"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                title="ही नोंद हटवा"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Book-Print Justified Paragraphs */}
                          <div className="mt-2.5 space-y-2.5">
                            {paragraphs.map((para, pIdx) => (
                              <p
                                key={pIdx}
                                className="indent-8 text-justify text-[15px] leading-[1.85] text-slate-900"
                              >
                                {para}
                              </p>
                            ))}
                          </div>

                          {item.updatedAt && (
                            <div className="mt-2 text-right text-[11px] text-slate-400">
                              नोंद वेळ: {formatDateTimeMarathi(item.updatedAt)}
                            </div>
                          )}
                        </article>
                      );
                    })}

                    {/* Official Signature Footer Preview */}
                    <div className="mt-8 flex items-end justify-between border-t border-slate-300 pt-6 px-4 text-xs text-slate-700">
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">स्वाक्षरी</p>
                        <p className="mt-6 font-semibold">{employee.designation}</p>
                        <p>{employee.fullName}</p>
                        <p className="text-slate-500">{employee.officeName}</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-900">प्रतिस्वाक्षरी</p>
                        <p className="mt-6 font-semibold">वैद्यकीय अधिकारी</p>
                        <p className="text-slate-500">{employee.officeName}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden A4 Print Sheet — Strictly contains ONLY the currently selected date (`workDate`) */}
      <PrintableSingleDayWorkLogSheet
        employee={employee}
        workDate={workDate}
        entries={currentDayEntries}
        sheetRef={printSheetRef}
      />

      {/* A4 Full Preview Modal for the Active Day */}
      {a4ModalOpen && currentDayEntries.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="दैनंदिन सविस्तर कामाचा वृत्तांत A4 प्रिव्ह्यू"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xl max-h-full">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  A4 अहवाल प्रिव्ह्यू — दि. {formatDateDDMMYYYY(workDate)} ({getDayNameForIsoDate(workDate)})
                </h2>
                <p className="text-xs text-slate-500">
                  फक्त निवडलेल्या चालू दिवसाचा स्टँडर्ड शासकीय A4 अहवाल ({currentDayEntries.length} नोंदी)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => void handleDownloadCurrentDayPdf()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
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
                  onClick={() =>
                    printWithDocumentTitle(
                      `सविस्तर_कामाचा_वृत्तांत_${formatDateDDMMYYYY(workDate)}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 text-slate-700" />
                  A4 प्रिंट करा
                </button>
                <button
                  type="button"
                  onClick={() => setA4ModalOpen(false)}
                  aria-label="बंद करा"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[794px] rounded-sm bg-white p-6 sm:p-9 shadow-md ring-1 ring-slate-200">
                <PrintableSingleDayWorkLogSheet
                  employee={employee}
                  workDate={workDate}
                  entries={currentDayEntries}
                  previewMode
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ही कामाची नोंद हटवायची का?"
        description={
          deleteTarget
            ? `दि. ${formatDateDDMMYYYY(deleteTarget.workDate)} रोजीची (${deleteTarget.villages.join(
                ', '
              )}) ही सविस्तर कामाची नोंद कायमची हटवली जाईल.`
            : ''
        }
        confirmLabel="होय, नोंद हटवा"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          if (editingEntryId === id) {
            cancelEditEntry();
          }
          await onDeleteRecord(id);
        }}
      />
    </div>
  );
};
