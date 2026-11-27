import React from 'react';
import type {
  EmployeeMaster,
  GovernmentHolidayMaster,
  MonthlyDiaryDocument,
  MonthlyDiaryEntry,
  VillageMaster,
} from '../shared/types.ts';
import {
  formatDateDDMMYYYY,
  resolveDiaryEntryDisplay,
} from '../shared/marathi.ts';
import { resolveDiaryEntryTravel } from '../shared/travelMeta.ts';

interface PrintableDiarySheetProps {
  diary: MonthlyDiaryDocument;
  employee: EmployeeMaster;
  holidays: GovernmentHolidayMaster[];
  villages: VillageMaster[];
  /** Optional subset of entries when printing/downloading a specific date or date range */
  entriesOverride?: MonthlyDiaryEntry[];
  /** Optional subtitle label when filtering by a specific date or date range */
  dateFilterLabel?: string | null;
  /** When true, applies .print-preview-visible so the exact .print-only layout is visible on screen inside the A4 preview modal */
  previewMode?: boolean;
  /** Optional ref attached to the root .print-only sheet for direct PDF export */
  sheetRef?: React.Ref<HTMLDivElement>;
}

function getPrintRowClass(entry: MonthlyDiaryEntry): string {
  if (entry.entryType === 'sunday') return 'diary-print-row-sunday';
  if (entry.entryType === 'holiday') return 'diary-print-row-holiday';
  if (entry.entryType === 'leave') return 'diary-print-row-leave';
  return '';
}

export const PrintableDiarySheet: React.FC<PrintableDiarySheetProps> = ({
  diary,
  employee,
  holidays,
  villages,
  entriesOverride,
  dateFilterLabel,
  previewMode = false,
  sheetRef,
}) => {
  const activeEntries = entriesOverride && entriesOverride.length > 0 ? entriesOverride : diary.entries;
  const isFilteredSubset = Boolean(
    entriesOverride && entriesOverride.length > 0 && entriesOverride.length < diary.entries.length
  );

  let totalDistanceKm = 0;
  let workingDaysCount = 0;
  let villageToursCount = 0;
  let meetingsCount = 0;
  let holidaysAndSundaysCount = 0;
  let leavesCount = 0;

  const resolvedRows = activeEntries.map((row) => {
    const display = resolveDiaryEntryDisplay(row, holidays);
    const travel = resolveDiaryEntryTravel(row, display.toPlace, villages);
    totalDistanceKm += travel.distanceKm;

    if (row.entryType === 'sunday' || row.entryType === 'holiday') {
      holidaysAndSundaysCount++;
    } else if (row.entryType === 'leave') {
      leavesCount++;
    } else {
      workingDaysCount++;
    }
    if (row.entryType === 'weekly_schedule' || row.entryType === 'adjusted_schedule') {
      villageToursCount++;
    }
    if (
      row.entryType === 'wednesday_weekly' ||
      row.entryType === 'wednesday_asha' ||
      row.entryType === 'district_meeting' ||
      row.entryType === 'taluka_meeting' ||
      row.entryType === 'subcenter_meeting'
    ) {
      meetingsCount++;
    }

    return { row, display, travel };
  });
  totalDistanceKm = Math.round(totalDistanceKm * 10) / 10;

  return (
    <div
      ref={sheetRef}
      className={`print-only print-sheet${previewMode ? ' print-preview-visible' : ''}`}
    >
      <div className="diary-print-header">
        <h1 className="diary-print-title">
          {isFilteredSubset && activeEntries.length === 1
            ? 'दैनिक दौरा दैनंदिनी अहवाल'
            : 'मासिक दौरा दैनंदिनी'}
        </h1>
        <p className="diary-print-subtitle">
          {diary.designation} {diary.employeeName}
        </p>
        <p className="diary-print-meta">{diary.officeName}</p>
        <p className="diary-print-month">
          महिना: {diary.monthLabelMarathi}
          {dateFilterLabel ? ` · (${dateFilterLabel})` : ''}
        </p>
      </div>

      <table className="diary-print-table">
        <thead>
          <tr>
            <th className="col-serial">अ.क्र.</th>
            <th className="col-date">दिनांक</th>
            <th className="col-from">कोठून</th>
            <th className="col-to">कोठे</th>
            <th className="col-travel">प्रवास प्रकार</th>
            <th className="col-km">किमी</th>
            <th className="col-work">कामाचे स्वरूप</th>
          </tr>
        </thead>
        <tbody>
          {resolvedRows.map(({ row, display, travel }) => (
            <tr key={row.date} className={getPrintRowClass(row)}>
              <td className="col-serial">{row.serialNo}</td>
              <td className="col-date">
                {formatDateDDMMYYYY(row.date)} ({row.dayNameMarathi})
              </td>
              <td className="col-from">{row.fromPlace}</td>
              <td className="col-to">{display.toPlace}</td>
              <td className="col-travel">{travel.travelMode}</td>
              <td className="col-km">{travel.distanceKm > 0 ? travel.distanceKm : '—'}</td>
              <td className="col-work">
                {display.workDescription}
                {display.notes ? ` (${display.notes})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="diary-print-summary">
        <span>
          एकूण दिवस: <strong>{isFilteredSubset ? activeEntries.length : diary.summary.totalDays}</strong>
        </span>
        <span>
          कामकाजाचे दिवस: <strong>{isFilteredSubset ? workingDaysCount : diary.summary.workingDays}</strong>
        </span>
        <span>
          गाव सत्रे: <strong>{isFilteredSubset ? villageToursCount : diary.summary.villageTours}</strong>
        </span>
        <span>
          बैठका: <strong>{isFilteredSubset ? meetingsCount : diary.summary.meetings}</strong>
        </span>
        <span>
          सुट्ट्या: <strong>{isFilteredSubset ? holidaysAndSundaysCount : diary.summary.sundays + diary.summary.holidays}</strong>
        </span>
        <span>
          रजा: <strong>{isFilteredSubset ? leavesCount : diary.summary.leaves}</strong>
        </span>
        <span>
          एकूण प्रवास अंतर: <strong>{totalDistanceKm} किमी</strong>
        </span>
      </div>

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
