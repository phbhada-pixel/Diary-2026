import React, { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import type { EmployeeMaster } from '../shared/types.ts';
import { formatDateDDMMYYYY, formatDateTimeMarathi } from '../shared/marathi.ts';

interface EmployeeViewProps {
  employee: EmployeeMaster;
  onSave: (payload: Partial<EmployeeMaster>) => Promise<void>;
}

export const EmployeeView: React.FC<EmployeeViewProps> = ({ employee, onSave }) => {
  const [form, setForm] = useState({
    fullName: employee.fullName,
    designation: employee.designation,
    officeName: employee.officeName,
    headquarters: employee.headquarters,
    email: employee.email,
    mobile: employee.mobile || '',
    implementationDate: employee.implementationDate,
  });
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setForm({
      fullName: employee.fullName,
      designation: employee.designation,
      officeName: employee.officeName,
      headquarters: employee.headquarters,
      email: employee.email,
      mobile: employee.mobile || '',
      implementationDate: employee.implementationDate,
    });
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSave(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">कर्मचारी माहिती</h1>
        <p className="mt-1 text-sm text-slate-600">
          मासिक दौरा दैनंदिनी, Excel व PDF शीर्षकामध्ये वापरली जाणारी अधिकृत कर्मचारी व कार्यालयीन माहिती.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              कर्मचाऱ्याचे पूर्ण नाव <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              पदनाम <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              कार्यालयाचे नाव <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.officeName}
              onChange={(e) => setForm({ ...form, officeName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              मुख्यालय (कोठून) <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.headquarters}
              onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">प्रशासकीय ई-मेल</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">मोबाईल क्रमांक (ऐच्छिक)</label>
            <input
              type="text"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="उदा. 98XXXXXXXX"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">अंमलबजावणी दिनांक</label>
            <input
              type="date"
              value={form.implementationDate}
              onChange={(e) => setForm({ ...form, implementationDate: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              निवडलेला दिनांक: {formatDateDDMMYYYY(form.implementationDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            शेवटचे अद्यतन: {formatDateTimeMarathi(employee.updatedAt)}
          </p>
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-700">
                <Check className="h-4 w-4" />
                माहिती जतन केली
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'जतन होत आहे...' : 'माहिती जतन करा'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
