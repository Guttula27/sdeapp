import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Percent } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type Target = 'CATEGORY' | 'SUBCATEGORY' | 'ITEM' | 'BILL';
type Discount = {
  id: string;
  name: string;
  outletId?: string | null;
  targetType: Target;
  categoryId?: string | null;
  subcategoryId?: string | null;
  itemId?: string | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  item?: { id: string; name: string } | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: string | number;
  minBillAmount?: string | number | null;
  maxDiscountAmount?: string | number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  daysOfWeek?: string | null;
  startMinute?: number | null;
  endMinute?: number | null;
  isManualOnly: boolean;
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
const fromHHMM = (s: string) => {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function DiscountsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;

  const [outlets, setOutlets] = useState<any[]>([]);
  const [scope, setScope] = useState<'BUSINESS' | string>('BUSINESS');
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const [list, setList] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: Discount }>({ open: false });
  const [form, setForm] = useState({
    name: '',
    targetType: 'BILL' as Target,
    categoryId: '',
    subcategoryId: '',
    itemId: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
    discountValue: '10',
    minBillAmount: '',
    maxDiscountAmount: '',
    validFrom: '',
    validUntil: '',
    daysOfWeek: [] as number[],
    startTime: '',
    endTime: '',
    isManualOnly: false,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);

  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`).then(({ data }) => setOutlets(data.data || [])).catch(() => {});
  }, [businessId]);

  // Pull categories/items for the picker. Uses any one outlet's menu since
  // categories are shared at business level via Category.businessId — but
  // here we fall back to the first outlet's menu endpoint for convenience.
  useEffect(() => {
    const oid = scope !== 'BUSINESS' ? scope : (outlets[0]?.id || '');
    if (!oid) return;
    api.get(`/outlets/${oid}/menu`).then(({ data }) => {
      const menu = data.data || data || [];
      const cats: any[] = [];
      const subs: any[] = [];
      const its: any[] = [];
      for (const c of menu) {
        cats.push({ id: c.id, name: c.name });
        for (const s of c.subcategories || []) {
          subs.push({ id: s.id, name: `${c.name} / ${s.name}`, categoryId: c.id });
          for (const it of s.items || []) its.push({ id: it.id, name: it.name });
        }
      }
      setCategories(cats);
      setSubcategories(subs);
      setItems(its);
    }).catch(() => {});
  }, [scope, outlets]);

  const fetch = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = scope !== 'BUSINESS' ? `?outletId=${scope}` : '';
      const { data } = await api.get(`/businesses/${businessId}/discounts${params}`);
      setList(data.data || data || []);
    } finally {
      setLoading(false);
    }
  }, [businessId, scope]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setForm({
      name: '', targetType: 'BILL',
      categoryId: '', subcategoryId: '', itemId: '',
      discountType: 'PERCENT', discountValue: '10',
      minBillAmount: '', maxDiscountAmount: '',
      validFrom: '', validUntil: '',
      daysOfWeek: [], startTime: '', endTime: '',
      isManualOnly: false, isActive: true,
    });
    setModal({ open: true });
  };

  const openEdit = (d: Discount) => {
    setForm({
      name: d.name,
      targetType: d.targetType,
      categoryId: d.categoryId ?? '',
      subcategoryId: d.subcategoryId ?? '',
      itemId: d.itemId ?? '',
      discountType: d.discountType,
      discountValue: String(d.discountValue),
      minBillAmount: d.minBillAmount != null ? String(d.minBillAmount) : '',
      maxDiscountAmount: d.maxDiscountAmount != null ? String(d.maxDiscountAmount) : '',
      validFrom: d.validFrom ? d.validFrom.slice(0, 10) : '',
      validUntil: d.validUntil ? d.validUntil.slice(0, 10) : '',
      daysOfWeek: d.daysOfWeek ? d.daysOfWeek.split(',').map((s) => Number(s.trim())).filter(Boolean) : [],
      startTime: toHHMM(d.startMinute),
      endTime: toHHMM(d.endMinute),
      isManualOnly: d.isManualOnly,
      isActive: d.isActive,
    });
    setModal({ open: true, editing: d });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        outletId: scope !== 'BUSINESS' ? scope : null,
        targetType: form.targetType,
        categoryId: form.targetType === 'CATEGORY' ? form.categoryId || null : null,
        subcategoryId: form.targetType === 'SUBCATEGORY' ? form.subcategoryId || null : null,
        itemId: form.targetType === 'ITEM' ? form.itemId || null : null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minBillAmount: form.minBillAmount ? Number(form.minBillAmount) : null,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        daysOfWeek: form.daysOfWeek.length ? form.daysOfWeek.join(',') : null,
        startMinute: fromHHMM(form.startTime),
        endMinute: fromHHMM(form.endTime),
        isManualOnly: form.isManualOnly,
        isActive: form.isActive,
      };
      if (modal.editing) {
        await api.patch(`/discounts/${modal.editing.id}`, body);
        toast.success('Discount updated');
      } else {
        await api.post(`/businesses/${businessId}/discounts`, body);
        toast.success('Discount created');
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
      await api.delete(`/discounts/${deleteTarget.id}`);
      toast.success('Discount deleted');
      setDeleteTarget(null);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  const targetLabel = (d: Discount) => {
    if (d.targetType === 'BILL') return 'Bill total';
    if (d.targetType === 'CATEGORY') return `Category — ${d.category?.name || '?'}`;
    if (d.targetType === 'SUBCATEGORY') return `Subcategory — ${d.subcategory?.name || '?'}`;
    if (d.targetType === 'ITEM') return `Item — ${d.item?.name || '?'}`;
    return d.targetType;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-orange-500" /> Discounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scheduled price reductions (auto) and counter discounts (cashier-picked).
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Discount
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
          <div className="p-8 text-center text-sm text-slate-500">No discounts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">Discount</th>
                <th className="text-left px-4 py-2">Schedule</th>
                <th className="text-center px-4 py-2">Type</th>
                <th className="text-center px-4 py-2">Active</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2 text-xs">{targetLabel(d)}</td>
                  <td className="px-4 py-2">
                    {d.discountType === 'PERCENT' ? `${d.discountValue}%` : `₹${d.discountValue}`}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {d.daysOfWeek
                      ? d.daysOfWeek.split(',').map((dow) => DOW.find((x) => x.v === Number(dow))?.l).join(' ')
                      : 'Every day'}
                    {d.startMinute != null && d.endMinute != null && (
                      <span className="ml-2 text-slate-500">{toHHMM(d.startMinute)}–{toHHMM(d.endMinute)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-xs">
                    {d.isManualOnly
                      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">Counter</span>
                      : <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">Auto</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${d.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openEdit(d)} className="text-slate-400 hover:text-slate-600 p-1">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(d)} className="text-slate-400 hover:text-red-500 p-1 ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false })}
        title={modal.editing ? 'Edit Discount' : 'New Discount'} size="xl">
        <form onSubmit={save} className="space-y-4 p-6">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. Lunch combo 15%" required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Apply to">
              <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value as Target })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="BILL">Whole bill</option>
                <option value="CATEGORY">A category</option>
                <option value="SUBCATEGORY">A subcategory</option>
                <option value="ITEM">A specific item</option>
              </select>
            </Field>
            {form.targetType === 'CATEGORY' && (
              <Field label="Category">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {form.targetType === 'SUBCATEGORY' && (
              <Field label="Subcategory">
                <select value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required>
                  <option value="">Select…</option>
                  {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            {form.targetType === 'ITEM' && (
              <Field label="Item">
                <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required>
                  <option value="">Select…</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Discount Type">
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="PERCENT">% Percent</option>
                <option value="FIXED">₹ Fixed</option>
              </select>
            </Field>
            <Field label="Value">
              <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" required />
            </Field>
            <Field label="Max ₹ Cap (optional)">
              <input type="number" value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" />
            </Field>
          </div>

          {form.targetType === 'BILL' && (
            <Field label="Minimum bill (optional)">
              <input type="number" value={form.minBillAmount} onChange={(e) => setForm({ ...form, minBillAmount: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" />
            </Field>
          )}

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
                    form.daysOfWeek.includes(d.v) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-700 border-slate-300'
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

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isManualOnly} onChange={(e) => setForm({ ...form, isManualOnly: e.target.checked })} />
              Counter discount (cashier picks at checkout)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal({ open: false })}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-md disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete discount"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
