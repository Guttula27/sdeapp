import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Percent, Save, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import { useUserRole } from '../../hooks/useUserRole';

type Settings = {
  platformFeePercent: string | number;
  platformFeeMinimum: string | number;
};

type BusinessRow = {
  id: string;
  name: string;
  publicCode?: string | null;
  isCluster?: boolean;
  platformFeePercent: string | number | null;
  platformFeeMinimum: string | number | null;
};

const numFmt = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Effective fee shown next to each business — the per-business value
// wins field-by-field, otherwise the platform default. Returned as
// numbers so the cell can render them without juggling string/Decimal.
function effective(b: BusinessRow, defaults: Settings) {
  return {
    percent: b.platformFeePercent != null
      ? numFmt(b.platformFeePercent)
      : numFmt(defaults.platformFeePercent),
    minimum: b.platformFeeMinimum != null
      ? numFmt(b.platformFeeMinimum)
      : numFmt(defaults.platformFeeMinimum),
    overridden:
      b.platformFeePercent != null || b.platformFeeMinimum != null,
  };
}

export default function PlatformFeesPage() {
  const { tier } = useUserRole();
  if (tier !== 'platform') return <Navigate to="/dashboard" replace />;

  const [settings, setSettings] = useState<Settings>({ platformFeePercent: 0, platformFeeMinimum: 0 });
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [editPercent, setEditPercent] = useState('');
  const [editMinimum, setEditMinimum] = useState('');
  const [overrideForId, setOverrideForId] = useState<string | null>(null);
  const [overridePercent, setOverridePercent] = useState('');
  const [overrideMinimum, setOverrideMinimum] = useState('');

  const load = async () => {
    try {
      const [s, b] = await Promise.all([
        api.get('/platform/settings'),
        api.get('/businesses'),
      ]);
      const settingsRow = s.data.data as Settings;
      setSettings(settingsRow);
      setEditPercent(String(numFmt(settingsRow.platformFeePercent)));
      setEditMinimum(String(numFmt(settingsRow.platformFeeMinimum)));
      setBusinesses((b.data.data.businesses || []) as BusinessRow[]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load fees');
    }
  };
  useEffect(() => { load(); }, []);

  const saveDefaults = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/platform/settings', {
        platformFeePercent: Number(editPercent || 0),
        platformFeeMinimum: Number(editMinimum || 0),
      });
      setSettings(data.data);
      toast.success('Defaults saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openOverride = (b: BusinessRow) => {
    setOverrideForId(b.id);
    setOverridePercent(b.platformFeePercent != null ? String(b.platformFeePercent) : '');
    setOverrideMinimum(b.platformFeeMinimum != null ? String(b.platformFeeMinimum) : '');
  };
  const closeOverride = () => setOverrideForId(null);
  const saveOverride = async () => {
    if (!overrideForId) return;
    setSaving(true);
    try {
      // Empty strings → null so the field reverts to "inherit default"
      // rather than persisting 0 as an explicit override.
      const body: any = {
        platformFeePercent: overridePercent.trim() === '' ? null : Number(overridePercent),
        platformFeeMinimum: overrideMinimum.trim() === '' ? null : Number(overrideMinimum),
      };
      await api.patch(`/businesses/${overrideForId}`, body);
      toast.success('Override saved');
      closeOverride();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };
  const clearOverride = async (id: string) => {
    if (!window.confirm('Revert this business to the platform default fee?')) return;
    try {
      await api.patch(`/businesses/${id}`, {
        platformFeePercent: null,
        platformFeeMinimum: null,
      });
      toast.success('Reverted to default');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    }
  };

  const sortedBusinesses = useMemo(
    () => [...businesses].sort((a, b) => a.name.localeCompare(b.name)),
    [businesses],
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Platform fees</h1>
        <p className="page-subtitle">
          Fee taken by paynpik on every Razorpay Route payment. Customer pays the full ticket;
          the fee is retained on the master account and the remainder is routed to the outlet's
          Linked Account.
        </p>
      </header>

      {/* Defaults ─────────────────────────────────────────────── */}
      <section className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent size={16} className="text-brand-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Platform default</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
              Fee percent (%)
            </label>
            <input
              type="number" step="0.01" min="0" max="100"
              value={editPercent} onChange={(e) => setEditPercent(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
              Minimum floor (₹)
            </label>
            <input
              type="number" step="0.50" min="0"
              value={editMinimum} onChange={(e) => setEditMinimum(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={saveDefaults} disabled={saving} className="btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save defaults'}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          The greater of <code>percent × order total</code> and the minimum floor is charged.
          Setting both to 0 disables the platform fee — outlets receive the full ticket value.
        </p>
      </section>

      {/* Per-business overrides ───────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Per-business overrides</h2>
          <p className="text-xs text-slate-500 mt-1">
            Each business can override the default. Empty fields inherit from the platform default.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto">
            <thead>
              <tr>
                <th>Business</th>
                <th>Effective %</th>
                <th>Effective min (₹)</th>
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedBusinesses.map((b) => {
                const e = effective(b, settings);
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="font-semibold text-slate-900">
                      {b.name}
                      {b.publicCode && (
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{b.publicCode}</div>
                      )}
                    </td>
                    <td className="text-slate-700">{e.percent.toFixed(2)}%</td>
                    <td className="text-slate-700">₹{e.minimum.toFixed(2)}</td>
                    <td>
                      {e.overridden
                        ? <span className="badge badge-blue">Override</span>
                        : <span className="badge badge-slate">Default</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openOverride(b)}
                          className="text-xs font-medium px-2 py-1 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          Override
                        </button>
                        {e.overridden && (
                          <button
                            onClick={() => clearOverride(b.id)}
                            className="text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                          >
                            <RotateCcw size={11} /> Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedBusinesses.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 italic py-6">
                    No businesses registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Override modal — kept inline so the page stays self-contained. */}
      {overrideForId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeOverride}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Override fee</h3>
            <p className="text-xs text-slate-500 mb-4">
              Leave a field blank to inherit the platform default for that field.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Fee percent (%)</label>
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={overridePercent} onChange={(e) => setOverridePercent(e.target.value)}
                  placeholder={`Default: ${numFmt(settings.platformFeePercent).toFixed(2)}`}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Minimum floor (₹)</label>
                <input
                  type="number" step="0.50" min="0"
                  value={overrideMinimum} onChange={(e) => setOverrideMinimum(e.target.value)}
                  placeholder={`Default: ${numFmt(settings.platformFeeMinimum).toFixed(2)}`}
                  className="input"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={closeOverride}>Cancel</button>
              <button className="btn-primary" onClick={saveOverride} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
