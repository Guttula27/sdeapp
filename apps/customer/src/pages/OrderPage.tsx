import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ShoppingCart, Plus, Minus, X, LogOut, Star, Clock, ChevronRight, User, Heart, Lock } from 'lucide-react';
import api from '../services/api';
import { useCustomerAuth } from '../context/CustomerAuthContext';

interface CartTopping {
  toppingId: string;
  optionId?: string;
  label: string;     // human-readable: "Cheese" or "Spicy: Medium"
  priceAdd: number;
}

interface CartItem {
  itemId: string; variantId?: string;
  name: string;   variantName?: string;
  price: number;  quantity: number;
  toppings?: CartTopping[];
  cartLineId: string; // unique per (item+variant+toppings) line
}

export default function OrderPage() {
  const [params] = useSearchParams();
  const navigate  = useNavigate();
  const outletId  = params.get('outlet') || '';
  const tableId   = params.get('table');
  const { user, isLoggedIn } = useCustomerAuth();

  const [menu, setMenu]           = useState<any[]>([]);
  const [openStatus, setOpenStatus] = useState<{ isOpen: boolean; reason: string | null } | null>(null);
  // Outlet meta drives whether we route to /pay (prepaid) or use the open-tab
  // postpaid flow inline. Loaded once on mount.
  const [outletMeta, setOutletMeta] = useState<{ outletType?: string } | null>(null);
  // The open postpaid order on this table — items already submitted, locked
  // from edits, waiting for Bill Now.
  const [openOrder, setOpenOrder] = useState<any | null>(null);
  const [cart, setCart]           = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`cart-${outletId || ''}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showCart, setShowCart]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [placing, setPlacing]     = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSub, setActiveSub] = useState('');
  const [detailItem, setDetailItem] = useState<any>(null);

  // Optimistic favorite toggle on the menu list
  const toggleFavorite = async (item: any) => {
    if (!isLoggedIn) {
      toast('Sign in to save favourites', { icon: '🔐' });
      return;
    }
    const next = !item.isFavorite;
    // Optimistic update
    setMenu(prev => prev.map(c => ({
      ...c,
      subcategories: c.subcategories?.map((s: any) => ({
        ...s,
        items: s.items?.map((it: any) => it.id === item.id ? { ...it, isFavorite: next } : it),
      })),
    })));
    try {
      if (next) await api.post(`/users/me/favorites/${item.id}`);
      else      await api.delete(`/users/me/favorites/${item.id}`);
    } catch {
      // Revert on failure
      setMenu(prev => prev.map(c => ({
        ...c,
        subcategories: c.subcategories?.map((s: any) => ({
          ...s,
          items: s.items?.map((it: any) => it.id === item.id ? { ...it, isFavorite: !next } : it),
        })),
      })));
      toast.error('Failed to update favourite');
    }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/outlets/${outletId}/menu`, { params: tableId ? { tableId } : {} }),
      api.get(`/outlets/${outletId}/open-status`).catch(() => null),
    ])
      .then(([menuRes, statusRes]) => {
        setMenu(menuRes.data.data);
        if (menuRes.data.data.length) {
          setActiveCategory(menuRes.data.data[0].id);
          setActiveSub(menuRes.data.data[0].subcategories?.[0]?.id || '');
        }
        if (statusRes) {
          setOpenStatus(statusRes.data.data);
          // open-status now carries outletType so we don't need an authed
          // /outlets/:id call to know whether this is a postpaid outlet.
          if (statusRes.data.data?.outletType) {
            setOutletMeta({ outletType: statusRes.data.data.outletType });
          }
        }
      })
      .finally(() => setLoading(false));
  }, [outletId]);

  // Postpaid open-tab flow only applies when the customer scanned a table
  // QR on a Dine-in Postpaid outlet. Anything else (counter, parcel, dine-in
  // prepaid, hybrid) keeps the existing prepaid checkout via /pay.
  const isPostpaidTable = !!tableId && outletMeta?.outletType === 'DINE_IN_POSTPAID';

  const refreshOpenOrder = async () => {
    if (!isPostpaidTable || !isLoggedIn) { setOpenOrder(null); return; }
    try {
      const { data } = await api.get(`/outlets/${outletId}/orders/open`, { params: { tableId } });
      setOpenOrder(data.data ?? null);
    } catch {
      setOpenOrder(null);
    }
  };
  useEffect(() => { refreshOpenOrder(); }, [isPostpaidTable, isLoggedIn, outletId, tableId]);

  // When category changes, snap to first subcategory
  useEffect(() => {
    const cat = menu.find(c => c.id === activeCategory);
    if (cat?.subcategories?.length) setActiveSub(cat.subcategories[0].id);
  }, [activeCategory, menu]);

  // Persist cart across navigation (Pay page → back)
  useEffect(() => {
    try { sessionStorage.setItem(`cart-${outletId || ''}`, JSON.stringify(cart)); } catch {}
  }, [cart, outletId]);

  // Topping picker state
  const [toppingPicker, setToppingPicker] = useState<{ item: any; variant?: any } | null>(null);
  const [pickerSelections, setPickerSelections] = useState<Record<string, { optionId?: string; selected: boolean }>>({});

  const cartKey = (l: CartItem) => l.cartLineId;
  const makeLineId = (itemId: string, variantId: string | undefined, toppings: CartTopping[]) =>
    `${itemId}-${variantId || ''}-${toppings.map(t => `${t.toppingId}:${t.optionId || ''}`).sort().join('|')}`;

  const addToCart = (item: any, variant?: any, toppings: CartTopping[] = []) => {
    const basePrice = variant
      ? Number(variant.effectivePrice ?? variant.price)
      : Number(item.effectivePrice ?? item.basePrice);
    const toppingTotal = toppings.reduce((s, t) => s + t.priceAdd, 0);
    const cartLineId = makeLineId(item.id, variant?.id, toppings);
    setCart((prev) => {
      const hit = prev.find((c) => c.cartLineId === cartLineId);
      if (hit) return prev.map((c) => c.cartLineId === cartLineId ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        cartLineId,
        itemId: item.id, variantId: variant?.id,
        name: item.name, variantName: variant?.name,
        price: basePrice + toppingTotal,
        quantity: 1,
        toppings: toppings.length ? toppings : undefined,
      }];
    });
  };

  const tryAddToCart = (item: any, variant?: any) => {
    if (item.itemToppings?.length) {
      // Open picker; initialize each radio topping to its first option
      const init: Record<string, { optionId?: string; selected: boolean }> = {};
      item.itemToppings.forEach((l: any) => {
        if (l.topping.options.length) {
          init[l.toppingId] = {
            optionId: l.isRequired ? l.topping.options[0].id : undefined,
            selected: !!l.isRequired,
          };
        } else {
          init[l.toppingId] = { selected: !!l.isRequired };
        }
      });
      setPickerSelections(init);
      setToppingPicker({ item, variant });
    } else {
      addToCart(item, variant);
    }
  };

  const confirmPicker = () => {
    if (!toppingPicker) return;
    const { item, variant } = toppingPicker;
    const toppings: CartTopping[] = [];
    for (const link of item.itemToppings || []) {
      const sel = pickerSelections[link.toppingId];
      if (!sel?.selected && !link.isRequired) continue;
      const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
      if (link.topping.options.length) {
        const optId = sel?.optionId || link.topping.options[0].id;
        const opt = link.topping.options.find((o: any) => o.id === optId);
        if (!opt) continue;
        toppings.push({
          toppingId: link.toppingId,
          optionId: opt.id,
          label: `${link.topping.name}: ${opt.name}`,
          priceAdd: basePriceAdd + Number(opt.priceAdd),
        });
      } else {
        toppings.push({
          toppingId: link.toppingId,
          label: link.topping.name,
          priceAdd: basePriceAdd,
        });
      }
    }
    addToCart(item, variant, toppings);
    setToppingPicker(null);
    setPickerSelections({});
  };

  const updateQty = (lineId: string, delta: number) =>
    setCart((prev) =>
      prev.map((c) => c.cartLineId === lineId ? { ...c, quantity: c.quantity + delta } : c)
          .filter((c) => c.quantity > 0)
    );

  const [isParcel, setIsParcel] = useState(false);

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  // Estimate per-line GST from the menu (server recomputes authoritatively).
  const taxAmount = cart.reduce((s, c) => {
    let rate = 0;
    for (const cat of menu) for (const sub of cat.subcategories || []) for (const it of sub.items || []) {
      if (it.id === c.itemId && it.gstRate != null) rate = Number(it.gstRate);
    }
    return s + c.price * c.quantity * (rate / 100);
  }, 0);
  // Parcel charge preview is computed authoritatively on the server; here we estimate using item-level overrides
  // (universal outlet charge isn't fetched on the customer side, server will add it on order creation)
  const parcelPreview = isParcel
    ? cart.reduce((s, c) => {
        // Look up the menu item to detect a custom per-item parcel charge
        for (const cat of menu) for (const sub of cat.subcategories || []) for (const it of sub.items || []) {
          if (it.id === c.itemId && it.useCustomParcelCharge && it.parcelCharge != null) {
            return s + Number(it.parcelCharge) * c.quantity;
          }
        }
        return s;
      }, 0)
    : 0;
  const cartTotal = subtotal + taxAmount + parcelPreview;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const goToPay = () => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!isLoggedIn) {
      toast('Sign in to continue', { icon: '🔐' });
      navigate('/auth', { state: { from: `/order${window.location.search}` } });
      return;
    }
    navigate('/pay', {
      state: {
        outletId,
        tableId,
        cart,
        isParcel,
        subtotal,
        taxAmount,
        parcelPreview,
        total: cartTotal,
      },
    });
  };

  // Postpaid: place items without payment; open tab keeps accepting more
  // items until the customer hits Bill Now (which routes to /pay).
  const placePostpaid = async () => {
    if (!cart.length) return;
    if (openStatus && !openStatus.isOpen) {
      toast.error(`Outlet is currently closed${openStatus.reason ? ` · ${openStatus.reason}` : ''}`);
      return;
    }
    if (!isLoggedIn) {
      toast('Sign in to continue', { icon: '🔐' });
      navigate('/auth', { state: { from: `/order${window.location.search}` } });
      return;
    }
    setPlacing(true);
    try {
      const itemsPayload = cart.map((c) => ({
        itemId: c.itemId,
        variantId: c.variantId,
        quantity: c.quantity,
        toppings: c.toppings?.map((t) => ({ toppingId: t.toppingId, optionId: t.optionId })) || undefined,
      }));
      if (openOrder) {
        await api.post(`/outlets/${outletId}/orders/${openOrder.id}/items`, { items: itemsPayload });
        toast.success('Items added to your tab');
      } else {
        await api.post(`/outlets/${outletId}/orders`, {
          tableId,
          isPostpaid: true,
          items: itemsPayload,
        });
        toast.success('Tab opened — keep ordering');
      }
      setCart([]);
      setShowCart(false);
      try { sessionStorage.removeItem(`cart-${outletId}`); } catch {}
      await refreshOpenOrder();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const goBillNow = () => {
    if (!openOrder) return;
    navigate('/pay', {
      state: {
        outletId,
        tableId,
        billOrderId: openOrder.id,
        total: Number(openOrder.totalAmount),
        outletName: openOrder.outlet?.name,
      },
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-dvh bg-white">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 font-medium">Loading menu…</p>
      </div>
    </div>
  );

  const activeCat = menu.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* ── Open tab banner (Dine-in Postpaid only) ─────────────── */}
      {isPostpaidTable && openOrder && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Your tab</p>
            <p className="text-xs text-emerald-900 truncate">
              {openOrder.items?.length || 0} item{(openOrder.items?.length || 0) === 1 ? '' : 's'} · ₹{Number(openOrder.totalAmount).toFixed(2)}
            </p>
          </div>
          <button
            onClick={goBillNow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow"
          >
            Bill Now →
          </button>
        </div>
      )}
      {/* ── Sticky header ────────────────────────────────────── */}
      <div className={clsx('bg-white sticky z-20 shadow-sm', isPostpaidTable && openOrder ? 'top-[52px]' : 'top-0')}>
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cart.length > 0 && !window.confirm('Leave and clear cart?')) return;
                navigate('/');
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <LogOut size={17} />
            </button>
            <div>
              <p className="font-bold text-slate-900 text-base leading-tight">Menu</p>
              {tableId && (
                <p className="text-xs text-slate-400">Table {tableId.replace('table-', 'T')}</p>
              )}
            </div>
          </div>

          {/* Right side: user avatar or login */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/profile')}
                className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-400 rounded-full flex items-center justify-center text-white font-black text-sm"
                title={`Signed in as ${user?.name}`}
              >
                {user?.name?.[0]}
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth', { state: { from: `/order${window.location.search}` } })}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <User size={12} /> Sign in
              </button>
            )}
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm"
            >
              <ShoppingCart size={16} />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory('__special__')}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all inline-flex items-center gap-1',
              activeCategory === '__special__'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
            )}
          >
            ⭐ Special
          </button>
          {menu.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all',
                activeCategory === cat.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Outlet-closed banner ─────────────────────────────── */}
      {openStatus && !openStatus.isOpen && (
        <div className="bg-amber-50 border-y border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-800">
          <Lock size={14} className="shrink-0" />
          <p className="text-xs font-semibold">
            Outlet is currently closed{openStatus.reason ? ` · ${openStatus.reason}` : ''}. You can browse the menu but ordering is disabled.
          </p>
        </div>
      )}

      {/* ── Menu content (3-pane) ────────────────────────────── */}
      <div className="flex-1 flex min-h-0 pb-24">
        {activeCategory === '__special__' ? (
          <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-w-0">
            {(() => {
              const specialItems = menu
                .flatMap((c: any) => c.subcategories?.flatMap((s: any) => s.items || []) || [])
                .filter((i: any) => i.isDisplayed && i.isSpecial);
              if (specialItems.length === 0) {
                return <p className="text-sm text-slate-400 italic text-center py-12">No specials right now</p>;
              }
              const outletClosed = openStatus && !openStatus.isOpen;
              return specialItems.map((item: any) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  qty={cart.filter(c => c.itemId === item.id).reduce((s, l) => s + l.quantity, 0)}
                  disabled={outletClosed || !item.isAvailable}
                  disabledReason={outletClosed ? 'Outlet closed' : !item.isAvailable ? 'Currently not available' : null}
                  onOpen={() => navigate(`/order/item/${item.id}?outlet=${outletId}`, { state: { item, outletId } })}
                  onQuickAdd={(e) => {
                    e.stopPropagation();
                    if (!item.variants?.length) {
                      addToCart(item);
                      toast.success(`Added ${item.name}`);
                    } else {
                      setDetailItem(item);
                    }
                  }}
                  onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(item); }}
                />
              ));
            })()}
          </main>
        ) : (
        <>
        {/* Left: subcategories with thumbnail */}
        <aside className="w-24 sm:w-28 bg-white border-r border-slate-100 overflow-y-auto shrink-0">
          {activeCat?.subcategories?.map((sub: any) => {
            const thumb = sub.imageUrl
              || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.thumbnailUrl
              || sub.items?.find((i: any) => i.thumbnailUrl || i.imageUrl)?.imageUrl;
            const active = activeSub === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSub(sub.id)}
                className={clsx(
                  'flex flex-col items-center w-full px-2 py-3 gap-1.5 border-l-[3px] transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50/60'
                    : 'border-transparent hover:bg-slate-50',
                )}
              >
                <div className={clsx(
                  'w-14 h-14 rounded-xl overflow-hidden border shrink-0',
                  active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200',
                )}>
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-base">
                      🍽️
                    </div>
                  )}
                </div>
                <span className={clsx(
                  'text-[11px] font-semibold leading-tight text-center line-clamp-2',
                  active ? 'text-brand-700' : 'text-slate-600',
                )}>
                  {sub.name}
                </span>
              </button>
            );
          })}
          {!activeCat?.subcategories?.length && (
            <p className="px-3 py-3 text-[11px] text-slate-400 italic">
              Currently there are no items available
            </p>
          )}
        </aside>

        {/* Right: items in selected subcategory */}
        <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-w-0">
          {(() => {
            const sub = activeCat?.subcategories?.find((s: any) => s.id === activeSub);
            const items = (sub?.items || []).filter((i: any) => i.isDisplayed);
            if (items.length === 0) {
              return (
                <p className="text-sm text-slate-400 italic text-center py-12">
                  Currently there are no items available
                </p>
              );
            }
            const outletClosed = openStatus && !openStatus.isOpen;
            return items.map((item: any) => (
              <MenuItemRow
                key={item.id}
                item={item}
                qty={cart.filter(c => c.itemId === item.id).reduce((s, l) => s + l.quantity, 0)}
                disabled={outletClosed || !item.isAvailable}
                disabledReason={outletClosed ? 'Outlet closed' : !item.isAvailable ? 'Currently not available' : null}
                onOpen={() => navigate(`/order/item/${item.id}?outlet=${outletId}`, { state: { item, outletId } })}
                onQuickAdd={(e) => {
                  e.stopPropagation();
                  if (!item.variants?.length) {
                    addToCart(item);
                    toast.success(`Added ${item.name}`);
                  } else {
                    setDetailItem(item);
                  }
                }}
                onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(item); }}
              />
            ));
          })()}
        </main>
        </>
        )}
      </div>

      {/* ── Floating cart button ─────────────────────────────── */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-24 inset-x-4 z-40 max-w-[440px] mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-gradient-to-r from-brand-500 to-orange-400 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center px-5"
          >
            <span className="bg-white/20 rounded-xl w-7 h-7 flex items-center justify-center text-sm font-black mr-3">
              {cartCount}
            </span>
            <span className="flex-1 text-left">View Cart</span>
            <span className="font-black text-lg">₹{cartTotal.toFixed(2)}</span>
            <ChevronRight size={18} className="ml-1" />
          </button>
        </div>
      )}

      {/* ── Cart sheet ───────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-t-3xl shadow-sheet max-h-[80dvh] flex flex-col animate-[slideUp_.25s_ease-out]"
            style={{ animation: 'slideUp .25s ease-out' }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-900">Your Order</p>
                <p className="text-xs text-slate-400 mt-0.5">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl">
                <X size={16} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {isPostpaidTable && openOrder?.items?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock size={11} className="text-slate-400" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Already on tab</p>
                  </div>
                  {openOrder.items.map((oi: any) => (
                    <div key={oi.id} className="flex items-center justify-between">
                      <p className="text-xs text-slate-700 truncate">
                        {oi.item?.name}{oi.variant?.name ? ` · ${oi.variant.name}` : ''}
                        <span className="text-slate-400"> × {oi.quantity}</span>
                      </p>
                      <p className="text-xs font-bold text-slate-600">₹{Number(oi.totalPrice).toFixed(2)}</p>
                    </div>
                  ))}
                  {cart.length > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-2 border-t border-slate-200">New items</p>
                  )}
                </div>
              )}
              {cart.map((item) => (
                <div key={item.cartLineId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    {item.variantName && <p className="text-xs text-slate-400">{item.variantName}</p>}
                    {item.toppings?.length && (
                      <p className="text-[11px] text-indigo-600 mt-0.5">+ {item.toppings.map(t => t.label).join(', ')}</p>
                    )}
                    <p className="text-sm font-bold text-brand-600 mt-0.5">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.cartLineId, -1)} className="w-8 h-8 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center font-bold text-sm text-slate-900">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartLineId, 1)} className="w-8 h-8 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + CTA */}
            <div className="px-5 pt-4 pb-6 border-t border-slate-100 space-y-3 safe-bottom">
              <label className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isParcel} onChange={e => setIsParcel(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm font-medium text-slate-700">Order for parcel / takeaway</span>
              </label>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>SGST <span className="text-[10px] text-slate-400">est.</span></span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>CGST <span className="text-[10px] text-slate-400">est.</span></span>
                      <span>₹{(taxAmount / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {isParcel && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Parcel charges<span className="text-[10px] text-slate-400 ml-1">est.</span></span>
                    <span>₹{parcelPreview.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 text-lg pt-1 border-t border-slate-100">
                  <span>Total</span><span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={isPostpaidTable ? placePostpaid : goToPay}
                disabled={placing || (!!openStatus && !openStatus.isOpen)}
                className="w-full bg-gradient-to-r from-brand-500 to-orange-400 text-white font-bold py-4 rounded-2xl text-base shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[.98]"
              >
                {openStatus && !openStatus.isOpen
                  ? 'Outlet closed'
                  : isPostpaidTable
                    ? (openOrder ? 'Add to my tab →' : 'Place order →')
                    : 'Pay & place order →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item detail bottom-sheet (half-screen) */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onAdd={(variant, toppings, qty) => {
            for (let i = 0; i < qty; i++) addToCart(detailItem, variant, toppings);
            setDetailItem(null);
            setShowCart(true);
          }}
        />
      )}
    </div>
  );
}

/* ── Compact menu row (right pane) ────────────────────────── */
const FOOD_GRADE_COLOR: Record<string, string> = { VEG: '#16a34a', NON_VEG: '#dc2626', VEGAN: '#0d9488' };
function FoodGradeDot({ grade }: { grade?: string }) {
  const color = FOOD_GRADE_COLOR[grade || 'VEG'];
  return (
    <span
      title={(grade || 'VEG').replace('_', '-')}
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderRadius: 2 }}
    >
      <span style={{ width: 6, height: 6, background: color, borderRadius: '50%' }} />
    </span>
  );
}

