import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Minus, ShoppingBag, Trash2, Banknote, Smartphone,
  Phone, Package, X as XIcon, Search, Lock, Table2,
} from 'lucide-react';
import { RootState } from '../../store';
import api from '../../services/api';
import { allowsSeating } from '../../utils/outletType';

type BookingMode = 'counter' | 'table';

const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span className="inline-flex items-center justify-center shrink-0"
      style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderRadius: 2 }}>
      <span style={{ width: 6, height: 6, background: color, borderRadius: '50%' }} />
    </span>
  );
}

type CartLine = {
  cartLineId: string;
  itemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  gstRate?: number;
};

export default function PlaceOrderPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();
  const outletId = user?.outletId || 'demo-outlet';

  const [menu, setMenu] = useState<any[]>([]);
  const [openStatus, setOpenStatus] = useState<{ isOpen: boolean; reason: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('');
  const [activeSub, setActiveSub] = useState('');
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantPick, setVariantPick] = useState<any>(null);

  const [customerPhone, setCustomerPhone] = useState('');
  const [isParcel, setIsParcel] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Booking mode + table-service state. Only meaningful on Hybrid/Dine-in
  // outlets — for self-service we hide the "Table" tab entirely.
  const [outlet, setOutlet] = useState<any>(null);
  const [tableTypes, setTableTypes] = useState<any[]>([]);
  const [bookingMode, setBookingMode] = useState<BookingMode>('counter');
  const [tableTypeId, setTableTypeId] = useState('');
  const [tableId, setTableId] = useState('');

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const [menuRes, statusRes] = await Promise.all([
        api.get(`/outlets/${outletId}/menu`),
        api.get(`/outlets/${outletId}/open-status`).catch(() => null),
      ]);
      setMenu(menuRes.data.data || []);
      if (menuRes.data.data?.length) {
        setActiveCat(menuRes.data.data[0].id);
        setActiveSub(menuRes.data.data[0].subcategories?.[0]?.id || '');
      }
      if (statusRes) setOpenStatus(statusRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Service staff assignment: when the logged-in user is a worker on one or
  // more service stations at this outlet, the table picker is restricted to
  // the tables of those stations. Empty array = no restriction (admins).
  const [myStationTableIds, setMyStationTableIds] = useState<string[] | null>(null);

  // Fetch outlet meta + its table types (the table-types endpoint already
  // returns each type's active tables, so one call is enough). Also pull
  // the caller's service-station assignments to scope the picker.
  useEffect(() => {
    api.get(`/outlets/${outletId}`).then(({ data }) => setOutlet(data.data)).catch(() => {});
    api.get(`/outlets/${outletId}/table-types`)
      .then(({ data }) => setTableTypes(data.data || []))
      .catch(() => setTableTypes([]));
    api.get(`/outlets/${outletId}/service-stations/mine`)
      .then(({ data }) => {
        const stations = data.data || [];
        if (!stations.length) { setMyStationTableIds(null); return; }
        const ids = stations.flatMap((s: any) => (s.tables || []).map((t: any) => t.tableId));
        setMyStationTableIds(ids);
      })
      .catch(() => setMyStationTableIds(null));
  }, [outletId]);

  const seatingAllowed = allowsSeating(outlet?.outletType);
  // For service staff, hide table types whose tables they aren't assigned
  // to, and clip each remaining type's tables list to only their tables.
  const visibleTableTypes: any[] = (() => {
    if (!myStationTableIds) return tableTypes;
    const allowed = new Set(myStationTableIds);
    return tableTypes
      .map((tt: any) => ({
        ...tt,
        tables: (tt.tables || []).filter((t: any) => allowed.has(t.id)),
      }))
      .filter((tt: any) => tt.tables.length > 0);
  })();
  const selectedTableType = visibleTableTypes.find((t) => t.id === tableTypeId);
  const tablesForType: any[] = selectedTableType?.tables ?? [];
  // Dine-in Postpaid is the only outlet type that gets the open-tab UX.
  const isPostpaidTableFlow = bookingMode === 'table' && outlet?.outletType === 'DINE_IN_POSTPAID';
  const [openOrder, setOpenOrder] = useState<any | null>(null);
  // 'idle' = adding items / placing; 'billing' = Bill Now pressed, show Cash/UPI.
  const [billingState, setBillingState] = useState<'idle' | 'billing'>('idle');

  // Whenever the staff picks a different table on a postpaid flow, refresh
  // the open order so the locked-items list and Bill Now button stay in sync.
  const refreshOpenOrder = useCallback(async () => {
    if (!isPostpaidTableFlow || !tableId) { setOpenOrder(null); return; }
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/open`, { params: { tableId } });
      setOpenOrder(data.data ?? null);
    } catch {
      setOpenOrder(null);
    }
  }, [isPostpaidTableFlow, tableId, outletId]);
  useEffect(() => { refreshOpenOrder(); setBillingState('idle'); }, [refreshOpenOrder]);

  // If the outlet type later changes such that seating is no longer allowed
  // (or types/tables vanish), keep the booking mode coherent.
  useEffect(() => {
    if (!seatingAllowed && bookingMode === 'table') setBookingMode('counter');
  }, [seatingAllowed, bookingMode]);
  useEffect(() => {
    if (tableTypeId && !selectedTableType) { setTableTypeId(''); setTableId(''); }
  }, [tableTypeId, selectedTableType]);
  useEffect(() => {
    if (tableId && !tablesForType.some((t) => t.id === tableId)) setTableId('');
  }, [tableId, tablesForType]);

  useEffect(() => {
    const cat = menu.find(c => c.id === activeCat);
    if (cat?.subcategories?.length) setActiveSub(cat.subcategories[0].id);
  }, [activeCat, menu]);

  // ── Cart ops ─────────────────────────────────────────────
  const lineKey = (itemId: string, variantId?: string) => `${itemId}-${variantId || ''}`;
  const addToCart = (item: any, variant?: any) => {
    const unitPrice = variant
      ? Number(variant.effectivePrice ?? variant.price)
      : Number(item.effectivePrice ?? item.basePrice);
    setCart(prev => {
      const id = lineKey(item.id, variant?.id);
      const hit = prev.find(c => c.cartLineId === id);
      if (hit) return prev.map(c => c.cartLineId === id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        cartLineId: id,
        itemId: item.id,
        variantId: variant?.id,
        name: item.name,
        variantName: variant?.name,
        unitPrice,
        quantity: 1,
        gstRate: item.gstRate != null ? Number(item.gstRate) : 0,
      }];
    });
  };
  const tryAdd = (item: any) => {
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!item.isAvailable) {
      toast.error(`${item.name} is currently not available`);
      return;
    }
    if (item.variants?.length > 1) setVariantPick(item);
    else addToCart(item, item.variants?.[0]);
  };
  const updateQty = (id: string, delta: number) =>
    setCart(prev =>
      prev.map(c => c.cartLineId === id ? { ...c, quantity: c.quantity + delta } : c)
          .filter(c => c.quantity > 0),
    );
  const removeLine = (id: string) => setCart(prev => prev.filter(c => c.cartLineId !== id));

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  // Per-line estimate using the item's gstRate; server recomputes authoritatively.
  const taxAmount = cart.reduce(
    (s, c) => s + c.unitPrice * c.quantity * ((c.gstRate ?? 0) / 100),
    0,
  );
  const totalAmount = subtotal + taxAmount;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ── Place order ──────────────────────────────────────────
  const submit = async (mode: 'CASH' | 'UPI') => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (bookingMode === 'table' && !tableId) {
      toast.error('Pick a table before placing this order');
      return;
    }
    setPlacing(true);
    try {
      const isTableOrder = bookingMode === 'table';
      const { data } = await api.post(`/outlets/${outletId}/orders`, {
        isParcel: isTableOrder ? false : isParcel,
        tableId: isTableOrder ? tableId : undefined,
        items: cart.map(c => ({
          itemId: c.itemId,
          variantId: c.variantId,
          quantity: c.quantity,
        })),
        customerPhone: customerPhone.trim() || undefined,
        paymentMode: mode,
      });
      toast.success(`Order ${data.data.orderNumber} placed`);
      setCart([]);
      setCustomerPhone('');
      setIsParcel(false);
      setTableTypeId('');
      setTableId('');
      navigate('/orders');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  // ── Postpaid (Dine-in Postpaid) handlers ─────────────────────
  const placePostpaid = async () => {
    if (!cart.length) return;
    if (bookingMode !== 'table' || !tableId) {
      toast.error('Pick a table before placing this order');
      return;
    }
    setPlacing(true);
    try {
      const itemsPayload = cart.map(c => ({ itemId: c.itemId, variantId: c.variantId, quantity: c.quantity }));
      if (openOrder) {
        // Append to the open order — no new order number, no payment.
        await api.post(`/outlets/${outletId}/orders/${openOrder.id}/items`, { items: itemsPayload });
        toast.success('Items added to order');
      } else {
        await api.post(`/outlets/${outletId}/orders`, {
          tableId,
          isPostpaid: true,
          items: itemsPayload,
          customerPhone: customerPhone.trim() || undefined,
        });
        toast.success('Order placed — bill stays open');
      }
      setCart([]);
      await refreshOpenOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const pressBillNow = async () => {
    if (!openOrder) return;
    setPlacing(true);
    try {
      const { data } = await api.patch(`/outlets/${outletId}/orders/${openOrder.id}/bill-request`);
      setOpenOrder(data.data);
      setBillingState('billing');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to request bill');
    } finally {
      setPlacing(false);
    }
  };

  const payBill = async (mode: 'CASH' | 'UPI') => {
    if (!openOrder) return;
    setPlacing(true);
    try {
      // Cash auto-confirms server-side; UPI returns a PENDING payment id we
      // immediately confirm because staff just verified the gateway transfer.
      const { data } = await api.post('/payments/initiate', {
        orderId: openOrder.id,
        mode,
        amount: Number(openOrder.totalAmount),
      });
      if (mode === 'UPI' && data?.data?.paymentId) {
        await api.post(`/payments/${data.data.paymentId}/confirm`, { gatewayRef: '' });
      }
      toast.success(`Payment recorded · ₹${Number(openOrder.totalAmount).toFixed(2)}`);
      setOpenOrder(null);
      setBillingState('idle');
      setCart([]);
      setTableTypeId('');
      setTableId('');
      navigate('/orders');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to record payment');
    } finally {
      setPlacing(false);
    }
  };

  const cat = menu.find(c => c.id === activeCat);
  const subs = cat?.subcategories || [];
  const subCurrent = subs.find((s: any) => s.id === activeSub);
  const allItems = subs.flatMap((s: any) => s.items || []);
  // Keep unavailable items in the list — they render as disabled "Currently not available".
  const items = search
    ? allItems.filter((i: any) => i.isDisplayed && i.name?.toLowerCase().includes(search.toLowerCase()))
    : (subCurrent?.items || []).filter((i: any) => i.isDisplayed);

  const outletClosed = !!openStatus && !openStatus.isOpen;

  return (
    <div className="h-[calc(100dvh-64px)] -m-6">
      {outletClosed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800">
          <Lock size={14} className="shrink-0" />
          <p className="text-xs font-semibold">
            Outlet is currently closed{openStatus?.reason ? ` · ${openStatus.reason}` : ''}. Place Order is disabled.
          </p>
        </div>
      )}
      <div className="flex h-full">
        {/* ── Left 70%: menu ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50" style={{ flexBasis: '70%' }}>
          {/* Categories */}
          <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
              {menu.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={clsx(
                    'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0',
                    activeCat === c.id ? 'bg-brand-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="input pl-8 py-1.5 text-sm w-48"
              />
            </div>
          </div>

          {/* Sub + items */}
          <div className="flex-1 flex min-h-0">
            {/* Subcategories */}
            <aside className="w-32 bg-white border-r border-slate-100 overflow-y-auto shrink-0">
              {subs.map((sub: any) => {
                const thumb = sub.imageUrl
                  || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.thumbnailUrl
                  || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.imageUrl;
                const active = activeSub === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => { setActiveSub(sub.id); setSearch(''); }}
                    className={clsx(
                      'flex flex-col items-center w-full px-2 py-3 gap-1.5 border-l-[3px] transition-all',
                      active ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:bg-slate-50',
                    )}
                  >
                    <div className={clsx(
                      'w-14 h-14 rounded-xl overflow-hidden border shrink-0',
                      active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200',
                    )}>
                      {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-slate-100 flex items-center justify-center">🍽️</div>}
                    </div>
                    <span className={clsx('text-[11px] font-semibold leading-tight text-center line-clamp-2',
                      active ? 'text-brand-700' : 'text-slate-600')}>
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </aside>

            {/* Items */}
            <main className="flex-1 overflow-y-auto p-3 space-y-2 min-w-0">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-12">
                  Currently there are no items available
                </p>
              ) : (
                items.map((item: any) => {
                  const lines = cart.filter(c => c.itemId === item.id);
                  const qty = lines.reduce((s, l) => s + l.quantity, 0);
                  const hasVariants = !!item.variants?.length;
                  const lowPrice = hasVariants
                    ? Math.min(...item.variants.map((v: any) => Number(v.effectivePrice ?? v.price)))
                    : Number(item.effectivePrice ?? item.basePrice);
                  const disabled = outletClosed || !item.isAvailable;
                  const disabledReason = outletClosed
                    ? 'Outlet closed'
                    : !item.isAvailable
                      ? 'Currently not available'
                      : null;
                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        'bg-white rounded-2xl border p-3 flex items-center gap-3',
                        disabled ? 'border-slate-100 opacity-60' : 'border-slate-100',
                      )}
                    >
                      {item.thumbnailUrl || item.imageUrl ? (
                        <img src={item.thumbnailUrl || item.imageUrl} alt=""
                          className={clsx('w-14 h-14 rounded-xl object-cover shrink-0', disabled && 'grayscale')} />
                      ) : (
                        <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">🍽️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <FoodGradeDot grade={item.foodGrade} />
                          <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                          {disabledReason && (
                            <span className="inline-flex items-center text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                              {disabledReason}
                            </span>
                          )}
                        </div>
                        {item.shortDescription && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{item.shortDescription}</p>
                        )}
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {hasVariants ? `from ₹${lowPrice.toFixed(0)}` : `₹${lowPrice.toFixed(0)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => tryAdd(item)}
                        disabled={disabled}
                        className={clsx(
                          'shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold',
                          disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-brand-500 hover:bg-brand-600 text-white',
                        )}
                      >
                        <Plus size={12} /> Add{qty > 0 && ` · ${qty}`}
                      </button>
                    </div>
                  );
                })
              )}
            </main>
          </div>
        </div>

        {/* ── Right 30%: cart ────────────────────────────────── */}
        <aside className="w-[30%] min-w-[300px] max-w-[420px] bg-white border-l border-slate-100 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-brand-500" />
              <p className="text-sm font-bold text-slate-900">Cart</p>
              <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                {cartCount} item{cartCount !== 1 ? 's' : ''}
              </span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-[11px] text-slate-400 hover:text-red-500">Clear</button>
            )}
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isPostpaidTableFlow && openOrder?.items?.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock size={11} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Placed · {openOrder.orderNumber}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {openOrder.items.map((oi: any) => (
                    <div key={oi.id} className="bg-slate-100/70 rounded-xl px-3 py-1.5">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {oi.item?.name}{oi.variant?.name ? ` · ${oi.variant.name}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        ₹{Number(oi.unitPrice).toFixed(2)} × {oi.quantity} = ₹{Number(oi.totalPrice).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-3 mb-1.5">New items</p>
                )}
              </div>
            )}
            {cart.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400 italic">
                {openOrder ? 'No new items yet — pick from the menu' : 'No items yet — pick from the menu'}
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(c => (
                  <div key={c.cartLineId} className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                      {c.variantName && <p className="text-[10px] text-slate-400">{c.variantName}</p>}
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold">₹{c.unitPrice.toFixed(2)}</span> × {c.quantity} = <span className="font-bold text-slate-700">₹{(c.unitPrice * c.quantity).toFixed(2)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(c.cartLineId, -1)} className="w-6 h-6 bg-white border border-slate-200 rounded-md flex items-center justify-center"><Minus size={11} /></button>
                      <span className="w-5 text-center text-xs font-bold">{c.quantity}</span>
                      <button onClick={() => updateQty(c.cartLineId, 1)} className="w-6 h-6 bg-brand-500 text-white rounded-md flex items-center justify-center"><Plus size={11} /></button>
                      <button onClick={() => removeLine(c.cartLineId)} className="w-6 h-6 text-slate-400 hover:text-red-500 ml-1"><XIcon size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + CTA */}
          <div className="px-4 py-3 border-t border-slate-100 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {taxAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>SGST <span className="text-[10px] text-slate-400">est.</span></span><span>₹{(taxAmount / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>CGST <span className="text-[10px] text-slate-400">est.</span></span><span>₹{(taxAmount / 2).toFixed(2)}</span></div>
                </>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-100">
                <span>Total</span><span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Booking-mode tabs (only Hybrid / Dine-in outlets see Table). */}
            {seatingAllowed && (
              <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1">
                {(['counter','table'] as BookingMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBookingMode(m)}
                    className={clsx(
                      'text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors',
                      bookingMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {m === 'counter' ? <><Package size={12} /> Counter</> : <><Table2 size={12} /> Table</>}
                  </button>
                ))}
              </div>
            )}

            {bookingMode === 'counter' ? (
              <label className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isParcel} onChange={e => setIsParcel(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <Package size={13} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">Parcel / takeaway</span>
              </label>
            ) : (
              <div className="space-y-2 bg-slate-50 rounded-xl px-3 py-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Table type</label>
                  <select
                    value={tableTypeId}
                    onChange={(e) => { setTableTypeId(e.target.value); setTableId(''); }}
                    className="input text-xs"
                  >
                    <option value="">Select table type…</option>
                    {visibleTableTypes.map((tt) => (
                      <option key={tt.id} value={tt.id}>{tt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Table</label>
                  <select
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    disabled={!tableTypeId}
                    className="input text-xs"
                  >
                    <option value="">
                      {!tableTypeId ? 'Pick a table type first' : tablesForType.length ? 'Select a table…' : 'No tables in this type yet'}
                    </option>
                    {tablesForType.map((t: any) => (
                      <option key={t.id} value={t.id}>Table {t.number} · {t.capacity} pax</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Phone size={10} /> Customer phone <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+91 ..."
                className="input text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">For SMS updates if provided.</p>
            </div>

            <div className="flex flex-col gap-2">
              {isPostpaidTableFlow ? (
                billingState === 'billing' && openOrder ? (
                  <>
                    <button
                      onClick={() => payBill('CASH')}
                      disabled={placing}
                      className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      <Banknote size={14} /> Cash · ₹{Number(openOrder.totalAmount).toFixed(2)}
                    </button>
                    <button
                      onClick={() => payBill('UPI')}
                      disabled={placing}
                      className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Smartphone size={14} /> UPI · ₹{Number(openOrder.totalAmount).toFixed(2)}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={placePostpaid}
                      disabled={!cart.length || placing || outletClosed || !tableId}
                      className="w-full bg-gradient-to-r from-brand-500 to-orange-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      <Plus size={14} /> {openOrder ? 'Add to Order' : 'Place Order'}
                    </button>
                    <button
                      onClick={pressBillNow}
                      disabled={!openOrder || placing}
                      title={!openOrder ? 'Place items first before billing' : undefined}
                      className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Banknote size={14} /> Bill Now{openOrder ? ` · ₹${Number(openOrder.totalAmount).toFixed(2)}` : ''}
                    </button>
                  </>
                )
              ) : (
                <>
                  <button
                    onClick={() => submit('CASH')}
                    disabled={!cart.length || placing || outletClosed || (bookingMode === 'table' && !tableId)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {placing && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <Banknote size={14} /> Cash · ₹{totalAmount.toFixed(2)}
                  </button>
                  <button
                    onClick={() => submit('UPI')}
                    disabled={!cart.length || placing || outletClosed || (bookingMode === 'table' && !tableId)}
                    className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Smartphone size={14} /> UPI · ₹{totalAmount.toFixed(2)}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Variant pick popup */}
      {variantPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setVariantPick(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{variantPick.name}</p>
                <p className="text-xs text-slate-400">Pick a size</p>
              </div>
              <button onClick={() => setVariantPick(null)} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><XIcon size={14} /></button>
            </div>
            <div className="p-4 space-y-2">
              {variantPick.variants.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => { addToCart(variantPick, v); setVariantPick(null); }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span>
                    <span className="text-sm font-semibold text-slate-800">{v.name}</span>
                    {v.shortDescription && <span className="block text-[10px] text-slate-400">{v.shortDescription}</span>}
                  </span>
                  <span className="text-sm font-bold text-slate-900">₹{Number(v.effectivePrice ?? v.price).toFixed(0)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
