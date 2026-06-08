import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Sandwich, X as XIcon } from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useUserRole } from '../../hooks/useUserRole';

type Option = { name: string; priceAdd: number };
type Topping = {
  id: string;
  name: string;
  basePriceAdd: string | number;
  options: { id: string; name: string; priceAdd: string | number }[];
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

export default function ToppingsPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const businessId = user?.businessId;
  const userOutletId = user?.outletId || '';

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState<string>(userOutletId);

  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing?: Topping }>({ open: false });
  const [name, setName] = useState('');
  const [basePriceAdd, setBasePriceAdd] = useState('0');
  const [options, setOptions] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Topping | null>(null);

  useEffect(() => {
    if (!businessId) return;
    api.get(`/outlets/business/${businessId}`)
      .then(({ data }) => {
        const list = data.data || [];
        setOutlets(list);
        if (!outletId && list.length) setOutletId(list[0].id);
      })
      .catch(() => {});
  }, [businessId]);

  const fetchToppings = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/outlets/${outletId}/toppings`);
      setToppings(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchToppings(); }, [fetchToppings]);

  const openCreate = () => {
    setName('');
    setBasePriceAdd('0');
    setOptions([]);
    setModal({ open: true });
  };
  const openEdit = (t: Topping) => {
    setName(t.name);
    setBasePriceAdd(String(t.basePriceAdd || 0));
    setOptions(t.options.map(o => ({ name: o.name, priceAdd: Number(o.priceAdd) })));
    setModal({ open: true, editing: t });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        basePriceAdd: Number(basePriceAdd) || 0,
        options: options.length ? options.map(o => ({ name: o.name, priceAdd: Number(o.priceAdd) || 0 })) : undefined,
      };
      if (modal.editing) {
        await api.patch(`/outlets/${outletId}/toppings/${modal.editing.id}`, body);
        toast.success('Topping updated');
      } else {
        await api.post(`/outlets/${outletId}/toppings`, body);
        toast.success('Topping created');
      }
      setModal({ open: false });
      fetchToppings();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/outlets/${outletId}/toppings/${deleteTarget.id}`);
      toast.success('Topping deleted');
      setDeleteTarget(null);
      fetchToppings();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  // Outlet-tier admins are pinned to their own outlet — hide the cross-outlet switcher.
  const { tier } = useUserRole();
  const isMultiOutlet = tier !== 'outlet' && outlets.length > 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Toppings</h1>
          <p className="page-subtitle">
            {toppings.length} topping{toppings.length !== 1 ? 's' : ''} — available to all items in this outlet
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isMultiOutlet && (
            <select
              value={outletId}
              onChange={e => setOutletId(e.target.value)}
              className="input py-2 px-3 text-sm font-medium min-w-[180px]"
            >
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={openCreate} disabled={!outletId}>
            <Plus size={15} /> Add Topping
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : toppings.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Sandwich size={40} className="text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No toppings yet</p>
          <p className="text-xs text-slate-400 mt-1">Add toppings here (Cheese, Extra Cheese, Spicy level…) — then attach them to items in the Menu page.</p>
          <button className="btn-primary mt-4" onClick={openCreate}><Plus size={14} /> First topping</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {toppings.map(t => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Base +₹{Number(t.basePriceAdd).toFixed(0)} · {t.options.length} option{t.options.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                  <button onClick={() => setDeleteTarget(t)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                </div>
              </div>
              {t.options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.options.map(o => (
                    <span key={o.id} className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                      {o.name}{Number(o.priceAdd) ? ` · +₹${Number(o.priceAdd).toFixed(0)}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => !saving && setModal({ open: false })}
        title={modal.editing ? 'Edit Topping' : 'New Topping'}
        subtitle="Add options to make this a radio group (e.g. Spicy: Less / Medium / Hot)"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal({ open: false })} disabled={saving}>Cancel</button>
            <button form="top-form" type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {modal.editing ? 'Save Changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="top-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="e.g. Cheese" />
            </Field>
            <Field label="Base price (+₹)">
              <input
                type="number" min="0" step="0.50"
                value={basePriceAdd}
                onChange={e => setBasePriceAdd(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">Options (radio)</label>
              <button
                type="button"
                onClick={() => setOptions(prev => [...prev, { name: '', priceAdd: 0 }])}
                className="text-[11px] font-semibold text-brand-800 hover:text-brand-900"
              >
                + Add option
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">Add 2+ options if customers must choose one (e.g. Less / Medium / Hot). Leave empty for a simple checkbox topping.</p>
            <div className="space-y-2">
              {options.map((o, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    placeholder="Option name (e.g. Medium)"
                    value={o.name}
                    onChange={e => setOptions(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                    className="input flex-1 text-xs"
                  />
                  <input
                    type="number" min="0" step="0.50"
                    placeholder="+₹"
                    value={o.priceAdd}
                    onChange={e => setOptions(prev => prev.map((x, i) => i === idx ? { ...x, priceAdd: Number(e.target.value) || 0 } : x))}
                    className="input w-24 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}
                    className="btn-ghost p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <XIcon size={13} />
                  </button>
                </div>
              ))}
              {options.length === 0 && (
                <p className="text-xs text-slate-400 italic">No options — this is a simple toggle topping.</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete topping"
        message={`Delete "${deleteTarget?.name}"? Items linked to this topping will lose the link.`}
        confirmLabel="Delete"
        danger
        loading={saving}
      />
    </div>
  );
}
