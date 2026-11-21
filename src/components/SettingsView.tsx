import React, { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import type { ApplicationSettings, HolidayAdjustmentDirection } from '../shared/types.ts';
import { formatDateTimeMarathi } from '../shared/marathi.ts';

interface SettingsViewProps {
  settings: ApplicationSettings;
  onSave: (payload: Partial<ApplicationSettings>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [form, setForm] = useState({
    holidayAdjustmentDirection: settings.holidayAdjustmentDirection,
    defaultFromPlace: settings.defaultFromPlace,
    implementationDate: settings.implementationDate,
    hqPlace: settings.hqPlace,
    officePlace: settings.officePlace,
    talukaMeetingPlace: settings.talukaMeetingPlace,
    subcenterMeeting1Place: settings.subcenterMeeting1Place,
    subcenterMeeting2Place: settings.subcenterMeeting2Place,
  });
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setForm({
      holidayAdjustmentDirection: settings.holidayAdjustmentDirection,
      defaultFromPlace: settings.defaultFromPlace,
      implementationDate: settings.implementationDate,
      hqPlace: settings.hqPlace,
      officePlace: settings.officePlace,
      talukaMeetingPlace: settings.talukaMeetingPlace,
      subcenterMeeting1Place: settings.subcenterMeeting1Place,
      subcenterMeeting2Place: settings.subcenterMeeting2Place,
    });
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSave(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">प्रणाली सेटिंग्ज</h1>
        <p className="mt-1 text-sm text-slate-600">
          मासिक दौरा दैनंदिनी स्वयंचलित तयार करताना वापरले जाणारे सुट्टी समायोजन नियम आणि अनिवार्य बैठकांची ठिकाणे येथे निश्चित करा.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        {/* Holiday Adjustment Direction */}
        <div>
          <h2 className="text-base font-bold text-slate-900">शासकीय सुट्टी समायोजन दिशा</h2>
          <p className="mt-1 text-xs text-slate-500">
            वारनिहाय कार्यक्रमाच्या दिवशी शासकीय सुट्टी आल्यास त्या दिवसाचे सत्र कोणत्या उपलब्ध कामकाजाच्या दिवशी समायोजित करावे ते निवडा.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  value: 'next' as HolidayAdjustmentDirection,
                  title: 'पुढील उपलब्ध दिवस',
                  desc: 'सुट्टीनंतरच्या पहिल्या रिकाम्या कामकाजाच्या दिवशी सत्र समायोजित करा.',
                },
                {
                  value: 'previous' as HolidayAdjustmentDirection,
                  title: 'मागील उपलब्ध दिवस',
                  desc: 'सुट्टीपूर्वीच्या मागील रिकाम्या कामकाजाच्या दिवशी सत्र समायोजित करा.',
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  form.holidayAdjustmentDirection === opt.value
                    ? 'border-teal-700 bg-teal-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="holidayDirection"
                    value={opt.value}
                    checked={form.holidayAdjustmentDirection === opt.value}
                    onChange={() =>
                      setForm({ ...form, holidayAdjustmentDirection: opt.value })
                    }
                    className="h-4 w-4 accent-teal-700"
                  />
                  <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-slate-600">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Fixed Rule Locations */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">अनिवार्य नियम व कार्यालयांची नावे</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                कोठून (कायमस्वरूपी ठिकाण)
              </label>
              <input
                type="text"
                required
                value={form.defaultFromPlace}
                onChange={(e) => setForm({ ...form, defaultFromPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                अंमलबजावणी दिनांक
              </label>
              <input
                type="date"
                value={form.implementationDate}
                onChange={(e) => setForm({ ...form, implementationDate: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम १ — बुधवार मुख्यालय नाव
              </label>
              <input
                type="text"
                required
                value={form.hqPlace}
                onChange={(e) => setForm({ ...form, hqPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम २ — तालुकास्तरीय आढावा बैठक ठिकाण
              </label>
              <input
                type="text"
                required
                value={form.talukaMeetingPlace}
                onChange={(e) => setForm({ ...form, talukaMeetingPlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम ३ — उपकेंद्रस्तरीय बैठक (पहिला दिवस)
              </label>
              <input
                type="text"
                required
                value={form.subcenterMeeting1Place}
                onChange={(e) => setForm({ ...form, subcenterMeeting1Place: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                नियम ३ — उपकेंद्रस्तरीय बैठक (दुसरा दिवस)
              </label>
              <input
                type="text"
                required
                value={form.subcenterMeeting2Place}
                onChange={(e) => setForm({ ...form, subcenterMeeting2Place: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                नियम ४ — उर्वरित दिवस कार्यालयीन कामकाज ठिकाण
              </label>
              <input
                type="text"
                required
                value={form.officePlace}
                onChange={(e) => setForm({ ...form, officePlace: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            शेवटचे अद्यतन: {formatDateTimeMarathi(settings.updatedAt)}
          </p>
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700">
                <Check className="h-4 w-4" />
                सेटिंग्ज जतन केल्या
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'जतन होत आहे...' : 'सेटिंग्ज जतन करा'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
