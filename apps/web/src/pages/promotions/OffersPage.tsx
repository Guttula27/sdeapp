import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Gift } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type Trigger = 'MIN_BILL' | 'BUY_X_GET_Y';
type Offer = {
  id: string;
  name: string;
  description?: string | null;
  outletId?: string | null;
  triggerType: Trigger;
  minBillAmount?: string | number | null;
  buyItemId?: string | null;
  buyQuantity?: number | null;
  buyItem?: { id: string; name: string } | null;
  getItemId?: string | null;
  getQuantity?: number | null;
  getItem?: { id: string; name: string } | null;
  validFrom?: string | null;
  validUntil?: string | null;
  daysOfWeek?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
  isActive: boolean;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const DOW = [
  { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 7, l: 'Sun' },
];

const toHHMM = (mins?: number | null) => {
  if (mins == null) return '';
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};
const fromHHMM = (s: string) => s ? Number(s.split(':')[0]) * 60 + Number(s.split(':')[1] || 0) : null;

export default function OffersPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;

  const [outlets, setOutlets] = useState<any[]>([]);
  const [scope, setScope] = useState<'BUSINESS' | string>('BUSINESS');
  const [items, setItems] = useState<any[]>([]);
  const [list, setList] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: Offer }>({ open: false });
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'MIN_BILL' as Trigger,
    minBillAmount: '500',
    buyItemId: '',
    buyQuantity: '3',
    getItemId: '',
    getQuantity: '1',
    validFrom: '',
    validUntil: '',
    daysOfWeek: [] as number[],
    startTime: '',
    endTime: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);

  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`).then(({ data }) => setOutlets(data.data || [])).catch(() => {});
  }, [businessId]);

  useEffect(() => {
    const oid = scope !== 'BUSINESS' ? scope : (outlets[0]?.id || '');
    if (!oid) return;
    api.get(`/outlets/${oid}/menu`).then(({ data }) => {
      const menu = data.data || data || [];
      const its: any[] = [];
      for (const c of menu) for (const s of c.subcategories || []) for (const it of s.items || []) {
        its.push({ id: it.id, name: it.name });
      }
      setItems(its);
    }).catch(() => {});
  }, [scope, outlets]);

  const fetch = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = scope !== 'BUSINESS' ? `?outletId=${scope}` : '';
      const { data } = await api.get(`/businesses/${businessId}/offers${params}`);
      setList(data.data || data || []);
    } finally { setLoading(false); }
  }, [businessId, scope]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setForm({
      name: '', description: '', triggerType: 'MIN_BILL',
      minBillAmount: '500', buyItemId: '', buyQuantity: '3',
      getItemId: '', getQuantity: '1',
      validFrom: '', validUntil: '',
      daysOfWeek: [], startTime: '', endTime: '',
      isActive: true,
    });
    setModal({ open: true });
  };

  const openEdit = (o: Offer) => {
    setForm({
      name: o.name, description: o.description ?? '',
      triggerType: o.triggerType,
      minBillAmount: o.minBillAmount != null ? String(o.minBillAmount) : '',
      buyItemId: o.buyItemId ?? '', buyQuantity: o.buyQuantity != null ? String(o.buyQuantity) : '1',
      getItemId: o.getItemId ?? '', getQuantity: o.getQuantity != null ? String(o.getQuantity) : '1',
      validFrom: o.validFrom ? o.validFrom.slice(0, 10) : '',
      validUntil: o.validUntil ? o.validUntil.slice(0, 10) : '',
      daysOfWeek: o.daysOfWeek ? o.daysOfWeek.split(',').map((s) => Number(s.trim())).filter(Boolean) : [],
      startTime: toHHMM(o.startMinute),
      endTime: toHHMM(o.endMinute),
      isActive: o.isActive,
    });
    setModal({ open: true, editing: o });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        outletId: scope !== 'BUSINESS' ? scope : null,
        triggerType: form.triggerType,
        minBillAmount: form.triggerType === 'MIN_BILL' ? Number(form.minBillAmount) : null,
        buyItemId: form.triggerType === 'BUY_X_GET_Y' ? form.buyItemId : null,
        buyQuantity: form.triggerType === 'BUY_X_GET_Y' ? Number(form.buyQuantity) : null,
        getItemId: form.getItemId,
        getQuantity: Number(form.getQuantity),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        daysOfWeek: form.daysOfWeek.length ? form.daysOfWeek.join(',') : null,
        startMinute: fromHHMM(form.startTime),
        endMinute: fromHHMM(form.endTime),
        isActive: form.isActive,
      };
      if (modal.editing) {
        await api.patch(`/offers/${modal.editing.id}`, body);
        toast.success('Offer updated');
      } else {
        await api.post(`/businesses/${businessId}/offers`, body);
        toast.success('Offer created');
      }
      setModal({ open: false });
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/offers/${deleteTarget.id}`);
      toast.success('Offer deleted');
      setDeleteTarget(null);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  const ruleSummary = (o: Offer) => {
    if (o.triggerType === 'MIN_BILL') {
      return `Bill ≥ ₹${o.minBillAmount} → get ${o.getQuantity}× ${o.getItem?.name || '?'}`;
    }
    return `Buy ${o.buyQuantity}× ${o.buyItem?.name || '?'} → get ${o.getQuantity}× ${o.getItem?.name || '?'}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Gift className="w-6 h-6 text-brand-700" /> Offers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conditional freebies — “Spend ₹500, get a sweet” or “Buy 3 beers, get 1 free”.
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Offer
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 mb-4">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Scope</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">
            <option value="BUSINESS">Business-wide</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>Outlet — {o.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No offers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Rule</th>
                <th className="text-left px-4 py-2">Schedule</th>
                <th className="text-center px-4 py-2">Active</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">{o.name}</td>
                  <td className="px-4 py-2 text-xs">{ruleSummary(o)}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {o.daysOfWeek
                      ? o.daysOfWeek.split(',').map((dow) => DOW.find((x) => x.v === Number(dow))?.l).join(' ')
                      : 'Every day'}
                    {o.startMinute != null && o.endMinute != null && (
                      <span className="ml-2 text-slate-500">{toHHMM(o.startMinute)}–{toHHMM(o.endMinute)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${o.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openEdit(o)} className="text-slate-400 hover:text-slate-600 p-1"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTarget(o)} className="text-slate-400 hover:text-red-500 p-1 ml-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false })}
        title={modal.editing ? 'Edit Offer' : 'New Offer'} size="xl">
        <form onSubmit={save} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. Beer happy-hour" required />
            </Field>
            <Field label="Trigger">
              <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value as Trigger })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="MIN_BILL">Min bill → freebie</option>
                <option value="BUY_X_GET_Y">Buy X, get Y free</option>
              </select>
            </Field>
          </div>

          {form.triggerType === 'MIN_BILL' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bill must be ≥ ₹">
                <input type="number" value={form.minBillAmount} onChange={(e) => setForm({ ...form, minBillAmount: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" required />
              </Field>
              <div></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Buy item">
                <select value={form.buyItemId} onChange={(e) => setForm({ ...form, buyItemId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required>
                  <option value="">Pick…</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
              <Field label="Buy quantity">
                <input type="number" value={form.buyQuantity} onChange={(e) => setForm({ ...form, buyQuantity: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="1" required />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Get item (free)">
              <select value={form.getItemId} onChange={(e) => setForm({ ...form, getItemId: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required>
                <option value="">Pick…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="Get quantity">
              <input type="number" value={form.getQuantity} onChange={(e) => setForm({ ...form, getQuantity: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="1" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valid from (optional)">
              <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </Field>
            <Field label="Valid until (optional)">
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label="Days of week (leave empty for every day)">
            <div className="flex gap-2">
              {DOW.map((d) => (
                <button key={d.v} type="button"
                  onClick={() => setForm({
                    ...form,
                    daysOfWeek: form.daysOfWeek.includes(d.v)
                      ? form.daysOfWeek.filter((x) => x !== d.v)
                      : [...form.daysOfWeek, d.v],
                  })}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    form.daysOfWeek.includes(d.v) ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >{d.l}</button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start time (optional)">
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </Field>
            <Field label="End time (optional)">
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal({ open: false })}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-md disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete offer"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
