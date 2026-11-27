import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, MapPin, Pencil, Plus, Route, Save, Search, Trash2, X } from 'lucide-react';
import type { SubcenterMaster, VillageMaster } from '../shared/types.ts';
import {
  encodeVillageNotesWithTravelMeta,
  extractHeadquarterCities,
  parseVillageTravelMeta,
} from '../shared/travelMeta.ts';
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
  const { talukaHq, districtHq, regularVillages } = useMemo(
    () => extractHeadquarterCities(villages),
    [villages]
  );

  // Taluka & District HQ City state
  const [talukaCityName, setTalukaCityName] = useState(talukaHq.name);
  const [talukaDistanceKm, setTalukaDistanceKm] = useState(
    talukaHq.distanceKm !== null ? String(talukaHq.distanceKm) : ''
  );
  const [districtCityName, setDistrictCityName] = useState(districtHq.name);
  const [districtDistanceKm, setDistrictDistanceKm] = useState(
    districtHq.distanceKm !== null ? String(districtHq.distanceKm) : ''
  );
  const [savingHq, setSavingHq] = useState<'taluka' | 'district' | null>(null);
  const [savedHqNotice, setSavedHqNotice] = useState<'taluka' | 'district' | null>(null);

  useEffect(() => {
    setTalukaCityName(talukaHq.name);
    setTalukaDistanceKm(talukaHq.distanceKm !== null ? String(talukaHq.distanceKm) : '');
  }, [talukaHq.id, talukaHq.name, talukaHq.distanceKm]);

  useEffect(() => {
    setDistrictCityName(districtHq.name);
    setDistrictDistanceKm(districtHq.distanceKm !== null ? String(districtHq.distanceKm) : '');
  }, [districtHq.id, districtHq.name, districtHq.distanceKm]);

  // Regular Village form state
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    subcenterId: '',
    subcenterName: '',
    distanceKm: '',
    population: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VillageMaster | null>(null);

  const filtered = regularVillages.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.subcenterName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveHqCity = async (kind: 'taluka' | 'district', e: React.FormEvent) => {
    e.preventDefault();
    const isTaluka = kind === 'taluka';
    const cityName = (isTaluka ? talukaCityName : districtCityName).trim();
    const rawDist = (isTaluka ? talukaDistanceKm : districtDistanceKm).trim();
    if (!cityName) return;

    const parsedDist = rawDist === '' ? null : Number(rawDist);
    const validDist =
      parsedDist !== null && Number.isFinite(parsedDist) && parsedDist >= 0 ? parsedDist : null;

    const existing = isTaluka ? talukaHq.record : districtHq.record;
    const payload = {
      name: cityName,
      subcenterId: isTaluka ? '__TALUKA_HQ__' : '__DISTRICT_HQ__',
      subcenterName: isTaluka ? 'तालुका मुख्यालय' : 'जिल्हा मुख्यालय',
      population: '',
      notes: encodeVillageNotesWithTravelMeta(
        isTaluka
          ? 'तालुकास्तरीय बैठकीसाठी मुख्यालय शहर'
          : 'जिल्हास्तरीय बैठक, रक्त नमुने व पाणी नमुने जमा करण्यासाठी मुख्यालय शहर',
        validDist,
        isTaluka ? 'taluka_hq' : 'district_hq'
      ),
    };

    setSavingHq(kind);
    try {
      if (existing) {
        await onUpdate(existing.id, payload);
      } else {
        await onCreate(payload);
      }
      setSavedHqNotice(kind);
      setTimeout(() => setSavedHqNotice((prev) => (prev === kind ? null : prev)), 2500);
    } catch {
      // Error toast is already displayed by App.tsx
    } finally {
      setSavingHq(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      subcenterId: '',
      subcenterName: '',
      distanceKm: '',
      population: '',
      notes: '',
    });
  };

  const handleEdit = (v: VillageMaster) => {
    const meta = parseVillageTravelMeta(v);
    setEditingId(v.id);
    setForm({
      name: v.name,
      subcenterId: v.subcenterId,
      subcenterName: v.subcenterName,
      distanceKm: meta.distanceKm !== null ? String(meta.distanceKm) : '',
      population: v.population,
      notes: meta.cleanNotes,
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
    const parsedDist = form.distanceKm.trim() === '' ? null : Number(form.distanceKm.trim());
    const validDist =
      parsedDist !== null && Number.isFinite(parsedDist) && parsedDist >= 0 ? parsedDist : null;

    const payload = {
      name: form.name.trim(),
      subcenterId: form.subcenterId,
      subcenterName: form.subcenterName,
      population: form.population.trim(),
      notes: encodeVillageNotesWithTravelMeta(form.notes, validDist, 'village'),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
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
        <h1 className="text-2xl font-bold text-slate-900">गावे, तालुका व जिल्हा मुख्यालय अंतर</h1>
        <p className="mt-1 text-sm text-slate-600">
          कार्यक्षेत्रातील गावे तसेच तालुका व जिल्हा मुख्यालय शहरांचे प्राथमिक आरोग्य केंद्र भादा पासून अंतर (एकेरी किमी) नोंदवा. मासिक दौरा दैनंदिनीत प्रवासाचा प्रकार (बाय डिफॉल्ट "बस") आणि एकूण किलोमीटर आपोआप मोजले जातील.
        </p>
      </div>

      {/* Taluka HQ City & District HQ City Configuration */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Taluka HQ Card */}
        <form
          onSubmit={(e) => void handleSaveHqCity('taluka', e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">तालुका मुख्यालय शहर</h2>
                <p className="text-xs text-slate-500">
                  तालुकास्तरीय आढावा बैठकीसाठी वापरले जाते
                </p>
              </div>
            </div>
            {savedHqNotice === 'taluka' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                <Check className="h-3.5 w-3.5" />
                जतन झाले
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                तालुका शहराचे नाव <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={talukaCityName}
                onChange={(e) => setTalukaCityName(e.target.value)}
                placeholder="उदा. औसा"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                प्रा. आ. केंद्रापासून अंतर (एकेरी किमी)
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={talukaDistanceKm}
                onChange={(e) => setTalukaDistanceKm(e.target.value)}
                placeholder="उदा. 16"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs text-slate-500">
              {talukaDistanceKm.trim() !== '' && Number(talukaDistanceKm) > 0
                ? `जाणे-येणे अंतर: ${Math.round(Number(talukaDistanceKm) * 2 * 10) / 10} किमी (प्रवास: बस)`
                : 'अंतर भरल्यास तालुका दौऱ्याचे किमी आपोआप मोजले जातील'}
            </span>
            <button
              type="submit"
              disabled={savingHq === 'taluka'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5" />
              {savingHq === 'taluka' ? 'जतन होत आहे...' : 'जतन करा'}
            </button>
          </div>
        </form>

        {/* District HQ Card */}
        <form
          onSubmit={(e) => void handleSaveHqCity('district', e)}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                <Route className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">जिल्हा मुख्यालय शहर</h2>
                <p className="text-xs text-slate-500">
                  जिल्हा बैठक तसेच रक्त व पाणी नमुने जमा करण्याच्या दौऱ्यासाठी
                </p>
              </div>
            </div>
            {savedHqNotice === 'district' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                <Check className="h-3.5 w-3.5" />
                जतन झाले
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                जिल्हा शहराचे नाव <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={districtCityName}
                onChange={(e) => setDistrictCityName(e.target.value)}
                placeholder="उदा. लातूर"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                प्रा. आ. केंद्रापासून अंतर (एकेरी किमी)
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={districtDistanceKm}
                onChange={(e) => setDistrictDistanceKm(e.target.value)}
                placeholder="उदा. 36"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs text-slate-500">
              {districtDistanceKm.trim() !== '' && Number(districtDistanceKm) > 0
                ? `जाणे-येणे अंतर: ${Math.round(Number(districtDistanceKm) * 2 * 10) / 10} किमी (प्रवास: बस)`
                : 'अंतर भरल्यास लातूर बैठक व नमुने दौऱ्याचे किमी मोजले जातील'}
            </span>
            <button
              type="submit"
              disabled={savingHq === 'district'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5" />
              {savingHq === 'district' ? 'जतन होत आहे...' : 'जतन करा'}
            </button>
          </div>
        </form>
      </div>

      {/* Regular Subcenter Villages Section */}
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
            <label className="block text-sm font-medium text-slate-700">
              प्रा. आ. केंद्रापासून अंतर (एकेरी किमी)
            </label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.distanceKm}
              onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
              placeholder="उदा. 8"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-teal-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              दैनंदिनीत जाणे-येणे (२ × अंतर) किमी आपोआप मोजले जातील.
            </p>
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
                डाव्या बाजूच्या फॉर्ममधून तुमच्या कार्यक्षेत्रातील गावांची नावे व अंतर भरा.
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
                    <th className="px-4 py-3">अंतर (किमी)</th>
                    <th className="px-4 py-3">लोकसंख्या</th>
                    <th className="px-4 py-3">टिप्पणी</th>
                    <th className="px-4 py-3 text-right w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((v, idx) => {
                    const meta = parseVillageTravelMeta(v);
                    const roundTrip =
                      meta.distanceKm !== null ? Math.round(meta.distanceKm * 2 * 10) / 10 : null;
                    return (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                        <td className="px-4 py-3 text-slate-600">{v.subcenterName || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {meta.distanceKm !== null ? (
                            <div>
                              <span className="font-mono-num font-semibold text-teal-800">
                                {meta.distanceKm} किमी
                              </span>
                              <div className="text-xs text-slate-500 font-mono-num">
                                जाणे-येणे: {roundTrip} किमी
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-700">अंतर भरा</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-slate-600">{v.population || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{meta.cleanNotes || '—'}</td>
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
                    );
                  })}
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
