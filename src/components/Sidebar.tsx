import React from 'react';
import {
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  MapPin,
  Settings,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { EmployeeMaster, NavSection } from '../shared/types.ts';

interface SidebarProps {
  activeSection: NavSection;
  onSelect: (section: NavSection) => void;
  employee: EmployeeMaster | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; group: 'main' | 'masters' | 'ops'; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'डॅशबोर्ड', group: 'main', icon: LayoutDashboard },
  { id: 'monthly-diary', label: 'मासिक दौरा दैनंदिनी', group: 'main', icon: ClipboardList },
  { id: 'weekly-schedule', label: 'वारनिहाय कार्यक्रम', group: 'masters', icon: CalendarClock },
  { id: 'villages', label: 'गावांची माहिती', group: 'masters', icon: MapPin },
  { id: 'subcenters', label: 'उपकेंद्र माहिती', group: 'masters', icon: Building2 },
  { id: 'employee', label: 'कर्मचारी माहिती', group: 'masters', icon: UserCheck },
  { id: 'holidays', label: 'शासकीय सुट्ट्या', group: 'ops', icon: CalendarRange },
  { id: 'leaves', label: 'रजा व्यवस्थापन', group: 'ops', icon: CalendarOff },
  { id: 'special-events', label: 'विशेष कार्यक्रम', group: 'ops', icon: Sparkles },
  { id: 'reports', label: 'अहवाल व इतिहास', group: 'ops', icon: FileBarChart2 },
  { id: 'settings', label: 'सेटिंग्ज', group: 'ops', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelect,
  employee,
  mobileOpen,
  onCloseMobile,
}) => {
  const renderGroup = (groupKey: 'main' | 'masters' | 'ops', title?: string) => {
    const items = NAV_ITEMS.filter((i) => i.group === groupKey);
    return (
      <div className="mb-4">
        {title && (
          <p className="mb-1.5 px-3 text-xs font-semibold text-slate-400">
            {title}
          </p>
        )}
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold leading-tight text-slate-900">
              दौरा दैनंदिनी प्रणाली
            </p>
            <p className="truncate text-xs text-slate-500">
              {employee?.officeName || 'प्राथमिक आरोग्य केंद्र भादा'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="मेनू बंद करा"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {renderGroup('main')}
        {renderGroup('masters', 'मास्टर नोंदणी')}
        {renderGroup('ops', 'सुट्ट्या, रजा व अहवाल')}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3.5 bg-slate-50/70">
        <p className="truncate text-xs font-semibold text-slate-800">
          {employee?.fullName || 'श्री. हिप्परगेकर जी. एस.'}
        </p>
        <p className="truncate text-xs text-slate-500">
          {employee?.designation || 'आरोग्य सहाय्यक'} · मुख्यालय: {employee?.headquarters || 'भादा'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 w-72 max-w-[85vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
