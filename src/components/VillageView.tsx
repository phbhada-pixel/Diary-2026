import React, { useState } from 'react';
import { MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { SubcenterMaster, VillageMaster } from '../shared/types.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface VillageViewProps {
  villages: VillageMaster[];
  subcenters: SubcenterMaster[];
  onCreate: (
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Pick<VillageMaster, 'name' | 'subcenterId' | 'subcenterName' | 'population' | 'notes'>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const VillageView: React.FC<VillageViewProps> = ({
  villages,
  subcenters,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    subcenterId: '',
    subcenterName: '',
    population: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VillageMaster | null>(null);

  const filtered = villages.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.subcenterName.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', subcenterId: '', subcenterName: '', population: '', notes: '' });
  };

  const handleEdit = (v: VillageMaster) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      subcenterId: v.subcenterId,
      subcenterName: v.subcenterName,
      population: v.population,
      notes: v.notes,
    });
  };

  const handleSubcenterSelect = (subId: string) => {
    const found = subcenters.find((s) => s.id === subId);
    setForm({
      ...form,
      subcenterId: subId,
      subcenterName: found ? found.name : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      resetForm();
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">गावांची माहिती</h1>
        <p className="mt-1 text-sm text-slate-600">
          कार्यक्षेत्रातील सर्व गावे व संबंधित उपकेंद्रे एकदाच नोंदवा. वारनिहाय कार्यक्रमात ही गावे थेट निवडता येतील.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'गावाची माहिती संपादित करा' : 'नवीन गाव जोडा'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              गावाचे नाव <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="गावाचे अचूक मराठी नाव लिहा"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">संबंधित उपकेंद्र</label>
            <select
              value={form.subcenterId}
              onChange={(e) => handleSubcenterSelect(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              <option value="">— उपकेंद्र निवडा —</option>
              {subcenters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">अंदाजित लोकसंख्या (ऐच्छिक)</label>
            <input
              type="text"
              value={form.population}
              onChange={(e) => setForm({ ...form, population: e.target.value })}
              placeholder="उदा. 2500"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">अतिरिक्त टिप्पणी</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="आवश्यक असल्यास टिप्पणी लिहा"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'जतन होत आहे...' : editingId ? 'बदल जतन करा' : 'गाव जतन करा'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                रद्द
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">
              नोंदवलेली गावे (<span className="font-mono-num">{filtered.length}</span>)
            </p>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="गाव किंवा उपकेंद्र शोधा..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MapPin className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">अद्याप कोणतेही गाव नोंदवलेले नाही</p>
              <p className="mt-1 text-xs text-slate-500">
                डाव्या बाजूच्या फॉर्ममधून तुमच्या कार्यक्षेत्रातील गावांची नावे भरा.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 w-12">अ.क्र.</th>
                    <th className="px-4 py-3">गावाचे नाव</th>
                    <th className="px-4 py-3">उपकेंद्र</th>
                    <th className="px-4 py-3">लोकसंख्या</th>
                    <th className="px-4 py-3">टिप्पणी</th>
                    <th className="px-4 py-3 text-right w-28">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                      <td className="px-4 py-3 text-slate-600">{v.subcenterName || '—'}</td>
                      <td className="px-4 py-3 font-mono-num text-slate-600">{v.population || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{v.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(v)}
                            title="संपादित करा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(v)}
                            title="हटवा"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        danger
        title="गाव हटवायचे का?"
        description={`'${deleteTarget?.name}' हे गाव यादीतून कायमस्वरूपी हटवले जाईल.`}
        confirmLabel="होय, हटवा"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
