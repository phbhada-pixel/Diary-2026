import * as XLSX from 'xlsx';
import type { MonthlyDiaryDocument } from '../shared/types.ts';
import { formatDateDDMMYYYY } from '../shared/marathi.ts';

/**
 * Exports a single Monthly Tour Diary to Excel (.xlsx) with exact official Marathi header & columns.
 */
export function exportMonthlyDiaryToExcel(doc: MonthlyDiaryDocument): void {
  const rows: (string | number)[][] = [
    ['मासिक दौरा दैनंदिनी'],
    [`${doc.designation} ${doc.employeeName}`],
    [doc.officeName],
    [`महिना: ${doc.monthLabelMarathi}`],
    [],
    ['अनुक्रमांक', 'दिनांक', 'कोठून', 'कोठे', 'कामाचे स्वरूप'],
  ];

  for (const entry of doc.entries) {
    rows.push([
      entry.serialNo,
      `${formatDateDDMMYYYY(entry.date)} (${entry.dayNameMarathi})`,
      entry.fromPlace,
      entry.toPlace,
      entry.workDescription,
    ]);
  }

  rows.push([]);
  rows.push([
    'सारांश',
    `एकूण दिवस: ${doc.summary.totalDays}`,
    `कामकाज: ${doc.summary.workingDays}`,
    `रविवार/सुट्ट्या: ${doc.summary.sundays + doc.summary.holidays}`,
    `रजा: ${doc.summary.leaves} | विशेष कार्यक्रम: ${doc.summary.specialEvents}`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
  ];
  ws['!cols'] = [
    { wch: 11 },
    { wch: 24 },
    { wch: 14 },
    { wch: 36 },
    { wch: 52 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, doc.sheetName.slice(0, 31));
  XLSX.writeFile(wb, `मासिक_दौरा_दैनंदिनी_${doc.sheetName}.xlsx`);
}

/**
 * Exports a Financial Year Summary report to Excel (.xlsx).
 */
export function exportAnnualReportToExcel(
  fyLabel: string,
  diaries: MonthlyDiaryDocument[],
  employeeName: string,
  officeName: string
): void {
  const rows: (string | number)[][] = [
    ['वार्षिक मासिक दौरा दैनंदिनी गोषवारा अहवाल'],
    [`आरोग्य सहाय्यक: ${employeeName} — ${officeName}`],
    [fyLabel],
    [],
    [
      'महिना',
      'एकूण दिवस',
      'कामकाजाचे दिवस',
      'गाव सत्रे',
      'बैठका',
      'कार्यालयीन कामकाज',
      'विशेष कार्यक्रम',
      'रविवार',
      'शासकीय सुट्ट्या',
      'रजा',
      'सुट्टी समायोजन',
    ],
  ];

  for (const d of diaries) {
    rows.push([
      d.monthLabelMarathi,
      d.summary.totalDays,
      d.summary.workingDays,
      d.summary.villageTours,
      d.summary.meetings,
      d.summary.officeDays,
      d.summary.specialEvents,
      d.summary.sundays,
      d.summary.holidays,
      d.summary.leaves,
      d.summary.adjustedDays,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
  ];
  ws['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 11 },
    { wch: 10 },
    { wch: 16 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 },
    { wch: 9 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Annual_Summary');
  XLSX.writeFile(wb, `वार्षिक_अहवाल_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Triggers a JSON download for full database backup.
 */
export function downloadJsonBackup(data: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PHC_Bhada_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
