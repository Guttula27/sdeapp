import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Minus, ShoppingBag, Search, Package } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

type Variant = { id: string; name: string; price: number; isAvailable: boolean };
type Item = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  variants?: Variant[];
};
type Subcategory = { id: string; name: string; items: Item[] };
type Category = { id: string; name: string; subcategories: Subcategory[] };

type CartLine = { itemId: string; variantId?: string; name: string; price: number; quantity: number };

interface Props {
  open: boolean;
  onClose: () => void;
  outletId: string;
  onCreated: (order: any) => void;
}

export default function NewOrderModal({ open, onClose, outletId, onCreated }: Props) {
  const [menu, setMenu] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [isParcel, setIsParcel] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get(`/outlets/${outletId}/menu`)
      .then((r) => setMenu(r.data.data || []))
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [open, outletId]);

  useEffect(() => {
    if (!open) {
      setCart({});
      setIsParcel(false);
      setNotes('');
      setSearch('');
    }
  }, [open]);

  const lineKey = (itemId: string, variantId?: string) => `${itemId}::${variantId || ''}`;

  const addLine = (item: Item, variant?: Variant) => {
    const key = lineKey(item.id, variant?.id);
    const price = Number(variant?.price ?? item.basePrice);
    setCart((c) => {
      const existing = c[key];
      return {
        ...c,
        [key]: existing
          ? { ...existing, quantity: existing.quantity + 1 }
          : {
              itemId: item.id,
              variantId: variant?.id,
              name: variant ? `${item.name} · ${variant.name}` : item.name,
              price,
              quantity: 1,
            },
      };
    });
  };

  const removeLine = (key: string) => {
    setCart((c) => {
      const cur = c[key];
      if (!cur) return c;
      if (cur.quantity <= 1) {
        const { [key]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [key]: { ...cur, quantity: cur.quantity - 1 } };
    });
  };

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menu;
    return menu
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories
          .map((sub) => ({
            ...sub,
            items: sub.items.filter((i) => i.name.toLowerCase().includes(q)),
          }))
          .filter((sub) => sub.items.length > 0),
      }))
      .filter((cat) => cat.subcategories.length > 0);
  }, [menu, search]);

  const lines = Object.entries(cart);
  const total = lines.reduce((s, [, l]) => s + l.price * l.quantity, 0);

  const submit = async () => {
    if (lines.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/outlets/${outletId}/orders`, {
        items: lines.map(([, l]) => ({
          itemId: l.itemId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        isParcel,
        notes: notes.trim() || undefined,
      });
      toast.success(`Order ${data.data?.orderNumber || 'created'}`);
      onCreated(data.data);
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="New Order"
      subtitle="Place an order on behalf of a customer at the counter"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={submitting || lines.length === 0}>
            <ShoppingBag size={14} />
            {submitting ? 'Placing…' : `Place order · ₹${total.toFixed(0)}`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
        {/* Menu picker */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="input pl-9"
            />
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading menu…</p>
          ) : filteredMenu.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No items match.</p>
          ) : (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {filteredMenu.map((cat) => (
                <div key={cat.id}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {cat.name}
                  </p>
                  {cat.subcategories.map((sub) => (
                    <div key={sub.id} className="mb-3">
                      <p className="text-[10px] font-semibold text-slate-400 mb-1">{sub.name}</p>
                      <div className="space-y-1.5">
                        {sub.items.map((item) => {
                          const hasVariants = (item.variants?.length ?? 0) > 0;
                          const inCartCount = lines
                            .filter(([k]) => k.startsWith(`${item.id}::`))
                            .reduce((s, [, l]) => s + l.quantity, 0);
                          return (
                            <div
                              key={item.id}
                              className={clsx(
                                'rounded-lg border px-3 py-2 flex items-center justify-between gap-2',
                                item.isAvailable
                                  ? 'border-slate-200 bg-white'
                                  : 'border-red-100 bg-red-50/40 opacity-70',
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  ₹{Number(item.basePrice).toFixed(0)}
                                  {!item.isAvailable && ' · unavailable'}
                                </p>
                              </div>
                              {item.isAvailable && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {hasVariants ? (
                                    item.variants!
                                      .filter((v) => v.isAvailable)
                                      .map((v) => (
                                        <button
                                          key={v.id}
                                          onClick={() => addLine(item, v)}
                                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-brand-50 text-brand-900 border border-brand-200 hover:bg-brand-100"
                                        >
                                          + {v.name} ₹{Number(v.price).toFixed(0)}
                                        </button>
                                      ))
                                  ) : (
                                    <button
                                      onClick={() => addLine(item)}
                                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-brand-700 text-white hover:bg-brand-800"
                                    >
                                      <Plus size={11} />
                                      Add
                                    </button>
                                  )}
                                  {inCartCount > 0 && (
                                    <span className="text-[10px] font-bold text-brand-900 bg-brand-100 rounded-full w-4 h-4 inline-flex items-center justify-center">
                                      {inCartCount}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Cart {lines.length > 0 && <span className="text-brand-800">({lines.length})</span>}
          </p>

          {lines.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No items yet.</p>
          ) : (
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {lines.map(([key, l]) => (
                <div key={key} className="bg-white rounded-lg px-2.5 py-2 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-800 truncate">{l.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-500">₹{l.price.toFixed(0)} ea</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeLine(key)}
                        className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[14px] text-center">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() =>
                          setCart((c) => ({ ...c, [key]: { ...l, quantity: l.quantity + 1 } }))
                        }
                        className="w-5 h-5 rounded-md bg-gold-500 hover:bg-gold-600 text-charcoal-900 inline-flex items-center justify-center"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isParcel}
                onChange={(e) => setIsParcel(e.target.checked)}
                className="rounded"
              />
              <Package size={12} /> Parcel / takeaway
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="input text-xs resize-none"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">Total</span>
              <span className="text-sm font-bold text-slate-900">₹{total.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
