import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Ticket } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type CouponKind = 'STANDARD' | 'ALLOWANCE';
type ResetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type CouponTargetType = 'ALL' | 'SPECIFIC' | 'TAG';
type ScopeRow = { kind: 'ITEM' | 'CATEGORY' | 'SUBCATEGORY'; refId: string };

type Coupon = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  outletId?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: string | number;
  minBillAmount?: string | number | null;
  maxDiscountAmount?: string | number | null;
  validFrom: string;
  validUntil: string;
  maxUsesPerCustomer: number;
  maxTotalUses?: number | null;
  usesCount: number;
  targetType: CouponTargetType;
  isActive: boolean;
  targetCustomers?: { user: { id: string; name: string; phone: string } }[];
  targetTags?: { customerTag: { id: string; name: string; color: string } }[];
  scopes?: ScopeRow[];
  kind: CouponKind;
  resetPeriod?: ResetPeriod | null;
  perPeriodQuota?: number | null;
  _count?: { usages: number };
};

type Tag      = { id: string; name: string; color: string };
type Category = { id: string; name: string; subcategories?: Subcategory[] };
type Subcategory = { id: string; name: string; items?: MenuItem[] };
type MenuItem = { id: string; name: string };

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function CouponsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;

  const [outlets, setOutlets] = useState<any[]>([]);
  const [scope, setScope] = useState<'BUSINESS' | string>('BUSINESS');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: Coupon }>({ open: false });
  const blankForm = {
    code: '',
    name: '',
    description: '',
    // Empty string = "Business-wide". A real outlet id otherwise. We
    // default this to the page-scope outlet when opening the modal so
    // the operator's mental model is preserved, but it's editable
    // here — TAG / ALLOWANCE flows require a specific outlet and the
    // user shouldn't have to close the modal to change it.
    outletId: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
    discountValue: '10',
    minBillAmount: '',
    maxDiscountAmount: '',
    validFrom: isoDate(new Date()),
    validUntil: isoDate(new Date(Date.now() + 30 * 86400000)),
    maxUsesPerCustomer: '1',
    maxTotalUses: '',
    targetType: 'ALL' as CouponTargetType,
    isActive: true,
    targetPhones: '',  // comma-separated phones; UI shortcut
    // ALLOWANCE-specific
    kind: 'STANDARD' as CouponKind,
    resetPeriod: 'DAILY' as ResetPeriod,
    perPeriodQuota: '1',
    // Targeting + scope: arrays of ids
    targetTagIds: [] as string[],
    scopeItemIds: [] as string[],
    scopeCategoryIds: [] as string[],
    scopeSubcategoryIds: [] as string[],
  };
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  // Tag + menu lookups for the scope/targeting pickers. Driven by the
  // form's outlet field (not the page-level scope filter), so the
  // operator can change the target outlet inside the modal without
  // closing it. Cleared when the field is "Business-wide".
  const [tags, setTags] = useState<Tag[]>([]);
  const [menu, setMenu] = useState<Category[]>([]);
  const formOutletId = form.outletId || null;
  useEffect(() => {
    if (!formOutletId) { setTags([]); setMenu([]); return; }
    api.get(`/outlets/${formOutletId}/customer-tags`)
      .then(({ data }) => setTags(data.data || []))
      .catch(() => setTags([]));
    api.get(`/outlets/${formOutletId}/menu`, { params: { includeHidden: 'true' } })
      .then(({ data }) => {
        // The menu endpoint returns the category array DIRECTLY as
        // `data.data` (the transform interceptor's envelope wraps an
        // array, not an object) — same pattern as MenuPage.tsx. An
        // earlier `data.data?.categories` lookup quietly returned []
        // because arrays don't have a `.categories` prop.
        const cats: Category[] = Array.isArray(data?.data) ? data.data : [];
        setMenu(cats);
      })
      .catch(() => setMenu([]));
  }, [formOutletId]);

  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then(({ data }) => setOutlets(data.data || []))
      .catch(() => {});
  }, [businessId]);

  const fetch = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = scope !== 'BUSINESS' ? `?outletId=${scope}` : '';
      const { data } = await api.get(`/businesses/${businessId}/coupons${params}`);
      setCoupons(data.data || data || []);
    } finally {
      setLoading(false);
    }
  }, [businessId, scope]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    // Default the form's outlet to: (1) outlet-admin's own outlet if
    // they have one on the JWT — they can't create anywhere else;
    // (2) the page-scope outlet if a business owner has filtered the
    // list to one; (3) empty (business-wide) otherwise.
    const initialOutlet = user?.outletId || (scope !== 'BUSINESS' ? scope : '');
    setForm({ ...blankForm, outletId: initialOutlet });
    setModal({ open: true });
  };

  const openEdit = (c: Coupon) => {
    const scopes = c.scopes || [];
    setForm({
      ...blankForm,
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      outletId: c.outletId ?? '',
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      minBillAmount: c.minBillAmount != null ? String(c.minBillAmount) : '',
      maxDiscountAmount: c.maxDiscountAmount != null ? String(c.maxDiscountAmount) : '',
      validFrom: c.validFrom.slice(0, 10),
      validUntil: c.validUntil.slice(0, 10),
      maxUsesPerCustomer: String(c.maxUsesPerCustomer),
      maxTotalUses: c.maxTotalUses != null ? String(c.maxTotalUses) : '',
      targetType: c.targetType,
      isActive: c.isActive,
      targetPhones: (c.targetCustomers || []).map(t => t.user.phone).join(', '),
      kind: c.kind ?? 'STANDARD',
      resetPeriod: (c.resetPeriod ?? 'DAILY') as ResetPeriod,
      perPeriodQuota: c.perPeriodQuota != null ? String(c.perPeriodQuota) : '1',
      targetTagIds: (c.targetTags || []).map((t) => t.customerTag.id),
      scopeItemIds: scopes.filter((s) => s.kind === 'ITEM').map((s) => s.refId),
      scopeCategoryIds: scopes.filter((s) => s.kind === 'CATEGORY').map((s) => s.refId),
      scopeSubcategoryIds: scopes.filter((s) => s.kind === 'SUBCATEGORY').map((s) => s.refId),
    });
    setModal({ open: true, editing: c });
  };

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    // ALLOWANCE coupons need an outlet context (scope picker + tag
    // targeting are outlet-scoped). Block the save instead of silently
    // saving a misconfigured business-wide row.
    if (form.kind === 'ALLOWANCE' && !form.outletId) {
      toast.error('Allowance coupons must be assigned to a specific outlet.');
      return;
    }
    if (form.targetType === 'TAG' && !form.outletId) {
      toast.error('Tag targeting requires the coupon to be assigned to a specific outlet.');
      return;
    }

    setSaving(true);
    try {
      let targetUserIds: string[] | undefined;
      if (form.targetType === 'SPECIFIC') {
        const phones = form.targetPhones.split(',').map(p => p.trim()).filter(Boolean);
        if (phones.length) {
          const { data } = await api.post('/coupons/lookup-customers', { phones });
          targetUserIds = (data.data || data || []).map((u: any) => u.id);
        } else {
          targetUserIds = [];
        }
      }

      const scopeRows: ScopeRow[] = [];
      if (form.kind === 'ALLOWANCE') {
        for (const id of form.scopeItemIds)        scopeRows.push({ kind: 'ITEM', refId: id });
        for (const id of form.scopeSubcategoryIds) scopeRows.push({ kind: 'SUBCATEGORY', refId: id });
        for (const id of form.scopeCategoryIds)    scopeRows.push({ kind: 'CATEGORY', refId: id });
        if (scopeRows.length === 0) {
          toast.error('Allowance coupons need at least one item / category / subcategory in scope.');
          setSaving(false);
          return;
        }
      }

      const body: any = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        outletId: form.outletId || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minBillAmount: form.minBillAmount ? Number(form.minBillAmount) : null,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        validFrom: form.validFrom,
        validUntil: form.validUntil,
        maxUsesPerCustomer: Number(form.maxUsesPerCustomer) || 1,
        maxTotalUses: form.maxTotalUses ? Number(form.maxTotalUses) : null,
        targetType: form.targetType,
        targetUserIds,
        targetTagIds: form.targetType === 'TAG' ? form.targetTagIds : undefined,
        isActive: form.isActive,
        kind: form.kind,
        ...(form.kind === 'ALLOWANCE'
          ? {
              resetPeriod: form.resetPeriod,
              perPeriodQuota: Number(form.perPeriodQuota) || 1,
              scope: scopeRows,
            }
          : {
              resetPeriod: null,
              perPeriodQuota: null,
            }),
      };
      if (modal.editing) {
        await api.patch(`/coupons/${modal.editing.id}`, body);
        toast.success('Coupon updated');
      } else {
        await api.post(`/businesses/${businessId}/coupons`, body);
        toast.success('Coupon created');
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
      await api.delete(`/coupons/${deleteTarget.id}`);
      toast.success('Coupon deleted');
      setDeleteTarget(null);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-brand-700" /> Coupons
          </h1>
          <p className="text-sm text-slate-500 mt-1">Promo codes customers can apply at checkout.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-charcoal-900 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 mb-4">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Scope</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm"
          >
            <option value="BUSINESS">Business-wide</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>Outlet — {o.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No coupons yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Kind</th>
                <th className="text-left px-4 py-2">Discount</th>
                <th className="text-left px-4 py-2">Validity</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-right px-4 py-2">Used</th>
                <th className="text-center px-4 py-2">Active</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-xs">
                    {c.kind === 'ALLOWANCE' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        Allowance · {c.perPeriodQuota}/{(c.resetPeriod || '').toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-slate-500">Standard</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    {c.maxDiscountAmount && <span className="text-xs text-slate-500"> (max ₹{c.maxDiscountAmount})</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {c.validFrom.slice(0, 10)} → {c.validUntil.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.targetType === 'ALL'      ? 'All customers'
                     : c.targetType === 'TAG'    ? `${c.targetTags?.length || 0} tag(s)`
                     :                              `${c.targetCustomers?.length || 0} selected`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {c._count?.usages ?? c.usesCount}
                    {c.maxTotalUses && <span className="text-xs text-slate-500"> / {c.maxTotalUses}</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-600 p-1">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className="text-slate-400 hover:text-red-500 p-1 ml-1">
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
        title={modal.editing ? 'Edit Coupon' : 'New Coupon'} size="xl">
        <form onSubmit={save} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono" placeholder="WELCOME10" required />
            </Field>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Welcome offer" required />
            </Field>
          </div>
          <Field label="Description">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Optional" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Outlet">
              {(() => {
                // Lock the field when there is no meaningful choice to
                // make: outlet-admin accounts can only create coupons
                // for their own outlet (server enforces this anyway),
                // and a business owner who has filtered the page to a
                // specific outlet has already declared the context —
                // showing the full dropdown is just clutter that
                // implies the wrong choice space.
                const locked =
                  !!user?.outletId || (scope !== 'BUSINESS' && !modal.editing);
                if (locked) {
                  const o = outlets.find((x) => x.id === form.outletId);
                  return (
                    <div className="w-full border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-sm text-slate-700">
                      {o?.name || form.outletId || '—'}
                    </div>
                  );
                }
                return (
                  <select
                    value={form.outletId}
                    onChange={(e) => setForm({
                      ...form,
                      outletId: e.target.value,
                      // Switching outlet invalidates the previous outlet's scope
                      // and tag picks — wipe them so we don't persist refIds
                      // from a different outlet's menu.
                      scopeItemIds: [],
                      scopeCategoryIds: [],
                      scopeSubcategoryIds: [],
                      targetTagIds: [],
                    })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    required={form.kind === 'ALLOWANCE' || form.targetType === 'TAG'}
                  >
                    <option value="">Business-wide (all outlets)</option>
                    {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                );
              })()}
            </Field>
            <Field label="Kind">
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CouponKind })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="STANDARD">Standard — flat bill discount</option>
                <option value="ALLOWANCE">Allowance — N items per period (e.g. employee perks)</option>
              </select>
            </Field>
            <div className="flex items-end text-xs text-slate-500">
              {form.kind === 'ALLOWANCE'
                ? 'Allowance coupons must target a specific outlet and need at least one item/category/subcategory below.'
                : ' '}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Discount Type">
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                <option value="PERCENT">% Percent</option>
                <option value="FIXED">₹ Fixed</option>
              </select>
            </Field>
            <Field label={form.kind === 'ALLOWANCE' ? 'Value (per eligible unit)' : 'Value'}>
              <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" required />
            </Field>
            <Field label="Max ₹ Cap (optional)">
              <input type="number" value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" />
            </Field>
          </div>

          {form.kind === 'ALLOWANCE' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
              <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Allowance settings</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reset period">
                  <select value={form.resetPeriod} onChange={(e) => setForm({ ...form, resetPeriod: e.target.value as ResetPeriod })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (Monday → Sunday, UTC)</option>
                    <option value="MONTHLY">Monthly (1st → end of month)</option>
                  </select>
                </Field>
                <Field label="Items allowed per period">
                  <input type="number" min="1" value={form.perPeriodQuota}
                    onChange={(e) => setForm({ ...form, perPeriodQuota: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
                </Field>
              </div>

              <Field label="Eligible items / categories / subcategories">
                {!form.outletId ? (
                  <div className="text-xs text-slate-500 italic">
                    Pick an outlet above to load this outlet's menu.
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {/* Three rolled-up multi-pickers — categories, subcategories, items.
                        A cart line is eligible if it matches ANY of the selections. */}
                    <details className="bg-white rounded border border-slate-200 px-3 py-2">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Categories ({form.scopeCategoryIds.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                        {menu.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 py-0.5">
                            <input type="checkbox"
                              checked={form.scopeCategoryIds.includes(c.id)}
                              onChange={() => setForm({ ...form, scopeCategoryIds: toggleId(form.scopeCategoryIds, c.id) })} />
                            <span>{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                    <details className="bg-white rounded border border-slate-200 px-3 py-2">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Subcategories ({form.scopeSubcategoryIds.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                        {menu.flatMap((c) => (c.subcategories || []).map((s) => (
                          <label key={s.id} className="flex items-center gap-2 py-0.5">
                            <input type="checkbox"
                              checked={form.scopeSubcategoryIds.includes(s.id)}
                              onChange={() => setForm({ ...form, scopeSubcategoryIds: toggleId(form.scopeSubcategoryIds, s.id) })} />
                            <span>{c.name} → {s.name}</span>
                          </label>
                        )))}
                      </div>
                    </details>
                    <details className="bg-white rounded border border-slate-200 px-3 py-2">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Items ({form.scopeItemIds.length})
                      </summary>
                      <div className="mt-2 max-h-60 overflow-y-auto grid grid-cols-2 gap-1">
                        {menu.flatMap((c) => (c.subcategories || []).flatMap((s) => (s.items || []).map((i) => (
                          <label key={i.id} className="flex items-center gap-2 py-0.5">
                            <input type="checkbox"
                              checked={form.scopeItemIds.includes(i.id)}
                              onChange={() => setForm({ ...form, scopeItemIds: toggleId(form.scopeItemIds, i.id) })} />
                            <span>{i.name}</span>
                          </label>
                        ))))}
                      </div>
                    </details>
                  </div>
                )}
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {form.kind === 'STANDARD' && (
              <Field label="Minimum bill (optional)">
                <input type="number" value={form.minBillAmount} onChange={(e) => setForm({ ...form, minBillAmount: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="0" step="0.01" />
              </Field>
            )}
            <Field label="Max total uses (optional)">
              <input type="number" value={form.maxTotalUses} onChange={(e) => setForm({ ...form, maxTotalUses: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="1" />
            </Field>
          </div>

          <div className={`grid gap-4 ${form.kind === 'ALLOWANCE' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <Field label="Valid from">
              <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </Field>
            <Field label="Valid until">
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
            </Field>
            {form.kind === 'STANDARD' && (
              <Field label="Max uses per customer">
                <input type="number" value={form.maxUsesPerCustomer} onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" min="1" required />
              </Field>
            )}
          </div>

          <Field label="Target customers">
            <div className="flex gap-3 items-center mb-2 flex-wrap">
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={form.targetType === 'ALL'} onChange={() => setForm({ ...form, targetType: 'ALL' })} />
                All customers
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={form.targetType === 'SPECIFIC'} onChange={() => setForm({ ...form, targetType: 'SPECIFIC' })} />
                Specific phone numbers
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={form.targetType === 'TAG'} onChange={() => setForm({ ...form, targetType: 'TAG' })} />
                Customer tag(s)
              </label>
            </div>
            {form.targetType === 'SPECIFIC' && (
              <textarea
                value={form.targetPhones}
                onChange={(e) => setForm({ ...form, targetPhones: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                rows={2}
                placeholder="Comma-separated phone numbers, e.g. 9876543210, 9123456789"
              />
            )}
            {form.targetType === 'TAG' && (
              !form.outletId ? (
                <div className="text-xs text-slate-500 italic">
                  Pick an outlet above first — tags are outlet-scoped.
                </div>
              ) : tags.length === 0 ? (
                <div className="text-xs text-slate-500 italic">
                  This outlet has no customer tags configured yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const active = form.targetTagIds.includes(t.id);
                    return (
                      <button key={t.id} type="button"
                        onClick={() => setForm({ ...form, targetTagIds: toggleId(form.targetTagIds, t.id) })}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${active ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-300'}`}
                        style={active ? { backgroundColor: t.color } : undefined}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal({ open: false })}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-md">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-gold-500 hover:bg-gold-600 text-charcoal-900 rounded-md disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete coupon"
        message={`Delete coupon "${deleteTarget?.code}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
