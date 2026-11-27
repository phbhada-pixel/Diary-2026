import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Menu, RefreshCw, X } from 'lucide-react';
import { api, ApiError, type BootstrapData } from './services/api.ts';
import type { NavSection } from './shared/types.ts';
import { makeMonthLabelMarathi } from './shared/marathi.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { EmployeeView } from './components/EmployeeView.tsx';
import { SubcenterView } from './components/SubcenterView.tsx';
import { VillageView } from './components/VillageView.tsx';
import { WeeklyScheduleView } from './components/WeeklyScheduleView.tsx';
import { HolidayView } from './components/HolidayView.tsx';
import { LeaveView } from './components/LeaveView.tsx';
import { SpecialEventView } from './components/SpecialEventView.tsx';
import { MonthlyDiaryView } from './components/MonthlyDiaryView.tsx';
import { DailyWorkLogView } from './components/DailyWorkLogView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'डॅशबोर्ड',
  employee: 'कर्मचारी माहिती',
  villages: 'गावांची माहिती',
  subcenters: 'उपकेंद्र माहिती',
  'weekly-schedule': 'वारनिहाय कार्यक्रम',
  holidays: 'शासकीय सुट्ट्या',
  leaves: 'रजा व्यवस्थापन',
  'special-events': 'विशेष कार्यक्रम',
  'monthly-diary': 'मासिक दौरा दैनंदिनी',
  'daily-work-log': 'सविस्तर कामाचा वृत्तांत',
  reports: 'अहवाल व इतिहास',
  settings: 'सेटिंग्ज',
};

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Start at April 2026 (अंमलबजावणी दिनांक: 01 एप्रिल 2026)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const showToast = useCallback((type: 'error' | 'success', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoadError(null);
      setMissingEnvVars([]);

      // Step 1: Check backend Apps Script configuration status (HTTP 200 JSON)
      const status = await api.getConnectionStatus();
      if (!status.configured) {
        setMissingEnvVars(
          Array.isArray(status.missingVars) && status.missingVars.length > 0
            ? status.missingVars
            : ['GOOGLE_APPS_SCRIPT_URL', 'GOOGLE_APPS_SCRIPT_SECRET']
        );
        return;
      }

      // Step 2: Load live data from Google Sheets via Google Apps Script backend
      const bundle = await api.bootstrap();
      if (!bundle || typeof bundle !== 'object') {
        throw new Error('सर्व्हरकडून वैध डेटा प्राप्त झाला नाही. कृपया पुन्हा प्रयत्न करा.');
      }
      if (!bundle.employee || typeof bundle.employee !== 'object') {
        throw new Error('कर्मचारी माहिती (Employee_Master) लोड झाली नाही. कृपया डेटाबेस तपासा.');
      }
      if (
        !bundle.employee.officeName?.trim() ||
        !bundle.employee.fullName?.trim() ||
        !bundle.employee.designation?.trim()
      ) {
        throw new Error(
          'कर्मचारी माहितीमधील आवश्यक तपशील (कार्यालयाचे नाव / कर्मचाऱ्याचे नाव / पदनाम) अपूर्ण आहेत.'
        );
      }
      if (
        !bundle.settings ||
        typeof bundle.settings !== 'object' ||
        !bundle.settings.defaultFromPlace?.trim()
      ) {
        throw new Error('प्रणाली सेटिंग्ज (Application_Settings) अपूर्ण आहेत. कृपया डेटाबेस तपासा.');
      }
      setData({
        ...bundle,
        subcenters: Array.isArray(bundle.subcenters) ? bundle.subcenters : [],
        villages: Array.isArray(bundle.villages) ? bundle.villages : [],
        weeklySchedules: Array.isArray(bundle.weeklySchedules) ? bundle.weeklySchedules : [],
        holidays: Array.isArray(bundle.holidays) ? bundle.holidays : [],
        leaves: Array.isArray(bundle.leaves) ? bundle.leaves : [],
        specialEvents: Array.isArray(bundle.specialEvents) ? bundle.specialEvents : [],
        monthlyDiaries: Array.isArray(bundle.monthlyDiaries) ? bundle.monthlyDiaries : [],
        changeHistory: Array.isArray(bundle.changeHistory) ? bundle.changeHistory : [],
      });
      lastSyncTimestampRef.current = Date.now();
    } catch (err) {
      if (err instanceof ApiError && err.data?.notConfigured === true) {
        const mv = Array.isArray(err.data?.missingVars)
          ? (err.data.missingVars as string[])
          : ['GOOGLE_APPS_SCRIPT_URL', 'GOOGLE_APPS_SCRIPT_SECRET'];
        setMissingEnvVars(mv);
      } else {
        const msg = err instanceof Error ? err.message : 'डेटा लोड करताना त्रुटी आली.';
        setLoadError(msg);
        showToast('error', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await loadAll();
      showToast('success', 'Google Sheets मधील ताजा डेटा यशस्वीरित्या सिंक केला.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadAll, showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Automatically sync live data when returning to this browser tab from another link/device
  useEffect(() => {
    const syncOnFocus = () => {
      if (document.visibilityState === 'hidden') return;
      const elapsed = Date.now() - lastSyncTimestampRef.current;
      if (elapsed > 15000 && !loading && !isSyncing) {
        void loadAll();
      }
    };
    window.addEventListener('focus', syncOnFocus);
    document.addEventListener('visibilitychange', syncOnFocus);
    return () => {
      window.removeEventListener('focus', syncOnFocus);
      document.removeEventListener('visibilitychange', syncOnFocus);
    };
  }, [loadAll, loading, isSyncing]);

  const runMutation = useCallback(
    async <T,>(fn: () => Promise<T>, successMsg?: string): Promise<T> => {
      try {
        const result = await fn();
        await loadAll();
        if (successMsg) showToast('success', successMsg);
        return result;
      } catch (err) {
        const msg = err instanceof ApiError || err instanceof Error ? err.message : 'कृती करताना त्रुटी आली.';
        showToast('error', msg);
        throw err;
      }
    },
    [loadAll, showToast]
  );

  const handleGenerateDiary = useCallback(
    async (
      year: number,
      month: number,
      opts: { preserveManualEdits?: boolean; confirmedOverwrite?: boolean } = {}
    ) => {
      setIsGenerating(true);
      try {
        await runMutation(
          () =>
            api.generateDiary({
              year,
              month,
              preserveManualEdits: opts.preserveManualEdits ?? true,
              confirmedOverwrite: opts.confirmedOverwrite ?? false,
            }),
          `${makeMonthLabelMarathi(year, month)} ची मासिक दौरा दैनंदिनी यशस्वीरित्या जतन केली.`
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [runMutation]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" />
          <p className="mt-4 text-sm font-semibold text-slate-800">
            मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली लोड होत आहे...
          </p>
          <p className="mt-1 text-xs text-slate-500">प्राथमिक आरोग्य केंद्र भादा</p>
        </div>
      </div>
    );
  }

  if (missingEnvVars.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Google Apps Script जोडणी सेटअप प्रलंबित आहे
              </h2>
              <p className="text-xs text-slate-500">
                प्राथमिक आरोग्य केंद्र भादा · वैयक्तिक Google Drive (phbhada@gmail.com)
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            Google Apps Script Web App URL किंवा Secret Token अद्याप सेट केलेले नाही. कृपया <strong>AI Studio Secrets</strong> (किंवा GitHub Pages साठी <strong>Repository Settings → Secrets and variables → Actions</strong>) मध्ये खालील मूल्ये जोडा:
          </p>

          <ul className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-800">
            {missingEnvVars.map((v) => (
              <li key={v} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                <span>{v}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadAll();
              }}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              पुन्हा तपासा
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.employee || !data.settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-3 text-base font-bold text-slate-900">डेटाबेसशी संपर्क होऊ शकला नाही</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {loadError || 'Google Apps Script Server प्रतिसाद देत नाही. कृपया Deployed Web App URL तपासून पुन्हा प्रयत्न करा.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadAll();
            }}
            className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            पुन्हा प्रयत्न करा
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:min-h-0 print:bg-white">
      <Sidebar
        activeSection={activeSection}
        onSelect={setActiveSection}
        employee={data.employee}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="lg:pl-64 flex min-h-screen flex-col print:pl-0 print:min-h-0 print:block">
        {/* Top Bar (3-zone clean header, hidden during A4 print) */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="नेव्हिगेशन उघडा"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-semibold text-slate-800">
              {SECTION_TITLES[activeSection]}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            <span>{data.employee.officeName}</span>
            <span aria-hidden="true">·</span>
            <span>{data.employee.fullName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void handleManualSync()}
              title="Google Sheets मधून ताजा डेटा सिंक करा"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-teal-700 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'सिंक होत आहे...' : 'डेटा सिंक करा'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('monthly-diary')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
            >
              {makeMonthLabelMarathi(selectedYear, selectedMonth)}
            </button>
          </div>
        </header>

        {/* Global Toast Feedback */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md no-print">
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg ${
                toast.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-teal-200 bg-teal-50 text-teal-900'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
          {activeSection === 'dashboard' && (
            <DashboardView
              employee={data.employee}
              villages={data.villages}
              subcenters={data.subcenters}
              weeklySchedules={data.weeklySchedules}
              holidays={data.holidays}
              leaves={data.leaves}
              specialEvents={data.specialEvents}
              diaries={data.monthlyDiaries}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onSelectMonth={(y, m) => {
                setSelectedYear(y);
                setSelectedMonth(m);
              }}
              onGenerateMonth={(y, m) => {
                void handleGenerateDiary(y, m, { confirmedOverwrite: false, preserveManualEdits: true });
              }}
              onNavigate={setActiveSection}
              isGenerating={isGenerating}
            />
          )}

          {activeSection === 'employee' && (
            <EmployeeView
              employee={data.employee}
              onSave={async (payload) => {
                await runMutation(() => api.updateEmployee(payload), 'कर्मचारी माहिती अद्ययावत केली.');
              }}
            />
          )}

          {activeSection === 'subcenters' && (
            <SubcenterView
              subcenters={data.subcenters}
              onCreate={async (payload) => {
                await runMutation(() => api.createSubcenter(payload), 'नवीन उपकेंद्र जतन केले.');
              }}
              onUpdate={async (id, payload) => {
                await runMutation(() => api.updateSubcenter(id, payload), 'उपकेंद्र माहिती अद्ययावत केली.');
              }}
              onDelete={async (id) => {
                await runMutation(() => api.deleteSubcenter(id), 'उपकेंद्र हटवले.');
              }}
            />
          )}

          {activeSection === 'villages' && (
            <VillageView
              villages={data.villages}
              subcenters={data.subcenters}
              onCreate={async (payload) => {
                await runMutation(() => api.createVillage(payload), 'नवीन गाव जतन केले.');
              }}
              onUpdate={async (id, payload) => {
                await runMutation(() => api.updateVillage(id, payload), 'गावाची माहिती अद्ययावत केली.');
              }}
              onDelete={async (id) => {
                await runMutation(() => api.deleteVillage(id), 'गाव हटवले.');
              }}
            />
          )}

          {activeSection === 'weekly-schedule' && (
            <WeeklyScheduleView
              schedules={data.weeklySchedules}
              villages={data.villages}
              subcenters={data.subcenters}
              history={data.changeHistory}
              onCreate={async (payload) => {
                await runMutation(() => api.createWeeklySchedule(payload), 'वारनिहाय कार्यक्रम जतन केला.');
              }}
              onUpdate={async (id, payload) => {
                await runMutation(
                  () => api.updateWeeklySchedule(id, payload),
                  'वारनिहाय कार्यक्रम अद्ययावत केला व इतिहास नोंदवला.'
                );
              }}
              onDelete={async (id) => {
                await runMutation(() => api.deleteWeeklySchedule(id), 'वारनिहाय कार्यक्रम हटवला.');
              }}
            />
          )}

          {activeSection === 'holidays' && (
            <HolidayView
              holidays={data.holidays}
              settings={data.settings}
              onCreate={async (payload) => {
                await runMutation(() => api.createHoliday(payload), 'शासकीय सुट्टी जतन केली.');
              }}
              onUpdate={async (id, payload) => {
                await runMutation(() => api.updateHoliday(id, payload), 'शासकीय सुट्टी अद्ययावत केली.');
              }}
              onDelete={async (id) => {
                await runMutation(() => api.deleteHoliday(id), 'शासकीय सुट्टी हटवली.');
              }}
            />
          )}

          {activeSection === 'leaves' && (
            <LeaveView
              leaves={data.leaves}
              onCreate={async (payload) => {
                const res = await runMutation(() => api.createLeave(payload), 'रजा जतन केली.');
                return res.updatedMonths;
              }}
              onUpdate={async (id, payload) => {
                const res = await runMutation(() => api.updateLeave(id, payload), 'रजा अद्ययावत केली.');
                return res.updatedMonths;
              }}
              onDelete={async (id) => {
                const res = await runMutation(() => api.deleteLeave(id), 'रजा हटवली.');
                return res.updatedMonths;
              }}
            />
          )}

          {activeSection === 'special-events' && (
            <SpecialEventView
              events={data.specialEvents}
              villages={data.villages}
              onCreate={async (payload) => {
                await runMutation(() => api.createSpecialEvent(payload), 'विशेष कार्यक्रम जतन केला.');
              }}
              onUpdate={async (id, payload) => {
                await runMutation(() => api.updateSpecialEvent(id, payload), 'विशेष कार्यक्रम अद्ययावत केला.');
              }}
              onDelete={async (id) => {
                await runMutation(() => api.deleteSpecialEvent(id), 'विशेष कार्यक्रम हटवला.');
              }}
              onCreateVillage={async (vPayload) => {
                await api.createVillage(vPayload);
              }}
            />
          )}

          {activeSection === 'monthly-diary' && (
            <MonthlyDiaryView
              employee={data.employee}
              holidays={data.holidays}
              villages={data.villages}
              diaries={data.monthlyDiaries}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onSelectMonth={(y, m) => {
                setSelectedYear(y);
                setSelectedMonth(m);
              }}
              onGenerate={handleGenerateDiary}
              onUpdateEntry={async (diaryId, date, payload) => {
                await runMutation(
                  () =>
                    api.updateDiaryEntry(diaryId, date, {
                      ...payload,
                      isManualEdit: true,
                    }),
                  'दैनंदिनीतील मॅन्युअल बदल सुरक्षितपणे जतन केला.'
                );
              }}
              isGenerating={isGenerating}
            />
          )}

          {activeSection === 'daily-work-log' && (
            <DailyWorkLogView
              employee={data.employee}
              villages={data.villages}
              subcenters={data.subcenters}
              specialEvents={data.specialEvents}
              onCreateRecord={async (payload) => {
                await runMutation(
                  () => api.createSpecialEvent(payload),
                  'सविस्तर कामाची नवीन नोंद जतन केली.'
                );
              }}
              onUpdateRecord={async (id, payload) => {
                await runMutation(
                  () => api.updateSpecialEvent(id, payload),
                  'सविस्तर कामाची नोंद अद्ययावत केली.'
                );
              }}
              onDeleteRecord={async (id) => {
                await runMutation(
                  () => api.deleteSpecialEvent(id),
                  'सविस्तर कामाची नोंद हटवली.'
                );
              }}
            />
          )}

          {activeSection === 'reports' && (
            <ReportsView
              employee={data.employee}
              diaries={data.monthlyDiaries}
              history={data.changeHistory}
              onRefreshAll={loadAll}
              onOpenMonth={(y, m) => {
                setSelectedYear(y);
                setSelectedMonth(m);
                setActiveSection('monthly-diary');
              }}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={data.settings}
              specialEvents={data.specialEvents}
              onSave={async (payload) => {
                await runMutation(() => api.updateSettings(payload), 'प्रणाली सेटिंग्ज जतन केल्या.');
              }}
              onAddMeeting={async (payload) => {
                await runMutation(
                  () => api.createSpecialEvent(payload),
                  `${payload.eventType} यशस्वीरित्या जतन केली.`
                );
              }}
              onUpdateMeeting={async (id, payload) => {
                await runMutation(
                  () => api.updateSpecialEvent(id, payload),
                  `${payload.eventType} अद्ययावत केली.`
                );
              }}
              onDeleteMeeting={async (id) => {
                await runMutation(() => api.deleteSpecialEvent(id), 'बैठक हटवली.');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