function MenuItemRow({ item, qty, onOpen, onQuickAdd, onToggleFavorite, disabled, disabledReason }: {
  item: any; qty: number;
  onOpen: () => void;
  onQuickAdd: (e: React.MouseEvent) => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const hasVariants = !!item.variants?.length;
  const lowPrice = hasVariants
    ? Math.min(...item.variants.map((v: any) => Number(v.effectivePrice ?? v.price)))
    : Number(item.effectivePrice ?? item.basePrice);
  return (
    <div
      onClick={disabled ? undefined : onOpen}
      role="button" tabIndex={disabled ? -1 : 0}
      className={clsx(
        'w-full text-left bg-white rounded-2xl border shadow-card overflow-hidden transition-colors',
        disabled
          ? 'border-slate-100 opacity-60 cursor-not-allowed'
          : 'border-slate-100 hover:border-brand-200 cursor-pointer',
      )}
    >
      <div className="flex gap-3 p-3 items-center">
        {item.thumbnailUrl || item.imageUrl ? (
          <img src={item.thumbnailUrl || item.imageUrl} alt={item.name}
            className={clsx('w-16 h-16 rounded-xl object-cover shrink-0', disabled && 'grayscale')} />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl shrink-0 flex items-center justify-center">
            <span className="text-xl">🍽️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <FoodGradeDot grade={item.foodGrade} />
            <p className="text-sm font-bold text-slate-900 leading-tight truncate">{item.name}</p>
            {item.isPopular && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">
                <Star size={8} fill="currentColor" /> Popular
              </span>
            )}
            {item.isSpecial && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full">
                ⭐ Special
              </span>
            )}
            {disabled && disabledReason && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">
                {disabledReason}
              </span>
            )}
          </div>
          {item.shortDescription && (
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.shortDescription}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-black text-slate-900">{hasVariants ? `from ₹${lowPrice.toFixed(0)}` : `₹${lowPrice.toFixed(0)}`}</span>
            {item.ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                <Star size={9} fill="currentColor" className="text-amber-500" />
                {item.ratingAvg.toFixed(1)}
                <span className="text-slate-400 font-normal">({item.ratingCount})</span>
              </span>
            )}
            {item.itemToppings?.length > 0 && <span className="text-[10px] text-indigo-600 font-semibold">+ toppings</span>}
            {item.preparationTime && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} /> {item.preparationTime}m</span>}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                item.isFavorite ? 'bg-red-50 text-red-500' : 'text-slate-300 hover:text-red-400 hover:bg-red-50',
              )}
              title={item.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Heart size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            onClick={onQuickAdd}
            disabled={disabled}
            className={clsx(
              'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
              disabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-brand-500 hover:bg-brand-600 text-white',
            )}
          >
            <Plus size={12} /> Add{qty > 0 && ` · ${qty}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Item detail half-screen modal ────────────────────────── */
function ItemDetailModal({
  item, onClose, onAdd,
}: {
  item: any;
  onClose: () => void;
  onAdd: (variant: any | undefined, toppings: CartTopping[], qty: number) => void;
}) {
  const [variantId, setVariantId] = useState<string | ''>(item.variants?.[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [topSel, setTopSel] = useState<Record<string, { selected: boolean; optionId?: string }>>(() => {
    const init: Record<string, { selected: boolean; optionId?: string }> = {};
    (item.itemToppings || []).forEach((l: any) => {
      if (l.topping.options.length) {
        init[l.toppingId] = { selected: !!l.isRequired, optionId: l.isRequired ? l.topping.options[0].id : undefined };
      } else {
        init[l.toppingId] = { selected: !!l.isRequired };
      }
    });
    return init;
  });

  const variant = item.variants?.find((v: any) => v.id === variantId);
  const basePrice = variant ? Number(variant.effectivePrice ?? variant.price) : Number(item.effectivePrice ?? item.basePrice);
  const toppings: CartTopping[] = [];
  for (const link of item.itemToppings || []) {
    const sel = topSel[link.toppingId];
    if (!sel?.selected && !link.isRequired) continue;
    const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
    if (link.topping.options.length) {
      const optId = sel?.optionId || link.topping.options[0].id;
      const opt = link.topping.options.find((o: any) => o.id === optId);
      if (!opt) continue;
      toppings.push({ toppingId: link.toppingId, optionId: opt.id, label: `${link.topping.name}: ${opt.name}`, priceAdd: basePriceAdd + Number(opt.priceAdd) });
    } else {
      toppings.push({ toppingId: link.toppingId, label: link.topping.name, priceAdd: basePriceAdd });
    }
  }
  const lineTotal = (basePrice + toppings.reduce((s, t) => s + t.priceAdd, 0)) * qty;
  const galleryImages = [item.imageUrl, ...(item.images?.map((g: any) => g.url) || [])].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[80%]" onClick={e => e.stopPropagation()}>
        {/* Header image */}
        <div className="relative">
          {galleryImages.length > 0 ? (
            <div className="flex overflow-x-auto snap-x snap-mandatory rounded-t-3xl">
              {galleryImages.map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-full snap-center shrink-0 h-48 object-cover" />
              ))}
            </div>
          ) : (
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center rounded-t-3xl">
              <span className="text-5xl">🍽️</span>
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <FoodGradeDot grade={item.foodGrade} />
              <h3 className="text-base font-bold text-slate-900">{item.name}</h3>
              {item.isPopular && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Popular</span>}
            </div>
            {(item.longDescription || item.shortDescription || item.description) && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {item.longDescription || item.shortDescription || item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
              {item.preparationTime && <span className="flex items-center gap-1"><Clock size={10} /> {item.preparationTime} min</span>}
              {item.parcelAvailable ? <span>Parcel available</span> : <span className="text-red-500">Not available for parcel</span>}
            </div>
          </div>

          {/* Variants */}
          {item.variants?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Choose size</p>
              <div className="space-y-1.5">
                {item.variants.map((v: any) => {
                  const price = Number(v.effectivePrice ?? v.price);
                  const checked = variantId === v.id;
                  return (
                    <label key={v.id} className={clsx(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer',
                      checked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100',
                    )}>
                      <span className="flex items-center gap-2">
                        <input type="radio" name="variant" checked={checked} onChange={() => setVariantId(v.id)} className="accent-brand-500" />
                        <span>
                          <span className="text-sm font-semibold text-slate-800">{v.name}</span>
                          {v.shortDescription && <span className="block text-[10px] text-slate-400">{v.shortDescription}</span>}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-slate-900">₹{price.toFixed(0)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toppings */}
          {item.itemToppings?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Toppings</p>
              <div className="space-y-2">
                {item.itemToppings.map((link: any) => {
                  const sel = topSel[link.toppingId] || { selected: false };
                  const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
                  const isRadio = link.topping.options.length > 0;
                  return (
                    <div key={link.toppingId} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-800">
                          {link.topping.name}{link.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {!isRadio && (
                          <input
                            type="checkbox"
                            disabled={link.isRequired}
                            checked={sel.selected}
                            onChange={e => setTopSel(p => ({ ...p, [link.toppingId]: { ...sel, selected: e.target.checked } }))}
                            className="w-5 h-5 accent-brand-500 rounded"
                          />
                        )}
                      </div>
                      {!isRadio && <p className="text-[11px] text-slate-400">+₹{basePriceAdd.toFixed(0)}</p>}
                      {isRadio && (
                        <div className="space-y-1.5 mt-1">
                          {link.topping.options.map((opt: any) => {
                            const checked = sel.optionId === opt.id;
                            return (
                              <label key={opt.id} className={clsx(
                                'flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white border cursor-pointer',
                                checked ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-100',
                              )}>
                                <span className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`topping-${link.toppingId}`}
                                    checked={checked}
                                    onChange={() => setTopSel(p => ({ ...p, [link.toppingId]: { optionId: opt.id, selected: true } }))}
                                    className="accent-brand-500"
                                  />
                                  <span className="text-sm text-slate-700">{opt.name}</span>
                                </span>
                                <span className="text-xs font-bold text-slate-500">+₹{(basePriceAdd + Number(opt.priceAdd)).toFixed(0)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-slate-700">Quantity</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Minus size={14} /></button>
              <span className="w-6 text-center font-bold text-sm">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 bg-brand-500 text-white rounded-lg flex items-center justify-center"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-base font-bold text-slate-900">₹{lineTotal.toFixed(0)}</span>
          <button
            onClick={() => onAdd(variant, toppings, qty)}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-2xl text-sm font-bold shadow-md"
          >
            Add {qty} to cart · ₹{lineTotal.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}

