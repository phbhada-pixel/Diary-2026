import React, { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, History, Search, Upload } from 'lucide-react';
import type {
  DiaryChangeHistoryRecord,
  EmployeeMaster,
  MonthlyDiaryDocument,
} from '../shared/types.ts';
import {
  formatDateTimeMarathi,
  getFinancialYearLabel,
  getFinancialYearMonths,
} from '../shared/marathi.ts';
import { downloadJsonBackup, exportAnnualReportToExcel } from '../utils/exportUtils.ts';
import { api } from '../services/api.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface ReportsViewProps {
  employee: EmployeeMaster;
  diaries: MonthlyDiaryDocument[];
  history: DiaryChangeHistoryRecord[];
  onRefreshAll: () => Promise<void>;
  onOpenMonth: (year: number, month: number) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employee,
  diaries,
  history,
  onRefreshAll,
  onOpenMonth,
}) => {
  const [fyStartYear, setFyStartYear] = useState(2026);
  const [historySearch, setHistorySearch] = useState('');
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fyMonths = useMemo(() => getFinancialYearMonths(fyStartYear), [fyStartYear]);
  const fyDiaries = useMemo(() => {
    const map = new Map(diaries.map((d) => [d.id, d]));
    return fyMonths.map((fm) => ({
      meta: fm,
      doc: map.get(fm.id) || null,
    }));
  }, [diaries, fyMonths]);

  const savedFyDiaries = fyDiaries.map((x) => x.doc).filter((d): d is MonthlyDiaryDocument => d !== null);

  const totals = useMemo(() => {
    return savedFyDiaries.reduce(
      (acc, d) => ({
        workingDays: acc.workingDays + d.summary.workingDays,
        villageTours: acc.villageTours + d.summary.villageTours,
        meetings: acc.meetings + d.summary.meetings,
        officeDays: acc.officeDays + d.summary.officeDays,
        holidays: acc.holidays + d.summary.holidays,
        leaves: acc.leaves + d.summary.leaves,
        specialEvents: acc.specialEvents + d.summary.specialEvents,
      }),
      {
        workingDays: 0,
        villageTours: 0,
        meetings: 0,
        officeDays: 0,
        holidays: 0,
        leaves: 0,
        specialEvents: 0,
      }
    );
  }, [savedFyDiaries]);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(
      (h) =>
        h.summary.toLowerCase().includes(q) ||
        h.entityType.toLowerCase().includes(q) ||
        h.action.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  const handleDownloadBackup = async () => {
    const backup = await api.getBackup();
    downloadJsonBackup(backup);
    setStatusMessage('संपूर्ण डेटाबेसचा JSON बॅकअप यशस्वीरित्या डाउनलोड केला आहे.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && typeof parsed === 'object' && parsed.data) {
          setPendingRestore(parsed);
        } else {
          setStatusMessage('अवैध बॅकअप फाईल: कृपया या प्रणालीतून डाउनलोड केलेली JSON बॅकअप फाईल निवडा.');
        }
      } catch {
        setStatusMessage('बॅकअप फाईल वाचताना त्रुटी आली.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">अहवाल, बदल इतिहास व बॅकअप</h1>
          <p className="mt-1 text-sm text-slate-600">
            आर्थिक वर्षनिहाय गोषवारा अहवाल, सर्व बदलांचा History Log आणि संपूर्ण डेटाबेस बॅकअप / रिस्टोअर सुविधा.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            डेटाबेस बॅकअप (.json)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            बॅकअप रिस्टोअर
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          {statusMessage}
        </div>
      )}

      {/* Financial Year Summary Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {getFinancialYearLabel(fyStartYear)} — वार्षिक गोषवारा
            </h2>
            <p className="text-xs text-slate-500">
              तयार केलेल्या महिन्यांची संख्या: <span className="font-mono-num font-semibold">{savedFyDiaries.length} / 12</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              {[2026, 2027, 2028, 2029, 2030].map((fy) => (
                <option key={fy} value={fy}>
                  आर्थिक वर्ष {fy}-{String(fy + 1).slice(-2)}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={savedFyDiaries.length === 0}
              onClick={() =>
                exportAnnualReportToExcel(
                  getFinancialYearLabel(fyStartYear),
                  savedFyDiaries,
                  employee.fullName,
                  employee.officeName
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" />
              वार्षिक Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">महिना</th>
                <th className="px-4 py-3 text-right">कामकाज</th>
                <th className="px-4 py-3 text-right">गाव सत्रे</th>
                <th className="px-4 py-3 text-right">बैठका</th>
                <th className="px-4 py-3 text-right">कार्यालयीन</th>
                <th className="px-4 py-3 text-right">सुट्ट्या</th>
                <th className="px-4 py-3 text-right">रजा</th>
                <th className="px-4 py-3 text-right">विशेष</th>
                <th className="px-4 py-3 text-right">स्थिती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fyDiaries.map(({ meta, doc }) => (
                <tr key={meta.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{meta.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{doc ? doc.summary.workingDays : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{doc ? doc.summary.villageTours : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{doc ? doc.summary.meetings : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{doc ? doc.summary.officeDays : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{doc ? doc.summary.holidays : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-red-700">{doc ? doc.summary.leaves : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-teal-700">{doc ? doc.summary.specialEvents : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenMonth(meta.year, meta.month)}
                      className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
                    >
                      {doc ? 'पहा / संपादित करा' : 'तयार करा'}
                    </button>
                  </td>
                </tr>
              ))}
              {savedFyDiaries.length > 0 && (
                <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                  <td className="px-4 py-3">एकूण (तयार महिने)</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.workingDays}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.villageTours}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.meetings}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.officeDays}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{totals.holidays}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-red-700">{totals.leaves}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-teal-700">{totals.specialEvents}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs">{savedFyDiaries.length} महिने</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change History Log */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">
              बदलांचा इतिहास लॉग (Diary Change History — <span className="font-mono-num">{filteredHistory.length}</span>)
            </h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="इतिहास शोधा..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            कोणत्याही बदलांची नोंद आढळली नाही.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 w-40">दिनांक व वेळ</th>
                  <th className="px-4 py-2.5 w-44">विभाग</th>
                  <th className="px-4 py-2.5 w-28">कृती</th>
                  <th className="px-4 py-2.5">तपशील</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {formatDateTimeMarathi(h.changeDate)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{h.entityType}</td>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600">{h.action}</td>
                    <td className="px-4 py-2.5 text-slate-800">{h.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        danger
        title="बॅकअप फाईल रिस्टोअर करायची का?"
        description="सध्याचा डेटाबेस निवडलेल्या बॅकअप फाईलमधील माहितीने बदलला जाईल. पुढे सुरू ठेवायचे का?"
        confirmLabel="होय, रिस्टोअर करा"
        onCancel={() => setPendingRestore(null)}
        onConfirm={async () => {
          if (pendingRestore) {
            await api.restoreBackup(pendingRestore);
            await onRefreshAll();
            setPendingRestore(null);
            setStatusMessage('डेटाबेस बॅकअप यशस्वीरित्या रिस्टोअर करण्यात आला आहे.');
          }
        }}
      />
    </div>
  );
};
