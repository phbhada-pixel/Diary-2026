import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  Plus,
  Sparkles,
} from 'lucide-react';
import type {
  EmployeeMaster,
  GovernmentHolidayMaster,
  LeaveRecord,
  MonthlyDiaryDocument,
  NavSection,
  SpecialEventMaster,
  SubcenterMaster,
  VillageMaster,
  WeeklyScheduleMaster,
} from '../shared/types.ts';
import {
  ENTRY_TYPE_LABELS,
  formatDateDDMMYYYY,
  getFinancialYearLabel,
  getFinancialYearMonths,
  makeMonthId,
  resolveHolidayEntryDisplay,
} from '../shared/marathi.ts';
import { isMeetingRuleRecord } from '../shared/meetingRules.ts';
import { extractHeadquarterCities, resolveDiaryEntryTravel } from '../shared/travelMeta.ts';

interface DashboardViewProps {
  employee: EmployeeMaster;
  villages: VillageMaster[];
  subcenters: SubcenterMaster[];
  weeklySchedules: WeeklyScheduleMaster[];
  holidays: GovernmentHolidayMaster[];
  leaves: LeaveRecord[];
  specialEvents: SpecialEventMaster[];
  diaries: MonthlyDiaryDocument[];
  selectedYear: number;
  selectedMonth: number;
  onSelectMonth: (year: number, month: number) => void;
  onGenerateMonth: (year: number, month: number) => void;
  onNavigate: (section: NavSection) => void;
  isGenerating: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employee,
  villages,
  subcenters,
  weeklySchedules,
  holidays,
  leaves,
  specialEvents,
  diaries,
  selectedYear,
  selectedMonth,
  onSelectMonth,
  onGenerateMonth,
  onNavigate,
  isGenerating,
}) => {
  const currentMonthId = makeMonthId(selectedYear, selectedMonth);
  const currentDiary = diaries.find((d) => d.id === currentMonthId) || null;
  const fyStartYear = selectedMonth >= 4 ? selectedYear : selectedYear - 1;
  const fyMonths = getFinancialYearMonths(fyStartYear);

  const summary = currentDiary?.summary;
  const visibleSpecialEventsCount = specialEvents.filter((ev) => !isMeetingRuleRecord(ev)).length;
  const { regularVillages } = extractHeadquarterCities(villages);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-teal-700">
            {employee.officeName} · अंमलबजावणी: {formatDateDDMMYYYY(employee.implementationDate)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {employee.designation} {employee.fullName} · {getFinancialYearLabel(fyStartYear)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="महिना निवडा"
            value={currentMonthId}
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

          <button
            type="button"
            onClick={() => onNavigate('monthly-diary')}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <ClipboardList className="h-4 w-4" />
            दैनंदिनी उघडा
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">एकूण कामकाजाचे दिवस</p>
          <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900">
            {summary ? summary.workingDays : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary ? `एकूण ${summary.totalDays} दिवसांपैकी` : 'दैनंदिनी तयार नाही'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">रविवार व शासकीय सुट्ट्या</p>
          <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900">
            {summary ? summary.sundays + summary.holidays : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary ? `रविवार: ${summary.sundays} · सुट्ट्या: ${summary.holidays}` : `वर्षातील सुट्ट्या: ${holidays.filter((h) => h.year === selectedYear).length}`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">कर्मचारी रजा</p>
          <p className="mt-2 font-mono-num text-2xl font-semibold text-red-700">
            {summary ? summary.leaves : leaves.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary ? 'या महिन्यातील रजा दिवस' : 'एकूण नोंदवलेल्या रजा'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">विशेष कार्यक्रम</p>
          <p className="mt-2 font-mono-num text-2xl font-semibold text-teal-700">
            {summary ? summary.specialEvents : visibleSpecialEventsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary ? 'या महिन्यातील विशेष कार्यक्रम' : 'एकूण विशेष कार्यक्रम'}
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          <p className="text-xs font-medium text-slate-500">वारनिहाय मास्टर सत्रे</p>
          <p className="mt-2 font-mono-num text-2xl font-semibold text-slate-900">
            {weeklySchedules.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            गावे: {regularVillages.length} · उपकेंद्रे: {subcenters.length}
          </p>
        </div>
      </div>

      {/* Master Setup Quick Guidance if weekly schedule is empty */}
      {weeklySchedules.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  वारनिहाय आरोग्य सेवा सत्र कार्यक्रम अद्याप भरलेला नाही
                </p>
                <p className="mt-0.5 text-sm text-amber-800">
                  प्रथम गावांची माहिती आणि वारनिहाय कार्यक्रम (पहिला ते पाचवा सोमवार, मंगळवार, गुरुवार, शुक्रवार, शनिवार) एकदा भरा. त्यानंतर दर महिन्याची दैनंदिनी आपोआप तयार होईल.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('weekly-schedule')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-amber-800 whitespace-nowrap"
            >
              वारनिहाय कार्यक्रम भरा
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Split: Current Month Diary Preview + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 cols: Current Month Diary Preview */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                चालू महिन्याची दौरा दैनंदिनी — {fyMonths.find((m) => m.id === currentMonthId)?.label || currentMonthId}
              </h2>
              <p className="text-xs text-slate-500">
                {currentDiary
                  ? `गाव सत्रे: ${currentDiary.summary.villageTours} · बैठका: ${currentDiary.summary.meetings} · कार्यालयीन: ${currentDiary.summary.officeDays}`
                  : 'या महिन्याची दैनंदिनी एका क्लिकवर स्वयंचलित तयार करता येईल.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!currentDiary ? (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => onGenerateMonth(selectedYear, selectedMonth)}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  {isGenerating ? 'तयार होत आहे...' : 'दैनंदिनी तयार करा'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('monthly-diary')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  पूर्ण दैनंदिनी पहा व संपादित करा
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {currentDiary ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-2.5 w-12">अ.क्र.</th>
                    <th className="px-4 py-2.5 w-36">दिनांक</th>
                    <th className="px-4 py-2.5 w-20">कोठून</th>
                    <th className="px-4 py-2.5">कोठे</th>
                    <th className="px-3 py-2.5 w-20 text-center">प्रवास</th>
                    <th className="px-3 py-2.5 w-20 text-center">किमी</th>
                    <th className="px-4 py-2.5">कामाचे स्वरूप</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentDiary.entries.slice(0, 12).map((row) => {
                    const display = resolveHolidayEntryDisplay(row, holidays);
                    const travel = resolveDiaryEntryTravel(row, display.toPlace, villages);
                    const rowBg =
                      row.entryType === 'sunday'
                        ? 'bg-slate-50/90 text-slate-500'
                        : row.entryType === 'holiday'
                        ? 'bg-orange-50/50 text-slate-700'
                        : row.entryType === 'leave'
                        ? 'bg-red-50/50 text-red-900'
                        : row.entryType === 'district_meeting'
                        ? 'bg-indigo-50/40'
                        : row.entryType === 'lab_sample_visit'
                        ? 'bg-sky-50/50'
                        : '';
                    return (
                      <tr key={row.date} className={`hover:bg-slate-50/80 ${rowBg}`}>
                        <td className="px-4 py-2.5 font-mono-num text-xs text-slate-500">
                          {row.serialNo}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-mono-num text-xs font-medium text-slate-800">
                            {formatDateDDMMYYYY(row.date)}
                          </span>
                          <span className="ml-1.5 text-xs text-slate-500">({row.dayNameMarathi})</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.fromPlace}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{display.toPlace}</td>
                        <td className="px-3 py-2.5 text-center text-slate-700 whitespace-nowrap">
                          {travel.travelMode}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono-num text-slate-800 whitespace-nowrap">
                          {travel.distanceKm > 0 ? `${travel.distanceKm} किमी` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {display.workDescription}
                          <span className="ml-2 text-xs text-slate-400">
                            · {ENTRY_TYPE_LABELS[row.entryType]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {currentDiary.entries.length > 12 && (
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onNavigate('monthly-diary')}
                    className="text-sm font-medium text-teal-700 hover:text-teal-900"
                  >
                    उर्वरित {currentDiary.entries.length - 12} दिवसांच्या नोंदी पाहण्यासाठी पूर्ण दैनंदिनी उघडा →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <CalendarCheck className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                या महिन्याची दैनंदिनी अद्याप तयार केलेली नाही
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                वारनिहाय कार्यक्रम, शासकीय सुट्ट्या, रजा, विशेष कार्यक्रम व अनिवार्य बैठकीचे नियम वापरून एका क्लिकवर संपूर्ण महिन्याची दैनंदिनी तयार होईल.
              </p>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => onGenerateMonth(selectedYear, selectedMonth)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isGenerating ? 'तयार होत आहे...' : 'आत्ताच स्वयंचलित दैनंदिनी तयार करा'}
              </button>
            </div>
          )}
        </div>

        {/* Right 1 col: Quick Actions & Financial Year Month Status */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">त्वरित नोंदणी पर्याय</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <button
                type="button"
                onClick={() => onNavigate('weekly-schedule')}
                className="flex w-full items-center justify-between py-3 text-left text-sm text-slate-700 hover:text-teal-700"
              >
                <span className="flex items-center gap-2.5">
                  <CalendarClock className="h-4 w-4 text-slate-400" />
                  वारनिहाय कार्यक्रम जोडा / बदला
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('holidays')}
                className="flex w-full items-center justify-between py-3 text-left text-sm text-slate-700 hover:text-teal-700"
              >
                <span className="flex items-center gap-2.5">
                  <CalendarRange className="h-4 w-4 text-slate-400" />
                  शासकीय सुट्ट्या यादी ({selectedYear})
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('leaves')}
                className="flex w-full items-center justify-between py-3 text-left text-sm text-slate-700 hover:text-teal-700"
              >
                <span className="flex items-center gap-2.5">
                  <CalendarOff className="h-4 w-4 text-slate-400" />
                  कर्मचारी रजा नोंदवा
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('special-events')}
                className="flex w-full items-center justify-between py-3 text-left text-sm text-slate-700 hover:text-teal-700"
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-slate-400" />
                  विशेष कार्यक्रम नोंदवा
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Financial Year Month Tracker */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">
              आर्थिक वर्ष {fyStartYear}-{String(fyStartYear + 1).slice(-2)} मधील महिने
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              एप्रिल {fyStartYear} ते मार्च {fyStartYear + 1} · कोणत्याही महिन्यावर क्लिक करा
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {fyMonths.map((fm) => {
                const exists = diaries.some((d) => d.id === fm.id);
                const isSelected = fm.id === currentMonthId;
                return (
                  <button
                    key={fm.id}
                    type="button"
                    onClick={() => onSelectMonth(fm.year, fm.month)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50 font-semibold text-teal-900'
                        : exists
                        ? 'border-slate-200 bg-white text-slate-800 hover:border-teal-300'
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div className="truncate">{fm.label.split(' ')[0]}</div>
                    <div className="mt-0.5 font-mono-num text-[11px] text-slate-400">
                      {exists ? 'सेव्ह आहे' : fm.year}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
